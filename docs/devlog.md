# Wapify — Development Log

> Setiap agent wajib update file ini setelah menyelesaikan task apapun.
> Entry terbaru di BAWAH.

---

## [2026-04-19] — Finalisasi PRD, Devplan, dan Semua Dokumen

**Fase:** Fase 0 — Setup & Fondasi
**Dikerjakan oleh:** Waluyo + Claude
**Status:** ✅ Selesai

### Yang Dikerjakan
- Diskusi panjang dan finalisasi seluruh arah produk Wapify
- Finalisasi PRD v1.4 dengan scope yang tepat untuk tahap internal dulu
- Finalisasi devplan 6 fase
- Setup semua file rules untuk Antigravity

### Keputusan Teknis (Kronologi)
**Nama produk → Wapify**
**CORS → Electron Desktop App**
**Backend → Go + Fiber**
**Real-time Collaboration → Field-Level Locking**
**Hosting → STB Android + Cloudflare Tunnel**
**On-Premise Ready by Design**
**License System → Ditunda ke Fase 5**
**Email → Resend**
**Super Admin → is_super_admin field di USER**
**No Self-Register**

### Langkah Selanjutnya
- **Fase 0:** Init repo, setup Go module + Electron boilerplate, Docker Compose PostgreSQL, migration pertama
- **Fase 1:** Mulai dari backend Auth dulu, lalu Team Management, lalu Collection/Request, lalu Frontend

---

## [2026-04-19] — Inisialisasi Frontend Electron-Vite

**Fase:** Fase 0 — Setup & Fondasi
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- Membuat folder `apps/desktop`
- Inisialisasi boilerplate `electron-vite` menggunakan template `react-ts`
- Menginstal dependencies inti: `tailwindcss`, `zustand`, `@monaco-editor/react`, `keytar`, serta dependensi Radix UI.

---

## [2026-04-19] — Pembuatan Layout Utama UI Wapify

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- Membuat komponen kerangka dasar UI: `Sidebar`, `Header`, `MainArea`, dan `AppLayout`.

---

## [2026-04-20] — Setup Backend Go + Fiber (Fase 0 & 1 MVP)

**Fase:** Fase 0 → Fase 1 — Setup & MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- Implementasi seluruh endpoint Auth, Team, Collection, Folder, Request, Environment.
- Setup database PostgreSQL dan migrasi awal.
- Admin CLI untuk manajemen user.

---

## [2026-04-20] — Progres Masif: Auth Tab, Request History, dan Sistem Notifikasi

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Auth Tab Implementation**: Implementasi logika dan UI untuk `Bearer Token`, `Basic Auth`, dan `API Key`.
- **Request History**: Backend & Frontend integrasi untuk menyimpan dan menampilkan riwayat eksekusi.
- **Sistem Notifikasi (Toast)**: Integrasi `sonner` untuk feedback global.

---

## [2026-04-20] — Implementasi Multi-Tab System dan Import Postman Collection

**Fase:** Fase 1 → Fase 3 — MVP Internal & Dokumentasi
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Multi-Tab System**: 
    - Refaktor `useDataStore` untuk mendukung array of tabs.
    - Setiap tab memiliki state `workingRequest`, `lastResponse`, dan `isSending` yang terisolasi.
    - UI Tab Bar di `MainArea` dengan fitur close dan indikator perubahan (dirty state).
- **Import Postman Collection**:
    - Backend: Endpoint `/import` untuk parsing file Postman v2.1 (rekursif folder & request).
    - Frontend: `ImportModal` dengan fitur drag-drop file atau paste JSON.
- **UX Polish**: Integrasi `ResponseArea` dan `Header` agar tersinkronisasi dengan tab aktif.

---

## [2026-04-20] — Perbaikan Body Editor dan User/Team Management CRUD

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Body Editor Fix**: 
    - Menggunakan local state + debounce (300ms) untuk editing request body di Monaco Editor.
    - Menghilangkan masalah cursor yang terpental (reset) saat mengetik karena update state global yang lambat.
    - Sinkronisasi otomatis saat perpindahan tab menggunakan `key` property pada komponen `EditorArea`.
- **User Management CRUD**:
    - Backend: Penambahan endpoint `POST /api/v1/admin/users` untuk super admin.
    - Frontend: Implementasi modal "Create User" dan fungsi "Delete User" di Admin Panel.
    - Safety: Mencegah super admin menghapus dirinya sendiri.
- **Team Management CRUD**:
    - Frontend: Implementasi modal "Create Team" dan fungsi "Delete Team" di Admin Panel.
- **Security & Reliability**:
    - Refaktor `apiClient` untuk mencegah kebocoran auth token Wapify ke Target API luar (hanya dikirim ke backend Wapify).
    - Memperbaiki penanganan `Content-Type` otomatis pada request executor.
- **Linting & Stability**: Pembersihan seluruh error `any` dan perbaikan React hooks warnings (synchronous setState in effect).

---

## [2026-04-20] — Ekspansi Fitur Admin & Perbaikan Kolaborasi Tim

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Enhanced User Creation**: 
    - Admin kini bisa menentukan tim awal dan role (Owner/Admin/Editor/Viewer) langsung saat membuat user baru.
    - Implementasi transaksi database (atomic) untuk memastikan user dan membership tim dibuat bersamaan.
- **Team Member Management**:
    - Penambahan modal **"Manage Members"** pada Admin Panel.
    - Fitur menambah member baru ke tim dengan memilih dari daftar user yang ada.
    - Fitur menghapus member dari tim.
- **UI/UX Sidebar**:
    - Penambahan tombol **"+" (Create Team)** pada bagian Teams di Sidebar agar user bisa membuat tim baru dengan mudah.
- **Backend Fixes**:
    - Membuka akses serialisasi `User` pada model `TeamMember` (sebelumnya tersembunyi/json ignored).
    - Preloading data `CreatedBy` dan `User` pada endpoint admin untuk UI yang lebih informatif.
- **Frontend Types**: Sinkronisasi interface `TeamMember` untuk mendukung data user yang di-preload.

### Keputusan & Catatan
- Transaksi database digunakan pada `CreateUser` untuk menjaga integritas data antara tabel `users` dan `team_members`.
- Admin Panel kini jauh lebih fungsional untuk mengelola struktur organisasi tim.

---

## [2026-04-20] — Finalisasi Fase 1: Role Access, Auto-Refresh Token, & Email Resend

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Sistem Role & Kontrol Akses (RBAC)**:
    - Pengecekan mutasi (Create/Update/Delete) pada koleksi, request, dan environment sekarang membutuhkan role minimal **Editor**.
    - Hanya **Owner** atau **Admin** yang bisa mengedit informasi tim dan anggota tim.
- **Team-Scoped History**:
    - Request History sekarang berbasis tim, bukan lagi berbasis user. Semua anggota tim dapat melihat riwayat eksekusi request di tim tersebut.
    - Menampilkan inisial user di sidebar history agar terlihat siapa yang menjalankan eksekusi.
- **Fitur Email Welcome**:
    - Integrasi `resend-go` SDK.
    - Saat Admin membuat User baru, sistem akan otomatis mengirim email selamat datang berisi kredensial login via Resend (jika API Key tersedia di `.env`).
- **Auto-Refresh JWT Token (keytar)**:
    - Implementasi endpoint `POST /api/v1/auth/refresh` di backend.
    - Menggunakan `keytar` via IPC di Electron Main Process untuk menyimpan Refresh Token dengan aman di OS Keychain.
    - API Client di Frontend sekarang memiliki interceptor untuk HTTP 401: otomatis melakukan refresh token dan retry request, atau log out jika refresh gagal.
- **Peningkatan UX Editor & Response**:
    - Penambahan keyboard shortcut `Cmd/Ctrl + Enter` pada request editor untuk mengeksekusi request secara langsung.
    - Penambahan tombol **Copy** pada Response Area untuk kemudahan menyalin payload JSON balasan.
- **Makefile Cross-Compilation**:
    - Dibuatkan `Makefile` di root proyek untuk mempermudah cross-compilation backend Go ke berbagai arsitektur OS (Linux, macOS, Windows, dan STB ARM64).

### Keputusan & Catatan
- Semua target dalam devplan untuk Fase 1 telah tuntas diselesaikan.
- Tim Waluyo sekarang memiliki fitur otentikasi lengkap, manajemen tim & role yang tangguh, sistem histori tim, environment variables, import Postman, dan integrasi Resend email.
- **Siap menuju Fase 2 (Kolaborasi Real-time).**

---

## [2026-04-20] — Perbaikan Bug & Penyempurnaan Fase 1

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Fix Syntax Error ResponseArea**: Memperbaiki syntax error (tag HTML yang belum ditutup) pada `ResponseArea.tsx` yang memblokir build frontend.
- **Penyempurnaan Request Body Save**: Memperbaiki issue di mana `body` editor (Monaco) tidak tersimpan dengan benar ke database PostgreSQL karena backend mengharapkan object (tipe `JSONB`) namun frontend mengirim string murni. Menambahkan konversi otomatis agar string body di-_parse_ ke JSON atau di-_wrap_ dalam object `{ raw: string }` jika berupa string biasa.
- **Penyempurnaan Environment Variables**: Memperbaiki bug pada React Strict Mode/Type dan memastikan Environment Editor modal menginisialisasi `variables` dan menyimpannya secara valid. 
- **Mematikan Resend Email (sementara)**: Sesuai permintaan pengguna, proses pengiriman email Welcome dengan Resend API pada `CreateUser` admin telah dikomentari sementara.
- **Fix Global TypeScript Errors**: Mengganti semua tipe `JSX.Element` menjadi `React.JSX.Element` untuk memperbaiki error TS2503 yang menyebabkan `npm run typecheck` gagal.
- **Menyertakan User di History**: Update tipe `RequestHistory` untuk menyertakan objek `user`.

### Perubahan File
- `apps/desktop/src/renderer/src/components/layout/ResponseArea.tsx` — Perbaikan syntax closing div
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Perbaikan handle dan parsing body request
- `apps/desktop/src/renderer/src/types/index.ts` — Update interface RequestHistory
- `backend/internal/api/admin.go` — Mengomentari fungsi `email.SendWelcomeEmail`
- `apps/desktop/tsconfig.web.json` dkk — Fix JSX types di seluruh file

### Keputusan & Catatan
- Memastikan tipe `body` API Request berjalan mulus antara `map[string]interface{}` (Go JSONB) dengan text string editor (TypeScript).
- Fungsi Fase 1 kini berjalan jauh lebih stabil dan tidak ada error pada `npm run typecheck`.

### Langkah Selanjutnya
- Lanjut ke eksekusi **Fase 2 — Kolaborasi Real-time** dengan fokus pada setup Websocket dan *field-level locking*.

---

## [2026-04-20] — Fix Build Error Backend & Finalisasi Semua Endpoint

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Fix Compile Error**: Memperbaiki 3 error kompilasi yang mencegah `go run cmd/server/main.go` berjalan dari folder `backend/`:
  - `admin.go`: hapus import `email` yang tidak terpakai (kode email sudah dikomentari)
  - `collection.go`: hapus field `CreatedByID` yang tidak ada di struct `repository.Folder`
  - `collection.go`: fix tipe `headers` dari `map[string]string` → `repository.JSONB` agar type-safe
- **Migration `000002_add_history`**: Jalankan migrasi yang sudah ada untuk tabel `request_histories`
- **Migration `000003_add_team_id_to_histories`**: Tambah kolom `team_id` ke tabel `request_histories` agar history bisa difilter per tim
- **Verifikasi Server**: Backend berhasil jalan di port 8000 dengan **93 handlers** aktif

### Perubahan File
- `backend/internal/api/admin.go` — hapus unused import `email`
- `backend/internal/api/collection.go` — fix `Folder` struct literal + fix tipe `headers`
- `backend/migrations/000003_add_team_id_to_histories.up.sql` — tambah kolom `team_id`
- `backend/migrations/000003_add_team_id_to_histories.down.sql` — rollback migration

### Keputusan & Catatan
- Folder `backend/` tidak punya `main.go` di root, harus dijalankan dengan `go run cmd/server/main.go` dari dalam folder `backend/`
- Model `Folder` sengaja tidak punya `CreatedByID` karena skema SQL migrasi tidak memiliki kolom tersebut; untuk traceability folder cukup lewat `collection_id`
- Semua 93 endpoint backend sudah berjalan dan terverifikasi build clean

### Langkah Selanjutnya
- Integrasi penuh frontend (Electron) dengan backend yang sudah live
- Build backend untuk STB Android: `GOARCH=arm64 GOOS=linux go build ./cmd/server/`
- Deploy via Cloudflare Tunnel ke `api.wapify.io`
---

## [2026-04-20] — Implementasi Folder Rekursif & Perbaikan Environment

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Sistem Folder Rekursif (Nested Folders)**:
    - Backend: Update `ListRequestsInCollection` untuk mengembalikan seluruh request dalam koleksi tanpa memedulikan kedalaman folder.
    - Frontend: Refaktor `fetchCollectionContents` untuk mengelompokkan request berdasarkan `folder_id` secara dinamis.
    - UI: Refaktor `FolderItem` di Sidebar agar mendukung rendering sub-folder secara rekursif (unlimited depth).
    - Fitur: Menambahkan tombol "Add Folder" dan "Add Request" langsung pada folder dan koleksi di Sidebar.
- **Environment Management Fixes**:
    - Memperbaiki bug di mana `activeEnvironmentId` selalu reset ke item pertama setiap kali data di-refresh. Sekarang ID lingkungan yang aktif akan dipertahankan selama masih ada dalam daftar.
    - UI: Menambahkan shortcut icon gear (Manage Environments) langsung di Sidebar bagian bawah untuk kemudahan akses tanpa harus ke Header.
- **Data Integrity**:
    - Memastikan pembersihan data request lama saat berpindah koleksi atau melakukan import untuk mencegah tampilan data "sampah" atau "stale".

### Perubahan File
- `backend/internal/api/request.go` — Backend request filtering fix.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Grouping logic & environment persistence.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Recursive folder UI & action buttons.

### Keputusan & Catatan
- Keputusan untuk mengembalikan seluruh request koleksi sekaligus (flat list) dari backend dan melakukan pengelompokan di frontend diambil untuk mengurangi jumlah round-trip API saat membuka koleksi besar.
- Penambahan tombol aksi langsung di Sidebar meningkatkan efisiensi navigasi user secara signifikan dibandingkan menggunakan modal atau prompt terpisah.

### Langkah Selanjutnya
- Persiapan untuk testing eksekusi request dengan variabel lingkungan (Environment Variables substitution).
- Lanjut ke Fase 2 (Real-time collaboration).

---

## [2026-04-20] — Perbaikan UI Bug & Refaktor Manajemen Role Per-Tim

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **UI Bug Fix: Monaco Editor Loading**:
    - Memperbaiki issue di mana editor request body tertahan di status "Loading..." dengan menambahkan indikator loading kustom dan memastikan sinkronisasi state yang lebih baik saat perpindahan tab.
    - Menambahkan `useEffect` untuk sinkronisasi `localBody` di `EditorArea` agar konten editor selalu mutakhir.
- **UI Bug Fix: Sidebar Folders**:
    - Memperbaiki issue di mana koleksi yang diimpor tidak menampilkan request (karena berada di dalam folder).
    - Implementasi komponen `FolderItem` secara rekursif di `Sidebar` untuk mendukung struktur folder tak terbatas.
- **Role Management Refactoring**:
    - **Backend**: Update API `AddTeamMember` dan `UpdateTeamMember` (di `team_member.go` dan `admin.go`) untuk mencegah assignment role "Owner" secara manual. Role "Owner" kini eksklusif untuk pencipta tim.
    - **Frontend**: Menghapus opsi role "Owner" dari UI pembuatan user dan manajemen anggota tim.
    - **Data Consistency**: Menghapus dependensi role global pada user, beralih sepenuhnya ke role berbasis tim.

### Perubahan File
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — Fix Editor loading & state sync.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Implementasi `FolderItem` rekursif.
- `backend/internal/api/team_member.go` — Enforce safety rules untuk role Owner.
- `backend/internal/api/admin.go` — Enforce safety rules untuk role Owner pada admin API.
- `apps/desktop/src/renderer/src/components/admin/UserManagement.tsx` — Hapus opsi Owner.
- `apps/desktop/src/renderer/src/components/admin/TeamManagement.tsx` — Hapus opsi Owner.

### Keputusan & Catatan
- Keputusan untuk mengunci role "Owner" hanya bagi pembuat tim bertujuan untuk menjaga integritas kepemilikan tim dan mencegah eskalasi hak akses yang tidak disengaja.
- Struktur sidebar rekursif memastikan Wapify siap menangani koleksi Postman yang sangat kompleks dengan banyak level folder.

### Langkah Selanjutnya
- Monitor performa editor pada koleksi besar.
- Persiapan transisi ke kolaborasi real-time (Fase 2).

---

## [2026-04-20] — Implementasi Scripting Engine (Wapify SDK v1.0)

**Fase:** Fase 4 — Automated Testing
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai (Early Delivery)

### Yang Dikerjakan
- **Scripting Engine (JavaScript)**: 
    - Implementasi Pre-request Script (sebelum request) dan Tests Script (setelah response).
    - Eksekusi script dilakukan di sisi Renderer menggunakan `new Function` sandbox untuk interaksi langsung dengan state.
- **Wapify SDK (`wap` object)**:
    - Objek global `wap` (dan alias `pm` untuk kompatibilitas Postman) untuk manajemen environment dan testing.
    - `wap.set(key, value)`: Inject variabel temporary untuk request saat ini (tanpa simpan ke DB).
    - `wap.setEnv(key, value)`: Update variabel environment permanen di database.
    - `wap.test()` & `wap.expect()`: Framework testing sederhana untuk validasi response.
    - `wap.response.json()`: Helper untuk memproses data response.
- **Library Integration (Offline First)**:
    - Bundling `moment` dan `lodash` (`_`) ke dalam context script agar bisa digunakan tanpa internet.
- **Visual Feedback**:
    - Penambahan tab **Scripts** dengan Monaco Editor (JS syntax highlighting).
    - Indikator titik hijau pada tab **Body**, **Headers**, **Auth**, dan **Scripts** jika terdapat konfigurasi/isi aktif.
- **Backend & Migration**:
    - Migration `000004_add_scripts_to_requests`: Menambahkan kolom `pre_request_script` dan `post_request_script` (TEXT) pada tabel `requests`.
    - Update Go models dan API handlers untuk mendukung sinkronisasi script.

### Keputusan & Catatan
- Keputusan menggunakan `wap` sebagai objek utama bertujuan untuk branding, namun alias `pm` tetap disertakan agar user bisa langsung menggunakan script dari Postman tanpa edit manual.
- Fitur ini (Fase 4) ditarik maju karena urgensi otomatisasi variabel token yang diminta pengguna.
- Library `moment` dan `lodash` dipilih karena merupakan standar industri dalam scripting API client.

### Perubahan File Utama
- `backend/internal/repository/models.go` — Schema update.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Core execution logic.
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — UI & Indicators.

---

## [2026-04-20] — Refinement Scripting Engine & Premium UI Polish

**Fase:** Fase 1 → Fase 4 — MVP & Testing
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Fix Persistence Bug**: 
    - Memperbaiki *race condition* pada `wap.setEnv` yang menyebabkan variabel gagal tersimpan ke database saat script berjalan cepat. 
    - Implementasi sinkronisasi state instan sebelum melakukan API call asinkron.
- **Enhanced Variable Substitution**:
    - **Case-Insensitive Match**: Substitusi variabel `{{baseUrl}}` kini tidak lagi sensitif terhadap huruf besar/kecil, meningkatkan toleransi kesalahan penulisan user.
    - **Loosened Validation**: Menghilangkan pemblokiran request jika variabel belum ditemukan (sekarang hanya muncul peringatan di konsol, mirip perilaku Postman).
- **Premium UI/UX Polish**:
    - **Hover Tooltips**: Implementasi tooltip variabel yang lebih "premium" dengan gaya glassmorphism, backdrop-blur, dan animasi transisi yang halus.
    - **Navbar Environment Selector**: Penambahan pemilih environment langsung di baris URL (Navbar) untuk kemudahan kontrol dan sinkronisasi status environment yang lebih jelas.
    - **Precise Character Detection**: Peningkatan akurasi deteksi posisi kursor pada font mono untuk memunculkan hover tepat di atas variabel.
- **Scripting SDK Debugging**:
    - Penambahan logging detail (`[Wapify] ...`) pada konsol browser untuk memantau siklus hidup pre-request dan post-request script.
    - Penambahan alias `wap.set` dan perbaikan `wap.response.json()` agar lebih tangguh.

### Perubahan File Utama
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Perbaikan logika substitusi dan sinkronisasi variabel.
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — Penambahan Navbar Selector dan perbaikan hover URL.
- `apps/desktop/src/renderer/src/components/ui/KeyValueEditor.tsx` — Perbaikan hover pada Header/Params editor.

### Keputusan & Catatan
- Keputusan untuk meletakkan environment selector di Navbar bertujuan untuk mengurangi kebingungan user saat bekerja dengan banyak tab dan environment yang berbeda.
- Penanganan variabel yang tidak lagi memblokir request memberikan kebebasan bagi user untuk melakukan debug manual di sisi server jika diperlukan.

---

## [2026-04-20] — UX Stability: Persistence, Auth Rehydration & Sidebar State

**Fase:** Fase 1 — MVP Internal
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Auth Rehydration**:
    - Implementasi `rehydrateAuth` di `useAuthStore` untuk membaca *Refresh Token* dari Keychain OS saat aplikasi dimuat.
    - Menghilangkan keharusan login ulang saat melakukan refresh (`Cmd + R`) atau membuka kembali aplikasi.
    - Penambahan *Splash Screen* ("Initializing Wapify...") untuk transisi yang lebih mulus saat pengecekan token.
- **State Persistence (Zustand Persist)**:
    - Integrasi middleware `persist` pada `useDataStore` untuk menyimpan state penting ke `localStorage`.
    - State yang dipersist: `activeTeamId`, `activeTabId`, `activeEnvironmentId`, dan `expandedItems`.
- **Sidebar State Recovery**:
    - Memindahkan state daftar folder/koleksi yang terbuka (`expandedItems`) dari lokal komponen ke global store.
    - Implementasi pemulihan otomatis: Saat aplikasi dimuat, sistem akan otomatis melakukan *re-fetch* konten untuk seluruh koleksi yang sedang terbuka.
    - Fix: Folder dan Koleksi tidak lagi *collapse* (tertutup) secara otomatis saat data di-refresh.
- **Robustness Improvements**:
    - Perbaikan bug pada fungsi `deleteEnvironment` dengan penambahan logging dan pembersihan ID aktif jika environment yang sedang digunakan dihapus.

### Perubahan File Utama
- `apps/desktop/src/renderer/src/store/useAuthStore.ts` — Logika rehydration token.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Konfigurasi persistensi dan global expansion state.
- `apps/desktop/src/renderer/src/App.tsx` & `AppLayout.tsx` — Alur inisialisasi data otomatis.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Sinkronisasi UI dengan global expansion state.

### Keputusan & Catatan
- Keputusan untuk mem-persist `expandedItems` sangat krusial untuk menjaga konteks kerja user, terutama pada koleksi yang memiliki struktur folder dalam.
- Penggunaan Keychain OS (via `keytar`) untuk *Refresh Token* tetap dipertahankan sebagai standar keamanan tinggi dibandingkan menyimpannya di `localStorage`.
+
+---
+
+## [2026-04-20] — Implementasi Fase 2: Kolaborasi Real-time & Versioning
+
+**Fase:** Fase 2 — Kolaborasi Real-time
+**Dikerjakan oleh:** Antigravity
+**Status:** ✅ Selesai
+
+### Yang Dikerjakan
+- **WebSocket Collaboration Engine**:
+    - Backend: Implementasi `Hub` dan `Client` menggunakan `gofiber/contrib/websocket` untuk manajemen koneksi per tim.
+    - Presence: Fitur melacak user yang sedang aktif pada request tertentu (indikator avatar di UI).
+    - Field-level Locking: Sistem penguncian otomatis (TTL 5 detik) saat user mulai mengetik untuk mencegah conflict editing.
+    - Real-time Broadcast: Sinkronisasi sidebar dan koleksi secara instan saat ada perubahan entitas (Request/Folder/Collection) dari user lain.
+- **Versioning & Rollback**:
+    - Fitur snapshot otomatis versi request setiap kali user menekan tombol Save.
+    - Panel **History** untuk melihat daftar versi sebelumnya dan melakukan rollback instan ke snapshot terpilih.
+- **Team Communication**:
+    - Fitur **Comments** per request untuk diskusi tim secara langsung di dalam aplikasi.
+    - Fitur **Activity Log** untuk merekam jejak perubahan penting (create/update/delete) di seluruh tim.
+- **UI Integration**:
+    - Pembuatan **Collaboration Panel** (Right Sidebar) untuk akses Comments dan History secara berdampingan.
+    - Integrasi status locking pada seluruh input form (URL, Headers, Body, Scripts, Auth) dengan feedback visual yang jelas.
+
+### Keputusan & Catatan
+- Menggunakan `gofiber/contrib/websocket` (wrapper gorilla) karena performa dan integrasi yang mulus dengan framework Fiber.
+- Implementasi locking bersifat *pessimistic* dengan TTL singkat (5 detik) untuk memberikan UX yang aman namun tetap responsif.
+- Versioning dilakukan di level `Request` (bukan seluruh koleksi sekaligus) sesuai kebutuhan user untuk performa yang lebih ringan.
+
+### Milestone ✅
+- Sistem kolaborasi real-time Wapify kini siap digunakan. User bisa melihat rekan tim mereka, berdiskusi via komentar, dan bekerja tanpa takut menimpa perubahan orang lain.
+---