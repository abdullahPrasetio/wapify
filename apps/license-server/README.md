# Wapbolt License Server

Backend **standalone** untuk generate dan kirim Ed25519 license key Wapbolt ke user yang request melalui landing page. Terpisah total dari backend Wapbolt utama.

- **Stack:** Go + Fiber + GORM + PostgreSQL
- **Key format:** identik dengan `backend/cmd/license/main.go`
- **Email:** via Gmail SMTP port 465 (App Password)

---

## Cara Jalankan

### Opsi A — Docker (recommended)

**1. Build image**

```bash
cd apps/license-server
docker build -t wapbolt-license-server .
```

**2. Jalankan container**

```bash
docker run -d \
  --name wapbolt-license \
  -p 9100:9100 \
  -e PORT=9100 \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=yourpassword \
  -e DB_NAME=wapbolt_licenses \
  -e DB_SSLMODE=disable \
  -e LICENSE_PRIVATE_KEY=<base64-private-key> \
  -e LICENSE_DURATION=1year \
  -e ADMIN_API_KEY=ganti-dengan-string-acak-panjang \
  -e CORS_ORIGINS=https://wapbolt.io \
  -e GMAIL_USER=temancode@gmail.com \
  -e GMAIL_APP_PASSWORD="abcd efgh ijkl mnop" \
  -e ADMIN_EMAIL=temancode@gmail.com \
  wapbolt-license-server
```

> Jika DB berjalan di host lokal (bukan container), gunakan `--network host` atau ganti `DB_HOST` dengan IP host.

**Lihat log:**
```bash
docker logs -f wapbolt-license
```

**Stop / restart:**
```bash
docker stop wapbolt-license
docker start wapbolt-license
```

---

### Opsi B — Docker dengan file .env

```bash
cp .env.example .env
# Edit .env sesuai kebutuhan

docker run -d \
  --name wapbolt-license \
  -p 9100:9100 \
  --env-file .env \
  wapbolt-license-server
```

---

### Opsi C — Jalankan langsung (tanpa Docker)

```bash
cp .env.example .env
# Edit .env

go run .
```

---

## Setup awal

### 1. Generate keypair Ed25519

```bash
cd backend
go run ./cmd/license keygen
```

Copy nilai `LICENSE_PRIVATE_KEY=...` dari output ke `.env` license server.

### 2. Buat App Password Gmail

1. Aktifkan 2FA di [myaccount.google.com/security](https://myaccount.google.com/security)
2. Buat App Password di [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Isi `GMAIL_APP_PASSWORD` dengan 16 karakter yang didapat

### 3. Buat database PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE wapbolt_licenses;"
```

---

## Flow

```
User buka landing page
  → isi Nama + Email → klik "Register Beta"
    → POST /api/license-requests
      → generate Ed25519 key (langsung)
      → kirim key ke email user (via Gmail port 465)
      → copy ke ADMIN_EMAIL sebagai record
      → simpan di PostgreSQL (status: approved)
```

---

## API

### Public

`POST /api/license-requests`

```json
{ "name": "Budi Santoso", "email": "budi@corp.com", "message": "..." }
```

Response `201`:
```json
{ "message": "License key generated and sent to your email!" }
```

`name` dan `email` wajib. Jika Gmail tidak dikonfigurasi, key tetap di-generate dan di-log ke server console.

---

### Admin (`X-Admin-Key: <ADMIN_API_KEY>`)

| Method   | Path                                    | Keterangan                   |
|----------|-----------------------------------------|------------------------------|
| `GET`    | `/api/admin/license-requests`           | List semua issued license     |
| `PATCH`  | `/api/admin/license-requests/:id/revoke`| Tandai license sebagai revoked|
| `DELETE` | `/api/admin/license-requests/:id`       | Hapus record                  |

```bash
# List semua
curl -H "X-Admin-Key: $ADMIN_API_KEY" http://localhost:9100/api/admin/license-requests/

# Revoke
curl -X PATCH -H "X-Admin-Key: $ADMIN_API_KEY" http://localhost:9100/api/admin/license-requests/1/revoke
```

---

## Health

```bash
curl http://localhost:9100/health
# {"status":"healthy","service":"wapbolt-license-server"}
```
