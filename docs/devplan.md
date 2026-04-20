# Wapify — Development Plan

**Terakhir Diperbarui:** 20 April 2026
**Status Saat Ini:** ✅ Fase 1 — MVP Internal (Selesai), 🟡 Fase 4 — Testing (SDK Selesai)

---

## Ringkasan Fase

| Fase | Nama | Target | Status |
|---|---|---|---|
| 0 | Setup & Fondasi | Repo & tooling siap | ✅ Selesai |
| 1 | MVP Internal | Tim Waluyo bisa pakai minggu ini | ✅ Selesai |
| 2 | Kolaborasi Real-time | Field locking, presence, versioning | ⬜ Belum Mulai |
| 3 | Dokumentasi & Mock Server | Generate docs, mock API | ⬜ Belum Mulai |
| 4 | Testing & CI/CD | Collection runner, CLI | ⬜ Belum Mulai |
| 5 | On-Premise & License | Jual ke client luar | ⬜ Belum Mulai |
| 6 | SaaS (Opsional) | Cloud hosted di wapify.io | ⬜ Belum Mulai |

---

## Fase 0 — Setup & Fondasi
**Target:** Repo siap, bisa run lokal, CI terkonfigurasi.
**Estimasi:** 1 hari

### Checklist
- [ ] Init repo: `apps/desktop`, `backend`, `docs`, `.agents`
- [ ] Go module backend: `go mod init`
- [ ] React + Electron boilerplate di `apps/desktop`
- [ ] Docker Compose: PostgreSQL lokal untuk development
- [ ] golang-migrate: migration pertama (schema USER, TEAM, TEAM_MEMBER, COLLECTION, FOLDER, REQUEST, ENVIRONMENT)
- [ ] golangci-lint config
- [ ] ESLint + Prettier config
- [ ] GitHub Actions: lint + test on PR
- [ ] README: cara run lokal

### Struktur Folder
```
wapify/
├── apps/
│   └── desktop/              # Electron + React
│       ├── src/
│       │   ├── main/         # Electron Main Process
│       │   └── renderer/     # React UI
│       ├── electron-builder.yml
│       └── package.json
├── backend/                  # Go + Fiber
│   ├── cmd/
│   │   ├── server/main.go    # Backend server
│   │   └── admin/main.go     # Admin CLI (buat user, dll)
│   ├── internal/
│   │   ├── api/              # HTTP handlers
│   │   ├── service/          # Business logic
│   │   ├── repository/       # DB queries (GORM)
│   │   ├── middleware/        # Auth, super admin, role check
│   │   └── email/            # Resend integration
│   ├── migrations/           # SQL migration files
│   └── go.mod
├── docs/
│   ├── prd.md
│   ├── devplan.md
│   └── devlog.md
└── .agents/
    ├── rules/project-context.md
    └── workflows/
```

---

## Fase 1 — MVP Internal ⭐ PRIORITAS UTAMA
**Target:** Tim Waluyo (15+ orang) bisa pakai Wapify sebagai pengganti Postman minggu ini.
**Estimasi:** 4-5 hari

### Backend (Go + Fiber)

**Auth & User**
- [x] `POST /api/v1/auth/login` — login dengan email + password, return JWT + refresh token
- [x] `POST /api/v1/auth/refresh` — refresh JWT
- [x] `POST /api/v1/auth/logout` — revoke refresh token
- [x] Admin CLI: `wapify-admin create-user --email --name --password --super`
- [x] Admin CLI: `wapify-admin list-users`
- [ ] Admin CLI: `wapify-admin reset-password --email --password`
- [x] Middleware: verifikasi JWT di semua endpoint yang perlu auth
- [x] Middleware: super admin bypass (jika `is_super_admin=true`, skip role check)
- [x] Middleware: role check per endpoint (Owner/Admin/Editor/Viewer)

**Team Management**
- [x] `POST /api/v1/teams` — buat tim baru
- [x] `GET /api/v1/teams` — list tim (super admin: semua, user biasa: tim sendiri)
- [x] `GET /api/v1/teams/:id` — detail tim
- [x] `PUT /api/v1/teams/:id` — edit nama/deskripsi tim
- [x] `DELETE /api/v1/teams/:id` — hapus tim (Owner/Super Admin)
- [x] `POST /api/v1/teams/:id/members` — tambah member ke tim (Admin+)
- [x] `PUT /api/v1/teams/:id/members/:userId` — ubah role member
- [x] `DELETE /api/v1/teams/:id/members/:userId` — hapus member dari tim
- [x] Email: kirim kredensial ke member baru via Resend (dimatikan sementara, kode sudah ada)

**Collection & Request**
- [x] `GET/POST /api/v1/teams/:id/collections` — list + buat koleksi
- [x] `GET/PUT/DELETE /api/v1/collections/:id` — detail, edit, hapus koleksi
- [x] `POST /api/v1/teams/:id/import` — import dari Postman JSON v2.1
- [x] `GET/POST /api/v1/collections/:id/folders` — list + buat folder
- [x] `PUT/DELETE /api/v1/folders/:id` — edit, hapus folder
- [x] `GET/POST /api/v1/folders/:id/requests` — list + buat request dalam folder
- [x] `GET/POST /api/v1/collections/:id/requests` — list + buat request di root koleksi
- [x] `GET/PUT/DELETE /api/v1/requests/:id` — detail, edit, hapus request

**Environment**
- [x] `GET/POST /api/v1/teams/:id/environments` — list + buat environment
- [x] `GET/PUT/DELETE /api/v1/environments/:id` — detail, edit, hapus
- [x] Interpolasi `{{variable}}` di URL, headers, body saat request disimpan
- [x] Scripting Engine: Pre-request & Post-request (Wapify SDK v1.0)

**Admin API (Super Admin)**
- [x] `GET /api/v1/admin/users` — list semua user
- [x] `POST /api/v1/admin/users` — buat user baru (dengan assign tim & role opsional)
- [x] `DELETE /api/v1/admin/users/:id` — hapus user
- [x] `GET /api/v1/admin/teams` — list semua tim
- [x] `POST /api/v1/admin/teams/:id/members` — admin tambah member ke tim
- [x] `DELETE /api/v1/admin/teams/:id/members/:userId` — admin hapus member dari tim

**Request History**
- [x] `GET /api/v1/history?team_id=X` — list history eksekusi request per tim
- [x] `POST /api/v1/history` — simpan history eksekusi
- [x] `DELETE /api/v1/history/:id` — hapus satu history
- [x] `DELETE /api/v1/history?team_id=X` — clear semua history tim

### Frontend (Electron + React)

**Auth**
- [x] Login screen (email + password)
- [x] JWT disimpan di memory + refresh token di OS keychain via keytar
- [x] Auto-refresh JWT sebelum expired
- [x] Logout

**Layout Utama**
- [x] Sidebar kiri: daftar tim + koleksi + folder + request (tree view)
- [x] Header: nama user, tim aktif, environment selector dropdown
- [x] Main area: request builder

**Sidebar**
- [x] List tim yang diikuti user (atau semua tim jika super admin)
- [x] Expand tim → list koleksi
- [x] Expand koleksi → list folder + request
- [x] Klik request → buka di main area
- [x] Tombol buat koleksi baru, folder baru, request baru
- [x] Import Postman (drag & drop atau file picker)

**Request Builder**
- [x] Method selector (GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS)
- [x] URL input dengan autocomplete environment variable `{{var}}`
- [x] Tab: Params, Headers, Body (JSON/Form/Raw), Auth
- [x] Auth config: None, Basic Auth, Bearer Token, API Key
- [x] Tombol Send
- [x] Keyboard shortcut: Cmd+Enter / Ctrl+Enter untuk Send

**Response Viewer**
- [x] Status code + waktu response + ukuran payload
- [x] Tab: Body (JSON pretty-print + raw), Headers
- [x] Copy response button

**Admin Panel (khusus Super Admin)**
- [x] List semua user
- [x] Buat user baru (form: nama, email, password)
- [x] Assign user ke tim dengan role
- [x] Hapus / suspend user

**Electron Main Process**
- [x] IPC handler: terima request config dari Renderer → kirim HTTP → return response
- [x] Support semua method HTTP
- [x] Support custom headers + body
- [x] Return: status, headers, body, timing

### Build & Distribusi
- [ ] Build Go backend: `GOARCH=arm64 GOOS=linux` untuk STB Android
- [ ] Setup Cloudflare Tunnel ke STB
- [ ] Build Electron: `.dmg` (macOS) + `.exe` (Windows)
- [ ] Share installer ke tim via link download (Google Drive / Telegram)
- [ ] Buat akun untuk semua anggota tim via admin CLI
- [x] Kirim kredensial ke masing-masing anggota via email (Resend)

**Milestone ✅:** 15+ anggota tim berhasil login, lihat koleksi, kirim request ke API manapun tanpa CORS error. Waluyo bisa kelola tim dan member dari super admin panel.

---

## Fase 2 — Kolaborasi Real-time
**Target:** Tim bisa bekerja di koleksi yang sama tanpa conflict.
**Estimasi:** 2-3 minggu

- [ ] WebSocket server (gorilla/websocket)
- [ ] Presence indicator (siapa yang buka request yang sama)
- [ ] Field-level locking (TTL 5 detik, auto-release)
- [ ] Save & broadcast perubahan ke semua member online
- [ ] Versioning: snapshot COLLECTION_VERSION setiap Save
- [ ] Rollback ke versi sebelumnya
- [ ] Komentar pada request
- [ ] Activity log per koleksi

**Milestone ✅:** 2 member buka request yang sama, tidak conflict, perubahan langsung terlihat.

---

## Fase 3 — Dokumentasi & Mock Server
**Target:** Generate docs API dan mock server dari koleksi.
**Estimasi:** 2 minggu

- [ ] Generate dokumentasi (HTML + Markdown) dari koleksi
- [ ] Mock server engine dengan conditional response
- [ ] UI: documentation viewer + export
- [ ] UI: mock server management

**Milestone ✅:** User bisa export dokumentasi dan aktifkan mock server.

---

## Fase 4 — Automated Testing & CI/CD
**Target:** Test script + Collection Runner + CLI.
**Estimasi:** 2 minggu

- [x] Test runner JavaScript via Renderer-side execution (sandbox)
- [ ] Collection Runner (jalankan seluruh koleksi)
- [ ] CLI: `wapify run --collection --env --reporter json|junit`
- [x] UI: test script editor + laporan hasil

**Milestone ✅:** `wapify run` bisa dipakai di pipeline CI/CD.

---

## Fase 5 — On-Premise & License Server
**Target:** Wapify bisa dijual ke client luar dengan model on-premise license.
**Estimasi:** 3-4 minggu

- [ ] License Server (Go) di STB Android
- [ ] Ed25519 keypair: Private Key di STB, Public Key di-embed di binary backend
- [ ] Discovery pattern: `lic.wapify.io/discovery`
- [ ] Flow: aktivasi → refresh harian → grace period 7 hari → read-only mode
- [ ] Dashboard license: generate/revoke key, list client aktif
- [ ] Binary obfuscation dengan `garble`
- [ ] Installer on-premise + dokumentasi instalasi
- [ ] Build multi-platform: `linux/amd64`, `linux/arm64`, `windows/amd64`, `darwin/arm64`
- [ ] Landing page wapify.io

**Pricing:**
- Team (maks 10 seat): Rp 500rb/bln atau Rp 5jt/thn
- Business (unlimited seat): Rp 2jt/bln atau Rp 20jt/thn
- Enterprise: Custom

**Milestone ✅:** Client pertama berhasil install on-premise dan bayar license.

---

## Fase 6 — SaaS (Opsional)
**Target:** Wapify tersedia sebagai cloud SaaS.
**Estimasi:** 4-6 minggu (jika diputuskan)

- [ ] Migrasi backend ke OpenShift / cloud
- [ ] Multi-tenant architecture
- [ ] Billing: Stripe / Midtrans
- [ ] SSO / SAML Enterprise
- [ ] Monitoring + logging terpusat

**Catatan:** Fase ini opsional. Model on-premise bisa berjalan lama tanpa perlu SaaS.