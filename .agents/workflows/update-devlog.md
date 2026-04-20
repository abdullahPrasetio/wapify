---
description: Update devlog.md setelah menyelesaikan task atau membuat keputusan penting
---

Setelah menyelesaikan task apapun, update `docs/devlog.md` dengan format berikut:

1. Baca isi `docs/devlog.md` yang ada saat ini
2. Tambahkan entry baru di BAWAH entry terakhir dengan format:

```
## [TANGGAL-HARI-INI] — Judul Singkat yang Deskriptif
**Fase:** Fase X — Nama Fase (sesuai devplan.md)
**Dikerjakan oleh:** Agent
**Status:** ✅ Selesai | 🔄 Dalam Proses | ❌ Dibatalkan

### Yang Dikerjakan
- (list apa yang dilakukan)

### Perubahan File
- `path/file` — deskripsi singkat perubahan

### Keputusan & Catatan
- (keputusan teknis atau arsitektur yang dibuat, beserta alasannya)

### Langkah Selanjutnya
- (apa yang perlu dikerjakan setelah ini)
```

3. Jika ada milestone yang tercapai, update juga status di `docs/devplan.md`
4. Jika ada perubahan arsitektur atau tech stack, update juga `docs/prd.md`