
## [2026-04-24] — cURL Import & Code Snippet Export
**Fase:** Fase 6 — UX & Power Features
**Dikerjakan oleh:** Gemini
**Status:** ✅ Selesai

### Yang Dikerjakan
- **Import dari cURL (Fase 6.4)**:
    - Integrasi library `curlconverter` untuk memproses perintah cURL menjadi request Wapify.
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
- **Pembersihan Tipe Data (Fixes)**:
    - Sinkronisasi tipe data `any` untuk body request agar mendukung baik format string (raw) maupun array (form-data/urlencoded).
    - Memperbaiki berbagai error TypeScript terkait definisi `window.api` dan penggunaan variabel yang hilang di komponen React.
    - Memperbaiki bug pada `MainArea` dimana `activeTabRequest` digunakan di scope yang salah.

### Perubahan File
- `apps/desktop/src/renderer/src/utils/curlParser.ts` — Utilitas konversi cURL.
- `apps/desktop/src/renderer/src/components/modals/ImportCurlModal.tsx` — UI untuk import.
- `apps/desktop/src/renderer/src/components/modals/ExportCodeModal.tsx` — UI untuk export snippet.
- `apps/desktop/src/renderer/src/components/layout/MainArea.tsx` — Integrasi tombol dan logika deteksi cURL.
- `apps/desktop/src/renderer/src/api/client.ts` & `env.d.ts` — Update tipe data untuk mendukung body fleksibel.
- `apps/desktop/src/renderer/src/store/useDataStore.ts` — Update penanganan body dan script untuk test runner.

### Keputusan & Catatan
- Memilih `curlconverter` karena library ini sangat handal dan mendukung hampir semua flag cURL standar industri.
- Menggunakan `JSON.stringify` otomatis saat mengekspor ke JavaScript/Python untuk memastikan snippet valid dan siap pakai.

### Langkah Selanjutnya
- Implementasi Drag-and-Drop Request & Folder (Fase 6.6).
- Implementasi Mock Server Dynamic Response (Fase 6.7).

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
- Integrasi runner dengan CLI (`wapify run`).

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
- Implementasi Mock Server Dynamic Response (Fase 6.7).

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
