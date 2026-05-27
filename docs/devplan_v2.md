# Wapbolt — Development Plan

> Dokumen ini adalah roadmap fitur yang akan dikembangkan secara bertahap berdasarkan prioritas.  
> Setiap fitur diberi label **prioritas**, **estimasi kompleksitas**, dan **dependensi**.

---

## Cara Baca

| Label | Arti |
|---|---|
| 🔴 Critical | Blocker utama adopsi, harus dikerjakan duluan |
| 🟠 High | Nilai tinggi, dikerjakan setelah Critical selesai |
| 🟡 Medium | Nice-to-have yang memperkuat produk |
| 🟢 Low | Polish / quality of life |
| S / M / L / XL | Estimasi kompleksitas: Small / Medium / Large / Extra Large |

---

## Phase 1 — Foundation & Adoption (v1.8.x) ✅ SELESAI

Fokus: menghilangkan hambatan masuk bagi pengguna Postman/Insomnia.

### [P1-1] Import dari Postman v2.1 & OpenAPI 3.0 🔴 M ✅
**Status:** **SELESAI** (2026-05-25)  
**Perubahan:**
- Backend: `ImportOpenAPI` handler di `collection.go` — parsing OpenAPI 3.0 & Swagger 2.0, grouping by tags → folders, route `/api/v1/teams/:id/import-openapi`
- Frontend: `ImportModal.tsx` dirombak total — tab switcher Wapbolt/OpenAPI, auto-detect format, preview endpoint count
- Store: `importOpenAPI()` ditambahkan di `useDataStore.ts`

- [x] Parser OpenAPI 3.0 → internal Wapbolt format (paths, methods, params, body schema)
- [x] Parser Swagger 2.0 → internal Wapbolt format
- [x] Import modal: tambah tab "OpenAPI / Swagger" di samping tab JSON yang sudah ada
- [x] Preview jumlah request yang akan diimport sebelum konfirmasi
- [ ] Mapping auth scheme dari OpenAPI (Bearer, Basic, ApiKey) ke auth_config *(backlog)*

---

### [P1-2] Export ke Format Postman v2.1 🔴 S ✅
**Status:** **SELESAI** (2026-05-25)  
**Perubahan:**
- `exportCollection` di `useDataStore.ts` ditulis ulang: recursive folder tree, auth mapping (Bearer/Basic/ApiKey), pre/post scripts sebagai `event[]`, URL object `{raw, protocol, host, path, query}`, filename `.postman_collection.json`

- [x] Mapper internal format → Postman Collection v2.1 JSON
- [x] Pastikan folder hierarchy, auth, pre-request script ikut terexport

---

### [P1-3] Collection Runner — Upgrade 🔴 M ✅
**Status:** **SELESAI** (2026-05-25, bug fix 2026-05-26)  
**Perubahan:**
- `runCollection` di `useDataStore.ts` diupgrade: support `selectedIds`, `iterations`, `delayMs`, `stopOnFailure`
- `CollectionRunnerPanel.tsx` dibuat baru: fullscreen panel dengan checklist request, config panel, progress bar live, result cards dengan expand test assertions, export JSON/CSV
- `Sidebar.tsx`: inline runner dihapus, diganti `<CollectionRunnerPanel />`
- **Bug fix (2026-05-26):** Modal hilang saat run karena `CollectionItem` unmount — fix dengan `createPortal` ke `document.body`
- **Bug fix (2026-05-26):** Hasil run tidak tampil setelah panel close — fix dengan menyimpan `lastRunResults` & `lastRunCollectionId` di Zustand store; panel reopen langsung menampilkan hasil terakhir dalam state `finished`
- **Bug fix (2026-05-26):** `handleRun` tanpa try/catch — ditambah `try/catch/finally` sehingga state selalu transisi ke `finished` meski ada error
- **Bug fix (2026-05-26):** `wap.setEnv`, `wap.environment`, `wap.collectionVariables` tidak tersedia di post-request script runner — object `wap` di post-request dilengkapi method yang sama dengan pre-request

- [x] Pilihan request yang akan dijalankan (checklist per request)
- [x] Konfigurasi: jumlah iterasi, delay antar request (ms), stop on failure
- [x] Progress bar dan live log saat running
- [x] Laporan hasil: tabel pass/fail per request, response time, test assertions
- [x] Export hasil run ke JSON / CSV
- [x] Integrasi dengan test assertions (`wap.test()`) — tampilkan pass/fail per assertion
- [x] Hasil run persisten di store — reopen panel tetap menampilkan hasil run terakhir
- [x] `wap.setEnv` / `wap.environment.set` bisa digunakan di post-request script untuk chain variable antar request

---

## Phase 2 — Protocol & Testing Power (v1.9.x)

Fokus: memperluas jenis request yang bisa ditest.

### [P2-1] WebSocket Testing 🟠 L ✅
**Status:** **SELESAI** (2026-05-26)  
**Perubahan:**
- `WorkingRequest` di `useDataStore.ts`: tambah field `request_type?: 'http' | 'ws'`
- `WebSocketPanel.tsx` dibuat baru: connect/disconnect, sub-protocol, handshake headers toggle, event log (timestamp, direction, size, copy), send panel (text/JSON format), filter sent/received/all, clear log
- `MainArea.tsx`: protocol toggle HTTP/WS di URL bar; WS mode mengaktifkan `WebSocketPanel` (full-height, tanpa resizer/response); top-half div menjadi `flex-1` saat WS mode; auto-convert `https://` → `wss://` saat switch ke WS

- [x] Tipe request baru: `ws` (field `request_type` di `WorkingRequest`)
- [x] UI WebSocket di `MainArea.tsx`: URL bar, tombol Connect/Disconnect, input message, event log
- [x] Support: text message, JSON message
- [x] Event log: timestamp, direction (sent/received), payload, ukuran
- [x] Sub-protocol & custom headers saat handshake
- [ ] Simpan session history (last N messages) *(backlog)*

**Catatan:** `request_type` hanya disimpan di `WorkingRequest` (in-memory/tab state), tidak di-persist ke database karena tidak ada perubahan schema backend. Saat request di-save ke backend, tipe WS tidak tersimpan — tapi WebSocket testing dimaksudkan sebagai mode ephemeral.

**File terkait:** `MainArea.tsx`, `WebSocketPanel.tsx`, `store/useDataStore.ts`

---

### [P2-2] GraphQL Support 🟠 L ✅
**Status:** **SELESAI** (2026-05-26)  
**Perubahan:**
- `normalizeRequest` di `useDataStore.ts`: tambah handling body_type `graphql` — body disimpan sebagai JSON string `{query, variables, operationName}`
- `contentTypeMap` di `useDataStore.ts`: `graphql` → `application/json`
- `executeActiveRequest` di `useDataStore.ts`: saat body_type `graphql`, method di-override ke POST, body dikonversi ke `{query, variables, operationName}` JSON
- `MainArea.tsx`: tombol `GraphQL` di body type switcher; `EditorArea` menampilkan split panel — query editor (Monaco graphql language) di kiri, variables/schema tab di kanan; toolbar operation name + "Load Schema" (introspection via `__schema`)

- [x] Tipe body baru: `graphql`
- [x] Editor GraphQL di tab Body: query editor (Monaco), variables editor (JSON), operation name
- [x] Introspection: tombol "Load Schema" fetch schema dari endpoint → tampil di tab Schema
- [x] Schema explorer panel: raw JSON schema dari introspection
- [x] Kirim sebagai POST dengan `Content-Type: application/json` secara otomatis
- [ ] Autocomplete query berdasarkan schema (Monaco completion provider) *(backlog)*

**Dependensi:** Tidak ada  
**File terkait:** `MainArea.tsx` (tab Body), `types/index.ts`

---

### [P2-3] Request Chaining / Dynamic Variables 🟠 M ✅
**Status:** **SELESAI** (2026-05-27)  
**Perubahan:**
- `ExtractionRule` interface ditambahkan ke `types/index.ts` — `{ id, variableName, jsonPath, enabled }`
- `WorkingRequest` diperluas dengan field `extraction_rules: ExtractionRule[]`
- `normalizeRequest` di `useDataStore.ts` memastikan field selalu berupa array
- `executeActiveRequest` menjalankan semua enabled rules setelah response diterima — nilai di-set ke active environment via `updateActiveEnvironmentVariable`
- `runCollection` juga menjalankan extraction rules — variable chain antar-request dalam satu run
- `MainArea.tsx`: sub-tab **Extract** di tab Tests — UI tambah/hapus/toggle rule per-request
- `ResponseArea.tsx`: tombol **Extract** shortcut — buat rule langsung dari panel response, dengan lock check
- Badge indicator di tab Tests menyala jika ada extraction rules

- [x] UI "Extract Variable" di response panel: klik field JSON → simpan ke environment variable
- [x] JSONPath extractor: pilih path, pilih nama variabel, simpan sebagai aturan post-response
- [x] Aturan extraction disimpan per-request dan dijalankan otomatis setelah response diterima
- [x] Visual indicator di request: badge di tab Tests

**Catatan keamanan:** Guard `isSafeJsonPath()` memblokir path dengan `__proto__`, `constructor`, `prototype` sebelum `_.get` — mencegah prototype pollution.  
**File terkait:** `ResponseArea.tsx`, `MainArea.tsx`, `useDataStore.ts`, `types/index.ts`

---

### [P2-4] JSON Schema Validation di Test Assertions 🟠 M ✅
**Status:** **SELESAI** (2026-05-27)  
**Perubahan:**
- `SchemaAssertion` interface ditambahkan ke `types/index.ts` — `{ id, name, schema, enabled }`
- `WorkingRequest` diperluas dengan field `schema_assertions: SchemaAssertion[]`
- Singleton `ajv` (v6, `allErrors: true`) di module level `useDataStore.ts` — tidak di-instantiasi ulang per-request
- `executeActiveRequest`: validasi ajv dijalankan setelah response, hasilnya masuk ke test results (format `dataPath` + pesan error)
- `runCollection`: schema assertions dijalankan dan dicatat ke `result.testResults` per-request
- `MainArea.tsx`: sub-tab **Schema** di tab Tests — Monaco JSON editor per-assertion, toggle enable/disable

- [x] UI builder di tab "Tests": tambah assertion "Response matches schema"
- [x] JSON Schema editor (Monaco) untuk definisikan schema yang diharapkan
- [x] Integrasi dengan `ajv` untuk validasi saat response diterima
- [x] Tampilkan error validation detail di hasil test

**File terkait:** `MainArea.tsx` (tab Tests), `useDataStore.ts`, `types/index.ts`

---

## Phase 3 — Developer Experience (v2.0.x)

Fokus: mempercepat workflow sehari-hari.

### [P3-1] Response Comparison (Diff View) 🟡 M ✅
**Status:** **SELESAI** (2026-05-27)  
**Perubahan:**
- `ResponseSnapshot` interface + `responseSnapshots` state di `useDataStore.ts` — in-memory, per requestId; actions `saveResponseSnapshot` dan `deleteResponseSnapshot`
- `ResponseArea.tsx`: tombol **Snapshot** (Camera icon) + tombol **Compare** (GitCompare icon, muncul jika ada ≥1 snapshot)
- `ResponseDiffModal.tsx` dibuat baru — Monaco `DiffEditor` side-by-side; dropdown pilih left/right dari snapshots + current response; stats bar status + timing; delete snapshot langsung dari modal

- [x] Simpan snapshot response per-request (manual)
- [x] Modal "Compare": pilih dua snapshot, tampilkan diff side-by-side
- [x] Highlight baris yang berubah (Monaco DiffEditor)
- [x] Bandingkan juga: status code, response time

**File terkait:** `ResponseArea.tsx`, `ResponseDiffModal.tsx`, `useDataStore.ts`

---

### [P3-2] Keyboard Shortcuts Panel 🟡 S ✅
**Status:** **SELESAI** (2026-05-27)  
**Perubahan:**
- `KeyboardShortcutsModal.tsx` dibuat baru — modal 2-kolom dengan semua shortcut dikelompokkan per konteks (Global, Request Editor, Tab Navigation, WebSocket, Runner, Modal)
- `MainArea.tsx`: listener `Shift+?` ditambahkan ke handler keydown yang ada — guard skip saat user sedang di input/textarea
- `Header.tsx`: tombol `Keyboard` icon ditambahkan di toolbar kanan — dispatch `Shift+?` event ke window

- [x] Modal `KeyboardShortcutsModal.tsx` dengan daftar semua shortcut
- [x] Grouped by context: Global, Request Editor, Tab Navigation, WebSocket, Runner, Modals
- [x] Shortcut untuk buka modal: `Shift+?`
- [x] Tambah shortcut yang belum ada: new tab (`Cmd+T`), close tab (`Cmd+W`), switch tab (`Cmd+[1-9]`), save request (`Cmd+S`), send request (`Cmd+Enter`)

**File terkait:** `KeyboardShortcutsModal.tsx`, `MainArea.tsx`, `Header.tsx`

**Dependensi:** Tidak ada  
**File terkait:** `Header.tsx` atau menu Help, baru `KeyboardShortcutsModal.tsx`

---

### [P3-3] File Upload Testing (multipart/form-data UI) 🟡 S ✅
**Status:** **SELESAI** (2026-05-27)  
**Perubahan:**
- `KeyValueEditor.tsx`: tambah prop `allowFileType` — per-row toggle Text/File (icon `Type`↔`Paperclip`); row bertipe `file` menampilkan tombol "Choose File" yang trigger IPC dialog; nama file + deskripsi (ukuran) auto-isi setelah pilih
- `main/index.ts`: `ipcMain.handle('wapbolt:open-file-dialog')` — buka native file dialog, return `{path, name, size}`; handler `wapbolt:request` form-data diperluas: item `type=file` di-attach sebagai `fs.createReadStream`
- `preload/index.ts`: expose `openFileDialog()` ke renderer
- `MainArea.tsx`: form-data body_type pass data sebagai array langsung + `allowFileType={true}`

- [x] Di `KeyValueEditor` untuk form-data: tambah toggle "Text / File" per row
- [x] Jika "File": tampilkan file picker (Electron `dialog.showOpenDialog`)
- [x] Kirim file sebagai `FormData` via request
- [x] Tampilkan nama file + ukuran di editor

**File terkait:** `KeyValueEditor.tsx`, `MainArea.tsx`, `main/index.ts`, `preload/index.ts`

---

### [P3-4] Global Search yang Diperluas 🟡 M
**Status:** `GlobalSearchModal.tsx` ada, belum tahu scope search-nya.  
**Goal:** Search bisa menemukan request, folder, koleksi, environment variable, dan history sekaligus.

- [ ] Search scope: requests (nama + URL), koleksi, folder, environment variables (key), history
- [ ] Hasil dikelompokkan per kategori
- [ ] Preview singkat: method badge + URL untuk request, nilai untuk variable
- [ ] Navigasi keyboard (↑↓ Enter) di hasil search
- [ ] Fuzzy search (tidak harus exact match)

**Dependensi:** Tidak ada  
**File terkait:** `GlobalSearchModal.tsx`, `useDataStore.ts`

---

### [P3-5] Mock Server — Scenario Delay & Error Simulation 🟡 M
**Status:** Mock Server sudah ada (`MockServerPanel.tsx`, `ScenariosPanel.tsx`).  
**Goal:** Simulasi kondisi edge case: response lambat, random error, network failure.

- [ ] Per-endpoint config: response delay (fixed / random range dalam ms)
- [ ] Error simulation: random % chance return error (4xx/5xx)
- [ ] Chaos mode: aktifkan simulasi failure untuk seluruh mock server
- [ ] Log request ke mock server: timestamp, matched endpoint, latency simulasi

**Dependensi:** Backend mock server  
**File terkait:** `MockServerPanel.tsx`, `ScenariosPanel.tsx`

---

## Phase 4 — Polish & Ecosystem (v2.1.x)

### [P4-1] Import dari Insomnia 🟢 M
- [ ] Parser format Insomnia v4 JSON → Wapbolt format
- [ ] Mapping resource (request groups → folders, environments, auth)

### [P4-2] CLI Runner (Newman-style) 🟢 XL
- [ ] Binary `wapbolt-cli` yang bisa run collection dari terminal
- [ ] Output: JUnit XML, JSON report untuk CI/CD integration
- [ ] Support environment file sebagai flag `--env`

### [P4-3] Request Response Time Chart 🟢 S
- [ ] Grafik response time dari N run terakhir per request
- [ ] Tampil di bawah response area atau di History

### [P4-4] SSE (Server-Sent Events) Support 🟢 M
- [ ] Tipe request `sse`: connect ke SSE endpoint, tampilkan stream events secara real-time
- [ ] Event log dengan timestamp dan data per event

---

## Backlog (Belum Diprioritaskan)

- Team activity feed (siapa edit apa, kapan)
- Request documentation generator (auto-generate markdown dari request)
- API versioning: simpan multiple snapshot request untuk compare across versions
- Dark/light theme toggle manual (bukan ikut sistem)
- Notification sound on/off

---

## Urutan Eksekusi yang Direkomendasikan

```
v1.8.0 → P1-1 (OpenAPI Import) + P1-2 (Export Postman)
v1.8.1 → P1-3 (Collection Runner upgrade)
v1.9.0 → P2-1 (WebSocket Testing)
v1.9.1 → P2-2 (GraphQL)
v1.9.2 → P2-3 (Request Chaining) + P2-4 (Schema Validation)
v2.0.0 → P3-1 (Response Diff) + P3-2 (Keyboard Shortcuts) + P3-3 (File Upload)
v2.0.1 → P3-4 (Global Search) + P3-5 (Mock Scenarios)
v2.1.x → Phase 4
```

---

*Last updated: 2026-05-27 (P3-1 + P3-2 + P3-3 selesai → release v2.0.0)*
