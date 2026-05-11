# Release Notes — Wapbolt v1.5.0

## What's New 🚀
Rilis ini membawa pembaruan besar pada sistem kolaborasi tim dengan pengenalan **Real-Time Notifications** dan perbaikan stabilitas fundamental.

### 🔔 Real-Time Notification System
- **Live Collaboration**: Dapatkan notifikasi instan saat rekan tim membuat, mengubah, atau memindahkan request/koleksi di workspace yang sama.
- **Heartbeat Protocol**: Implementasi koneksi WebSocket yang lebih stabil dengan mekanisme *heartbeat* untuk mencegah pemutusan koneksi yang tidak diinginkan.
- **Activity Center**: Halaman "Activity Log" baru untuk melacak riwayat kolaborasi secara mendalam.
- **Deep Linking**: Klik pada notifikasi akan otomatis membuka sidebar, mengekspansi koleksi, dan memuat request yang relevan.

### 🧹 Auto-Retention & Cleanup
- **30-Day Retention**: Backend sekarang otomatis menghapus notifikasi lama (>30 hari) setiap 24 jam untuk menjaga performa database.
- **Manual Clear**: Tombol "Clear Activities" di halaman Log untuk menghapus seluruh riwayat aktivitas secara instan.

### 🔑 Login UX Improvements
- **Input Persistence**: Memperbaiki bug yang menghapus input Email jika password salah. Sekarang Anda hanya perlu membetulkan password tanpa mengetik ulang email.

### 🔧 Fixes & Stability
- **Backend Hub Fix**: Memperbaiki *panic error* pada WebSocket Hub yang sebelumnya bisa menyebabkan server crash saat user disconnect.
- **Search Integration**: Menambahkan navigasi "Activity Log" ke dalam Global Search (`Cmd+K`).
- **Notification Dropdown**: Tampilan lonceng yang lebih bersih, hanya menampilkan 5 aktivitas terbaru dengan akses cepat ke log penuh.

---
*Dibuat oleh Antigravity pada 11 Mei 2026*
