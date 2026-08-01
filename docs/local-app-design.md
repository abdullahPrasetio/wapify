# Wapbolt Local — Design Document

> **Status**: Draft v1 — 2026-07-31
> **Keputusan produk**: storage lokal pakai `better-sqlite3` di Electron main process (tanpa backend Go), sync **manual** via tombol "Sync Now", konflik **tidak pernah auto-resolve** (wajib dipilih user, kalau tidak dipilih tetap pending).

---

## 1. Tujuan & Non-Tujuan

### Tujuan
1. App desktop terpisah (**Wapbolt Local**) dengan **tampilan 100% identik** dengan Wapbolt sekarang.
2. **Semua data disimpan lokal** (SQLite) — app berfungsi penuh tanpa server, tanpa login, tanpa internet.
3. Bisa **sinkron dua arah** dengan server Wapbolt yang ada sekarang (backend Go + Postgres) lewat REST API existing, dipicu manual oleh user.
4. Bugfix/bugfix UI di app utama semudah mungkin ikut ke app lokal (shared package, bukan copy-paste).

### Non-Tujuan (v1)
- ❌ Realtime collaboration (WS presence, request locking) — server-only, jadi no-op di mode lokal.
- ❌ Auto-sync background / sync scheduler.
- ❌ Sync untuk history, comments, activity log, notifications, mock server (local-only dulu).
- ❌ Multi-user di satu instance lokal.
- ❌ CRDT / auto-merge konflik.

---

## 2. Arsitektur Tingkat Tinggi

### Sekarang (Wapbolt Cloud)

```
┌─────────────────────────── Electron ───────────────────────────┐
│  Renderer (React + zustand)                                    │
│    useDataStore ──► apiClient (api/client.ts)                  │
│                        │ window.api.wapboltRequest (IPC)       │
│  Main Process ─────────┼──────────► HTTP ──► Go backend ──► PG │
└────────────────────────┴───────────────────────────────────────┘
```

### Wapbolt Local (baru)

```
┌─────────────────────────── Electron ───────────────────────────┐
│  Renderer (React + zustand)  ← SAMA PERSIS, dari ui-shared     │
│    useDataStore ──► apiClient                                  │
│                        │ window.api.wapboltRequest (IPC)       │
│  Main Process                                                  │
│    ┌───────────────────▼────────────────────┐                  │
│    │ LocalRouter (TS)                       │                  │
│    │  match(method, path) ──► handler       │                  │
│    │  handler ──► repository ──► SQLite     │                  │
│    │  return { status, data, headers,       │                  │
│    │           timing }  ← shape identik    │                  │
│    │           dgn response Go backend      │                  │
│    └────────────────────────────────────────┘                  │
│    SyncEngine ──(hanya saat "Sync Now")──► HTTP ──► Go backend │
└────────────────────────────────────────────────────────────────┘
```

**Titik potong kuncinya**: `window.api.wapboltRequest` di preload. Di app utama IPC handler ini mem-forward ke HTTP; di Wapbolt Local, jika URL menuju base URL Wapbolt (`/api/v1/...`), handler me-route ke `LocalRouter` alih-alih ke jaringan. Request ke **target API arbitrary** (tombol "Send" di request builder, `executeRequest` dengan `skipAuth: true`) **tetap lewat HTTP seperti biasa** — itu memang fungsi utama aplikasinya.

```ts
// main/ipc.ts (desktop-local)
ipcMain.handle('wapbolt-request', async (_e, config) => {
  if (isWapboltApiUrl(config.url)) {
    return localRouter.handle(config)   // ← SQLite, tidak pernah ke network
  }
  return httpExecute(config)            // ← request user ke API target, tetap network
})
```

Dengan cara ini `api/client.ts`, `useDataStore.ts`, dan seluruh komponen React **tidak berubah satu baris pun**.

---

## 3. Struktur Monorepo

```
apps/
  desktop/            # existing — Wapbolt Cloud client
  desktop-local/      # BARU — Wapbolt Local
    src/
      main/
        index.ts          # bootstrap electron, spawn window
        ipc.ts            # ipcMain.handle('wapbolt-request') → LocalRouter / HTTP
        local/
          db.ts           # koneksi better-sqlite3 + migrasi
          migrations/     # file .sql bernomor (001_init.sql, ...)
          router.ts       # LocalRouter: tabel route → handler
          handlers/       # satu file per resource (teams.ts, collections.ts, ...)
          repo/           # query SQLite per tabel
          seed.ts         # first-run: local user + local team default
        sync/
          engine.ts       # orchestrator push/pull
          push.ts         # kirim row dirty → REST server
          pull.ts         # tarik perubahan server → upsert lokal
          conflict.ts     # deteksi & antrian konflik
          auth.ts         # login/token khusus sesi sync
      preload/            # sama dengan desktop (expose window.api)
      renderer/           # shell tipis: import dari @wapbolt/ui-shared
  landing-page/
  license-server/
packages/
  ui-shared/          # BARU — extract dari apps/desktop/src/renderer
    src/
      components/     # semua komponen React
      store/          # useDataStore, useAppStore, useAuthStore, useNotificationStore
      api/            # client.ts
      types/
```

### Strategi ekstraksi `ui-shared`
1. Pindahkan `apps/desktop/src/renderer/src/{components,store,api,types,utils,...}` → `packages/ui-shared/src/`.
2. `apps/desktop/src/renderer` menjadi shell tipis (entry + import App dari ui-shared). Vite alias `@wapbolt/ui-shared` → source langsung (tanpa build step terpisah, TS project references).
3. `apps/desktop-local/src/renderer` shell serupa, plus **feature-flag injection** (lihat §7).

> ⚠️ Ini refactor terbesar dan paling berisiko regresi di fase awal. Wajib dikerjakan sebagai fase tersendiri dengan QA app utama sebelum menyentuh fitur lokal sama sekali.

---

## 4. Skema SQLite

Mirror 1:1 dari `backend/internal/repository/models.go`, dengan konversi tipe:

| Postgres/GORM | SQLite |
|---|---|
| `bigserial` / `uint` PK | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `jsonb` | `TEXT` (JSON string; parse/stringify di layer repo) |
| `timestamptz` | `TEXT` (ISO-8601, UTC — format sama dengan JSON response Go agar renderer tak bisa membedakan) |
| `boolean` | `INTEGER` 0/1 (di-serialize ke `true/false` di layer repo) |
| `double precision` (`order_index`) | `REAL` |

### 4.1 Tabel domain

```sql
-- 001_init.sql

CREATE TABLE teams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by  INTEGER,               -- selalu local user id (1)
  created_at  TEXT NOT NULL
);

CREATE TABLE collections (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  team_id            INTEGER NOT NULL REFERENCES teams(id),
  created_by         INTEGER,
  confluence_page_id TEXT NOT NULL DEFAULT '',
  chaos_mode         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE folders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  collection_id    INTEGER NOT NULL REFERENCES collections(id),
  parent_folder_id INTEGER REFERENCES folders(id),
  order_index      REAL NOT NULL DEFAULT 0
);

CREATE TABLE requests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  method              TEXT NOT NULL,
  url                 TEXT NOT NULL,
  headers             TEXT NOT NULL DEFAULT '{}',   -- JSON
  body                TEXT NOT NULL DEFAULT '{}',   -- JSON
  body_type           TEXT NOT NULL DEFAULT 'raw-json',
  body_variants       TEXT NOT NULL DEFAULT '{}',   -- JSON
  auth_config         TEXT NOT NULL DEFAULT '{}',   -- JSON
  field_validations   TEXT NOT NULL DEFAULT '{}',   -- JSON
  extraction_rules    TEXT NOT NULL DEFAULT '[]',   -- JSON
  schema_assertions   TEXT NOT NULL DEFAULT '[]',   -- JSON
  collection_id       INTEGER NOT NULL REFERENCES collections(id),
  folder_id           INTEGER REFERENCES folders(id),
  created_by          INTEGER,
  order_index         REAL NOT NULL DEFAULT 0,
  pre_request_script  TEXT NOT NULL DEFAULT '',
  post_request_script TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_requests_collection ON requests(collection_id);
CREATE INDEX idx_requests_folder     ON requests(folder_id);

CREATE TABLE request_examples (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id       INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  request_method   TEXT NOT NULL,
  request_url      TEXT NOT NULL,
  request_headers  TEXT NOT NULL DEFAULT '{}',
  request_body     TEXT NOT NULL DEFAULT '{}',  -- JSON any (object/array/raw)
  response_status  INTEGER NOT NULL,
  response_headers TEXT NOT NULL DEFAULT '{}',
  response_body    TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE environments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  variables  TEXT NOT NULL DEFAULT '{}',        -- JSON
  team_id    INTEGER REFERENCES teams(id),      -- NULL = global env
  is_global  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE request_history (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL DEFAULT 1,
  team_id          INTEGER NOT NULL,
  request_id       INTEGER NOT NULL,
  method           TEXT NOT NULL,
  url              TEXT NOT NULL,
  request_headers  TEXT NOT NULL DEFAULT '{}',
  request_body     TEXT NOT NULL DEFAULT '',
  response_headers TEXT NOT NULL DEFAULT '{}',
  response_body    TEXT NOT NULL DEFAULT '',
  status_code      INTEGER NOT NULL DEFAULT 0,
  response_time    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_history_team    ON request_history(team_id);
CREATE INDEX idx_history_request ON request_history(request_id);

CREATE TABLE request_versions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id          INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  created_by          INTEGER NOT NULL DEFAULT 1,
  name                TEXT,
  method              TEXT NOT NULL,
  url                 TEXT NOT NULL,
  headers             TEXT NOT NULL DEFAULT '{}',
  body                TEXT NOT NULL DEFAULT '{}',
  auth_config         TEXT NOT NULL DEFAULT '{}',
  pre_request_script  TEXT NOT NULL DEFAULT '',
  post_request_script TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL
);

CREATE TABLE comments (          -- local-only di v1, tidak disync
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL DEFAULT 1,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

> Catatan: `extraction_rules` dan `schema_assertions` di backend Go tersimpan dalam request (frontend mengaksesnya via `(request as any).extraction_rules`). Pastikan kolomnya ada dan ikut kontrak JSON yang sama.

### 4.2 Tabel infrastruktur sync

```sql
-- sync metadata per row, terpisah dari tabel domain agar skema domain tetap mirror server
CREATE TABLE sync_meta (
  entity      TEXT NOT NULL,            -- 'team' | 'collection' | 'folder' | 'request' | 'environment' | 'example'
  local_id    INTEGER NOT NULL,
  remote_id   INTEGER,                  -- id di server pusat; NULL = belum pernah dipush
  dirty       INTEGER NOT NULL DEFAULT 0,
  deleted_at  TEXT,                     -- tombstone: dihapus lokal, belum dipropagate ke server
  base_hash   TEXT,                     -- hash konten saat terakhir sync (deteksi konflik 3-way)
  last_synced_at TEXT,
  PRIMARY KEY (entity, local_id)
);
CREATE INDEX idx_sync_dirty  ON sync_meta(dirty);
CREATE INDEX idx_sync_remote ON sync_meta(entity, remote_id);

-- konflik yang menunggu keputusan user
CREATE TABLE sync_conflicts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entity       TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'content', -- 'content' | 'delete_edit' | 'name_collision' (§6.4)
  local_id     INTEGER NOT NULL,
  remote_id    INTEGER,                 -- NULL utk name_collision (belum ter-map)
  local_snapshot  TEXT NOT NULL,        -- JSON row lokal saat konflik terdeteksi
  remote_snapshot TEXT NOT NULL,        -- JSON row server saat konflik terdeteksi
  detected_at  TEXT NOT NULL,
  resolved_at  TEXT,                    -- NULL = masih pending
  resolution   TEXT                     -- 'local' | 'remote' | 'merged' | 'renamed' | NULL
);

-- state sync global (key-value)
CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,               -- 'server_url', 'last_full_sync_at', 'sync_account_email', ...
  value TEXT
);
```

**Kenapa `sync_meta` tabel terpisah, bukan kolom tambahan di tiap tabel domain?** Supaya (a) skema domain tetap mirror persis server → serializer JSON ke renderer sederhana, (b) migrasi entity baru ke dalam scope sync tinggal insert meta, tanpa ALTER TABLE domain.

---

## 5. LocalRouter — Kontrak API

`LocalRouter.handle(config) → { status, data, headers, timing }` — shape **identik** dengan `IpcResponse` yang sekarang dihasilkan dari HTTP, sehingga `useDataStore` tidak bisa membedakan.

### 5.1 Endpoint yang harus diimplementasi (dipakai renderer saat ini)

| Method | Path | Handler lokal |
|---|---|---|
| GET | `/api/v1/teams` | list teams (selalu ≥1: local team) |
| POST | `/api/v1/teams` | create team |
| GET | `/api/v1/teams/:teamId/collections` | list collections by team |
| POST | `/api/v1/teams/:teamId/collections` | create collection |
| GET | `/api/v1/teams/:teamId/environments` | list envs (+ global) |
| GET | `/api/v1/teams/:teamId/activities` | **stub**: `200 []` |
| GET/PUT/DELETE | `/api/v1/collections/:id` | detail/update/delete collection |
| GET | `/api/v1/collections/:id/folders` | list folders (sorted `order_index, id`) |
| GET | `/api/v1/collections/:id/requests` | list requests + preload examples |
| POST | `/api/v1/collections/:id/folders` | create folder (validasi nested & duplikat — porting dari Go) |
| POST | `/api/v1/collections/:id/requests` | create request |
| GET/PUT/PATCH/DELETE | `/api/v1/requests/:id` | CRUD request; PUT membuat `request_versions` otomatis (mirror perilaku Go) |
| POST | `/api/v1/requests/:id/duplicate` | duplicate (aturan penamaan copy sama dgn Go) |
| POST | `/api/v1/requests/:id/move` | pindah folder/collection + re-order |
| GET | `/api/v1/requests/:id/versions` | list versions |
| GET/POST | `/api/v1/requests/:id/comments` | comments lokal |
| GET/POST | `/api/v1/requests/:id/examples` | examples |
| PUT/DELETE | `/api/v1/examples/:id` | update/delete example |
| PUT/DELETE | `/api/v1/folders/:id` | update/delete folder |
| POST | `/api/v1/folders/:id/move` | pindah folder + validasi nested |
| GET/POST/DELETE | `/api/v1/history` (`?team_id=`) | history lokal |
| GET/POST/PUT/DELETE | `/api/v1/environments/:id`, `/environments/global` | envs |
| GET | `/api/v1/search/summary` | search lintas collection (SQL `LIKE`) |
| GET | `/api/v1/confluence/config` | **stub**: `200 { enabled: false }` |
| POST | `/api/v1/auth/*` | **tidak di-route lokal** — hanya dipakai SyncEngine (§6) |

### 5.2 Aturan implementasi handler

1. **Response shape harus byte-compatible dengan Go**: field names snake_case, timestamp ISO-8601 UTC, JSONB dikembalikan sebagai object/array (bukan string). Sumber kebenaran: struct tags `json:"..."` di `models.go`.
2. **Business logic wajib diporting, bukan ditebak** — daftar minimal (semua ada di `backend/internal/` handlers/service Go):
   - `order_index` float + resequencing saat move/reorder.
   - Grouping request root vs folder (renderer mengandalkan `folder_id: null`).
   - Validasi **nested folder** (larangan cycle, batas kedalaman) — bugfix terbaru `a002b22`/`5568fe4`.
   - Deteksi **duplikat nama** collection/folder/request — bugfix `5568fe4`.
   - **Koreksi 2026-08-01**: dicek ulang di `backend/internal/api/folder.go`/`collection.go` — validasi cycle/duplikat-nama di atas **tidak ditemukan** di kode Go saat ini (hanya ada cek dasar "tidak boleh pindah folder ke dirinya sendiri"). LocalRouter yang sudah dibangun (Fase 2) mengikuti Go apa adanya (tanpa validasi tsb) — sudah sinkron, bukan gap. Kalau bugfix ini pernah ada dan ke-revert, atau memang belum pernah diimplementasikan Go-nya, perlu diklarifikasi sebelum "diporting".
   - Auto-create `request_versions` saat update request (perilaku "Create a version automatically for history" yang di renderer sudah diasumsikan ada).
   - Aturan bentuk body saat simpan (unwrap array/raw — bugfix `4ee79c2`).
3. **Selalu balikan array untuk endpoint list**, walau kosong (`200 []`) — jangan pernah `null`/object (akar bug blank-screen yang baru diperbaiki).
4. Setiap mutasi (POST/PUT/PATCH/DELETE) pada entity dalam scope sync **menandai `sync_meta.dirty = 1`** dan me-refresh `updated_at`. DELETE menulis tombstone (`deleted_at`), row domain dihapus baru setelah tombstone terpropagate saat sync.
5. `timing` diisi durasi eksekusi handler (ms) supaya UI timing tetap masuk akal.

---

## 6. SyncEngine — Manual "Sync Now"

### 6.1 Prasyarat
- Kredensial sudah ada dari **login pertama** (lihat §8 — revisi 2026-07-31): user login sekali di awal memakai `/api/v1/auth/login` existing, refresh token disimpan via `safeStorage` Electron dan **hanya dipakai saat sync** — operasional harian tidak menyentuh network. Sesi persisten sampai user eksplisit logout.
- Pemetaan team: saat koneksi pertama, user memilih team server mana yang dipetakan ke team lokal (atau buat team baru di server). Disimpan di `sync_state`.

### 6.2 Urutan sync (satu kali klik "Sync Now")

```
1. PRE-FLIGHT
   - GET /api/v1/teams (validasi token & konektivitas). Gagal → tampilkan error, stop.
   - Jika ada konflik pending yang belum diresolve → tampilkan dulu, user boleh
     lanjut sync (row konflik di-skip) atau resolve dulu.

2. PULL (server → lokal) — per entity, urutan dependensi:
   teams → collections → folders → requests → examples → environments
   - GET list per scope (collection contents, envs, dst).
   - Untuk tiap row server:
     a. remote_id belum ada di sync_meta        → INSERT lokal + meta (baru dari server)
     b. ada di meta, lokal TIDAK dirty          → UPSERT lokal (server menang, tidak ada
                                                  perubahan lokal yang hilang)
     c. ada di meta, lokal dirty:
        - hash(server_row) == base_hash         → server tidak berubah; biarkan, nanti dipush
        - hash(server_row) != base_hash         → ✋ KONFLIK: tulis sync_conflicts, skip row
   - Row server yang hilang (pernah sync, kini tak ada di server):
     - lokal tidak dirty → hapus lokal
     - lokal dirty       → ✋ KONFLIK (edited-locally-deleted-remotely)

3. PUSH (lokal → server) — urutan dependensi sama:
   - Tombstone dulu: DELETE ke server utk deleted_at != NULL → sukses: hapus row+meta.
   - dirty & remote_id NULL  → POST → simpan remote_id, dirty=0, base_hash=hash(row)
   - dirty & remote_id ada   → PUT  → dirty=0, base_hash=hash(row)
   - Mapping FK: body yang dikirim menerjemahkan local_id → remote_id
     (collection_id, folder_id, parent_folder_id, request_id) via sync_meta.

4. FINALIZE
   - sync_state.last_full_sync_at = now
   - Emit event ke renderer → refetch collections/envs aktif (pakai fetch* existing).
   - Tampilkan ringkasan: N pushed, M pulled, K conflicts pending.
```

### 6.3 Aturan konflik (sesuai keputusan produk)

- Konflik = **kedua sisi berubah** sejak sync terakhir (dideteksi via `base_hash` — hash konten saat terakhir sync, perbandingan 3-way, bukan sekadar timestamp).
- **Tidak ada pemenang otomatis.** Dialog per-konflik menampilkan diff ringkas (nama, method, URL, updated_at kedua sisi) dengan dua aksi:
  - **"Pakai punya saya"** → row lokal dipush (PUT) menimpa server; `resolution='local'`.
  - **"Pakai punya server"** → snapshot server di-apply ke lokal, `dirty=0`; `resolution='remote'`.
- **Tidak memilih** (tutup dialog) → row tetap `dirty=1`, konflik tetap tercatat `resolved_at IS NULL`, **tidak ada overwrite ke arah mana pun**, dan akan muncul lagi di sync berikutnya. Badge indikator "K konflik pending" tampil di UI dekat tombol Sync.
- Konflik delete-vs-edit diperlakukan sama: user memilih "hapus juga di lokal" vs "hidupkan lagi di server".

### 6.4 Identitas objek — ID lokal vs ID server

**Local id dan remote id adalah dua ruang penomoran independen dan tidak pernah dibandingkan langsung.** SQLite autoincrement jalan sendiri, Postgres sequence jalan sendiri; angka yang kebetulan sama tidak berarti apa-apa.

Identitas ("ini objek yang sama") **hanya** ditentukan oleh mapping `sync_meta (entity, local_id) → remote_id`:

- Row server yang `remote_id`-nya **tidak ada** di mapping → objek **baru dari server** → INSERT lokal dengan local id baru + tulis mapping. Row lokal lain yang kebetulan punya angka id sama tidak tersentuh.
- Row lokal `dirty` dengan `remote_id NULL` → objek **baru dari lokal** → POST, server memberi id sendiri, tulis mapping.
- Renderer selalu melihat **local id**; remote id murni urusan internal SyncEngine.

Konsekuensi: "cloud punya id 2, lokal punya id 2, isinya beda total" **bukan konflik** — itu dua objek berbeda yang setelah sync sama-sama hidup di kedua sisi (masing-masing dengan pasangan id barunya). Konflik (§6.3) hanya mungkin pada pasangan yang **sudah ter-map** dan kedua sisinya berubah sejak `base_hash`.

**Tabrakan nama (name collision)** — kasus turunan yang bukan konflik id tapi tetap harus ditangani: lokal membuat collection/folder "Payments", server juga punya "Payments" di scope yang sama. Saat push, backend Go menolak karena validasi duplikat nama (`5568fe4`). Aturan v1:

1. Push yang ditolak server dengan error duplikat nama **tidak menggagalkan sync** — dicatat sebagai *name collision* di `sync_conflicts` (jenis `name_collision`), row tetap `dirty`.
2. Dialog menawarkan dua pilihan:
   - **"Ini objek yang sama — gabungkan"** → tulis mapping local→remote ke row server yang namanya tabrakan; selanjutnya diperlakukan sebagai konflik konten biasa (§6.3) dan user memilih versi mana yang menang.
   - **"Objek berbeda — ganti nama punyaku"** → user beri nama baru (default: `"Payments (local)"`), lalu push diulang.
3. Tidak memilih → sama seperti konflik lain: pending, tanpa overwrite, muncul lagi di sync berikutnya.

### 6.5 Idempotensi & kegagalan parsial

- Sync boleh terputus kapan pun (server 503 — kasus nyata minggu ini): setiap row selesai diproses langsung commit meta-nya, jadi klik "Sync Now" berikutnya melanjutkan sisa, tidak mengulang yang sudah beres dan tidak menduplikasi (POST hanya utk `remote_id IS NULL`).
- Semua operasi pull-upsert per entity dibungkus transaksi SQLite per-batch.
- Rate: request sync berjalan sekuensial (bukan paralel) untuk menjaga urutan dependensi FK.

---

## 7. Feature Flags (perbedaan perilaku Cloud vs Local)

`ui-shared` menerima konfigurasi runtime dari shell:

```ts
export interface AppMode {
  mode: 'cloud' | 'local'
  realtime: boolean        // false di local → WS module tidak connect sama sekali
  auth: 'required' | 'none'
  sync: boolean            // true di local → tampilkan tombol "Sync Now" + badge konflik
}
```

| Fitur | Cloud | Local |
|---|---|---|
| Login screen | wajib, setiap sesi butuh server | **opsional** (revisi 2026-08-01, §8): "Masuk" atau "Lewati/Kerja Offline"; login kapan pun → pull otomatis, push data lama minta consent (§8.3); sesi persisten sampai logout eksplisit |
| WebSocket presence/lock/PONG | aktif | **tidak pernah connect** (hilangkan error console) |
| Comments/activities | server | lokal (comments) / stub kosong (activities) |
| Confluence export | sesuai config server | disabled (`enabled: false`) |
| Offline banner | tampil saat server mati | tidak pernah tampil |
| Tombol "Sync Now" + status | tidak ada | ada (header/statusbar) |
| License check (402/403 handler) | aktif | bypass |

UI komponen **tetap sama** — flag hanya menentukan mount/no-op, bukan layout berbeda.

---

## 8. First-Run Flow (Local)

> **Revisi 2026-08-01** (menggantikan revisi 2026-07-31 "login wajib sekali"): login jadi **opsional**. Layar awal menawarkan **"Masuk"** atau **"Lewati / Kerja Offline"**. Kedua jalur menuju workspace yang sama; login (kapan pun, di awal atau belakangan) selalu memicu pull otomatis, tapi **push data lokal-lama meminta persetujuan eksplisit** (§8.3) — bukan otomatis, supaya tidak ada data lokal yang "diam-diam" terkirim ke akun server.

### 8.1 Alur boot

1. App start → `db.ts` buka `<userData>/wapbolt-local.db`, jalankan migrasi pending.
2. Cek sesi tersimpan (`sync_state` + `safeStorage`):
   - **Ada sesi** → langsung masuk workspace, data dari SQLite, tanpa network sama sekali.
   - **Tidak ada sesi** (first run / setelah logout / setelah pilih "Lewati") → tampilkan layar login dengan dua aksi: **"Masuk"** (server URL + kredensial) atau **"Lewati / Kerja Offline"** (langsung masuk workspace sebagai local user, tanpa network).
3. Seed "My Workspace" (`teams: { id: 1, name: 'My Workspace', created_by: 1 }`) tetap dilakukan saat DB kosong — wadah kerja default, terlepas dari status login.

### 8.2 Login (pertama kali atau belakangan, setelah sempat "Lewati")

Sama persis kedua kasusnya — tidak ada cabang kode berbeda:

1. Autentikasi ke server (`/api/v1/auth/login`), simpan refresh token (`safeStorage`) + identitas akun (`sync_state`).
2. **PULL otomatis** (§6.2 langkah 2) — selalu jalan tanpa tanya, karena PULL cuma menambah data baru dari server, tidak pernah menghapus/menimpa kerja lokal yang belum ter-map.
3. **Cek data lokal pra-login yang belum pernah ter-sync** (row `dirty=1` dengan `remote_id NULL`, biasanya isi "My Workspace" kalau user sempat kerja lewat "Lewati"). Kalau ada → tampilkan dialog consent (§8.3) sebelum PUSH. Kalau tidak ada → lanjut PUSH seperti biasa (tidak ada yang perlu ditanya).
4. Masuk workspace.

### 8.3 Dialog consent push data pra-login

Muncul hanya kalau §8.2 langkah 3 menemukan data dirty tak ter-map. Isi: ringkasan singkat ("Anda punya N collection, M request yang dibuat sebelum masuk akun ini").

- **"Ya, kirim ke server"** → tandai team pra-login (biasanya "My Workspace") sebagai `dirty=1` di `sync_meta` kalau belum (lihat catatan implementasi di bawah), lanjut PUSH normal (§6.2 langkah 3) — akan muncul sebagai **team baru** di server (tidak ada auto-merge by nama, konsisten §6.4).
- **"Tidak, biarkan lokal saja"** → skip PUSH untuk baris-baris itu, **tidak ditanya lagi** di sesi ini. Baris tetap `dirty=1` selamanya (tidak pernah otomatis ter-push oleh "Sync Now" manual ke depannya juga) sampai user mengubahnya sendiri lewat UI belum-dibangun (di luar scope v1; catatan risiko).

Catatan implementasi: seed "My Workspace" saat ini dibuat langsung via SQL di `seed.ts`, **tidak** lewat `LocalRouter` — jadi tidak otomatis dapat baris `sync_meta`/`dirty` seperti team buatan user biasa. Ini harus diperbaiki saat membangun §8.3: baik dengan menandai dirty di awal (lalu dialog jadi opt-out) atau menandai dirty tepat saat user pilih "Ya" di dialog (opt-in, lebih sesuai §6.3 "tidak ada yang terjadi tanpa keputusan eksplisit").

### 8.4 Logout

- **Tidak pernah menyentuh data domain atau `sync_meta`** (mapping id lokal↔remote tetap utuh, supaya login lagi ke akun yang sama tidak duplikasi). Hanya menghapus token + identitas akun (`sync_state`).
- Setelah logout, app kembali ke layar §8.1 langkah 2 (pilihan Masuk / Lewati) — **bukan** dipaksa login lagi, karena akses data lokal tidak pernah bergantung status sesi.
- **Menghapus data lokal BUKAN bagian dari alur logout.** Itu aksi terpisah di Settings ("Hapus semua data lokal"), dengan konfirmasi lebih berat, dan **wajib memperingatkan eksplisit** kalau ada baris `dirty=1 AND remote_id IS NULL` (data yang cuma ada di lokal, akan hilang permanen tanpa cadangan) sebelum mengizinkan.
- Risiko yang sudah diketahui dan diterima (bukan bug baru): login ke akun/server **berbeda** setelah sempat kerja lokal bisa membuat data lokal ter-push ke akun yang salah kalau user asal klik "Ya" di dialog §8.3 tanpa sadar akunnya beda. Konsisten dengan non-tujuan "multi-user di satu instance lokal" (§1) — tidak ditangani khusus di v1.

---

## 9. Fase Implementasi

| Fase | Deliverable | Definition of Done |
|---|---|---|
| **0. Ekstraksi ui-shared** | `packages/ui-shared`, app utama pakai package ini | App Cloud build & regresi manual penuh lulus, zero perubahan perilaku |
| **1. Skeleton desktop-local** | Electron shell + SQLite + migrasi + seed | App boot, DB terbentuk, local team muncul |
| **2. LocalRouter core** | Handler teams/collections/folders/requests + list endpoints | CRUD & tree sidebar berfungsi penuh offline |
| **3. LocalRouter lengkap** | envs, history, examples, versions, comments, search, duplicate/move, stubs | Seluruh fitur harian paritas dengan Cloud (kecuali realtime) |
| **4. Feature flags** | mode local: no-WS, no-login, no-license | Console bersih dari error WS; boot langsung ke workspace |
| **5. Sync engine** | login opsional (§8 revisi 2026-08-01), sesi persisten, push/pull, conflict dialog, badge pending, consent dialog push data pra-login (§8.3) | Login → semua data tertarik → offline penuh; round-trip lokal↔server terverifikasi; putus di tengah → resume aman |

**Status Fase 5 per 2026-08-01**: inti sync (pull/push/conflict/idempotent resume) **selesai & teruji** (9 test skenario matrix). Yang **belum**: layar login opsional + tombol "Lewati" (saat ini login masih wajib di boot), dialog consent §8.3, pemetaan team manual (§6.1), penanganan `name_collision` sungguhan (§6.4 — saat ini cuma tercatat generik di `summary.errors`), auto-create `request_versions` saat update request (§5.2), kolom `extraction_rules`/`schema_assertions` belum tersambung ke handler manapun, auto-backup `.db` (§10), dan contract-test harness diff-vs-Go (§9) — LocalRouter diverifikasi manual baca kode Go + vitest, bukan harness otomatis.
| **6. Packaging & QA** | installer terpisah (nama/ikon/appId beda, userData beda) | Kedua app bisa terinstal berdampingan; QA regresi checklist |

**Testing per fase**:
- Fase 2–3: contract test — jalankan request yang sama ke Go backend dan LocalRouter, diff JSON response (harness kecil, fixture dari `wapbolt-internal-api-collection.json` di root repo).
- Fase 5: skenario matrix — (lokal saja berubah / server saja / keduanya / delete-edit silang / sync terputus di tengah).

---

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Business logic Go diporting tidak persis | perilaku dua app beda diam-diam | Contract test diff vs backend Go (fase 2–3); porting sambil baca handler Go, bukan menulis dari ingatan |
| Refactor ui-shared meregresi app Cloud | rusak app produksi | Fase 0 terisolasi, QA penuh sebelum lanjut; perubahan hanya pemindahan file + alias |
| Bugfix ganda (Go & TS) ke depan | drift perilaku | Simpan daftar "logic paritas" di doc ini; setiap bugfix backend yang menyentuh daftar §5.2 wajib ada task kembar untuk LocalRouter |
| Mapping FK lokal↔remote salah saat push | data nyasar antar collection | Semua translate id lewat satu fungsi `mapId(entity, localId)`; push sekuensial urut dependensi; tanpa remote_id parent → skip child + laporkan |
| Konflik menumpuk karena user tak pernah resolve | sync macet sebagian | Badge pending selalu terlihat; pre-flight menawarkan resolve; konflik tidak memblokir row lain |
| SQLite corrupt / file terhapus | kehilangan data lokal | Backup otomatis file .db (copy berversi, keep 5) setiap kali app start sebelum migrasi & sebelum sync |
| better-sqlite3 native module vs electron ABI | build gagal | `electron-rebuild` di postinstall; pin versi; CI build matrix mac/win/linux |

---

## 11. Keputusan Terbuka (perlu dijawab sebelum fase terkait)

1. **Fase 0**: ekstraksi `ui-shared` beneran, atau copy renderer dulu (cepat tapi drift)? → Rekomendasi kuat: ekstraksi beneran; copy hanya jika butuh PoC < 1 minggu.
2. **Scope sync environments global** (yang `is_global=true`, tanpa team): ikut disync atau local-only? (server memperlakukannya lintas-team). → *Interim v1 (implementasi Fase 5): local-only — SyncEngine hanya pull/push env non-global.*
3. Apakah **history** suatu saat perlu disync (misal untuk analytics)? Skema `sync_meta` sudah menampung, tinggal tambah entity.
4. ~~Nama produk & appId final~~ → **Selesai**: `io.wapbolt.local` / "Wapbolt Local" (lihat `apps/desktop-local/electron-builder.yml`), terbukti terinstal berdampingan dgn Cloud via CI (Fase 6).
