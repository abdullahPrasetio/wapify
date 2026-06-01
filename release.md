# Wapbolt Release Notes

## [v2.4.0] — 2026-05-29

### 🔗 OpenAPI Sync to Confluence

- **4 mode sync**: Documentation Only, OpenAPI 3.0 Raw JSON, Swagger UI Interactive, Documentation + Swagger UI
- Macro `swagger-open-api` (app "Open API (Swagger) Integration for Confluence") — spec di-embed langsung tanpa upload attachment
- Footer generated-by selalu muncul di semua mode

### 🛡 Security Hardening

- `collection.go`: 5 unguarded `.(float64)` type assertion diganti comma-ok pattern — return 401, bukan panic

---

## [v2.1.0] — 2026-05-27

### 🔥 Chaos Mode & Error Simulation (Mock Server)

- **Chaos Mode** (collection-level): toggle di header MockServerPanel — paksa error rate min 50% seluruh endpoint. Cache 5s TTL mencegah N+1 DB query.
- **Error Injection** (per-endpoint): field `error_rate` (0–100%) + `error_status_code`, slider dengan live preview, status code di-clamp 400–599.
- **Delay Range** (per-endpoint): field `delay_max_ms` baru untuk simulasi random delay range; badge di card.

### 📋 Mock Request Logs

- Tab **"Request Logs"** di MockServerPanel: setiap request ke mock server di-log async (goroutine + `recover()` guard) ke `mock_request_logs`.
- Kolom: timestamp, method, path, status, latency, matched/unmatched, chaos-injected.
- API: `GET /api/v1/collections/:id/mock/logs`.

### 🔍 Global Search yang Diperluas

- Scope: requests, collections, folders, environment variables (key+value), history, navigation.
- Grouped results per kategori + **fuzzy search** dengan skor relevansi.
- Navigasi keyboard `↑↓ Enter` flat across semua grup.

### 🛠 Hardening

- `collectionID` path param divalidasi (`parseUint`) — HTTP 400 jika invalid.
- Goroutine log dilindungi `defer recover()` — panic DB tidak crash server.

---

## [v2.0.1] — 2026-05-27

### 🐛 Bug Fixes & Hardening

- **File Upload — error handling**: `handleFilePick` di renderer kini dibungkus `try-catch`; `fs.statSync` di IPC handler juga di-guard — tidak lagi silent failure jika file tidak bisa dibaca (fallback `size: 0`).
- **Response Snapshots — cap maksimum**: Dibatasi 10 snapshot per request. Menyimpan lebih dari batas akan menampilkan pesan error, mencegah memory leak tak terbatas.
- **Type safety `window.api`**: `openFileDialog` dan `reloadApp` ditambahkan ke interface `WapboltAPI` di `env.d.ts` — `(window as any).api` cast dihapus sepenuhnya.
- **Keyboard icon di Header — custom event**: Tombol keyboard icon tidak lagi men-dispatch `KeyboardEvent` sintetis (yang bisa konflik dengan handler lain). Kini menggunakan `CustomEvent('wapbolt:open-shortcuts')` yang di-listen secara eksplisit di MainArea.
- **CSP — Monaco workers**: Ditambah `worker-src 'self' blob:` di `index.html` agar Monaco editor dapat membuat web workers tanpa error CSP.
- **File dialog — window focus**: `BrowserWindow.getFocusedWindow()` ditambah fallback ke `getAllWindows()[0]` sehingga dialog tetap terbuka meski window kehilangan fokus saat tombol diklik.
- **TypeScript — duplicate identifier**: Hapus deklarasi duplikat `responseSnapshots` di `DataState` interface.

---

## [v2.0.0] — 2026-05-27

### 🎹 Keyboard Shortcuts Panel
- **Modal daftar shortcut**: Tekan `Shift+?` atau klik icon keyboard di Header untuk membuka panel shortcut.
- **6 grup konteks**: Global, Request Editor, Tab Navigation, WebSocket, Collection Runner, Modals.
- **Platform-aware**: Menampilkan `⌘` di Mac dan `Ctrl` di Windows/Linux secara otomatis.
- Shortcut `Shift+?` tidak terpicu saat user sedang mengetik di input, textarea, atau Monaco editor.

### 📎 File Upload di Form-Data
- **Toggle Text/File per-row**: Di body `form-data`, setiap baris kini punya tombol toggle tipe — klik icon `T` (text) atau paperclip (file).
- **Native file picker**: Klik "Choose File" membuka dialog Electron OS-native untuk memilih file.
- **Nama & ukuran file** otomatis ditampilkan setelah file dipilih.
- **Kirim sebagai multipart**: File dikirim sebagai `ReadStream` — kompatibel dengan semua server yang menerima `multipart/form-data`.

### 🔍 Response Compare (Diff View)
- **Tombol Snapshot** di toolbar response — simpan response saat ini sebagai snapshot bernama.
- **Tombol Compare** muncul otomatis saat ada ≥1 snapshot — buka Monaco Diff Editor side-by-side.
- Bisa bandingkan snapshot mana saja dengan response saat ini atau snapshot lain.
- Tampilkan status code dan response time untuk setiap sisi.
- Snapshot bisa dihapus langsung dari modal Compare.

---

## [v1.7.2] — 2026-05-25

### ⌨️ Keyboard Shortcut & Export Code
- **Cmd+Enter di Monaco Editor**: Shortcut kirim request kini bekerja dari mana saja — termasuk saat fokus di editor body, pre-request script, dan tests script. Didaftarkan via `editor.addCommand` di setiap Monaco instance saat mount.
- **Export Code — 8 Bahasa Lengkap**: `node-axios`, `php-guzzle`, `java-okhttp`, `ruby-net-http`, dan `csharp-restsharp` kini menghasilkan snippet yang akurat dan siap-pakai (sebelumnya menampilkan "coming soon").
- **Fix `js-fetch` double-stringify**: Body JSON tidak lagi di-`JSON.stringify` dua kali.
- **Fix `node-native` protocol detection**: Snippet Node.js native kini otomatis menggunakan `http` atau `https` sesuai URL, lengkap dengan port dan query string.
- **Syntax highlighting**: Monaco editor di Export Code Modal kini menampilkan highlighting yang benar untuk Java, C#, PHP, Ruby, dan Go.

### 🖱️ Cursor Pointer Global Audit
- Audit menyeluruh ~60 elemen interaktif di seluruh app yang sebelumnya tidak memiliki `cursor-pointer`.
- Diperbaiki di: `MainArea`, `KeyValueEditor`, `VariableOverlayInput`, `HistoryDetailView`, `NotificationBell`, `ActivityLogView`, `ScenariosPanel`, `LoginPage`, dan semua `<select>` di sidebar, admin panels, dan modals.
- Elemen disabled kini konsisten menampilkan `cursor-not-allowed`.

---

## [v1.7.1] — 2026-05-25

### 📋 Export cURL
- **Copy as cURL**: Tombol "Copy cURL" baru di Quick Actions bar — satu klik langsung meng-copy seluruh request (method, URL, headers, body) sebagai perintah `curl` yang valid ke clipboard.
- **Semua body type didukung**: raw JSON/text, `x-www-form-urlencoded` (via `--data-urlencode`), dan `form-data` (via `-F`).
- **Multi-line format**: Output diformat dengan `\` line-continuation agar mudah dibaca dan di-paste ke terminal.

---

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
