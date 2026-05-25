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

### [P2-1] WebSocket Testing 🟠 L
**Status:** Ada `websocket.ts` tapi itu untuk koneksi kolaborasi internal, bukan untuk testing WebSocket API.  
**Goal:** Tab request baru bertipe "WebSocket" untuk connect, send message, dan monitor event.

- [ ] Tipe request baru: `ws` (simpan di `request_type` field)
- [ ] UI WebSocket di `MainArea.tsx`: URL bar, tombol Connect/Disconnect, input message, event log
- [ ] Support: text message, JSON message, binary (base64)
- [ ] Event log: timestamp, direction (sent/received), payload, ukuran
- [ ] Sub-protocol & custom headers saat handshake
- [ ] Simpan session history (last N messages)

**Dependensi:** Perlu perubahan schema database (`request_type` field) + backend support  
**File terkait:** `MainArea.tsx`, `types/index.ts`, backend model Request

---

### [P2-2] GraphQL Support 🟠 L
**Status:** Belum ada.  
**Goal:** Request editor khusus GraphQL dengan query builder dan schema introspection.

- [ ] Tipe body baru: `graphql`
- [ ] Editor GraphQL di tab Body: query editor (Monaco), variables editor (JSON), operation name
- [ ] Introspection: tombol "Load Schema" fetch schema dari endpoint → simpan lokal
- [ ] Schema explorer panel: browse types, fields, dan dokumentasi inline
- [ ] Autocomplete query berdasarkan schema (Monaco completion provider)
- [ ] Kirim sebagai POST dengan `Content-Type: application/json` secara otomatis

**Dependensi:** Tidak ada  
**File terkait:** `MainArea.tsx` (tab Body), `types/index.ts`

---

### [P2-3] Request Chaining / Dynamic Variables 🟠 M
**Status:** Ada post-request script (`wap.environment.set`) tapi tidak ada UI visual untuk chaining.  
**Goal:** Ekstrak nilai dari response dan gunakan langsung di request berikutnya tanpa nulis script manual.

- [ ] UI "Extract Variable" di response panel: klik field JSON → simpan ke environment variable
- [ ] JSONPath extractor: pilih path, pilih nama variabel, simpan sebagai aturan post-response
- [ ] Aturan extraction disimpan per-request dan dijalankan otomatis setelah response diterima
- [ ] Visual indicator di request: badge variabel yang akan di-set setelah request ini

**Dependensi:** Tidak ada  
**File terkait:** `ResponseArea.tsx`, `MainArea.tsx`, `useDataStore.ts`

---

### [P2-4] JSON Schema Validation di Test Assertions 🟠 M
**Status:** Test assertions via script ada (`wap.test()`/`wap.expect()`), tapi tidak ada schema validation.  
**Goal:** Validasi struktur response JSON terhadap schema tanpa nulis kode.

- [ ] UI builder di tab "Tests": tambah assertion "Response matches schema"
- [ ] JSON Schema editor (Monaco) untuk definisikan schema yang diharapkan
- [ ] Integrasi dengan `ajv` untuk validasi saat response diterima
- [ ] Tampilkan error validation detail di hasil test

**Dependensi:** Tidak ada  
**File terkait:** `MainArea.tsx` (tab Tests), `useDataStore.ts` (sendRequest)

---

## Phase 3 — Developer Experience (v2.0.x)

Fokus: mempercepat workflow sehari-hari.

### [P3-1] Response Comparison (Diff View) 🟡 M
**Status:** Belum ada.  
**Goal:** Bandingkan dua response secara visual — berguna saat membandingkan staging vs production atau sebelum/sesudah perubahan API.

- [ ] Simpan snapshot response per-request (manual atau otomatis)
- [ ] Panel "Compare": pilih dua snapshot, tampilkan diff side-by-side
- [ ] Highlight baris yang berubah, ditambah, dihapus (Monaco diff editor)
- [ ] Bandingkan juga: status code, headers, response time

**Dependensi:** Tidak ada  
**File terkait:** `ResponseArea.tsx`, storage snapshot di `useDataStore.ts`

---

### [P3-2] Keyboard Shortcuts Panel 🟡 S
**Status:** Beberapa shortcut ada (`Cmd+Enter`) tapi tidak ada dokumentasi shortcut untuk user.  
**Goal:** Modal daftar shortcut yang bisa diakses via `?` atau menu Help.

- [ ] Modal `KeyboardShortcutsModal.tsx` dengan daftar semua shortcut
- [ ] Grouped by context: Global, Request Editor, Response, Sidebar, Runner
- [ ] Shortcut untuk buka modal: `Shift+?`
- [ ] Tambah shortcut yang belum ada: new tab (`Cmd+T`), close tab (`Cmd+W`), switch tab (`Cmd+[1-9]`), save request (`Cmd+S`), send request (`Cmd+Enter`)

**Dependensi:** Tidak ada  
**File terkait:** `Header.tsx` atau menu Help, baru `KeyboardShortcutsModal.tsx`

---

### [P3-3] File Upload Testing (multipart/form-data UI) 🟡 S
**Status:** Body type `form-data` ada tapi tidak ada file picker.  
**Goal:** User bisa upload file asli di body `form-data`.

- [ ] Di `KeyValueEditor` untuk form-data: tambah toggle "Text / File" per row
- [ ] Jika "File": tampilkan file picker (Electron `dialog.showOpenDialog`)
- [ ] Kirim file sebagai `FormData` via request
- [ ] Tampilkan nama file + ukuran di editor

**Dependensi:** Electron main process untuk file dialog  
**File terkait:** `KeyValueEditor.tsx`, `MainArea.tsx`, Electron `main/`

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

*Last updated: 2026-05-26*
