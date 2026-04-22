# Wapify Licensing System (Simplified) 🔐

Dokumen ini menjelaskan arsitektur manajemen lisensi Wapify yang menggunakan pendekatan **Offline-First**.

---

## 1. Konsep Utama: Offline Validation
Wapify menggunakan validasi kriptografi Ed25519 untuk memastikan lisensi valid tanpa memerlukan koneksi internet ke server pusat.

### A. License CLI (Alat Waluyo)
*   **Peran:** Sebagai *Authority* (Penerbit Izin).
*   **Fungsi:** Digunakan oleh Waluyo untuk men-generate pasangan kunci (Keypair) dan membuat string lisensi untuk klien.
*   **Lokasi:** `backend/cmd/license/main.go`.

### B. Wapify App (Aplikasi Klien)
*   **Peran:** Sebagai *Verifier* (Pemeriksa Izin).
*   **Kunci:** Memiliki `LICENSE_PUBLIC_KEY` yang di-embed di dalam kode/binary.
*   **Fungsi:** Memverifikasi integritas lisensi secara lokal (offline) menggunakan Public Key.

---

## 2. Cara Kerja (Ed25519)
1.  **Signing:** Waluyo menggunakan CLI dengan **Private Key** untuk menandatangani data klien (Nama + Expiry).
2.  **License Key:** Hasilnya berupa string `Payload.Signature`.
3.  **Verification:** Aplikasi klien menggunakan **Public Key** untuk memastikan data belum diubah dan tanda tangan tersebut valid.

---

## 3. Panduan Operasional (Terminal CLI)

Gunakan perintah berikut di dalam folder `backend`:

### A. Membuat Pasangan Kunci (Keypair)
```bash
go run cmd/license/main.go keygen
```
*   **LICENSE_PRIVATE_KEY:** Simpan dengan aman (hanya untuk Anda).
*   **LICENSE_PUBLIC_KEY:** Tanam di binary aplikasi klien.

### B. Men-generate Lisensi untuk Klien
```bash
go run cmd/license/main.go generate --name "Nama Klien" --email "client@email.com" --duration 1year
```
*Gunakan flag `--private-key` jika tidak ada di `.env`.*

---

## 4. Keamanan
*   **Offline First:** Tidak ada fitur *Revocation* (pencabutan) secara remote karena aplikasi tidak melapor ke server pusat. Pembatasan dilakukan berdasarkan tanggal kadaluarsa (`ValidUntil`) yang terenkripsi dalam lisensi.
*   **Binary Obfuscation:** Gunakan `garble` saat build backend untuk menyembunyikan Public Key.
