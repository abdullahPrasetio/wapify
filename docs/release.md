# Wapbolt v1.6.0 — Confluence Sync & Smart Documentation 📚

Rilis ini membawa integrasi penuh dengan Confluence, memungkinkan Anda untuk mensinkronisasi dokumentasi API langsung dari Wapbolt ke halaman Confluence tim Anda.

### ✨ Apa yang Baru?

#### 📘 Confluence Integration (Cloud & Server/DC)
Kini Anda bisa membagikan dokumentasi API ke seluruh organisasi dengan sekali klik:
- **Dual Auth Support**: Mendukung **Atlassian Cloud** (Email + API Token) dan **Confluence Server / Data Center** (Personal Access Token).
- **Per-User Configuration**: Setiap anggota tim dapat menggunakan kredensial Confluence mereka masing-masing.
- **Smart Sync Engine**: Sinkronisasi otomatis menyertakan Deskripsi, Endpoint, Headers, Body Validation, dan Contoh Respons (Examples).
- **Table of Contents (TOC)**: Dokumentasi yang dihasilkan di Confluence otomatis menyertakan navigasi TOC yang interaktif.

#### 🎨 Visual Consistency & Parity
Penyelarasan estetika di seluruh penjuru aplikasi:
- **Standardized Method Colors**: Pewarnaan method HTTP kini mengikuti standar industri (GET Hijau, POST Oranye, PUT/PATCH Biru, DELETE Merah).
- **UI/UX Parity**: Warna method yang konsisten di Documentation Panel, Mock Server, dan Main Request Builder.
- **Neutral Validation Badges**: Aturan validasi (Required, Email, Numeric, dll) kini tampil lebih bersih dengan skema warna netral (*slate*).

#### 🛠️ Developer Utilities
Peningkatan alat bantu untuk mempercepat alur kerja:
- **Auto-Generated cURL**: Dokumentasi kini otomatis menyediakan perintah cURL untuk setiap endpoint, siap untuk di-*copy* dan dijalankan.
- **Improved Response Preview**: Batas tinggi maksimal pada blok kode respons dengan *custom scrollbar* untuk navigasi dokumentasi yang lebih nyaman.
- **Robust IPC Handlers**: Komunikasi antara Renderer dan Main Process yang lebih stabil untuk penanganan request lintas origin (CORS-free).

---

# Wapbolt v1.4.6 — Enterprise Resilience & Smart Collaboration 🚀

Rilis ini fokus pada kesiapan aplikasi untuk lingkungan internal/enterprise (OCP) dan peningkatan signifikan pada fitur kolaborasi real-time.

### ✨ Apa yang Baru?

#### 🛡️ Enterprise-Ready SSL/TLS Resilience
Dukungan penuh untuk pengujian API di lingkungan internal (seperti OCP BRI) yang menggunakan sertifikat *Self-Signed*:
- **Global SSL Bypass**: Aplikasi secara otomatis mengabaikan error sertifikat SSL di seluruh level (Main Process & Renderer), memungkinkan akses lancar ke domain internal.
- **Smart Backend Automation**: Menulis domain tanpa protokol di pengaturan sekarang otomatis menambahkan `https://`.
- **Insecure-Aware Code Generation**: Generator kode (cURL, Node.js, Python, Go, PHP) kini otomatis menyertakan flag `--insecure` atau opsi bypass SSL jika mendeteksi URL HTTPS.

#### 🔄 Real-time Collaboration Engine
Sinkronisasi antar anggota tim kini berjalan secara instan tanpa perlu memuat ulang aplikasi:
- **Auto-Sync Entities**: Penambahan/perubahan pada Request, Folder, Koleksi, dan History oleh satu pengguna akan langsung muncul di layar pengguna lain dalam tim yang sama melalui optimasi WebSocket.
- **Enhanced Collaboration Presence**: UI baru yang menunjukkan siapa saja yang sedang melihat request secara eksplisit (nama user) dan status penguncian (Locking) yang lebih visual dengan efek animasi.

#### 🎨 Developer Experience (UX)
Fitur-fitur kecil namun berdampak besar bagi kenyamanan pengembang:
- **JSON Beautify & Unbeautify**: Tombol satu klik untuk merapikan atau merapatkan payload JSON pada Request Body.
- **Global Font Size Control**: Pengaturan ukuran huruf editor (10px - 24px) yang tersedia secara global di menu App Settings.
- **Hard Refresh Support**: Tombol refresh di sidebar kini melakukan reload total aplikasi (seperti Cmd+R) untuk memastikan sinkronisasi state yang sempurna.
- **Production DevTools**: Memungkinkan inspeksi aplikasi (Shortcut Ctrl+Shift+I) bahkan pada versi yang sudah di-build untuk memudahkan debugging lapangan.

### 🐛 Bug Fixes & Stability
- **Defensive UI**: Memperbaiki error `TypeError: endpoints.filter` dan `toUpperCase` yang sebelumnya menyebabkan aplikasi crash saat menerima respons HTML error dari infrastruktur jaringan (seperti Router OCP).
- **Consolidated Settings**: Menyatukan pengaturan URL Backend dan preferensi tampilan dalam satu modal App Settings yang intuitif.

---

**Wapbolt — API Testing, Built for Teams.**

---

# Wapbolt v1.4.2 — Pro Console & Precision Request Engine ⚡️

Rilis ini merupakan pembaruan stabilitas besar yang fokus pada akurasi pengiriman data ke server tujuan dan transparansi debugging melalui fitur Console yang baru.

### ✨ Apa yang Baru?

#### 🛠️ Precision Request Engine (Wire Format Fix)
Kami melakukan perbaikan mendalam pada cara Wapbolt mengirimkan data `x-www-form-urlencoded` dan `form-data`:
- **Standard-Compliant Serialization**: Kini menggunakan `URLSearchParams` dan `FormData` asli dari Node.js (Main Process). Data yang sampai ke server Anda kini 100% akurat sesuai spesifikasi HTTP.
- **Header Auto-Correction**: Menghapus konflik header yang sering terjadi (seperti memaksa JSON pada data form), memastikan server backend (seperti Go Fiber) dapat mem-parsing request dengan lancar.

#### 🖥️ Advanced Network Console (Postman Style)
Tab Console kini jauh lebih bertenaga untuk debugging profesional:
- **Detailed Network Logs**: Setiap request secara otomatis mencatat detail **Request Headers**, **Request Body**, **Response Headers**, dan **Response Body**.
- **Collapsible UI**: Tampilan detail log yang bisa dibuka-tutup untuk menjaga kebersihan workspace Anda.
- **Wire Format Preview**: Melihat data asli yang dikirim "lewat kabel", memudahkan pencocokan dengan log server.

#### 🌍 Standalone Mock Server for Everyone
Aksesibilitas fitur Mock Server ditingkatkan untuk kolaborasi tim:
- **Democratized Access**: Menu "Workspace Mock Server" dipindahkan dari Admin Panel ke bagian **Workspaces** di Sidebar. Kini semua anggota tim (bukan hanya Super Admin) bisa mengelola mock server untuk workspace mereka.
- **Universal Scenario Routes**: Pengelolaan skenario kini lebih stabil dan tidak lagi bergantung pada ID koleksi tertentu.

### 🐛 Bug Fixes & UI Improvements
- **Crash Fixes**: Memperbaiki error `scenarios.map` dan `body.filter` yang sebelumnya menyebabkan aplikasi crash saat transisi data.
- **Pretty Headers**: Tabel Response Headers kini menggunakan format **Pascal-Case** (misal: `Content-Type`) dan visual spacing yang lebih lega.
- **History Accuracy**: Data riwayat kini menyimpan format asli (serialized string), memberikan gambaran yang benar tentang apa yang dikirim sebelumnya.
- **Backend Stability**: Memperbaiki kesalahan kompilasi pada rute auth dan perbaikan routing hijacking pada engine mock.

---

**Wapbolt — API Testing, Built for Teams.**
