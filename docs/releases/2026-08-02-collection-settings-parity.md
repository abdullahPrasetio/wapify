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
