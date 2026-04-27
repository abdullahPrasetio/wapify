# Wapbolt — All-in-One API Ecosystem

Project monorepo untuk Wapbolt (API Orchestration, Collaboration, & Documentation).

## 📁 Struktur Project
- `apps/desktop`: Aplikasi Electron + React (Client)
- `apps/landing-page`: Web promosi & dokumentasi (Vite + React)
- `backend`: Go Fiber API Server
- `docs`: Dokumentasi teknis & devplan

## 🚀 Perintah Cepat (Makefile)

Gunakan perintah `make <command>` untuk mempercepat alur kerja Anda:

### Pengembangan & Dependencies
- `make install-deps`: Instal semua library (Go & Node)
- `make dev-backend`: Jalankan backend dev mode
- `make help`: Lihat semua perintah tersedia

### Manajemen Lisensi (Offline-First)
- `make keygen`: Buat pasangan kunci Ed25519 baru
- `make generate-license NAME="Client" EMAIL="email@test.com" DURATION="1year"`: Buat kunci lisensi klien
- `make build-license-cli`: Build tool manajemen lisensi

### Build & Distribusi
- `make build-backend`: Build server internal
- `make build-backend-license PUB_KEY="xxx"`: Build server terkunci untuk klien
- `make build-docker-license PUB_KEY="xxx" TAG="v1.0.0"`: Build Docker image terkunci untuk klien
- `make build-desktop`: Build installer Windows, Mac, & Linux

## 🛠️ Persyaratan
- Go 1.21+
- Node.js 20+
- Docker (Opsional, untuk PostgreSQL & Deployment)

---
Developed by [abdullahPrasetio](https://github.com/abdullahPrasetio)
