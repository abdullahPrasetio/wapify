# Release Notes — Wapbolt v1.4.7

## What's New 🚀
Kami menghadirkan sistem donasi terintegrasi untuk mendukung keberlanjutan pengembangan Wapbolt.

### 💖 Donation System
- **Pop-up QRIS**: User akan sesekali mendapatkan ajakan donasi melalui QRIS dengan desain yang bersih dan premium.
- **Admin Control**: Waluyo dapat mengaktifkan/menonaktifkan fitur ini, mengubah pesan, dan mengatur masa cooldown (default 7 hari).
- **Instant Trigger**: Admin dapat memicu pop-up donasi secara real-time ke user tertentu atau seluruh tim melalui WebSocket broadcast.
- **Smart Cooldown**: Sistem secara otomatis mencatat kapan terakhir kali user merespon pop-up (tutup, nanti, atau donasi) untuk memastikan pengalaman pengguna tetap nyaman.

### 🔧 Fixes & Improvements
- Perbaikan bug sinkronisasi pada WebSocket client yang menyebabkan kegagalan rendering.
- Peningkatan stabilitas database dengan penambahan skema `system_settings`.
- Update metadata aplikasi ke versi **1.4.7**.

---
*Dibuat oleh Antigravity pada 05 Mei 2026*
