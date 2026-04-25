---
description: Panduan langkah-demi-langkah untuk melakukan git commit di project Wapify
---

# Commit Workflow — Wapify

Gunakan workflow ini SETIAP KALI akan melakukan commit untuk memastikan standar kualitas dan dokumentasi terjaga.

## 1. Persiapan (Pre-Commit)
Sebelum melakukan commit, pastikan hal-hal berikut sudah terpenuhi:
- [ ] Kode bebas dari `console.log` (kecuali di Logger resmi) atau komentar debug.
- [ ] Perubahan sudah di-test secara manual di UI atau via unit test.
- [ ] Dokumentasi internal (`docs/devlog.md` dan `docs/devplan.md`) sudah diupdate.
- [ ] Pastikan tidak ada file rahasia (.env, keys) yang tidak sengaja masuk.

## 2. Staging Perubahan
Jalankan perintah berikut untuk melihat apa yang akan dikirim:
```bash
git status
git diff --stat
```
Lalu tambahkan file secara selektif atau sekaligus:
```bash
git add .
```

## 3. Menulis Pesan Commit
Pesan commit WAJIB mengikuti standar **Conventional Commits** dan ditulis dalam **Bahasa Inggris**.

### Format:
```text
<type>: <description>

- Bullet point detail 1
- Bullet point detail 2 (kenapa/bagaimana)
```

### Type yang diizinkan:
- `feat`: Fitur baru.
- `fix`: Perbaikan bug.
- `docs`: Perubahan dokumentasi (PRD, DevLog, MD).
- `refactor`: Perubahan kode yang tidak menambah fitur atau memperbaiki bug.
- `chore`: Update build task, package manager, dll.
- `style`: Perubahan format (whitespace, semi-colon, dll).

## 4. Eksekusi Commit
1. Buat pesan commit yang informatif.
2. Jalankan commit:
```bash
git commit -m "feat: judul fitur

- detail perubahan 1
- detail perubahan 2"
```

## 5. Verifikasi Akhir
Setelah commit, pastikan:
- [ ] `git status` menunjukkan "nothing to commit, working tree clean".
- [ ] Log commit terlihat rapi (`git log -n 1`).
