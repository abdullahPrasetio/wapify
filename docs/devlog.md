
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
