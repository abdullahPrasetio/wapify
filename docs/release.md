# Wapbolt v1.8.0 — OpenAPI Import, Postman Export & Collection Runner ⚡

Rilis terbesar sejak v1.6 — Phase 1 dari roadmap Foundation & Adoption kini lengkap. Wapbolt kini bisa membaca koleksi dari ekosistem OpenAPI/Postman dan menjalankan seluruh collection secara otomatis dengan laporan hasil yang detail.

### ✨ Fitur Baru

#### 📥 Import OpenAPI 3.0 & Swagger 2.0
- Auto-detect format JSON/YAML, grouping endpoint by tags → folders.
- Preview jumlah endpoint sebelum konfirmasi import.
- Path params, query params, dan request body schema dikonversi otomatis.

#### 📤 Export ke Postman Collection v2.1
- Full fidelity: folder hierarchy, auth, pre/post scripts ikut terexport.
- File hasil siap diimport ke Postman tanpa modifikasi.

#### 🏃 Collection Runner — Versi Lengkap
- Checklist per request, konfigurasi iterasi/delay/stop-on-failure.
- Progress bar live + laporan detail: status, response time, test assertions.
- Export hasil run ke JSON atau CSV.
- Hasil run persisten — panel yang dibuka kembali langsung tampilkan hasil terakhir.

### 🐛 Bug Fixes
- **Modal runner hilang saat run** — fix dengan `createPortal`.
- **`wap.setEnv` error di post-request script** — API `wap` di pre/post sekarang simetris.
- **UI stuck di "running"** — diperbaiki dengan `try/finally`.

---

# Wapbolt v1.6.3 — Confluence Resilience & Variable Resolution 🛠️

Rilis ini membawa peningkatan krusial pada ketahanan konektivitas Confluence, terutama untuk lingkungan korporat dengan firewall ketat, serta dukungan penuh untuk variabel environment.

### ✨ Apa yang Baru?

#### 🛡️ Enterprise Connectivity & Firewall Bypass
- **Method Tunneling Support**: Melewati blokir firewall terhadap metode `PUT` via `POST-as-PUT`.
- **CSRF Protection Bypass**: Penambahan header `X-Atlassian-Token` untuk Confluence Server/DC.
- **Flexible URL Construction**: Kontrol penuh jalur API melalui Base URL.

#### 🌍 Full Environment Variable Resolution
- **Dynamic Content**: Placeholder `{{variable}}` otomatis di-resolve sebelum sinkronisasi.
- **Support in all fields**: Berlaku untuk URL, Headers, Body, dan Deskripsi.

---

# Wapbolt v1.6.2 — Enhanced Confluence Sync & Branding 🚀

Rilis ini membawa peningkatan pada fitur sinkronisasi Confluence dengan penambahan informasi branding dan timestamp otomatis untuk dokumentasi yang lebih informatif.

### ✨ Apa yang Baru?

#### 📘 Enhanced Confluence Footer
- **Automatic Branding**: Menampilkan teks *"Generated using aplikasi wapbolt by temancode"*.
- **Dynamic Indonesian Timestamp**: Mencatat waktu sinkronisasi secara presisi dengan format lokal Indonesia.
- **Quick Links**: Menyertakan tautan langsung ke **Landing Page** resmi dan **GitHub Support**.

---

# Wapbolt v1.6.1 — Shared Environments & UI Polish 🌍

Rilis ini menghadirkan fitur kolaborasi tingkat lanjut dengan Shared Environments yang memungkinkan tim berbagi variabel di seluruh workspace, serta pembaruan antarmuka pengguna untuk pengalaman navigasi yang lebih bersih.

### ✨ Apa yang Baru?

#### 🌍 Shared Environment Lintas Workspace
- **Global / Shared Environments**: Membuat environment yang dapat diakses oleh semua tim.
- **Logical Grouping**: Pengelompokkan rapi antara **Global** dan **Workspace** di Sidebar.
- **Role-Based Protection**: Environment global bersifat *read-only* bagi anggota tim biasa.

#### 👤 New Profile & Navigation Experience
- **Avatar Dropdown**: Akses cepat ke pengaturan melalui menu dropdown avatar.
- **Centralized Settings**: App Settings, Change Password, dan Confluence Settings dalam satu tempat.

---

# Wapbolt v1.6.0 — Confluence Sync & Smart Documentation 📚

Rilis ini membawa integrasi penuh dengan Confluence, memungkinkan Anda untuk mensinkronisasi dokumentasi API langsung dari Wapbolt ke halaman Confluence tim Anda.

### ✨ Apa yang Baru?

#### 📘 Confluence Integration (Cloud & Server/DC)
- **Dual Auth Support**: Atlassian Cloud (Email + API Token) dan Confluence Server (PAT).
- **Smart Sync Engine**: Sinkronisasi otomatis Deskripsi, Headers, Body Validation, dan Examples.
- **Table of Contents (TOC)**: Navigasi otomatis yang interaktif di halaman Confluence.

#### 🎨 Visual Consistency
- **Standardized Method Colors**: Pewarnaan method HTTP mengikuti standar industri.
- **Neutral Validation Badges**: Aturan validasi tampil lebih bersih dengan skema warna *slate*.

---

**Wapbolt — API Testing, Built for Teams.**
