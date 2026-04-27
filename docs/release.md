# Wapbolt v1.4.0 — The Rebrand & UX Polish ⚡️

Rilis ini menandai era baru bagi aplikasi kita dengan identitas brand yang sepenuhnya baru: **Wapbolt**. Kami juga menyertakan beberapa perbaikan UX penting untuk kenyamanan pengujian API Anda.

### ✨ Apa yang Baru?

#### ⚡️ Rebranding: Say Hello to Wapbolt!
Kami telah mengganti nama aplikasi dari Wapify menjadi **Wapbolt**. Nama baru ini mencerminkan kecepatan (*lightning fast*), kekuatan, dan efisiensi yang menjadi inti dari tool ini.
- **Identitas Visual Baru**: Logo kini menggunakan simbol **Zap (Petir)** yang modern dan dinamis di seluruh aplikasi.
- **SVG Ikon Baru**: Ikon aplikasi resmi (`icon.svg`) telah didesain ulang dengan perpaduan inisial "W" dan elemen "Bolt" emas.
- **Pembaruan Ekosistem**: Seluruh infrastruktur (Backend, Desktop, Landing Page) kini telah menggunakan identitas Wapbolt secara seragam.

#### 📏 UX Improvement: Resizer Constraint
Kami memperbaiki salah satu kendala navigasi yang paling sering dilaporkan:
- **Sticky Response Panel**: Kini panel respon di bagian bawah tidak akan bisa hilang saat ditarik ke bawah.
- **Min-Height Protection**: Kami memberikan batas minimal **80px** untuk memastikan baris Tabs (Body, Headers, Console) tetap terlihat dan dapat diakses setiap saat.

#### 🚀 Infrastruktur & Backend
- **Module Migration**: Semua jalur impor Go telah diperbarui ke `github.com/waluyo/wapbolt-backend`.
- **IPC & Storage**: Jalur komunikasi antar-proses dan kunci penyimpanan lokal telah dimigrasi ke namespace `wapbolt` untuk stabilitas data jangka panjang.
- **HTTP Headers**: Standarisasi header kustom menjadi `X-Wapbolt-License-Warning` dan `X-Wapbolt-Mock`.

### 🛠 Peningkatan Lainnya
- **Clean Documentation**: Seluruh panduan teknis (`PRD`, `DevLog`, `DevPlan`) telah diperbarui agar selaras dengan branding baru.
- **Landing Page Refresh**: Halaman depan kini tampil lebih berenergi dengan tema visual Wapbolt yang baru.
- **Auto-Update Path**: Menyiapkan jalur rilis ke repositori `wapbolt-desktop-releases`.

---

**Wapbolt — API Testing, Built for Teams.**
