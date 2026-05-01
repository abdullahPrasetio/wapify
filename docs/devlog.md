# Wapify — Development Log

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
