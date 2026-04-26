# Wapify — Development Plan

**Terakhir Diperbarui:** 24 April 2026
**Status Saat Ini:** ✅ Fase 0-6 Selesai → 🟡 Fase 7 In Progress

---

## Ringkasan Fase

| Fase | Nama | Target | Status |
|---|---|---|---|
| 0 | Setup & Fondasi | Repo & tooling siap | ✅ Selesai |
| 1 | MVP Internal | Tim Waluyo bisa pakai minggu ini | ✅ Selesai |
| 2 | Kolaborasi Real-time | Field locking, presence, versioning | ✅ Selesai |
| 3 | Dokumentasi & Mock Server | Generate docs, mock API | ✅ Selesai |
| 4 | Testing & CI/CD | Collection runner, CLI | ✅ Selesai (CLI pending) |
| 5 | On-Premise & License | Jual ke client luar | ✅ Selesai |
| 6 | UX & Power Features | Workspace, body types, export, drag-drop, mock dynamic | ✅ Selesai |
| 7 | Kolaborasi Lanjutan | Notifikasi, shared env, diff visual | 🟡 Dalam Proses |
| 8 | SaaS (Opsional) | Cloud hosted di wapify.io | ⬜ Belum Mulai |

---

## Fase 0 — Setup & Fondasi
**Status:** ✅ Selesai

- [x] Init repo: `apps/desktop`, `backend`, `docs`, `.agents`
- [x] Go module backend: `go mod init`
- [x] React + Electron boilerplate di `apps/desktop`
- [x] Docker Compose: PostgreSQL lokal untuk development
- [x] golang-migrate: migration pertama (schema awal)
- [x] golangci-lint config
- [x] ESLint + Prettier config
- [ ] GitHub Actions: lint + test on PR ← pending Fase 4
- [x] README: cara run lokal

---

## Fase 1 — MVP Internal
**Status:** ✅ Selesai

### Backend
- [x] Auth: login, refresh, logout, JWT + Refresh Token
- [x] Admin CLI: create-user, list-users
- [ ] Admin CLI: reset-password ← belum dikerjakan
- [x] Middleware: JWT verify, super admin bypass, role check
- [x] Team CRUD + member management (POST/GET/PUT/DELETE)
- [x] Collection, Folder, Request CRUD
- [x] Import Postman v2.1 JSON
- [x] Environment CRUD + interpolasi `{{variable}}` (Case-Insensitive)
- [x] Scripting Engine: Pre-request & Post-request (Wapify SDK v1.0)
- [x] Variable persistence: simpan hasil `setEnv` ke DB permanen
- [x] Ghost Input engine: click-to-set di URL, Body, Header, Docs
- [x] Request History CRUD
- [x] Admin API (Super Admin): user & team management

### Frontend
- [x] Login screen + Auth rehydration (auto-login via refresh token)
- [x] Sidebar tree: tim → koleksi → folder → request (recursive, persistent state)
- [x] Request Builder: method, URL, Params, Headers, Body, Auth, Scripts
- [x] Premium Variable Hover UI (Glassmorphism)
- [x] Response Viewer: status, timing, payload size, body, headers
- [x] Admin Panel: user & team CRUD
- [x] Electron Main Process: IPC HTTP Executor bebas CORS

**Milestone ✅:** 15+ anggota tim berhasil login, kirim request bebas CORS, Waluyo kelola tim dari admin panel.

---

## Fase 2 — Kolaborasi Real-time
**Status:** ✅ Selesai

- [x] WebSocket server (gofiber/contrib/websocket)
- [x] Presence indicator (siapa yang buka request yang sama)
- [x] Field-level locking (TTL 5 detik, auto-release)
- [x] Save & broadcast perubahan ke semua member online
- [x] Versioning: snapshot REQUEST_VERSION setiap Save
- [x] Rollback ke versi sebelumnya
- [x] Komentar pada request
- [x] Activity log per koleksi/tim

**Milestone ✅:** Tim bisa kerja di request yang sama tanpa conflict.

---

## Fase 3 — Dokumentasi & Mock Server
**Status:** ✅ Selesai

- [x] Generate dokumentasi HTML + Markdown + OpenAPI 3.0
- [x] Documentation viewer + export
- [x] Mock server engine: conditional response, delay, path wildcard, per-collection
- [x] Mock server UI: CRUD endpoints, quick-mock, toggle aktif

**Milestone ✅:** User bisa export dokumentasi dan aktifkan mock server.

---

## Fase 4 — Automated Testing & CI/CD
**Status:** ✅ Hampir Selesai — CLI masih pending

- [x] Test runner JavaScript via Renderer-side execution (sandbox)
- [x] Collection Runner (jalankan seluruh koleksi)
- [x] UI: test script editor + laporan hasil
- [ ] CLI: `wapify run --collection --env --reporter json|junit` ← **TODO**
- [ ] GitHub Actions: lint + test on PR ← **TODO**

> CLI bisa dikerjakan paralel saat Fase 6 berlangsung.

---

## Fase 5 — On-Premise & License
**Status:** ✅ Selesai

- [x] License CLI (Go): generate keypair & client license (Offline-First)
- [x] Ed25519: signing dan generation (MVP)
- [x] Middleware: validasi offline + Grace Period 24 jam
- [x] UI: layar kunci (License Required) + toast warning
- [x] Branding: ikon baru "API Pulse"
- [x] Makefile: otomasi build + packaging
- [x] Landing page wapify.io (Beta Registration via Gmail)
- [x] Dockerfile untuk landing page di STB
- [x] Dynamic Server Config: point app ke backend manapun tanpa rebuild
- [x] Build multi-platform: `linux/amd64`, `linux/arm64`, `windows/amd64`, `darwin/arm64`

**Pricing:**
- Team (maks 10 seat): Rp 500rb/bln atau Rp 5jt/thn
- Business (unlimited seat): Rp 2jt/bln atau Rp 20jt/thn
- Enterprise: Custom

---

## Fase 6 — UX & Power Features
**Status:** 🟡 In Progress
**Target:** Wapify terasa lebih powerful dan nyaman dari Postman.
**Estimasi:** 2-3 minggu

### Fitur Ditunda (Coming Soon)
Beberapa fitur yang direncanakan di Fase 6 telah disesuaikan prioritasnya dan untuk sementara dialihkan ke modal **"Coming Soon"** di UI guna menjaga stabilitas MVP:
- **Documentation (Main Tab):** Generator dokumentasi otomatis sedang dalam perbaikan engine.
- **Cookies Management:** Fitur manajemen cookie (interceptor & manual set) masih dalam tahap desain keamanan.
- **Send Options Dropdown:** Dropdown pada tombol Send (Send & Download, dll) akan diaktifkan di update mendatang.
- **Request Sharing:** Fitur kolaborasi berbagi request via link.

### Urutan Pengerjaan

```
1. Rename Workspace         (0.5 hari)  → paling cepat, warmup
2. Default Header JSON      (0.5 hari)  → cepat, tidak ada dependency
3. Body Types               (3-4 hari)  → fondasi untuk cURL import
4. cURL Import              (2-3 hari)  → bergantung pada Body Types
5. Export Code Snippet      (3-4 hari)  → independen, bisa paralel dengan 4
6. Drag-and-Drop            (3-4 hari)  → independen UI
7. Mock Dynamic Response    (4-5 hari)  → paling kompleks, dikerjakan terakhir
```

---

### 6.1 — Rename "Tim" → "Workspace" 
**Estimasi:** 0.5 hari
**Scope:** Frontend only — tidak ada perubahan backend atau DB.

- [x] Ganti semua label "Tim" / "Team" → "Workspace" di seluruh UI
- [x] Update: "Buat Tim" → "Buat Workspace", "Anggota Tim" → "Member"
- [x] Update tooltip, placeholder, empty state, error message
- [x] String "team" boleh ada di kode internal, tidak boleh tampil ke user

---

### 6.2 — Default Header `Content-Type: application/json`
**Status:** ✅ Selesai

- [x] Saat buat request baru → otomatis tambah header `Content-Type: application/json`
- [x] Header tampil di tab Headers, bisa dihapus/diubah user
- [x] Bisa edit bulk header seperti postman
- [x] Auto-update Content-Type saat body type berubah

---

### 6.3 — Body Types Lengkap
**Status:** ✅ Selesai

- [x] Migration: tambah kolom `body_type VARCHAR(30)` ke tabel REQUEST
- [x] Struktur `body` untuk form-data & urlencoded: array `[{ key, value, enabled, type }]`
- [x] Update `PUT /api/v1/requests/:id` terima dan simpan `body_type`
- [x] Update IPC handler Electron Main Process — serialisasi body sesuai `body_type` (Axios)
- [x] UI: Dropdown selector body type dan editor tabel/Monaco sesuai pilihan
- [x] Optimasi Monaco: Gunakan `display: none` agar tidak reload saat ganti tab

---

### 6.4 — Import dari cURL
**Status:** ✅ Selesai

- [x] Tombol "Import cURL" di toolbar request builder
- [x] Modal: textarea paste cURL + tombol "Import Request"
- [x] **Deteksi otomatis:** paste teks diawali `curl ` di field URL → dialog konfirmasi
- [x] Support flag cURL: method, url, header, data (body)
- [x] Integrasi library `curlconverter`

---

### 6.5 — Export Request ke Code Snippet
**Status:** ✅ Selesai

- [x] Tombol `</>` di sebelah kanan tombol Send
- [x] Mendukung cURL, JavaScript (Fetch/Axios), Go, dan Python
- [x] Modal hasil: Monaco Editor read-only + tombol Copy + Close
- [x] Support semua body type (raw, form-data, urlencoded)

---

### 6.6 — Drag-and-Drop Request & Folder
**Status:** ✅ Selesai

- [x] Migration: tambah kolom `order_index FLOAT` (double precision) ke tabel REQUEST dan FOLDER
- [x] Update `PATCH /api/v1/requests/:id/move` terima `collection_id`, `folder_id`, `order_index`
- [x] Update `PATCH /api/v1/folders/:id/move` terima `collection_id`, `parent_folder_id`, `order_index`
- [x] UI: Integrasi `@dnd-kit/core` dan `@dnd-kit/sortable` di Sidebar
- [x] Implementasi **Horizontal Split Logic** (Left: Sort, Right: Nest)
- [x] Visual Indicators: Cyan line (Sort), Purple highlight (Nest)
- [x] Support **Move to Root** dengan dropping di header Koleksi
- [x] Optimistic update & automatic collection refresh

---

### 6.7 — Mock Server Dynamic Response
**Status:** ✅ Selesai

- [x] Migration: tambah tabel `mock_scenario` dan kolom `evaluation_mode`
- [x] Backend: Implementasi Condition Evaluator (Query, Body, Header, Path)
- [x] Backend: Implementasi Response Body Template `{{request.body.name}}`
- [x] UI: Scenarios Panel terintegrasi di Mock Server
- [x] UI: Visual Condition Builder (tanpa nulis JSON)
- [x] UI: Drag-and-Drop prioritas evaluasi skenario
- [x] Feature: Manual/Forced mode support
- [x] Feature: Copy as cURL command per endpoint

---

## Fase 7 — Kolaborasi Lanjutan & Mock Pro
**Status:** 🟡 Dalam Proses
**Estimasi:** 2-3 minggu

### Mock Server Pro
- [x] **Copy cURL per Scenario**: Generate cURL yang otomatis memenuhi kondisi skenario (inject query/body/header) untuk testing instan.
- [x] **Binary/PDF Response**: Upload file asli atau simpan base64 sebagai respons mock dengan deteksi otomatis `Content-Type: application/pdf`.

### Kolaborasi & Workflow
- [ ] Notifikasi in-app saat koleksi diupdate member lain
- [ ] Diff viewer visual yang lebih baik untuk versioning
- [ ] Shared environment lintas workspace
- [ ] Thread diskusi pada komentar (reply)
- [ ] Mention anggota (`@nama`) di komentar

---

## Fase 8 — SaaS (Opsional)
**Status:** ⬜ Belum Mulai
**Estimasi:** 4-6 minggu (jika diputuskan)

- [ ] Migrasi backend ke cloud / OpenShift
- [ ] Multi-tenant architecture
- [ ] Billing: Stripe / Midtrans
- [ ] SSO / SAML Enterprise
- [ ] Monitoring: Prometheus + Grafana
- [ ] Logging terpusat: ELK Stack

**Catatan:** Fase ini opsional. Model on-premise bisa berjalan lama tanpa perlu SaaS.
