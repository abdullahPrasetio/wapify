# Wapbolt Release v1.5.1

**Tanggal:** 12 Mei 2026
**Status:** Stable Release

---

## 🚀 Apa yang Baru?

### 🛡️ Structured API Validation System (V2)
Kami telah memigrasikan sistem validasi API dari pendekatan berbasis komentar inline (`//`) ke sistem metadata terstruktur. Ini memberikan stabilitas penuh dan menghilangkan risiko bug pada URL atau nilai string yang mengandung karakter serupa komentar.

*   **Tab Validation Baru:** Antarmuka khusus di Request Builder untuk mengatur aturan validasi (Headers & Body).
*   **Auto-Sync Fields:** Baris validasi digenerate otomatis berdasarkan field yang ada di Headers dan JSON Body Anda.
*   **Penyimpanan JSONB:** Semua aturan validasi sekarang disimpan dalam kolom `field_validations` di database PostgreSQL.

---

## 📄 Peningkatan Dokumentasi

Dokumentasi API sekarang jauh lebih profesional dan informatif:
*   **Tampilan Terstruktur:** Validasi (Required, Email, Min/Max) ditampilkan sebagai badge yang bersih.
*   **Kolom Deskripsi Terpisah:** Kami menambahkan kolom **Description** khusus agar penjelasan field lebih mudah dibaca tanpa berdesakan dengan rule validasi.
*   **Ukuran Teks Optimal:** Penyesuaian ukuran font dan lebar kolom untuk kenyamanan membaca dokumentasi teknis yang panjang.

---

## 🛠️ Perbaikan & Optimasi

*   **Cleanup Legacy Logic:** Menghapus seluruh logika `stripInlineComments` di Main Process yang sebelumnya memperlambat eksekusi request.
*   **Fix TypeScript Integrity:** Pembersihan tipe data pada Store dan Main Area untuk memastikan build aplikasi lebih stabil.
*   **CORS-Free Execution:** Pengoptimalan eksekusi request via Electron Main Process tanpa gangguan parsing komentar.

---

## 📦 Cara Update
1. Jalankan migrasi database di backend: `make migrate-up`.
2. Lakukan build ulang aplikasi desktop atau jalankan di mode development.

---
*Dibuat dengan ❤️ oleh tim WapBolt.*
