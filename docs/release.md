# Wapbolt v1.4.1 — Dynamic Connectivity & Workspace Fixes ⚡️

Rilis ini membawa perbaikan krusial pada fleksibilitas konektivitas server dan manajemen workspace, melengkapi transisi besar kita ke identitas **Wapbolt**.

### ✨ Apa yang Baru?

#### 🌐 Dynamic Server Connectivity
Kami menghapus sisa-sisa ketergantungan pada `localhost:8000`. Kini aplikasi sepenuhnya dinamis:
- **Mock Server & Scenarios**: Semua link mock dan cURL yang di-generate kini otomatis mengikuti URL server yang Anda atur di Settings.
- **WebSocket Protocol Detection**: Fitur kolaborasi kini secara otomatis mendeteksi penggunaan `ws://` atau `wss://` (untuk Cloudflare/HTTPS), memastikan sinkronisasi tim tetap lancar di lingkungan produksi.

#### 👥 Workspace Management Fix
Kami memperbaiki kendala pada fitur manajemen tim:
- **Member List Visibility**: Memperbaiki rute API backend agar daftar anggota workspace muncul dengan detail nama dan email yang lengkap.
- **Route Consolidation**: Menyederhanakan struktur backend untuk manajemen member agar lebih stabil dan cepat.

### ⏪ Sebelumnya di v1.4.0 (Rebrand)
- **Official Rebrand**: Perubahan nama dari Wapify menjadi **Wapbolt**.
- **New Visual Identity**: Logo baru berbasis ikon **Zap (Petir)** dan pembaruan ikon aplikasi (`icon.svg`).
- **Resizer Constraint**: Perbaikan panel respon agar tidak bisa ditarik hingga hilang (Min-height 80px).
- **Module Migration**: Update jalur impor Go ke `github.com/waluyo/wapbolt-backend`.

---

**Wapbolt — API Testing, Built for Teams.**
