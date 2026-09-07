# Collection Settings Parity (Authorization / Scripts / Variables) — migration checklist

Fitur baru: collection-level Authorization, Pre/Post-request Scripts, dan Variables (paritas dengan Postman), plus tab "Overview" di `CollectionModal`. Berlaku identik di Wapbolt Desktop (Cloud) dan Wapbolt Local. Detail desain di [../local-app-design.md](../local-app-design.md) dan rangkuman kerja di [branch-summary-wapbolt-local.md](branch-summary-wapbolt-local.md).

## Migrasi yang perlu dijalankan

### 1. Postgres (Wapbolt Desktop / Cloud backend)

**Tidak otomatis** — backend Go tidak menjalankan migrasi saat start. Harus dijalankan manual per environment:

```
make migrate-up
```

(pakai `migrate` CLI, target `DB_URL` dibaca dari `backend/.env` — pastikan `.env` menunjuk ke environment yang benar sebelum menjalankan).

File migrasi: `backend/migrations/000033_add_settings_to_collections.up.sql` / `.down.sql` — menambah 4 kolom ke tabel `collections`: `auth_config` (JSONB), `pre_request_script` (TEXT), `post_request_script` (TEXT), `variables` (JSONB).

| Environment | Status | Tanggal |
|---|---|---|
| Dev (`192.168.18.142`) | ✅ Sudah dijalankan | 2026-08-02 |
| Staging | ⬜ Belum | — |
| Production | ⬜ Belum | — |

**Rollback** (kalau perlu): `migrate -path backend/migrations -database "$DB_URL" down 1` — akan drop keempat kolom di atas (data di kolom itu hilang, tidak ada backfill).

### 2. SQLite (Wapbolt Local)

**Otomatis** — tidak perlu tindakan manual. File `apps/desktop-local/src/main/local/migrations/004_collection_settings.sql` sudah didaftarkan di `MIGRATIONS` array (`db.ts`), dan `openDb()` menjalankan migrasi pending setiap kali app dibuka (dicek lewat tabel `schema_migrations`, idempotent — aman dijalankan berkali-kali).

Berlaku untuk semua instance Wapbolt Local yang sudah terinstal begitu mereka update ke versi berikutnya (backup `.db` otomatis dibuat sebelum migrasi jalan, per §10 `local-app-design.md`).

## Checklist sebelum rilis

- [x] Migrasi Postgres dev
- [ ] Migrasi Postgres staging
- [ ] Migrasi Postgres production (jalankan **sebelum** deploy binary backend baru — binary baru mengasumsikan kolom sudah ada)
- [x] Migrasi SQLite — otomatis, tidak perlu langkah manual, cukup pastikan `004_collection_settings.sql` ikut ter-bundle di build Wapbolt Local berikutnya

## Iterasi lanjutan (frontend, tidak butuh migrasi baru)

Dua putaran revisi UI di atas fondasi yang sama (tidak ada perubahan skema tambahan — hanya konsumsi kolom yang sudah ditambahkan di atas):

**Putaran 1 — Postman-style tab strip.** Collection settings sekarang dibuka sebagai tab di strip yang sama dengan request (bukan modal atau halaman penuh terpisah lagi) — `useDataStore.tabs` jadi discriminated union `RequestTab | CollectionTab` (field `kind`). Tab collection punya draft state sendiri (`CollectionTabContent.tsx`) yang bertahan saat pindah-pindah tab, info row (jumlah request, created by, created date — field Postman seperti Forks/Views/Watchers/Connected Apps sengaja dilewati karena tidak ada padanannya di data model Wapbolt), dan ⌘S di-routing ke `wapbolt:save-collection-tab` saat tab aktif adalah collection. Field Authorization (Username/Key/Value, request maupun collection level) sekarang pakai `VariableOverlayInput` untuk highlight/autocomplete `{{variable}}` (Token/Password tetap plain masked input — komponen overlay belum dukung masking). Tambahan dynamic variable `{{$guid}}` (UUID random per kemunculan) di `replaceVariables`.

**Putaran 2 — polish lokal.** Menu "Admin Panel" (Dashboard/User Management/Workspace Management/Donation Settings) di-gate agar tidak muncul di Wapbolt Local lewat `getAppMode().mode === 'local'` (konsep multi-tenant, tidak ada backend-nya di Local) — "Confluence Sync" tetap tampil. Donation reminder sekarang punya jalur client-side khusus Local: sekali per hari lewat `localStorage` date-stamp (`wapbolt_donation_last_shown`), karena Local tidak punya endpoint `/api/v1/donations/check`/`mark-seen`. Tab strip sekarang membedakan tiga jenis tab secara visual: request (badge method berwarna), example (badge "e.g." — sebelumnya reuse badge method yang sama seperti request biasa, jadi tidak kebeda), dan collection (ikon folder).

## Yang masih kurang / belum diverifikasi

- **Belum ada verifikasi klik manual di app yang benar-benar jalan** untuk seluruh perubahan di atas (hanya `npm run typecheck`, `go build`/`go test`, dan `npm test` di `apps/desktop-local` yang sudah dijalankan). Perlu dicoba langsung: buka collection sebagai tab, edit draft lalu pindah tab lalu balik lagi (draft harus tetap ada), Save, ⌘S saat tab collection aktif, `{{` di field Authorization (autocomplete muncul), `{{$guid}}` di URL/header, menu gear di Local (harus cuma tampil Confluence Sync), donation modal muncul 1x lalu tidak lagi di hari yang sama.
- **`VariableOverlayInput` belum tahu collection-variables** — autocomplete/highlight-nya cuma baca environment variables, bukan variable yang didefinisikan di collection. Substitusi tetap benar saat eksekusi (`{...collectionVars, ...envVars}`), cuma tidak dapat highlight hijau/autocomplete. Belum dikerjakan, disengaja untuk iterasi ini.
- **Tab "Runs" ala Postman belum ada** di `CollectionTabContent.tsx` (hanya Overview/Authorization/Scripts/Variables) — histori run collection saat ini cuma lewat `CollectionRunnerPanel` modal terpisah, belum jadi sub-tab.
- **Migrasi Postgres staging & production masih belum dijalankan** (lihat checklist di atas) — binary backend baru (yang membaca/menulis `auth_config`/`variables`/scripts) akan error di environment itu sampai migrasi jalan.
- **Confluence Sync di Wapbolt Local belum diverifikasi ulang** — trigger UI-nya (`wapbolt:open-confluence-settings`) sama persis di Cloud maupun Local, tapi belum dicek apakah backend/handler Confluence-nya memang punya jalur kerja penuh di Local atau cuma UI shell.

## Bugfix: import Postman JSON gagal di Wapbolt Local

`importCollection` (`useDataStore.ts`) selalu POST ke `/api/v1/teams/:id/import`. Di Local, request ini di-route ke `LocalRouter` (`apps/desktop-local/src/main/local/router.ts`) — tapi route itu **tidak pernah didaftarkan**, jadi selalu jatuh ke fallback 501 ("belum diimplementasikan") dan muncul sebagai toast generik "Failed to import collection". Ini bukan regresi dari perubahan-perubahan di atas, melainkan gap lama (fitur import memang belum pernah di-port ke Local — backend Go-nya sudah ada di `collection.go:507` `ImportPostman`).

Diperbaiki dengan port `ImportPostman`/`processPostmanItems`/`resolvePostmanBody` dari Go ke TypeScript: `apps/desktop-local/src/main/local/handlers/import.ts` (baru) + route `POST /api/v1/teams/:id/import` didaftarkan di `router.ts`. Mendukung mode `new` dan `overwrite` (dengan `confirm_name` safety check yang sama seperti Go), folder bersarang, header, body raw-JSON/urlencoded/form-data, `auth_config` per-request, dan saved response examples. Diverifikasi lewat 3 test baru di `router.test.ts` (create, reject overwrite ke collection yang belum ada, overwrite berhasil + confirm_name mismatch ditolak) — total 55/55 test lokal lulus.

**Belum ikut di-port** (di luar scope perbaikan ini, masih 501 di Local): import **OpenAPI** dan **Insomnia** — keduanya punya gap yang persis sama (`/import-openapi`, `/import-insomnia` juga tidak terdaftar di `router.ts`).

## Fitur lanjutan: import Postman native Authorization/Variables/Scripts (paritas migrasi)

Sebelum putaran ini, `ImportPostman`/`processPostmanItems` (Go) cuma paham field `auth_config` custom milik Wapbolt sendiri (dipakai saat re-import hasil export Wapbolt) — file asli dari Postman menyimpan Authorization di field native `auth` (schema berbeda: `{"type":"bearer","bearer":[{key,value}]}` dst) yang **tidak pernah dibaca**, jadi Authorization dan collection-level Variables/Scripts selalu hilang saat migrasi dari Postman asli. Diperbaiki di Go (`collection.go`) dan port TypeScript-nya (Local `import.ts`):

- **Authorization** — `resolvePostmanAuth` menerjemahkan native `auth` Postman (collection-level `auth` dan per-request `request.auth`) ke `auth_config` Wapbolt untuk 4 tipe yang didukung Wapbolt: `noauth`, `bearer`, `basic`, `apikey`. Tipe lain (`oauth2`, `digest`, `awsv4`, `hawk`, `ntlm`, `oauth1`, dst — **Wapbolt belum punya form/eksekusi OAuth 2.0 sama sekali**) di-skip ke "No Auth", dan dihitung sebagai `unsupported_auth_count` di response import — frontend (`useDataStore.importCollection`) menampilkan toast tambahan kalau count > 0 supaya tidak diam-diam hilang.
- **Variables** — collection-level `variable` array Postman → `collections.variables` Wapbolt.
- **Scripts** — collection-level maupun item-level `event` array (`listen: "prerequest"|"test"`, `script.exec: string[]`) → `pre_request_script`/`post_request_script`, digabung dengan `\n`, di level collection maupun per-request.

Diverifikasi dengan file Postman asli milik user (`api-partner-release-new-lite`, 209KB, collection-level `oauth2` + 5 request bearer/basic + 19 variable) lewat skrip Python terpisah untuk memastikan bentuk data nyata cocok dengan asumsi parser, plus test baru di `collection_test.go` (Go, 6/6) dan `router.test.ts` (Local, 36/36).

**Keputusan yang diambil user** (bukan asumsi saya): OAuth 2.0 sengaja **tidak** dibangun penuh di putaran ini (butuh tipe auth baru + form + logic ambil/refresh token, scope terpisah dari sekadar "import") — cukup di-skip + notice, supaya migrasi Postman→Wapbolt untuk 3 dari 4 tipe auth (dan Variables + Scripts) langsung berfungsi, sisanya diberi tahu eksplisit untuk dikonfigurasi manual.

## Fitur lanjutan: sandbox script `pm`/`wap` diperluas untuk kompatibilitas Postman

Setelah script ter-import (putaran di atas), ternyata banyak yang **tidak jalan** — sandbox eksekusi Wapbolt (`useDataStore.ts`, dipakai baik di single-request send maupun Collection Runner) cuma implementasi minimal, dicek langsung terhadap script asli milik user:

- `require('moment')` — `require` tidak ada di sandbox lama → `ReferenceError`.
- `CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(...))` (pola umum bikin header Basic Auth manual) — `CryptoJS` tidak pernah di-inject → `ReferenceError`.
- `responseBody` (global gaya Postman v1) — tidak ada di sandbox lama → `ReferenceError`.
- `pm.response.code`, `pm.response.responseTime` — sandbox lama cuma punya `.status`, bukan alias-alias ini → `undefined`.
- Chai matcher: `.to.eql`, `.to.be.above/below`, `.to.have.property`, dan bentuk getter `.not.null` (tanpa dipanggil sebagai fungsi) — sandbox lama cuma punya `.to.equal`/`.be.a`/`.include`/`.not.to.be.null()`.

Ditambahkan di `useDataStore.ts` (dipakai di 4 tempat: pre/post-request script baik untuk single-request send maupun Collection Runner):
- `CryptoJSShim` — **bukan** port penuh crypto-js, cuma `enc.Utf8`/`enc.Base64` (encode/decode base64 dari string) yang menutupi pola "hand-roll Basic Auth header" yang umum di script Postman. Tidak ada MD5/SHA/HMAC.
- `wapboltScriptRequire('moment'|'lodash'|'crypto-js')` — shim `require()` minimal untuk 3 modul itu saja; modul lain melempar error jelas ("not supported"), bukan diam-diam gagal.
- `createScriptExpect` — chai-like matcher yang lebih lengkap (`.eql`, `.be.above/below`, `.have.property`, `.not.null`/`.not.undefined` getter-style).
- `pm.response.code` (alias `.status`), `pm.response.responseTime`, `pm.response.text()`, dan `responseBody` (global, isi teks response — di-`JSON.stringify` kalau `response.data` sudah ter-parse jadi object).

**Bug yang ketemu & diperbaiki selagi verifikasi** (bukan cuma nambah fitur — dua ini bikin fitur di atas nyaris tidak berguna kalau tidak ketangkap):
1. `responseBody` sempat ditaruh sebagai properti `wap.responseBody`, padahal script memakainya sebagai identifier bebas (`responseBody`, bukan `pm.responseBody`) — jadi tidak pernah benar-benar masuk scope. Diperbaiki dengan mem-bind `responseBody` sebagai parameter asli ke `AsyncFunction`, bukan properti objek.
2. `moment`/`_` (lodash) awalnya di-bind sebagai bare parameter ke `AsyncFunction` — ini bikin **setiap** script yang menulis `const moment = require('moment')` (pola standar Postman) langsung gagal dengan `SyntaxError: Identifier 'moment' has already been declared`, karena `const`/`let` tidak boleh mendeklarasikan ulang nama yang sudah jadi parameter fungsi. Diperbaiki dengan **tidak** lagi mem-bind `moment`/`_` sebagai bare global — keduanya cuma bisa diakses lewat `require('moment')`/`require('lodash')`, sama seperti Postman asli (yang juga tidak expose `moment` sebagai bare global).

Diverifikasi lewat skrip Node standalone (re-implementasi helper, dijalankan di luar Electron/React) terhadap 4 script asli dari file user (`oauth` pre+test, `Fraud Prevention` pre, `esign` test) — semua jalan tanpa error dan `collectionVariables`/`pm.test` hasilnya benar. Skrip verifikasi dihapus setelah lulus (bukan bagian dari test suite permanen — lihat catatan di bawah).

**Belum ada test permanen untuk sandbox ini** — `packages/ui-shared` tidak punya infrastruktur vitest sama sekali (beda dari `apps/desktop-local` yang punya 56 test). Verifikasi di atas hanya sekali jalan manual, bukan regression-proof. Kalau ada perubahan lanjutan ke `runPmScript`/`createScriptExpect`/dst, perlu dites ulang manual atau (lebih baik) set up vitest untuk `packages/ui-shared` dulu.

## Fitur lanjutan: `VariableOverlayInput` sekarang tahu collection variables

User laporan: field yang sudah pakai `VariableOverlayInput` (URL bar, Headers, Body form-data/urlencoded, Authorization Username/Key/Value) selalu menampilkan `{{nama_variable}}` sebagai **amber (unresolved)** untuk variable yang didefinisikan di level *collection* (bukan environment) — padahal saat eksekusi (`replaceVariables`) variable itu ke-resolve dengan benar. Penyebabnya persis seperti sudah dicatat di limitation sebelumnya: overlay ini cuma baca `environments[activeEnvironmentId].variables`, sama sekali tidak tahu `collection.variables`.

Diperbaiki: `VariableOverlayInput` sekarang menerima prop opsional `collectionId?: number`. Highlight, autocomplete, dan preview value sekarang gabung `{...collectionVars, ...envVars}` (urutan sama seperti `replaceVariables` — Environment menang kalau bentrok key). Popup "klik variable untuk set nilai" tetap menulis ke Environment saja (tidak diubah — scope "menulis ke collection variable dari popup ini" belum dikerjakan), tapi sekarang menampilkan pesan yang lebih jujur kalau variable-nya sebenarnya sudah resolve dari collection (bukan lagi selalu bilang "No active environment").

`collectionId` di-wire di semua 7 titik pemakaian: `MainArea.tsx` (URL bar lewat `RequestForm`, Headers/Body lewat `KeyValueEditor`, Authorization Username/Key/Value) dan `CollectionTabContent.tsx` (Authorization Username/Key/Value + Variables tab-nya sendiri) — masing-masing memakai `parentCollection?.id` (request) atau `tab.collectionId` (collection tab).

## Bugfix: header Postman `disabled: true` ikut ter-import sebagai header aktif

User laporan header hilang saat import ("Headers (11)" di Postman vs cuma "(1)" di Wapbolt). Dicek langsung dari file JSON asli user — ternyata bukan bug: request itu di collection aslinya memang cuma punya **1 header** (`Authorization`, `disabled: true`). Angka "11" di Postman UI adalah header yang **dihitung/di-generate otomatis oleh Postman saat preview** (Content-Type, Content-Length, Host, User-Agent, Accept, Accept-Encoding, Connection, Postman-Token, Cache-Control, dll) — bukan bagian dari file export, jadi tidak mungkin di-reproduksi oleh import tool manapun (tidak ada datanya).

Tapi proses pengecekan ini nemu bug beneran yang lebih kecil: field `disabled` pada Postman header (`{"key": "...", "value": "...", "disabled": true}`) **tidak pernah dibaca** — `PostmanReq.Header` (Go) dan `PostmanHeader` (TypeScript, Local) tidak punya field itu sama sekali, jadi header yang di-uncheck/nonaktifkan di Postman (harusnya TIDAK ikut terkirim) malah ikut ter-import sebagai header aktif. Diperbaiki di kedua tempat (`collection.go` `processPostmanItems`, `import.ts`): header dengan `disabled: true` sekarang di-skip, tidak masuk ke `headers` map. Diverifikasi lewat test baru di `router.test.ts` (header `Authorization` dengan `disabled: true` di fixture import, di-assert `toEqual` bukan cuma `toMatchObject` — supaya kebocoran field ekstra ikut ketahuan, bukan lolos diam-diam).

## Fitur lanjutan: mode masking di `VariableOverlayInput` (Bearer Token / Basic Auth password)

User laporan field "Token" (Bearer Auth) masih plain text tanpa highlight — dijelaskan awalnya ini disengaja (Token/Password sengaja dibiarkan `<input type="password">` polos karena `VariableOverlayInput` tidak punya mode masking). User minta ditambahkan mode masking supaya highlight `{{variable}}` tetap ada tanpa membuka nilai literal secret.

Ditambahkan dua prop baru ke `VariableOverlayInput`: `masked?: boolean` dan `revealed?: boolean`. Saat `masked && !revealed`, karakter literal di luar `{{...}}` diganti bullet (`•`) sepanjang teks aslinya — tapi span `{{variable_name}}` tetap ditampilkan apa adanya dengan warna highlight normal (nama variable bukan rahasia; nilai hasil resolve-nya yang rahasia). `revealed` dikontrol oleh tombol mata (Eye/EyeOff) yang sudah ada di tiap field, jadi UX show/hide-nya identik seperti sebelumnya.

Dipasang di 4 tempat: Bearer Token & Basic Auth Password, baik di `MainArea.tsx` (request-level) maupun `CollectionTabContent.tsx` (collection-level) — menggantikan `<input type="password">` polos yang sebelumnya dipakai di situ.

## Bugfix: `pm.collectionVariables.set()` dua kali berturut-turut kehilangan salah satu nilai (race condition)

User laporan: script test `oauth` (`pm.collectionVariables.set("access_token", ...)` lalu `pm.collectionVariables.set("refresh_token", ...)` di baris berikutnya, tanpa `await`) masuk ke block-nya tanpa error, tapi variable tetap tidak ke-set.

Penyebab: `updateCollectionVariable` membaca `collection.variables` dari Zustand state, gabung key baru, lalu `PUT` seluruh objek ke server/LocalRouter — tapi ini **tidak di-serialize**. Dua panggilan `set()` berturut-turut (seperti di script user) sama-sama memicu `updateCollectionVariable` yang berjalan konkuren; keduanya membaca snapshot `collection.variables` yang **sama-sama basi** (belum ada yang selesai nulis), lalu PUT terpisah — siapa pun yang responsnya datang belakangan menimpa state dengan objek `variables` yang cuma punya key dari panggilannya sendiri, sehingga key dari panggilan lain hilang. Diverifikasi lewat simulasi Node standalone (5x run, random network latency): tanpa perbaikan, salah satu dari `access_token`/`refresh_token` konsisten hilang di setiap run; dengan perbaikan, keduanya selalu tersimpan.

Diperbaiki dengan antrean (`queueByKey`) per `collectionId`/`environmentId` — panggilan `set()` berikutnya untuk collection/environment yang sama menunggu round-trip (baca-gabung-PUT-simpan state) panggilan sebelumnya selesai dulu, baru baca snapshot terbaru. Diterapkan ke `updateCollectionVariable` (bug utama) dan `updateActiveEnvironmentVariable` (potensi race yang sama, diperbaiki sekalian meski mitigasinya sudah sedikit lebih baik karena update state lokal duluan sebelum network call).

Sekalian ditambahkan `console.warn` di `pm.collectionVariables.set` kalau `collection` gagal di-resolve untuk tab request yang aktif (sebelumnya diam-diam no-op) — supaya kelas bug ini kelihatan lewat DevTools Console, bukan cuma "kok gak ke-set" tanpa jejak.

## Debugging: header "kosong" di beberapa request — dicek langsung ke database dev user

Waktu ditelusuri lebih lanjut ("header masih ga ada"), saya cek langsung isi database SQLite dev milik user (`~/Library/Application Support/wapbolt-desktop-local-dev/wapbolt-local.db`) lewat `sqlite3` CLI untuk dapat jawaban pasti, bukan menebak dari UI:

- Request `eSign request Template` (id 30): `headers` tersimpan benar — `{"Content-Type":"application/json","Authorization":"Bearer eyJ..."}`. Bukan bug; kemungkinan yang dilihat user adalah tab lama yang belum di-refresh setelah re-import (tab menyimpan `workingRequest` sendiri, tidak otomatis sinkron ke row baru hasil overwrite-import yang ID-nya berubah).
- Request `Fraud Prevention API - FR` (id 28, URL `{{services-svc}}/v2/services/fraud`): `headers = {}` — ini **benar**, sesuai temuan sebelumnya (satu-satunya header di file aslinya, `Authorization`, `disabled: true`).

## Fitur lanjutan: auto default `Content-Type` header saat request dikirim (mirip Postman)

Dari pengecekan `Fraud Prevention API - FR` di atas, ketemu gap nyata: request itu tidak punya header `Content-Type` sama sekali (baik di file Postman asli maupun di Wapbolt), padahal body-nya raw-JSON. Diverifikasi ini bukan cuma soal request itu — dicek perilaku asli Postman: Postman **selalu** otomatis menambahkan `Content-Type` sesuai bahasa yang dipilih di tab Body (JSON/XML/HTML/Text) sebagai *hidden header* saat mengirim, tapi **tidak pernah menuliskannya ke file export** collection. Itu sebabnya banyak request hasil import tidak punya `Content-Type` eksplisit — bukan lupa ditulis, tapi memang Postman yang mengurusnya diam-diam di baliknya.

Wapbolt sebelumnya cuma auto-set `Content-Type` saat body type diganti lewat UI (`setWorkingRequest`'s `contentTypeMap`, dipicu oleh aksi eksplisit user), **tidak pernah** saat mengirim request — jadi request hasil import raw-JSON tanpa header eksplisit selalu berangkat tanpa `Content-Type` sama sekali, berpotensi ditolak API tujuan yang strict soal ini.

Ditambahkan `withDefaultContentType(headers, bodyType)` di `useDataStore.ts` — dipanggil tepat sebelum request benar-benar dikirim (baik di single-request send maupun Collection Runner), untuk `raw-json`/`raw-xml`/`raw-html`/`raw-text`/`graphql`/`x-www-form-urlencoded`. Aturan: **cuma isi kalau belum ada header Content-Type sama sekali** (case-insensitive check) — header eksplisit (hasil import atau ditulis manual user) selalu menang, tidak pernah ditimpa. `form-data` sengaja dikecualikan karena butuh boundary per-request yang di-generate executor, bukan string tetap. Ini juga menggantikan special-case `isGraphQL`-only yang sudah ada sebelumnya (sekarang jadi kasus umum dari helper yang sama).

Diverifikasi lewat skrip Node standalone (5 skenario: inject saat kosong, tidak menimpa yang sudah eksplisit, case-insensitive existing header tidak dobel, `form-data` sengaja dilewati, body type `none` tidak disentuh) — semua lulus. Juga `npm run typecheck` bersih di kedua app dan 56/56 test Local masih lulus (tidak ada test vitest khusus untuk helper ini — sama seperti sandbox script, `packages/ui-shared` belum ada infrastruktur test).

## Fitur lanjutan: auto Content-Type ditampilkan sebagai "hidden header" di tab Headers (persis Postman)

User minta paritas visual penuh dengan Postman: auto Content-Type di atas tidak cuma berlaku saat kirim, tapi juga **muncul di tab Headers** sebagai baris abu-abu/read-only (Postman menampilkan header auto-generate seperti ini, bukan hanya menyisipkannya diam-diam saat request benar-benar berangkat).

- `getDefaultContentType(bodyType)` diekspor dari `useDataStore.ts` (re-export tipis dari `DEFAULT_CONTENT_TYPE_BY_BODY_TYPE`/`withDefaultContentType` yang sudah ada) supaya UI pakai sumber data yang sama persis dengan yang dipakai saat eksekusi — tidak ada logic kedua yang bisa drift.
- `KeyValueEditor` (dipakai untuk tab Headers) dapat prop baru `autoRows?: { key, value, note }[]` — baris tambahan yang dirender di `<tbody>` sebelum baris yang bisa diedit, gaya abu-abu/italic dengan ikon gembok (`Lock`) menggantikan checkbox, tanpa tombol hapus (memang bukan data yang tersimpan).
- Di `MainArea.tsx`'s tab Headers: dihitung `hasExplicitContentType` (case-insensitive, dari `workingRequest.headers`) — kalau request **sudah** punya Content-Type sendiri, baris auto ini tidak muncul sama sekali (menghindari duplikasi/kebingungan "yang mana yang beneran dikirim").

Cuma dipasang di Headers tab request (`MainArea.tsx`) — collection tidak punya tab Headers sendiri (cuma Overview/Authorization/Scripts/Variables), jadi tidak relevan di `CollectionTabContent.tsx`.
