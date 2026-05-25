# Wapbolt Release Notes

## [v1.7.0] — 2026-05-25
### ⚡ Environment Autocomplete, Script IntelliSense & History Replay

#### 🔐 Environment Variables
- **Variable Autocomplete**: Mengetik `{{` di URL, header, atau body memunculkan dropdown variabel dari environment aktif. Navigasi dengan ↑↓, konfirmasi Enter/Tab, tutup Escape.
- **Secret Masking**: Nilai variabel bisa ditandai sebagai rahasia — ditampilkan `••••••••` di editor. State secret tersimpan di localStorage per-environment.

#### 🛠️ Pre-request & Post-response Scripts
- **Monaco IntelliSense**: Object `wap` (dan `pm`) kini fully-typed di editor script. Autocomplete, parameter hints, dan dokumentasi inline tersedia untuk `wap.environment`, `wap.request`, `wap.response`, `wap.test()`, `wap.expect()`, dan lainnya.
- **Snippet Library**: Panel snippet di samping editor dengan insert satu-klik:
  - *Pre-request*: Set variable, Get variable, Timestamp, Bearer token injection, Log variable
  - *Tests*: Assert status 200/201/2xx, Save token dari response, Save field ke environment, Log response

#### 🕓 History Search & Replay
- **Full-text Search**: Filter history real-time berdasarkan URL, method, atau status code. Dilengkapi tombol clear.
- **Date Grouping**: Item history dikelompokkan per hari (Today, Yesterday, atau tanggal singkat).
- **One-click Replay**: Hover item history untuk menampilkan tombol replay (↺) — langsung memuat method, URL, headers, dan body kembali ke editor request, siap dikirim ulang.

---

## [v1.6.4] — 2026-05-22
### 🚀 Sidebar Refactor & Improved Save Flow
- **DND Refactor**: Menggunakan `closestCenter` dan Drag Ghost Overlay untuk pengaturan koleksi yang lebih presisi.
- **Recursive Save Location**: Modal penyimpanan request kini mendukung pemilihan folder via hierarchical tree.
- **Advanced Tab Management**: Fitur baru "Close Other Tabs", "Duplicate Tab", dan "Force Close".
- **Backend Robustness**: Konversi data ke JSONB yang lebih aman untuk mencegah panic.

## [v1.6.3] — 2026-05-18
### 🛡️ Confluence Resilience & Variables
- **Firewall Bypass**: Mendukung Method Tunneling (POST-as-PUT) dan bypass CSRF untuk lingkungan korporat ketat.
- **Environment Support**: Resolusi otomatis variabel `{{variable}}` pada seluruh konten sinkronisasi.
- **Improved UX**: Perbaikan bug `TypeError` versi halaman dan sanitasi URL yang lebih cerdas.

## [v1.6.2] — 2026-05-18
### ✨ Enhanced Confluence Sync
- **Branding Footer**: Menambahkan footer otomatis *"Generated using aplikasi wapbolt by temancode"* pada sinkronisasi Confluence.
- **Dynamic Timestamp**: Timestamp sinkronisasi menggunakan format lokal Indonesia.
- **Quick Support Links**: Integrasi link Landing Page dan GitHub Support di setiap halaman dokumentasi.

## [v1.6.1] — 2026-05-13
### 🌍 Shared Environments
- **Global Variables**: Dukungan environment yang dapat dibagikan di seluruh workspace.
- **UI Redesign**: Profil user baru dengan Avatar Dropdown dan pengelompokkan menu yang lebih rapi.
- **Security**: Proteksi read-only untuk environment global bagi pengguna non-admin.

## [v1.6.0] — 2026-05-12
### 📚 Confluence Integration
- **Full Sync**: Sinkronisasi dokumentasi API langsung ke Confluence (Cloud & Server).
- **Authentication**: Mendukung Personal Access Token dan Atlassian API Token.
- **Auto-Documentation**: Otomatis generate TOC, HTTP Method colors, dan cURL examples.

---
**Wapbolt — API Testing, Built for Teams.**
[https://wapbolt.temancode.my.id](https://wapbolt.temancode.my.id)
