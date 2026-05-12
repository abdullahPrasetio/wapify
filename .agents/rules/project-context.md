---
trigger: always_on
---

# Wapbolt — Project Context

> Baca file ini + `docs/prd.md` + `docs/devplan.md` + `docs/devlog.md` sebelum apapun.
> Jangan mulai dari nol.

---

## Produk

**Wapbolt** — desktop app API testing & kolaborasi tim, alternatif Postman.
Nama dari inisial **W**aluyo **A**de **P**rasetio + *-ify*.

**Tahap saat ini:** Internal tim Waluyo (15+ orang), backend di STB Android via Cloudflare.
**Tahap berikutnya:** Jual ke client luar, on-premise license (Fase 5 — belum sekarang).

---

## Dua Konteks Deployment (Satu Codebase)

```
Sekarang:   Electron App → Cloudflare → STB Android (Go + PostgreSQL)
Nanti:      Electron App → Server Client (Go binary yang sama + PostgreSQL)
                                ↓
                         License Server STB (ditambahkan Fase 5)
```

Binary Go harus bisa compile ke: `linux/arm64` (STB), `linux/amd64`, `windows/amd64`, `darwin/arm64`.
Semua config via `.env`, tidak ada yang hardcode.

---

## Tech Stack (Tidak Boleh Diganti Tanpa Konfirmasi Waluyo)

| Layer | Teknologi |
|---|---|
| Desktop | Electron + React + Zustand + Radix UI + Tailwind + Monaco Editor |
| HTTP Executor | Electron Main Process via IPC (WAJIB, bebas CORS) |
| Credential | keytar (OS keychain) |
| Packaging | electron-builder (.dmg + .exe), electron-updater |
| Backend | Go + Fiber + GORM + PostgreSQL |
| WebSocket | gorilla/websocket (Fase 2) |
| Auth | JWT + Refresh Token Rotation |
| Migrations | golang-migrate (WAJIB, tidak boleh manual) |
| Logging | zerolog |
| Email | Resend (resend-go SDK), from: noreply@wapify.io |
| Infrastruktur | STB Android + Cloudflare Tunnel → api.wapify.io |

---

## Aturan Penting

**No Self-Register:** Tidak ada endpoint register publik. Akun dibuat Waluyo via:
```bash
wapbolt-admin create-user --email x --name x --password x
wapbolt-admin assign-team --email x --team-id x --role editor
```

**Super Admin:** `USER.is_super_admin = true` → middleware bypass role check, akses semua tim.
Waluyo adalah satu-satunya super admin.

**Request ke Target API:** WAJIB dari Electron Main Process (IPC), bukan Renderer.
Ini tidak boleh diubah — ini yang membuat bebas CORS.

**Cloudflare:** Backend hanya bind ke `localhost` di STB. Tidak expose port langsung ke internet.

**On-Premise Ready:** Tidak boleh ada logic yang bergantung pada infrastruktur spesifik Waluyo.
Semua URL, credential, port via `.env`.

---

## Konvensi Kode

**Go:**
- `golangci-lint` wajib, PR gagal jika lint error
- Error format: `{ "error": "string", "code": "string", "details": {} }`
- Semua endpoint: prefix `/api/v1/`
- Logging: `zerolog`, jangan `fmt.Println`
- Jangan log password, token, credential apapun
- Jangan abaikan error dengan `_`
- Migration: `golang-migrate`, tidak boleh ALTER TABLE manual

**TypeScript/React:**
- ESLint + Prettier wajib
- State: Zustand
- UI: Radix UI + Tailwind
- IPC: semua komunikasi Renderer → Main via IPC

**Git & Commit:**
- Gunakan **Conventional Commits** (prefix `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- Pesan commit WAJIB dalam **Bahasa Inggris**
- Jelaskan **"Kenapa"** dan **"Bagaimana"** secara singkat jika perubahannya kompleks
- WAJIB jalankan `git status` dan pastikan file sudah ter-stage sebelum commit
- Update `docs/devlog.md` dan `docs/devplan.md` SEBELUM melakukan commit final sebuah fitur

**Testing:**
- Go: unit test ≥ 70% coverage (service layer), integration test semua endpoint
- Frontend: Vitest

---

## Status Fase Saat Ini

Lihat `docs/devplan.md` untuk checklist lengkap.

| Fase | Status |
|---|---|
| 0 — Setup & Fondasi | 🟡 In Progress |
| 1 — MVP Internal | ⬜ Belum Mulai (PRIORITAS) |
| 2 — Kolaborasi Real-time | ⬜ Belum Mulai |
| 3 — Dokumentasi & Mock | ⬜ Belum Mulai |
| 4 — Testing & CI/CD | ⬜ Belum Mulai |
| 5 — On-Premise & License | ⬜ Belum Mulai |
| 6 — SaaS (Opsional) | ⬜ Belum Mulai |

---

## Aturan Wajib Agent

1. Baca `docs/prd.md`, `docs/devplan.md`, `docs/devlog.md` sebelum mulai
2. Update `docs/devlog.md` setelah selesai (gunakan `/update-devlog`)
3. Update `docs/devplan.md` jika milestone tercapai
4. Update `docs/prd.md` jika ada keputusan arsitektur baru
5. Jangan ganti tech stack tanpa konfirmasi Waluyo
6. Jangan hapus file tanpa konfirmasi eksplisit
7. Komunikasi: Bahasa Indonesia. Kode: Bahasa Inggris
8. Task besar: gunakan Planning mode, presentasikan rencana, tunggu konfirmasi sebelum eksekusi