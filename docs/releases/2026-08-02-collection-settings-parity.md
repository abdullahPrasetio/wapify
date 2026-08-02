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
