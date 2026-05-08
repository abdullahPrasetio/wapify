# Release Notes — Wapbolt v1.4.8

## What's New 🚀
Rilis ini membawa perubahan besar pada sisi visual dan kenyamanan penggunaan, dengan fokus utama pada dukungan Tema Terang (Light Mode) dan perbaikan pengalaman navigasi.

### 🎨 Dynamic Theme System
- **Light & Dark Mode**: Wapbolt sekarang mendukung tema terang yang bersih dan profesional. Pengguna dapat memilih tema secara manual atau mengikuti pengaturan sistem operasi (System).
- **Editor Sync**: Monaco Editor sekarang secara otomatis berganti tema antara `vs` dan `vs-dark` mengikuti tema aplikasi yang aktif.
- **Global UI Cleanup**: Pembersihan besar-besaran pada seluruh komponen (Documentation, Mock Server, History) untuk menghilangkan warna *hardcoded* gelap, memastikan konsistensi visual di semua mode.

### 📂 Sidebar & Navigation Improvements
- **Collapse All**: Menambahkan tombol baru di sidebar untuk menutup semua koleksi dan folder yang terbuka dalam satu klik, membantu menjaga area kerja tetap rapi.
- **Persistence Fix**: Memperbaiki masalah di mana sidebar selalu tertutup saat aplikasi di-refresh (Cmd+R). Sekarang Wapbolt akan mengingat status ekspansi koleksi Anda.

### 🔧 Fixes & Improvements
- **Variable Overlay Cleanup**: Menghapus border hitam yang mengganggu pada tabel Body dan Headers saat menggunakan tema terang.
- **Smart Caret**: Warna kursor saat mengetik sekarang otomatis menyesuaikan dengan latar belakang tema agar tetap terlihat jelas.
- **Font Settings Restore**: Mengembalikan kotak "Preview Text" pada pengaturan ukuran font yang sempat hilang.
- **Toaster Sync**: Notifikasi aplikasi (Toast) sekarang juga mengikuti skema warna tema yang aktif.

---
*Dibuat oleh Agent pada 07 Mei 2026*
