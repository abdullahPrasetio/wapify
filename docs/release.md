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
