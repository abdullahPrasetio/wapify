---
description: Panduan langkah-demi-langkah untuk memeriksa dan memverifikasi Unit Test di backend Go.
---

# Check Unit Test Workflow — Wapbolt

Workflow ini digunakan untuk menjalankan seluruh pengujian unit di proyek backend dan memastikan stabilitas kode (regression check) sebelum melakukan commit atau merge.

## 1. Menjalankan Pengujian
Gunakan perintah `make` yang telah disediakan di root direktori proyek. Perintah ini akan menjalankan semua file berakhiran `_test.go` di seluruh direktori backend.

```bash
make test-backend
```
Atau jika menjalankan langsung di dalam folder `backend`:
```bash
go test -v ./... -cover
```

## 2. Membaca Hasil (Coverage)
- **PASS**: Jika semua pengujian berhasil, Anda akan melihat pesan `ok` dan persentase *coverage* (cakupan kode yang diuji).
- **FAIL**: Jika ada yang gagal, Go akan mencetak log yang menunjukkan file mana, baris ke berapa, dan pesan error dari kegagalan tersebut (misal: `Expected X, got Y`).

## 3. Penanganan Kegagalan (Troubleshooting)
Jika perintah `make test-backend` menghasilkan `FAIL`:
1. **Baca Pesan Error**: Lihat fungsi apa yang gagal dan pada kasus pengujian (test case) mana kegagalan terjadi.
2. **Periksa Kode Sumber**: Buka file sumber (`.go`) dan file pengujiannya (`_test.go`).
3. **Lakukan Debugging**: Tambahkan `fmt.Println` atau gunakan debugger pada titik yang gagal.
4. **Perbaiki Kode**: Perbaiki bug di kode sumber, JANGAN HANYA MENGUBAH PENGUJIAN AGAR LOLOS (kecuali memang pengujiannya yang salah atau logika bisnisnya berubah).
5. **Jalankan Ulang**: Ulangi Langkah 1 hingga semua pengujian `PASS`.

## 4. Standar Cakupan (Coverage)
- Meskipun belum ada batas minimum (*threshold*) baku, usahakan setiap penambahan fitur logika inti disertai pengujian.
- Gunakan perintah `make test-coverage` jika Anda ingin melihat secara visual baris kode mana saja yang belum diuji di browser Anda.

HANYA lakukan commit ke repositori jika perintah `make test-backend` berjalan tanpa ada error.
