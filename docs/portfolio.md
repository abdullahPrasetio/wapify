# Wapbolt — Portfolio

**Wapbolt** adalah aplikasi desktop untuk API testing, kolaborasi tim, dan dokumentasi — alternatif Postman yang dibangun dengan Electron + Go, dirancang untuk tim developer dan QA.

> *"API Testing, Built for Teams"*

---

## Image 1 — Hero: Main Request Editor

**Deskripsi screenshot:** Tampilan utama Wapbolt dengan request editor aktif — method selector (POST), URL bar, tab Body (RAW JSON dengan Monaco Editor), response panel menampilkan JSON response berstatus 200 OK, dan sidebar collection di kiri.

**Caption portfolio:**
> Wapbolt hadir dengan Monaco Editor yang sama digunakan VSCode — syntax highlighting, autocomplete, dan format JSON otomatis langsung di dalam request body.

**Poin teknis yang ditampilkan:**
- Monaco Editor embedded untuk body & scripting
- Split-pane layout (request editor + response viewer)
- Response: status badge, timing, ukuran body, pretty-print JSON
- Method color-coded (POST = orange, GET = green, dst.)

---

## Image 2 — Real-time Collaboration

**Deskripsi screenshot:** Dua atau lebih avatar user muncul di header request yang sedang dibuka bersama. Badge "Locked by Siti" muncul saat ada user lain yang sedang mengedit field yang sama. Sidebar menunjukkan collection Sprint 59 dengan beberapa folder (Odin, Src, UI Maintenance).

**Caption portfolio:**
> Kolaborasi tim secara real-time: setiap anggota bisa melihat siapa sedang membuka request yang sama, dengan field-level locking untuk mencegah konflik editing.

**Poin teknis yang ditampilkan:**
- WebSocket connection (badge "Collaboration connected" di footer)
- Presence indicator: avatar user yang sedang aktif di request
- Field-level locking: user lain tidak bisa edit field yang sedang dikunci
- Teknologi: Go WebSocket server + Zustand store di client

---

## Image 3 — Sidebar Collection & Folder Tree

**Deskripsi screenshot:** Sidebar dengan collection tree: Sprint 59 → Src → (odin, zoloz, wong, Gateway), UI Maintenance → Gateway. Request di-listing dengan method badge (POST, GET) berwarna. Context menu muncul saat klik kanan (Add Request, Add Folder, Rename, Delete, Export).

**Caption portfolio:**
> Organisasi API request dalam struktur folder bersarang — drag-and-drop untuk reorder, context menu untuk aksi cepat, dan real-time sync antar anggota tim.

**Poin teknis yang ditampilkan:**
- Recursive folder tree rendering (FolderItem component)
- Drag-and-drop dengan @dnd-kit/sortable (fractional indexing)
- Optimistic UI update + backend sync via PATCH order_index
- Expand state di-persist ke localStorage

---

## Image 4 — Environment Variables

**Deskripsi screenshot:** Panel Environment Variables dengan tabel key-value. Variable `{{base_url}}`, `{{token}}`, `{{user_id}}` tersebut dalam URL bar dan body request dengan highlight berwarna berbeda (resolved = hijau, unresolved = kuning). Dropdown selector environment di sudut kanan atas (Dev / Staging / Production).

**Caption portfolio:**
> Environment variables dengan interpolasi `{{variable}}` — switch antara Dev, Staging, dan Production dalam satu klik. Variable di-resolve secara real-time sebelum request dikirim.

**Poin teknis yang ditampilkan:**
- Variable interpolation engine di request executor
- Active environment selector (per-workspace)
- Visual indicator variable resolved vs. unresolved
- Variable override di Pre-request Script via `wap.env.set()`

---

## Image 5 — Pre-request & Post-request Script

**Deskripsi screenshot:** Tab "Pre-request" dengan Monaco Editor berisi script JavaScript. Contoh script: set token dari environment, generate timestamp, log request ke console. Panel console di bawah menampilkan output `console.log`. Alias `wap` dan `pm` tersedia sebagai SDK.

**Caption portfolio:**
> Scripting engine berbasis JavaScript dengan Wapbolt SDK (`wap` / `pm` alias) — set environment variable, generate dynamic value, validasi response, semua bisa dilakukan sebelum dan sesudah request dikirim.

**Poin teknis yang ditampilkan:**
- JavaScript sandbox dengan AsyncFunction executor
- SDK: `wap.env.get/set`, `wap.response`, `wap.request`
- Library tersedia: Moment.js, Lodash
- Kompatibel dengan sintaks Postman (`pm.environment.set`)

---

## Image 6 — Mock Server

**Deskripsi screenshot:** Panel Mock Server dengan daftar endpoint (GET /users, POST /auth/login, GET /products/:id). Setiap endpoint punya scenario yang bisa di-switch: "200 Success", "401 Unauthorized", "500 Server Error". Toggle aktif/nonaktif per endpoint. URL mock server ditampilkan: `https://wapbolt.io/mock/collection-id/path`.

**Caption portfolio:**
> Mock Server terintegrasi langsung dalam Wapbolt — buat endpoint palsu dengan berbagai skenario response, switch manual antara success/error/loading, tanpa perlu deploy server terpisah.

**Poin teknis yang ditampilkan:**
- Dynamic scenario switching (active_scenario_id)
- Conditional matching: query param, body field, header, path param
- Chaos Mode: paksa error rate min 50% untuk load testing
- Request logs: setiap request dicatat (timestamp, method, latency, matched/unmatched)

---

## Image 7 — Collection Runner

**Deskripsi screenshot:** Panel Collection Runner sedang berjalan — progress bar, daftar request dengan result badge (PASS hijau / FAIL merah), response time per request, summary total: 12 passed, 2 failed. Tombol "Export Results" dan "Stop".

**Caption portfolio:**
> Collection Runner untuk automated testing — jalankan seluruh collection sekaligus, lihat hasil test per request, dan export report. Juga tersedia sebagai CLI: `wapbolt run collection.json`.

**Poin teknis yang ditampilkan:**
- Sequential execution dengan Pre/Post script per request
- Test assertions via `wap.test()` dalam Post-request Script
- CLI runner: `wapbolt run` (binary terpisah, untuk CI/CD pipeline)
- Export hasil: JSON report

---

## Image 8 — Export Code Snippet

**Deskripsi screenshot:** Modal "Export to Code" muncul setelah klik tombol `</>`. Dropdown pilihan bahasa: cURL, JavaScript (Fetch), Go, Python, PHP, Kotlin, Swift, Dart. Kode siap-pakai muncul di editor dengan tombol "Copy". Environment variable sudah di-resolve (nilai aktual, bukan `{{placeholder}}`).

**Caption portfolio:**
> Export request ke 9 bahasa pemrograman dalam satu klik — cURL, JavaScript, Go, Python, PHP, Kotlin, Swift, Dart, dan Java. Environment variable otomatis di-resolve ke nilai aktual sebelum di-generate.

**Poin teknis yang ditampilkan:**
- Template-based code generator per bahasa
- Environment resolution sebelum generate
- Monaco Editor untuk display snippet (syntax highlighting)
- Copy to clipboard

---

## Image 9 — Import cURL

**Deskripsi screenshot:** Dialog "Import cURL" dengan textarea berisi command curl multiline. Setelah klik "Import", request otomatis terisi: method POST, URL terisi, headers (Authorization, Content-Type) masuk ke tab Headers, body JSON masuk ke tab Body.

**Caption portfolio:**
> Paste cURL command langsung ke Wapbolt — method, URL, headers, body, dan auth otomatis diparse dan diisi. Mendukung cURL multiline, basic auth (`-u`), dan semua flag umum.

**Poin teknis yang ditampilkan:**
- cURL parser (curlconverter + custom normalization)
- Auto-detect: paste teks yang dimulai `curl ` di URL bar langsung trigger import
- Mendukung: `-X`, `-H`, `-d`, `--data-raw`, `-u`, `--header`, `-b`
- Toleran terhadap variasi format (single/multiline, dengan/tanpa quotes)

---

## Image 10 — Import Postman Collection

**Deskripsi screenshot:** Dialog "Import Collection" dengan drag-drop zone untuk file JSON. Progress import: "Importing 47 requests across 8 folders..." Setelah selesai, collection langsung muncul di sidebar lengkap dengan struktur folder, request, environment variables.

**Caption portfolio:**
> Migrasi dari Postman tanpa kehilangan data — import file Postman v2.1 JSON secara langsung, termasuk folder, request, environment, dan pre/post scripts.

**Poin teknis yang ditampilkan:**
- Parser Postman Collection v2.1 format
- Mapping: Postman item → Wapbolt request, Postman folder → Wapbolt folder
- Environment variables di-import sekaligus
- `pm.*` script Postman kompatibel via alias `wap`

---

## Image 11 — Infrastruktur & On-Premise

**Deskripsi diagram:**
```
[ Tim (remote) ]
      │ HTTPS
      ▼
[ Cloudflare ]  ← DDoS protection, SSL otomatis
      │ Tunnel
      ▼
[ STB Android — Di rumah Waluyo ]
[ Go Backend + PostgreSQL ]
```

**Caption portfolio:**
> Backend Go berjalan di STB Android di rumah, diekspos via Cloudflare Tunnel — zero server cost, zero port forwarding, IP asli tersembunyi. Arsitektur yang sama bisa di-deploy on-premise di server client.

**Poin teknis yang ditampilkan:**
- Go single binary (cross-compile ke Android ARM)
- Cloudflare Tunnel (tidak butuh public IP / open port)
- On-premise license: Ed25519 signature validation
- Config via `.env` — satu binary untuk semua environment

---

## Deskripsi Singkat (untuk bio/tagline portfolio)

**Versi 1 baris:**
> Wapbolt — Desktop API client dengan kolaborasi real-time, mock server, dan scripting engine, dibangun dengan Electron + React + Go.

**Versi 3 baris:**
> Wapbolt adalah alternatif Postman yang saya bangun dari nol — Electron desktop app (macOS + Windows) dengan backend Go yang berjalan di STB Android via Cloudflare Tunnel.
>
> Fitur unggulan: real-time collaboration dengan field-level locking, mock server dengan scenario switching, JavaScript scripting engine, collection runner, dan export ke 9 bahasa pemrograman.
>
> Digunakan aktif oleh tim backend dan QA internal untuk pengujian API sehari-hari.

**Tech stack singkat:**
> Electron · React · Zustand · Tailwind CSS · Monaco Editor · Go · Fiber · GORM · PostgreSQL · WebSocket · Cloudflare Tunnel · Ed25519

---

## Urutan Rekomendasi untuk Portfolio Showcase

| Prioritas | Image | Alasan |
|---|---|---|
| 1 | Main Request Editor | First impression — visual paling kuat |
| 2 | Real-time Collaboration | Differentiator utama vs. tools lain |
| 3 | Mock Server | Fitur unik yang jarang ada di tools sejenis |
| 4 | Pre-request Script | Menunjukkan kedalaman teknis |
| 5 | Collection Runner | Menunjukkan mature product |
| 6 | Export Code Snippet | Useful + visually clean |
| 7 | Import cURL | Developer-friendly UX |
| 8 | Sidebar Tree | Menunjukkan polish UI |
| 9 | Environment Variables | Core workflow feature |
| 10 | Import Postman | Menunjukkan migration path |
| 11 | Infrastruktur | Menunjukkan sisi engineering unik |
