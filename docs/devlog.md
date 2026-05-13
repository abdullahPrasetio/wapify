
## [2026-05-13] — Shared Environment Lintas Workspace
**Fase:** Fase 7 — Kolaborasi Lanjutan & Mock Pro
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Database Schema**: Menambahkan kolom `is_global BOOLEAN DEFAULT FALSE` pada tabel `environments` dan membuat kolom `team_id` menjadi *nullable* untuk membedakan antara environment milik workspace tertentu dan environment global.
- **Backend API**: Memodifikasi rute REST API agar query `ListEnvironments` juga mengembalikan environment global, dan menambahkan rute eksklusif `POST /api/v1/environments/global` yang hanya bisa diakses oleh Super Admin. Mengimplementasi logika autorisasi (*role-based*) di fungsi edit dan delete untuk mencegah pengguna biasa mengubah global environment.
- **Backend Tests**: Memperbarui dan menyelaraskan puluhan unit tests terkait manipulasi *environments* (`environment_test.go`) guna memastikan coverage 100% dan regresi keamanan yang ketat.
- **State Store (Frontend)**: Meng-update metode pada `useDataStore.ts` untuk menangani format respon baru dan menambahkan fungsionalitas `createGlobalEnvironment`.
- **UI/UX Enhancement**: Memodifikasi `EnvironmentModal.tsx` agar visualisasi daftar environment dibagi menjadi dua kategori secara eksplisit (**🌍 Global Environments** dan **🏢 Workspace Environments**). Menambahkan proteksi *read-only* bagi environment global apabila yang mengakses adalah user biasa. Memberikan opsi checkbox 'Shared/Global' bagi Super Admin saat menambahkan environment baru. Mengatur layout dropdown `Sidebar` agar menampilkan grup (*optgroups*) dengan rapi.

### Perubahan File
- `backend/migrations/000026_support_shared_environments.up.sql` & `.down.sql` — Database migration script.
- `backend/internal/repository/models.go` — Update struktur data `Environment`.
- `backend/internal/api/environment.go` & `environment_test.go` — Backend core logic dan tes.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Manajemen state untuk memfasilitasi pembuatan global environment.
- `apps/desktop/src/renderer/src/components/modals/EnvironmentModal.tsx` — Peningkatan UI modal pengelolaan environment.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Pengelompokkan menu *dropdown select*.
- `apps/desktop/src/renderer/src/types/index.ts` — Pembaruan Type definisi Typescript.

### Keputusan & Catatan
- Memutuskan untuk membuat rute eksklusif `/api/v1/environments/global` dibanding mengeksploitasi endpoint per-tim (meskipun secara fungsi sama) agar API architecture tetap rapi dan *semantic*.
- Super Admin secara default menjadi satu-satunya entitas yang memiliki hak akses C-U-D (Create, Update, Delete) untuk Global Environment. User lain hanya berhak menggunakan dan membaca (R).

### Langkah Selanjutnya
- Melanjutkan fitur tersisa di Fase 7: Diff Viewer, Thread Diskusi, dan Mention (`@nama`).

---

## [2026-05-13] — User Profile Dropdown Menu Redesign
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **UI Redesign**: Merombak tampilan menu profil pengguna di pojok kiri bawah `Sidebar`.
- **Dropdown Menu**: Memindahkan tombol akses (Confluence Settings, App Settings, Change Password, Logout) ke dalam `DropdownMenu` menggunakan komponen dari Radix UI untuk membuat tampilan sidebar lebih minimalis dan elegan.
- **User Avatar**: Mengganti tampilan nama dan email teks murni dengan komponen avatar inisial (mengambil 2 huruf pertama dari nama) sebagai *trigger* untuk membuka dropdown menu.
- **Layout Adjustments**: Memastikan komponen Notification Bell tetap berada di luar dropdown agar pengguna tetap dapat melihat notifikasi masuk dengan cepat.

### Perubahan File
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Implementasi Radix UI `DropdownMenu` dan perombakan struktur menu pengguna.

### Keputusan & Catatan
- Memutuskan untuk menggunakan komponen DropdownMenu dari `@radix-ui/react-dropdown-menu` yang sudah ada di dependensi (*package.json*) demi memastikan konsistensi interaksi dengan elemen UI lain di Wapbolt.
- Memisahkan komponen Notifikasi sesuai spesifikasi agar urgensinya tetap tinggi.

### Langkah Selanjutnya
- Melanjutkan perbaikan atau pengembangan fitur lain di Fase 7.

---

## [2026-05-12] — Confluence Sync Integration & v1.6.0
**Fase:** Fase 3 — Dokumentasi & Mock Server (Advanced)
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Version Bump**: Menaikkan versi aplikasi ke **1.6.0**.
- **Full Confluence Integration**:
    - Implementasi sinkronisasi dokumentasi API langsung ke Confluence (Cloud & Server/DC).
    - Dukungan autentikasi ganda: **Personal Access Token (PAT)** dan **Atlassian Cloud API Token**.
    - Penambahan sistem *Auth Method Switcher* yang menyimpan preferensi autentikasi per-user di database.
    - Sinkronisasi otomatis menyertakan: Metadata (Deskripsi), Navigasi (TOC), Request Body Validation, dan Contoh Respons (Examples).
- **UI/UX Consistency**:
    - Standarisasi warna Method HTTP di seluruh aplikasi (GET: Emerald, POST: Amber, PUT: Blue, PATCH: Sky, DELETE: Rose).
    - Penyesuaian warna method pada Documentation Panel, Mock Server, dan Main Request Builder.
    - Pembersihan visual pada label validasi (Validation Rules) menjadi warna netral (*slate*) untuk keterbacaan yang lebih baik.
- **Developer Utilities**:
    - Penambahan fitur **Auto-generated cURL** pada panel dokumentasi aplikasi.
    - Optimasi performa rendering dokumentasi dengan batas tinggi (max-height) pada blok respons JSON.
- **TypeScript & Stability**:
    - Perbaikan 16+ error TypeScript terkait penanganan data `unknown` dari API.
    - Sinkronisasi tipe data antara Electron Main Process (IPC) dengan Renderer untuk fitur Confluence.

### Perubahan File
- `apps/desktop/package.json` — Version 1.6.0.
- `docs/release.md` — Log rilis kumulatif diperbarui.
- `docs/releases/v1.6.0.md` — Detail rilis v1.6.0 dibuat.
- `backend/migrations/000019..000025` — Migrasi skema Confluence (Global & User settings).
- `apps/desktop/src/renderer/src/components/layout/DocumentationPanel.tsx` — UI dokumentasi & sync engine.
- `apps/desktop/src/renderer/src/components/modals/UserConfluenceSettingsModal.tsx` — Modal settings user baru.
- `apps/desktop/src/main/index.ts` — IPC handler untuk Confluence.
- `apps/desktop/src/renderer/src/env.d.ts` — Type definitions untuk IPC bridge.

### Keputusan & Catatan
- Memilih untuk mempertahankan data kredensial (Email/PAT/Token) di database meskipun user berpindah metode autentikasi, guna memudahkan user saat ingin berganti kembali tanpa input ulang.
- Menggunakan pendekatan *switch* eksplisit di UI daripada deteksi otomatis field kosong untuk menghindari ambiguitas autentikasi.

---

## [2026-05-12] — Structured API Validation & v1.5.1
**Fase:** Fase 3 — Dokumentasi & Mock Server (Enhancement)
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Version Bump**: Menaikkan versi aplikasi ke **1.5.1**.
- **Structured API Validation System (V2)**:
    - Migrasi sistem validasi dari inline comments (`//`) ke metadata terstruktur menggunakan kolom JSONB.
    - Penambahan tab **"Validation"** pada Request Builder untuk mengelola aturan (Required, Email, Length, dll) secara visual.
    - Implementasi auto-generation field validation berdasarkan header dan body yang aktif.
    - Sinkronisasi otomatis antara UI Validation dengan database backend.
- **Documentation Overhaul**:
    - Panel Dokumentasi kini merender metadata validasi secara dinamis tanpa parsing teks.
    - Penambahan kolom **Description** khusus pada tabel dokumentasi untuk meningkatkan keterbacaan.
    - Optimasi layout tabel (lebar kolom & ukuran font) agar lebih nyaman dibaca pada dokumentasi yang kompleks.
- **Codebase Cleanup**:
    - Penghapusan seluruh logika *legacy* `stripInlineComments` di Main Process dan `parseAnnotations` di Frontend.
    - Perbaikan bug sinkronisasi state `workingRequest` pada fitur `openExample` dan `createRequest`.

### Perubahan File
- `apps/desktop/package.json` — Version 1.5.1.
- `release.md` — Ringkasan rilis untuk pengguna.
- `backend/migrations/000018_add_field_validations_to_requests.up.sql` — Kolom JSONB baru.
- `apps/desktop/src/renderer/src/components/layout/DocumentationPanel.tsx` — UI dokumentasi baru.
- `apps/desktop/src/main/index.ts` — Pembersihan legacy logic.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Integrasi field_validations ke store.

### Keputusan & Catatan
- Memutuskan memisahkan kolom deskripsi dari kolom validasi di dokumentasi agar informasi penting tidak terpotong (truncated).
- Menggunakan pendekatan JSONB di PostgreSQL untuk fleksibilitas aturan validasi di masa depan tanpa perlu migrasi skema berulang kali.

---
+## [2026-05-11] — Real-Time Notifications, Deep Linking & v1.5.0
+**Fase:** Fase 7 — Kolaborasi Lanjutan
+**Dikerjakan oleh:** Antigravity
+**Status:** ✅ Selesai
+
+### Yang Dikerjakan
+- **Version Bump**: Menaikkan versi aplikasi ke **1.5.0**.
+- **Advanced WebSocket Stability**:
+    - Implementasi **Heartbeat (PING)** setiap 30 detik untuk menjaga koneksi tetap hidup.
+    - Perbaikan *mutex panic* (double unlock) pada backend hub.
+    - Penambahan indikator status koneksi (Connected/Disconnected) via toast.
+- **Deep Linking System**:
+    - Integrasi navigasi otomatis saat notifikasi diklik: membuka sidebar, ekspansi koleksi, dan membuka tab request yang relevan.
+    - Dukungan navigasi lintas-view (dari Admin/Settings kembali ke Request Builder).
+- **Activity Log Dashboard**:
+    - Pembuatan halaman penuh `ActivityLogView` untuk melihat riwayat kolaborasi tim secara komprehensif.
+    - Fitur filter (All/Unread) dan pencarian instan pada log aktivitas.
+    - Integrasi "Activity Log" ke dalam Global Search (`Cmd+K`).
+- **Data Management & Retention**:
+    - Implementasi **Auto-Retention Policy**: Penghapusan otomatis notifikasi >30 hari via background job (Ticker).
+    - Penambahan fitur "Clear All Notifications" untuk penghapusan manual secara permanen.
+- **UX & Bug Fixes**:
+    - **Login Fix**: Memastikan input Email tetap terjaga saat terjadi kesalahan password (persistence).
+    - **TypeScript Audit**: Pembersihan kode dari unused imports dan perbaikan error kompilasi pada proses build.
+
+### Perubahan File
+- `apps/desktop/package.json` — Version 1.5.0.
+- `apps/desktop/src/renderer/src/App.tsx` — Login persistence fix & splash screen logic.
+- `apps/desktop/src/renderer/src/api/websocket.ts` — Heartbeat & status toasts.
+- `apps/desktop/src/renderer/src/components/layout/ActivityLogView.tsx` — Full activity dashboard.
+- `apps/desktop/src/renderer/src/components/layout/NotificationBell.tsx` — Deep linking & UI optimization.
+- `backend/internal/api/notification.go` — Delete API & Auto-cleanup job.
+- `backend/cmd/server/main.go` — Startup background job integration.
+
+### Keputusan & Catatan
+- Menggunakan `isRehydrating` state terpisah pada Auth Store untuk mencegah unmounting halaman login saat proses login berlangsung, sehingga input email tidak ter-reset.
+- Memilih interval 24 jam untuk cleanup job agar tidak memberatkan database selama jam kerja sibuk.
+
+---
+
+## [2026-05-09] — Real-time In-App Notifications System
+**Fase:** Fase 7 — Kolaborasi Lanjutan
+**Dikerjakan oleh:** Antigravity
+**Status:** ✅ Selesai
+
+### Yang Dikerjakan
+- **Full-stack Notification System**: Implementasi sistem notifikasi real-time untuk memberi tahu pengguna tentang aktivitas anggota tim lain di Workspace.
+- **Backend**:
+    - Database migration `000017_create_notifications_table`.
+    - Model `Notification` dan API endpoints (`GET`, `PATCH`, `POST read-all`).
+    - Notification Hooks: Trigger otomatis pada aksi Create/Update/Delete/Move untuk Request, Folder, dan Koleksi.
+- **WebSocket Integration**: Event `NOTIFICATION_NEW` untuk pengiriman notifikasi instan ke client yang sedang online.
+- **Frontend UI/UX**:
+    - `useNotificationStore`: State management dengan persistensi lokal.
+    - `NotificationBell`: Ikon lonceng premium dengan badge unread real-time.
+    - `NotificationPopover`: Dropdown list bergaya modern dengan format pesan yang deskriptif dan dukungan navigasi otomatis saat diklik.
+
+### Perubahan File
+- `backend/migrations/000017_create_notifications_table.*`
+- `backend/internal/api/notification.go`
+- `backend/internal/api/websocket.go`
+- `backend/internal/repository/models.go`
+- `apps/desktop/src/renderer/src/store/useNotificationStore.ts`
+- `apps/desktop/src/renderer/src/components/layout/NotificationBell.tsx`
+- `apps/desktop/src/renderer/src/api/websocket.ts`
+
+### Keputusan & Catatan
+- Memasukkan metadata (ID koleksi/request) ke dalam notifikasi untuk mendukung fitur **Quick Navigation** saat notifikasi diklik.
+- Menggunakan `NotifyTeamMembers` helper agar notifikasi hanya dikirim ke anggota tim lain, bukan ke pelaku aksi sendiri.
+
+---
+

## [2026-05-08] — Cross-Team Global Search & v1.4.9 Final
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Cross-Team Global Search**: Peningkatan fitur Omnibar untuk mendukung pencarian di seluruh Workspace yang dimiliki pengguna.
- **Backend Search API**: Implementasi `/api/v1/search/summary` dengan logic Join table untuk akses data lintas tim secara efisien.
- **Robust Navigation**: Perbaikan logika perpindahan workspace yang memastikan data request di-fetch secara asinkron sebelum dibuka, menjamin stabilitas navigasi.
- **Middleware Fixes**: Penambahan helper `JWTProtected` dan `GetUserFromCtx` pada middleware auth untuk standarisasi akses data user di backend.
- **Null Safety**: Penanganan defensif pada frontend untuk mencegah crash saat data pencarian kosong.

### Perubahan File
- `backend/internal/api/search.go` — Backend Join logic & access control.
- `backend/internal/middleware/auth.go` — Middleware helpers.
- `apps/desktop/src/renderer/src/components/modals/GlobalSearchModal.tsx` — Async navigation & safety checks.

---

## [2026-05-07] — Global Search (Omnibar), Menu Navigation & v1.4.9
**Fase:** Fase 7 — Kolaborasi Lanjutan
**Dikerjakan oleh:** Agent
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Global Search (Omnibar)**: Implementasi fitur pencarian cepat bergaya Spotlight/Raycast yang dapat diakses via `Cmd+K` (Mac) atau `Ctrl+K` (Windows).
- **Intelligent Filtering**: Mendukung pencarian **Requests** (berdasarkan nama & URL), **Collections**, dan **Menu Navigasi**.
- **Role-Based Search Results**: Menu administratif seperti "User Management" dan "Workspace Management" hanya muncul di hasil pencarian jika user adalah Super Admin.
- **Quick Navigation**: Integrasi dengan `useDataStore` dan `useAppStore` untuk langsung berpindah antar view atau mengekspansi koleksi dari hasil pencarian.
- **Custom Event System**: Menghubungkan Omnibar dengan komponen Sidebar untuk membuka modal Settings dan Standalone Mocks secara programatik.
- **Version Bump**: Menaikkan versi aplikasi ke **1.4.9**.

### Perubahan File
- `apps/desktop/src/renderer/src/components/modals/GlobalSearchModal.tsx` — Komponen UI Omnibar.
- `apps/desktop/src/renderer/src/components/layout/AppLayout.tsx` — Keyboard listener & mounting modal.
- `apps/desktop/src/renderer/src/store/useAppStore.ts` — State modal pencarian.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Listener untuk navigasi modal dari search.
- `apps/desktop/package.json` — Bump version to 1.4.9.

### Keputusan & Catatan
- Memisahkan logika pencarian sepenuhnya di frontend untuk performa instan (*sub-millisecond search*).
- Menggunakan `lucide-react` untuk ikon kategori agar user cepat membedakan tipe hasil pencarian (Request, Folder, Menu).

### Langkah Selanjutnya
- Audit fitur-fitur baru dan persiapan untuk rilis stabil v1.5.

---

## [2026-05-07] — Implementasi Sistem Tema Dinamis (Light/Dark/System) & Pembersihan UI
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Agent
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Dynamic Theme System**: Implementasi dukungan penuh untuk tema **Light**, **Dark**, dan **System** (mengikuti OS) pada aplikasi desktop.
- **CSS Variable Refactoring**: Mengonversi seluruh skema warna aplikasi menggunakan variabel CSS (`--background`, `--surface`, dll) di `main.css` untuk memungkinkan transisi tema instan tanpa *reload*.
- **Tailwind Integration**: Sinkronisasi `tailwind.config.js` agar menggunakan variabel CSS tersebut, memudahkan pengembangan komponen baru yang mendukung tema.
- **State Persistence**: Menyimpan pilihan tema pengguna di `useAppStore` yang tersinkronisasi dengan `localStorage`.
- **Monaco Editor Dynamic Theme**: Automasi perpindahan tema editor kode antara `vs` (light) dan `vs-dark` berdasarkan tema aplikasi yang aktif.
- **Light Mode UI Fixes**: 
    - Menghapus border *hardcoded* pada `VariableOverlayInput` yang menyebabkan tampilan "kotak-kotak" pada tabel di tema terang.
    - Mengatur ulang warna kursor (*caret*) agar selalu kontras dengan latar belakang.
- **Global Style Cleanup**: Melakukan pembersihan pada file `DocumentationPanel.tsx`, `MockServerPanel.tsx`, dan `StandaloneMockPanel.tsx` untuk mengganti ratusan warna *hardcoded* gelap menjadi variabel tema yang dinamis.
- **Restorasi Fitur**: Mengembalikan bagian "Preview Text" pada pengaturan ukuran font yang sempat hilang saat pemindahan UI.
- **Sidebar Persistence Fix**: Memperbaiki bug di mana sidebar (koleksi/folder) ter-collapse atau terlihat kosong saat aplikasi di-refresh. Sekarang aplikasi secara otomatis mengambil konten untuk semua item yang sebelumnya sudah diekspansi.

### Perubahan File
- `apps/desktop/src/renderer/src/assets/main.css` — Definisi variabel CSS tema.
- `apps/desktop/tailwind.config.js` — Mapping warna ke variabel CSS.
- `apps/desktop/src/renderer/src/store/useAppStore.ts` — State management tema.
- `apps/desktop/src/renderer/src/App.tsx` — Logika aplikasi tema dan integrasi Toaster.
- `apps/desktop/src/renderer/src/components/modals/ServerSettingsModal.tsx` — UI Pengaturan tema baru.
- `apps/desktop/src/renderer/src/components/ui/VariableOverlayInput.tsx` — Perbaikan border dan caret.
- Seluruh komponen UI utama (MainArea, ResponseArea, HistoryDetailView, DocumentationPanel, MockServerPanel, StandaloneMockPanel) — Migrasi ke variabel tema.

### Keputusan & Catatan
- Menggunakan variabel CSS murni alih-alih class-based theme Tailwind (`dark:`) untuk fleksibilitas lebih tinggi dalam menangani komponen pihak ketiga seperti Monaco Editor.
- Memindahkan pengaturan tema ke dalam modal "App Settings" utama agar sejajar dengan konfigurasi sistem lainnya (URL & Font Size).

### Langkah Selanjutnya
- Audit konsistensi visual pada komponen-komponen Admin Panel di tema terang.

---
**Fase:** Fase 7 — Kolaborasi Lanjutan
**Dikerjakan oleh:** Antigravity
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Full-stack Donation System**: Implementasi sistem donasi QRIS untuk mendukung pengembangan proyek.
- **Backend & Database**:
    - Penambahan tabel `system_settings` untuk konfigurasi global (key-value).
    - Penambahan kolom `last_donation_prompt_at` di tabel `users`.
    - API Endpoints: `GET /api/v1/donations/check`, `POST /api/v1/donations/mark-seen`, dan Admin CRUD untuk konfigurasi.
- **WebSocket Integration**: Implementasi event `DONATION_PROMPT` untuk memicu pop-up real-time ke user tertentu atau broadcast ke semua user.
- **Frontend UI/UX**:
    - `DonationModal.tsx`: Desain premium dengan integrasi gambar QRIS, mendukung transisi halus dan feedback toast.
    - **Admin Panel**: Menu baru "Donation Settings" untuk mengelola pesan, cooldown, dan tombol broadcast instan dengan pilihan target user.
- **Fixes**: Perbaikan bug sintaksis di `websocket.ts` dan sinkronisasi cooldown untuk semua aksi penutupan modal.

### Perubahan File
- `backend/migrations/000016_add_system_settings.*`
- `backend/internal/api/donation.go`
- `apps/desktop/src/renderer/src/components/modals/DonationModal.tsx`
- `apps/desktop/src/renderer/src/components/admin/DonationSettings.tsx`
- `apps/desktop/package.json` (Versi 1.4.7)

### Keputusan & Catatan
- Memutuskan untuk menggunakan tabel `system_settings` agar konfigurasi aplikasi bisa diubah secara dinamis tanpa restart server.
- Menggunakan `mark-seen` pada semua aksi penutupan modal (X, Nanti, Donasi) untuk memastikan user tidak merasa terganggu oleh pop-up yang muncul terus-menerus.

---

## [2026-05-02] — Massive Unit Testing Expansion (97%+ Coverage) & Backend Refactoring
**Fase:** Fase 7 — Kolaborasi Lanjutan & Mock Pro
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai (Fase 1-4)

### Yang Dikerjakan
- **Global Test Coverage (97%+)**: Berhasil meningkatkan cakupan unit test backend secara masif dari ~41% ke 97% secara keseluruhan (98.5% pada modul API).
- **Backend Refactoring**:
    - **Thread-Safety WebSocket**: Menambahkan sinkronisasi mutex pada `Client` websocket untuk mencegah *concurrent write panic*.
    - **Entry Point Refactor**: Merefaktorisasi `cmd/server`, `cmd/admin`, dan `cmd/license` agar logika bisnis terpisah dari `main()`, memungkinkan pengujian CLI tanpa `os.Exit`.
    - **Database Error Handling**: Mengubah `ConnectDB` agar mengembalikan `error` alih-alih `log.Fatal`, meningkatkan ketahanan aplikasi.
- **Comprehensive API Testing**:
    - Implementasi test case mendalam untuk `mock_server.go`, `request.go`, dan `documentation.go` mencakup evaluasi skenario otomatis, ekspor OpenAPI/Markdown, dan manipulasi tree koleksi.
    - Melengkapi skenario *edge case* untuk validasi input, kegagalan database, dan pengecekan otorisasi (*forbidden*).
- **CI/CD Readiness**: Menyesuaikan `go.mod` ke Go 1.24 untuk stabilitas tooling coverage (`covdata` compatibility) dan sinkronisasi dependensi.

### Perubahan File
- `backend/internal/api/*_test.go` — Penambahan ribuan baris kode pengujian baru.
- `backend/internal/repository/db.go` — Refaktor koneksi DB.
- `backend/cmd/*/main.go` — Refaktor entry points aplikasi.
- `backend/go.mod` — Downgrade target version ke 1.24.0 untuk stabilitas tooling.

### Keputusan & Catatan
- Menggunakan strategi `MatchExpectationsInOrder(false)` pada `sqlmock` untuk mengakomodasi sifat non-deterministik query GORM pada asosiasi kompleks.
- Memutuskan untuk melakukan refaktor pada fungsi startup utama guna menjamin setiap baris kode inisialisasi dapat diverifikasi secara otomatis.

### Langkah Selanjutnya
- Implementasi Notifikasi in-app saat koleksi diupdate (Fase 7.2).
- Peningkatan UI Diff visual untuk membandingkan versi request.

---

## [2026-04-21] — Inisialisasi License Management (Fase 5 MVP)
**Fase:** Fase 5 — On-Premise & License
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Database Schema**: Membuat migrasi `000009_create_licenses_table` untuk menyimpan data lisensi klien.
- **Backend (Cryptography)**: Implementasi penandatanganan lisensi menggunakan algoritma **Ed25519** (Standard industri, sangat aman dan sulit dipalsukan).
- **Backend API**: Membuat endpoint admin untuk `List`, `Create`, dan `Revoke` lisensi khusus Super Admin.
- **Frontend Admin UI**: Membuat halaman **License Management** di Admin Panel dengan fitur tabel interaktif, status badge (Active/Revoked), dan Copy-to-Clipboard untuk license key.
- **Tooling**: Membuat script `keygen` (`backend/cmd/keygen/main.go`) agar Waluyo bisa men-generate pasangan kunci Ed25519 untuk dipasang di `.env`.
- **Docker Simulation**: Menyiapkan `docker-compose.yml` dan Dockerfile khusus (`Dockerfile.central` & `Dockerfile.client`) untuk mensimulasikan lingkungan 2 server (Central vs Client) di mesin lokal.
- **Fixes**: Memperbaiki error `undefined: GetLicenses` pada `backend/internal/api/license.go`.

### Perubahan File
- `backend/migrations/000009_create_licenses_table.*` — Skema DB baru.
- `backend/internal/repository/models.go` — Penambahan model `License`.
- `backend/internal/api/license.go` — Logika signing, API endpoints lisensi, dan fungsi verifikasi untuk klien.
- `apps/desktop/src/renderer/src/components/admin/LicenseManagement.tsx` — UI baru manajemen lisensi.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` & `AppLayout.tsx` — Integrasi navigasi menu Admin baru.
- `docker-compose.yml` — Update untuk mendukung multi-instance backend.
- `backend/Dockerfile.*` — Dockerfile untuk peran Central dan Client.
- `docs/licensing.md` — Dokumentasi lengkap arsitektur dan panduan Docker.

### Keputusan & Catatan
- Menggunakan **Ed25519** alih-alih RSA karena ukuran key yang jauh lebih kecil dan performa verifikasi yang sangat cepat, ideal untuk binary on-premise yang ringan.
- Lisensi di-generate dalam format `Base64(Payload).Base64(Signature)` untuk memudahkan pengiriman via chat/email.
- Strategi **One Codebase, Two Roles** diimplementasikan menggunakan `-ldflags` saat build untuk menanamkan Public Key ke dalam binary klien secara aman.

### Langkah Selanjutnya
- Membangun layar "Input License" pada aplikasi untuk klien on-premise.
- Implementasi middleware verifikasi lisensi di startup backend klien.

---

## [2026-04-21] — Implementasi Penuh Collection Runner & Penyempurnaan Manajemen Example
**Fase:** Fase 4 — Automated Testing & CI/CD
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- Implementasi `runCollection` di `useDataStore` yang mendukung eksekusi rekursif seluruh request dalam koleksi (termasuk di dalam folder).
- Mendukung Pre-request dan Post-request (Tests) script dalam proses runner.
- Membuat UI `CollectionRunnerModal` yang interaktif, menampilkan progress bar, hasil real-time, dan ringkasan tes (pass/fail).
- Menambahkan tombol "Try" dan "Delete" pada panel dokumentasi untuk setiap *example*.
- Memperbaiki bug pada fitur `renameRequest` yang sebelumnya tidak mengupdate nama di tab.

### Perubahan File
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Implementasi `runCollection`, penambahan `CollectionRunResult` type, dan perbaikan bug `renameRequest`.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Implementasi UI `CollectionRunnerModal`, penambahan state untuk runner, dan penambahan menu "Run Collection".
- `apps/desktop/src/renderer/src/components/layout/DocumentationPanel.tsx` — Penambahan tombol "Try" dan "Delete" untuk *examples*, serta perbaikan scope props.

### Keputusan & Catatan
- Fungsi `runCollection` dibuat generik untuk dapat menjalankan sekelompok request secara sekuensial sambil memberikan progress, yang mana merupakan fondasi untuk fitur runner per folder nanti.
- UI Runner dibuat untuk memberikan feedback yang jelas kepada pengguna tentang status eksekusi, mana yang berhasil dan gagal, termasuk detail dari script test.

### Langkah Selanjutnya
- Implementasi runner untuk folder individual.
- Integrasi runner dengan CLI (`wapbolt run`).

---

## [2026-04-22] — Penyederhanaan Lisensi, Tooling (Makefile), & Landing Page Modern
**Fase:** Fase 5 — On-Premise & License
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Sistem Lisensi (Simplifikasi)**: Menghapus arsitektur License Server yang kompleks (Central-Client) dan menggantinya dengan sistem **Offline-First Ed25519**.
- **License CLI**: Membuat alat terminal baru di `backend/cmd/license/main.go` untuk `keygen` dan `generate` lisensi klien secara mandiri.
- **Backend Cleanup**: Menghapus tabel `licenses`, API manajemen lisensi internal, dan fungsi `PhoneHome` agar backend utama tetap ringan.
- **Grace Period & Warning**: Implementasi masa tenggang 24 jam setelah lisensi expired dan penambahan *Toast Warning* serta *Lock Screen* di frontend jika lisensi bermasalah.
- **Makefile**: Membuat sistem otomasi build untuk Backend (Internal/Client), License CLI, dan Electron Desktop (`make build-desktop`, `make keygen`, dll).
- **Electron Build Fix**: Memperbaiki masalah *Code Signing* macOS (`identity: null`), konfigurasi ikon multi-platform, dan penanganan error `typecheck` pada frontend.
- **Landing Page**: Membuat project baru `apps/landing-page` menggunakan React + Tailwind v4 + Framer Motion. Fokus pada responsivitas, Dark Mode, alur pendaftaran Beta via Gmail, dan dokumentasi setup.
- **Branding**: Mendesain ikon baru "API Pulse" (SVG) yang modern dan profesional untuk menggantikan ikon default Electron.

### Perubahan File
- `backend/cmd/license/main.go` — CLI Tool baru untuk lisensi.
- `backend/internal/middleware/license.go` — Middleware validasi offline dengan grace period.
- `apps/desktop/src/renderer/src/App.tsx` & `client.ts` — Integrasi layar kunci dan toast warning lisensi.
- `Makefile` — Automasi alur kerja project.
- `apps/landing-page/*` — Project landing page baru.
- `apps/desktop/resources/icon.svg` — Desain ikon baru.
- `docs/licensing.md` — Rewrite total dokumentasi lisensi menjadi Offline-First.

### Keputusan & Catatan
- Memutuskan untuk tidak menggunakan server lisensi terpisah karena fitur ini belum aktif digunakan dan untuk mengurangi kompleksitas bagi pengguna (STB ready).
- Keamanan tetap terjaga menggunakan Ed25519; lisensi tidak bisa dipalsukan tanpa Private Key milik Waluyo.
- Landing page dideploy menggunakan Docker (Nginx) agar sangat ringan saat dijalankan di CasaOS STB.

### Langkah Selanjutnya
- Implementasi cURL Import (Fase 6.4).
- Implementasi Export Code Snippet (Fase 6.5).

---

## [2026-04-24] — Implementasi Body Types Lengkap & UX Headers
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Body Types Support**: Implementasi dukungan penuh untuk berbagai tipe body: `none`, `form-data`, `x-www-form-urlencoded`, `raw` (JSON, XML, HTML, Text), dan `binary`.
- **Smart Content-Type**: Header `Content-Type` otomatis diperbarui atau dihapus berdasarkan tipe body yang dipilih untuk memudahkan alur kerja pengguna.
- **Bulk Edit Headers**: Fitur baru untuk mengedit header secara massal dalam format teks, mempermudah pemindahan data antar request.
- **HTTP Executor Upgrade**: Migrasi dari `net.request` Electron ke library **Axios** di proses Main untuk penanganan multipart/form-data dan urlencoded yang lebih stabil.
- **Optimasi UI**: 
    - Menggunakan teknik `display: none` pada Monaco Editor agar perpindahan tab terasa instan tanpa reload.
    - Memperbaiki bug kursor melompat pada `KeyValueEditor` menggunakan `useRef` dan pengecekan perubahan internal.
    - Sinkronisasi status *checked/unchecked* header secara permanen ke database.
- **Backend Infrastructure**: Penambahan kolom `body_type` pada tabel `requests` dan update API handler untuk mendukung struktur data body yang fleksibel (JSONB).

### Perubahan File
- `backend/migrations/000011_add_body_type_to_requests.up.sql` — Migrasi DB baru.
- `backend/internal/api/request.go` — Update rute dan logic CRUD request.
- `apps/desktop/src/main/index.ts` — Upgrade ke Axios dan penanganan body serialization.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Logika sinkronisasi header dan body types.
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — Perombakan UI Request Builder.
- `apps/desktop/src/renderer/src/components/ui/KeyValueEditor.tsx` — Peningkatan stabilitas input tabel.

### Keputusan & Catatan
- Memilih **Axios** di proses Main karena library bawaan Electron `net.request` memiliki keterbatasan dalam menangani boundary `multipart/form-data` secara manual.
- Menggunakan wrapper `{"array": [...]}` untuk data body bertipe list agar tetap kompatibel dengan kolom JSONB PostgreSQL dan GORM.
- Menghilangkan inisialisasi ulang Monaco Editor saat ganti tab untuk memberikan pengalaman "Postman-like" yang sangat responsif.

### Langkah Selanjutnya
- Implementasi cURL Import menggunakan library `curlconverter`.
- Integrasi tombol Export Code Snippet di sebelah tombol Send.

---

## [2026-04-24] — UI Redesign, Resizable Layout & Smart Inputs
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **UI Redesign (Professional Look)**: 
    - Merombak total `MainArea.tsx` untuk menyertakan **Request Header** yang menampilkan jalur koleksi, nama permintaan, serta tombol *Save* dan *Share* yang lebih modern.
    - Desain ulang bar URL dengan pemilih metode yang memiliki ikon dropdown dan tombol *Send* yang terpisah (split button).
    - Memperbaiki tata letak agar lebih bersih dengan memindahkan tombol *Import cURL*, *Export*, dan *Collab* ke baris tindakan cepat di bawah URL bar.
- **Resizable Layout**:
    - Menambahkan *Resizer Bar* di antara area Request Builder dan Response Area yang memungkinkan pengguna menggeser tinggi area secara dinamis (hingga 95% tinggi layar), mirip dengan fungsionalitas Postman.
- **Smart Multiline Inputs**:
    - Mengoverhaul `VariableOverlayInput` agar mendukung teks multi-baris (*auto-expanding*) saat fokus (mengetik) dan kembali menjadi satu baris (*single-line truncate*) saat kehilangan fokus (*blur*) untuk menjaga kerapihan UI.
    - Mengubah kolom *Description* pada `KeyValueEditor` menjadi `textarea` yang juga mendukung *auto-expand*.
- **Persistence Fix**:
    - Memperbaiki bug di mana tab yang terbuka hilang saat aplikasi di-refresh dengan menambahkan array `tabs` ke dalam konfigurasi `persist` di `useDataStore.ts`.
- **Coming Soon System**:
    - Implementasi `ComingSoonModal` untuk fitur yang sedang dalam pengembangan: *Documentation*, *Cookies Management*, dan *Request Sharing*.
- **Visual & UX Fixes**:
    - Memperbaiki bug "ghosting" pada variabel di URL bar dengan menyelaraskan lapisan visual dan interaksi secara presisi hingga ke level piksel.
    - Menghapus komponen `Header` global yang redundan untuk memberikan lebih banyak ruang bagi area kerja utama.

### Perubahan File
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — Perombakan total tata letak dan logika resize.
- `apps/desktop/src/renderer/src/components/layout/AppLayout.tsx` — Penghapusan Header redundan.
- `apps/desktop/src/renderer/src/components/ui/VariableOverlayInput.tsx` — Implementasi smart multiline & fix ghosting.
- `apps/desktop/src/renderer/src/components/ui/KeyValueEditor.tsx` — Perubahan kolom Description ke textarea.
- `apps/desktop/src/renderer/src/components/modals/ComingSoonModal.tsx` — Komponen modal baru.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Penambahan persistence untuk tab.
- `apps/desktop/src/renderer/src/store/useAppStore.ts` — Update tipe tab.

### Keputusan & Catatan
- Memutuskan untuk menggunakan `absolute inset-0` dengan `overflow-auto` pada kontainer editor body/headers untuk memastikan scrolling bekerja sempurna di dalam area yang bisa di-resize.
- Menggunakan `localStorage` untuk menyimpan tab agar sesi kerja pengguna tetap utuh meskipun terjadi refresh atau crash kecil pada aplikasi.

### Langkah Selanjutnya
- Implementasi Drag-and-Drop Request & Folder (Fase 6.6).

---

## [2026-04-24] — cURL Import & Code Snippet Export
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Import dari cURL (Fase 6.4)**:
    - Integrasi library `curlconverter` untuk memproses perintah cURL menjadi request Wapbolt.
    - Implementasi `ImportCurlModal` untuk mengimpor perintah cURL secara manual.
    - **Smart Auto-Detection**: Menambahkan logika deteksi otomatis saat pengguna mem-paste perintah yang diawali `curl ` ke dalam URL bar, memicu dialog konfirmasi import otomatis.
- **Export Code Snippet (Fase 6.5)**:
    - Implementasi `ExportCodeModal` dengan dukungan banyak bahasa pemrograman:
        - cURL
        - JavaScript (Fetch & Axios)
        - Go Native (`net/http`)
        - Python (`requests`)
    - Integrasi Monaco Editor (read-only) dengan syntax highlighting untuk setiap bahasa target.
    - Penambahan fitur "Copy to Clipboard" yang cepat.

### Perubahan File
- `apps/desktop/src/renderer/src/utils/curlParser.ts` — Utilitas konversi cURL.
- `apps/desktop/src/renderer/src/components/modals/ImportCurlModal.tsx` — UI untuk import.
- `apps/desktop/src/renderer/src/components/modals/ExportCodeModal.tsx` — UI untuk export snippet.
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — Integrasi tombol dan logika deteksi cURL.
- `apps/desktop/src/renderer/src/api/client.ts` & `env.d.ts` — Update tipe data untuk mendukung body fleksibel.

---

## [2026-04-24] — Drag-and-Drop Request & Folder (Fase 6.6)
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Infrastruktur Backend (Fractional Indexing)**:
    - Migrasi kolom `order_index` pada tabel `requests` dan `folders` dari `INT` menjadi `double precision` untuk mendukung penyisipan item tanpa batas.
    - Implementasi endpoint `PATCH /api/v1/requests/:id/move` dan `PATCH /api/v1/folders/:id/move` dengan validasi role Editor+.
- **Integrasi dnd-kit (Frontend)**:
    - Instalasi dan konfigurasi `@dnd-kit/core` dan `@dnd-kit/sortable` pada Sidebar.
    - Implementasi **Horizontal Split Logic**:
        - **Zona Kiri (30% lebar)**: Untuk **Mengurutkan** (Atas/Bawah) — menampilkan garis **Cyan**.
        - **Zona Kanan (70% lebar)**: Untuk **Memasukkan** (Nesting) ke dalam folder — menampilkan highlight **Ungu**.
    - Penanganan hirarki kompleks: bisa mengeluarkan anak dari induk dengan menjatuhkannya di header Koleksi (Move to Root).
- **Optimasi Store & API Client**:
    - Penambahan metode `apiClient.patch` yang sebelumnya hilang.
    - Implementasi aksi `moveRequest` dan `moveFolder` dengan *Optimistic Update* dan sinkronisasi otomatis antar koleksi.
    - Perbaikan stabilitas pengurutan di frontend menggunakan kombinasi `order_index` dan `id` sebagai tie-breaker.
- **Visual Feedback**:
    - Penambahan ikon *grip* (GripVertical) yang muncul saat hover.
    - Animasi transisi yang halus saat item digeser dan dilepaskan.

### Perubahan File
- `backend/migrations/000012_change_order_index_to_float.*` — Migrasi database.
- `backend/internal/repository/models.go` — Update tipe data model Go.
- `backend/internal/api/request.go` & `folder.go` — Endpoint move baru dan update payload.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Implementasi total Drag-and-Drop UI.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Logika sinkronisasi dan pengurutan.
- `apps/desktop/src/renderer/src/api/client.ts` — Penambahan `apiClient.patch`.

### Keputusan & Catatan
- Menggunakan koordinat pointer (`activatorEvent`) alih-alih `translated rect` untuk deteksi zona horizontal agar lebih presisi mengikuti kursor pengguna.
- Menetapkan `order_index` default baru menggunakan `Date.now()` untuk memastikan item baru selalu berada di posisi paling bawah.

---

## [2026-04-24] — Mock Server Dynamic Response (Fase 6.7)
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Mock Engine Dynamic (Conditional Matching)**:
    - Implementasi evaluator kondisi canggih di backend yang mendukung pencocokan request berdasarkan `Query`, `Body` (mendukung dot-notation seperti `user.role`), `Header`, dan `Path`.
    - Dukungan operator lengkap: `equals`, `contains`, `regex`, `exists`, dan negasinya.
    - Sistem evaluasi sekuensial (atas ke bawah) berdasarkan `order_index`.
- **Templating Engine**:
    - Implementasi parser respons yang memungkinkan injeksi data request ke dalam body respons menggunakan sintaks `{{request.source.key}}`.
- **Manajemen Skenario (Frontend)**:
    - Pembuatan `ScenariosPanel.tsx` sebagai pusat kendali respons endpoint.
    - **Visual Condition Builder**: UI intuitif untuk menyusun logika IF-THEN tanpa menulis JSON.
    - **Drag-and-Drop Priority**: Memungkinkan pengguna mengatur urutan prioritas evaluasi skenario secara visual.
- **Mode Eksekusi Ganda**:
    - **Auto / Dynamic**: Server mencari skenario yang cocok secara otomatis.
    - **Manual / Forced**: Memaksa server mengembalikan satu skenario spesifik (diperjelas dengan label **"FORCED"** oranye).
- **Infrastruktur & Stabilitas**:
    - Migrasi database tabel `mock_scenarios` dan penambahan kolom kontrol pada `mock_endpoints`.
    - Implementasi `JSONBArray` di Go untuk penanganan array kondisi yang stabil.
    - Penggunaan **Database Transaction** (Begin/Commit/Rollback) untuk menjamin aturan "Hanya Satu Fallback Per Endpoint".
    - Penambahan fitur **"Copy as cURL"** pada setiap endpoint untuk memudahkan pengujian eksternal.

### Perubahan File
- `backend/migrations/000013_add_dynamic_mock_scenarios.up.sql` — Skema DB baru.
- `backend/internal/repository/models.go` — Model data `MockScenario` dan tipe `JSONBArray`.
- `backend/internal/api/mock_server.go` — Logika inti evaluasi kondisi dan templating.
- `apps/desktop/src/renderer/src/components/layout/ScenariosPanel.tsx` — UI utama manajemen skenario.
- `apps/desktop/src/renderer/src/components/layout/MockServerPanel.tsx` — Integrasi panel skenario dan tombol cURL.
- `apps/desktop/src/renderer/src/types/index.ts` — Definisi tipe data baru.

### Keputusan & Catatan
- Memilih untuk menggunakan struktur rute bersarang (`/endpoints/:id/scenarios/:id`) untuk menghindari ambiguitas parameter ID pada framework Fiber.
- Menggunakan `DB.Save()` dan transaksi untuk menjamin integritas data status `is_default`.

### Langkah Selanjutnya
- Fase 6 Selesai secara fungsional. Persiapan untuk Fase 7: Kolaborasi Lanjutan.

---

## [2026-04-26] — Mock Server Pro, Binary Responses & Auth Persistence
**Fase:** Fase 7 — Kolaborasi Lanjutan & Mock Pro
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Mock Server Pro (Binary Support)**:
    - Migrasi database `000014_add_mock_scenario_files` untuk mendukung penyimpanan file biner (PDF, Gambar, dll) dalam format Base64.
    - Upgrade `handleMockRequest` di Go untuk mendeteksi ekstensi file dan mengirimkan `Content-Type` serta `Content-Disposition: inline` yang tepat.
    - Implementasi UI **File Upload** di panel skenario dengan konversi otomatis ke Base64.
- **Smart cURL Generator (Scenario Level)**:
    - Implementasi algoritma pembuat perintah cURL cerdas yang menganalisis aturan skenario (IF rules) dan secara otomatis menyisipkan data Query, Header, dan Body JSON (termasuk *nested object*) agar request langsung memicu skenario tersebut.
- **UX & Visual Preview**:
    - Penambahan fitur **PDF Preview** di `ResponseArea.tsx`. Aplikasi kini bisa menampilkan pratinjau file PDF langsung di dalam tab Body tanpa perlu download manual.
    - Peningkatan akurasi penghitungan ukuran respons (Size) untuk data biner.
- **Sesi Pengguna & Keamanan**:
    - Memperpanjang masa berlaku **Access Token** menjadi 24 jam dan **Refresh Token** menjadi 90 hari guna memastikan pengguna "tetap masuk" tanpa gangguan.
    - Penambahan tautan portal lisensi (`https://wapbolt.temancode.my.id`) pada layar kunci lisensi dan notifikasi peringatan.
- **Landing Page & Dev Tooling**:
    - Update `apps/landing-page` dengan seksi fitur profesional baru dan tabel perbandingan yang diperbarui.
    - Penambahan target `make build-landing` pada `Makefile` untuk otomatisasi pembangunan image Docker landing page dengan parameter `TAG`.

### Perubahan File
- `backend/internal/api/auth.go` — Perpanjangan durasi JWT.
- `backend/internal/api/mock_server.go` — Logika binary serving dan perbaikan Content-Type.
- `apps/desktop/src/renderer/src/components/layout/ScenariosPanel.tsx` — Smart cURL & File upload UI.
- `apps/desktop/src/renderer/src/components/layout/ResponseArea.tsx` — PDF Preview engine.
- `apps/desktop/src/renderer/src/App.tsx` — Integrasi link portal lisensi.
- `apps/landing-page/src/App.tsx` — Update konten fitur pro.
- `Makefile` — Penambahan target build docker landing page.

### Keputusan & Catatan
- Memutuskan untuk menyimpan file biner di kolom `TEXT` (Base64) PostgreSQL untuk sementara demi portabilitas database pada instalasi on-premise yang sederhana, dengan limitasi ukuran file yang disarankan (maks 5MB).
- Memisahkan logika penetapan `Content-Type` secara ketat antara tipe teks dan biner guna mencegah bug browser yang gagal merender file PDF.

### Langkah Selanjutnya
- Implementasi Notifikasi in-app saat koleksi diupdate (Fase 7.2).

---

## [2026-04-27] — Rebranding to Wapbolt & UX Improvements
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Rebranding Massal**:
    - Mengubah identitas produk dari **Wapify** menjadi **Wapbolt** di seluruh ekosistem (Backend, Desktop, Landing Page, dan Infrastruktur).
    - Update module path di `go.mod`, jalur impor Go, header HTTP (`X-Wapbolt-*`), dan metadata aplikasi (`appId`, `productName`).
    - Migrasi kunci LocalStorage (`wapbolt_server_url`, `wapbolt-data-storage`) dan IPC channels agar sinkron dengan nama baru.
- **Identitas Visual Baru**:
    - Mendesain ulang ikon `resources/icon.svg` dengan menggabungkan inisial "W" dan simbol "Bolt" (Petir).
    - Memperbarui komponen UI (Login, Sidebar, Main Area) dengan ikon **Zap** (Lucide React) sebagai logo utama yang lebih modern dan dinamis.
- **UX Resizer Improvement**:
    - Memperbaiki bug pada *Response Area Resizer* yang sebelumnya bisa ditarik hingga hilang.
    - Implementasi `minBottomHeightPx` sebesar 80px untuk memastikan Tab Response (Body, Headers, dll) tetap terlihat saat panel diturunkan maksimal.

### Perubahan File
- Seluruh file proyek (Rebranding massal).
- `apps/desktop/resources/icon.svg` — Ikon baru.
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — Logika resizer baru.
- `docker-compose.yml`, `Makefile`, `go.mod` — Sinkronisasi metadata.

### Keputusan & Catatan
- Memilih nama **Wapbolt** karena unik (zero search competition), mencerminkan kecepatan, dan tetap mempertahankan inisial personal (WAP).
- Memilih batas minimal 80px pada resizer berdasarkan kebutuhan visual agar kontrol utama tidak tersembunyi.

### Langkah Selanjutnya
- Persiapan rename repositori di GitHub (Wapbolt & Wapbolt-desktop-releases).
- Implementasi Notifikasi in-app (Fase 7.2).

---

## [2026-04-27] — Rebranding to Wapbolt & UX Improvements
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Rebranding Massal**:
    - Mengubah identitas produk dari **Wapify** menjadi **Wapbolt** di seluruh ekosistem (Backend, Desktop, Landing Page, dan Infrastruktur).
    - Update module path di `go.mod`, jalur impor Go, header HTTP (`X-Wapbolt-*`), dan metadata aplikasi (`appId`, `productName`).
    - Migrasi kunci LocalStorage (`wapbolt_server_url`, `wapbolt-data-storage`) dan IPC channels agar sinkron dengan nama baru.
- **Identitas Visual Baru**:
    - Mendesain ulang ikon `resources/icon.svg` dengan menggabungkan inisial "W" dan simbol "Bolt" (Petir).
    - Memperbarui komponen UI (Login, Sidebar, Main Area) dengan ikon **Zap** (Lucide React) sebagai logo utama yang lebih modern dan dinamis.
- **UX Resizer Improvement**:
    - Memperbaiki bug pada *Response Area Resizer* yang sebelumnya bisa ditarik hingga hilang.
    - Implementasi `minBottomHeightPx` sebesar 80px untuk memastikan Tab Response (Body, Headers, dll) tetap terlihat saat panel diturunkan maksimal.

### Perubahan File
- Seluruh file proyek (Rebranding massal).
- `apps/desktop/resources/icon.svg` — Ikon baru.
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — Logika resizer baru.
- `docker-compose.yml`, `Makefile`, `go.mod` — Sinkronisasi metadata.

### Keputusan & Catatan
- Memilih nama **Wapbolt** karena unik (zero search competition), mencerminkan kecepatan, dan tetap mempertahankan inisial personal (WAP).
- Memilih batas minimal 80px pada resizer berdasarkan kebutuhan visual agar kontrol utama tidak tersembunyi.

### Langkah Selanjutnya
- Persiapan rename repositori di GitHub (Wapbolt & Wapbolt-desktop-releases).
- Implementasi Notifikasi in-app (Fase 7.2).

---

## [2026-04-27] — Fix Workspace Members & Dynamic Server URLs
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Fix Workspace Member List**:
    - Memperbaiki rute API `GET /api/v1/teams/:id` yang sebelumnya tidak terdaftar dengan benar sehingga list member tidak muncul.
    - Melakukan konsolidasi rute manajemen tim dari `team_member.go` ke `team.go` agar lebih terstruktur.
    - Memastikan GORM melakukan `.Preload("User")` pada endpoint detail tim agar informasi nama dan email member tampil di UI.
- **Dynamic Server URLs**:
    - Menghapus hardcode `localhost:8000` pada panel **Mock Server** dan **Scenarios**. Kini URL mock dan cURL generator otomatis mengikuti konfigurasi server di Settings.
    - Memperbarui `WebSocketClient` agar menggunakan protocol yang sesuai (`ws` atau `wss`) secara dinamis berdasarkan URL backend yang aktif, menjamin fitur kolaborasi tetap jalan di domain kustom/Cloudflare.

### Perubahan File
- `backend/internal/api/team.go` & `team_member.go` — Perbaikan rute dan konsolidasi.
- `apps/desktop/src/renderer/src/components/layout/MockServerPanel.tsx` — Dynamic URL.
- `apps/desktop/src/renderer/src/components/layout/ScenariosPanel.tsx` — Dynamic URL.
- `apps/desktop/src/renderer/src/api/websocket.ts` — Dynamic protocol detection.

### Keputusan & Catatan
- Menggabungkan rute tim dan member ke satu file `team.go` untuk menyederhanakan pemeliharaan karena keduanya sangat berkaitan erat secara logika.
- Menggunakan helper `getBaseUrl()` yang sudah ada di frontend sebagai sumber kebenaran tunggal untuk semua alamat endpoint eksternal.

### Langkah Selanjutnya
- Implementasi Notifikasi in-app (Fase 7.2).

---

## [2026-04-30] — Backend Compilation Fixes, UI Bug Squashing & Mock Server UX
**Fase:** Fase 7 — Kolaborasi Lanjutan & Mock Pro
**Dikerjakan oleh:** Agent
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Backend Compilation Fix**:
    - Memperbaiki error `undefined: middleware` pada `auth.go` dengan menambahkan import yang hilang.
    - Memperbaiki ketidakcocokan tipe data `uint` vs `*uint` pada `CollectionID` di `mock_server.go`.
- **UI Bug Squashing**:
    - Memperbaiki crash `TypeError: scenarios.map is not a function` pada `ScenariosPanel.tsx` dengan menambahkan pengecekan defensif `Array.isArray`.
- **Mock Server UX & Routing**:
    - **Pemindahan Akses**: Mengeluarkan "Workspace Mock Server" dari Admin Panel (Super Admin Only) ke bagian **Workspaces** di Sidebar, sehingga bisa diakses oleh semua anggota tim.
    - **Universal API Routes**: Implementasi rute universal `/api/v1/mock-endpoints/:id/...` di backend untuk mengelola skenario tanpa ketergantungan pada `collection_id`.
    - **Fix Routing Hijacking**: Memperbaiki urutan rute mock di backend agar rute Standalone (`/mock/w/`) tidak "dibajak" oleh rute Koleksi.
    - **Database Compatibility**: Memperbaiki pencarian `team_id` pada query standalone mock agar menggunakan `uint` demi kompatibilitas database yang lebih baik.

### Perubahan File
- `backend/internal/api/auth.go` — Penambahan import middleware.
- `backend/internal/api/mock_server.go` — Perbaikan tipe data, urutan rute, universal API, dan parsing ID.
- `apps/desktop/src/renderer/src/components/layout/ScenariosPanel.tsx` — Pengecekan defensif `.map` dan migrasi ke universal API.
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — Pemindahan akses fitur mock server ke level workspace.
- `apps/desktop/src/renderer/src/types/index.ts` — Update interface `MockEndpoint` untuk mendukung `collection_id: null`.

### Keputusan & Catatan
- Memutuskan untuk membuat rute universal `/api/v1/mock-endpoints/` guna menghindari redundansi logika manajemen skenario antara mock koleksi dan standalone.
- Memindahkan akses fitur ke level Workspace karena secara fungsional fitur ini memang ditujukan untuk tim, bukan sekadar administrasi sistem.

### Langkah Selanjutnya
- Melanjutkan implementasi Notifikasi in-app (Fase 7.2).

---

## [2026-04-30] (Part 2) — Request Execution Overhaul, Wire Format History & Pro Console
**Fase:** Fase 7 — Kolaborasi Lanjutan & Mock Pro
**Dikerjakan oleh:** Agent
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Request Execution Fixes**:
    - Memperbaiki pengiriman data `x-www-form-urlencoded` dan `form-data` dengan menggunakan `URLSearchParams` dan `FormData` langsung di Main Process demi akurasi spesifikasi HTTP.
    - Memperbaiki bug "header hijacking" di mana `application/json` dipaksakan meskipun user memilih tipe body lain.
- **Advanced Console & Network Logging**:
    - Implementasi **Network Logger** yang mendetail: mencatat Request/Response Headers dan Body (Wire Format) secara transparan di tab Console.
    - Menambahkan UI detail log yang bisa di-expand (collapsible) untuk debugging mendalam ala Postman Console.
    - Implementasi Pascal-Case formatting untuk Response Headers agar lebih enak dibaca.
- **Wire Format History**:
    - Mengubah sistem penyimpanan riwayat agar menyimpan body dalam format string asli yang dikirim ke jaringan (urlencoded string), bukan format array internal.
- **Crash Fixes**:
    - Memperbaiki crash `TypeError: body.filter is not a function` pada fitur Ekspor Kode dengan menambahkan validasi tipe data yang ketat.

### Perubahan File
- `apps/desktop/src/main/index.ts` — Perbaikan serialisasi body dan penambahan debug logging.
- `apps/desktop/src/renderer/src/api/client.ts` — Perbaikan logika header default dan sinkronisasi parameter `body_type`.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Perbaikan penyimpanan history (wire format) dan implementasi log network.
- `apps/desktop/src/renderer/src/components/layout/ResponseArea.tsx` — Implementasi UI Log mendetail dan Pascal-Case headers.
- `apps/desktop/src/renderer/src/components/modals/ExportCodeModal.tsx` — Fix crash filter dan perbaikan akurasi generator snippet.

### Keputusan & Catatan
- Memutuskan untuk menyimpan format asli (string) ke riwayat agar user mendapatkan gambaran 1:1 antara apa yang ada di aplikasi dengan apa yang diterima server.
- Menggunakan Main Process (Electron) sebagai tempat final serialisasi untuk menjamin kompatibilitas `FormData` yang lebih baik dibanding lingkungan browser murni.

### Langkah Selanjutnya
- Melanjutkan implementasi Notifikasi in-app (Fase 7.2).
- Ekspansi Unit Test untuk mencapai target coverage 80-100% (Fase 7.3).

---

## [2026-05-01] (Part 3) — Unit Testing Completion (Success & Error Paths)
**Fase:** Fase 7 — Kolaborasi Lanjutan & Mock Pro
**Dikerjakan oleh:** Agent
**Status:** ✅ Selesai (Fase 1-3)

### Yang Dikerjakan
- **Comprehensive Error Testing**: 
    - Melengkapi skenario negatif untuk semua modul utama: Auth, Collections, Teams, Folders, dan Requests.
    - Menambahkan validasi penanganan "Not Found", "Forbidden" (Authorization Bypass protection), dan "Database Errors".
- **Account Integrity Testing**: Menguji fitur keamanan signature role user untuk mencegah manipulasi data database secara ilegal.
- **Activity Logging & Collaboration**: Verifikasi pencatatan log aktivitas otomatis saat terjadi perubahan data (tim, koleksi, request).
- **Bug Fix in Backend**: Menemukan dan memperbaiki bug validasi pada `CreateTeam` di mana nama tim sebelumnya bisa kosong.

### Perubahan File
- `backend/internal/api/team.go` — Penambahan validasi nama tim.
- `backend/internal/api/*_test.go` — Update besar pada 26 file pengujian untuk mencakup skenario error.

### Keputusan & Catatan
- Mengadopsi **Flexible Regex Matching** pada `sqlmock` untuk memastikan tes tidak mudah pecah saat ada perubahan minor pada optimasi query GORM.
- Mencapai milestone coverage yang signifikan sebagai fondasi kestabilan sistem.

### Langkah Selanjutnya
- Monitor stabilitas build CI/CD dengan menjalankan `make test-backend` secara otomatis.
- Implementasi Notifikasi in-app (Fase 7.2).

---

## [2026-05-01] — Unit Testing Infrastructure & Initial Backend Tests
**Fase:** Fase 7 — Kolaborasi Lanjutan & Mock Pro
**Dikerjakan oleh:** Agent
**Status:** ✅ Selesai (Fase 1)

### Yang Dikerjakan
- **Build System Integration**: Menambahkan perintah `make test-backend` dan `make test-coverage` ke dalam `Makefile`.
- **Agent Workflows**: Membuat standar operasional prosedur untuk penulisan dan pengecekan tes di folder `.agents/workflows/`.
- **Initial Utility Tests**: Implementasi unit test pertama di `backend/internal/api/util_test.go` untuk menguji fungsi `parseUint` dan `CalculateRoleSignature`.
- **Verification**: Verifikasi keberhasilan eksekusi tes dengan hasil `PASS`.

### Perubahan File
- `Makefile` — Penambahan target testing.
- `.agents/workflows/update-unit-test.md` — Panduan penulisan tes.
- `.agents/workflows/check-unit-test.md` — Panduan verifikasi tes.
- `backend/internal/api/util_test.go` — Implementasi tes pertama.

### Keputusan & Catatan
- Menggunakan pendekatan *phased implementation* untuk mengejar target coverage 80-100% agar tidak mengganggu stabilitas fitur yang sedang dikembangkan.
- Memilih pola *Table-Driven Tests* sebagai standar proyek untuk efisiensi skenario pengujian.

### Langkah Selanjutnya
- Implementasi Mocking Database untuk menguji API Handlers (Fase 2).
