# 🔍 Local Git Diff Review

| | |
|---|---|
| **Reviewed by** | `Claude — local-git-diff-review skill` |
| **Date** | 2026-06-15 15:00 WIB |
| **Stack detected** | TypeScript / Electron + Go / Fiber + PostgreSQL |
| **Files analyzed** | 7 of 7 |
| **Files skipped** | None — full diff analyzed |
| **Total lines changed** | +75 / -35 |

---

## 📋 Findings

---

### [#1] 🟠 HIGH — `openDraftRequest` masih override header meski `body_type` sudah di-normalize

- **Location:** `apps/desktop/src/renderer/src/store/useDataStore.ts:737`
- **Function:** `openDraftRequest`
- **Scope:** Reliability / Refactor
- **Finding:** Setelah normalisasi, `normalizedDraft.body_type` sudah benar. Namun blok `headers` masih re-check `!normalizedDraft.body_type || normalizedDraft.body_type === 'raw-json'` secara manual. Kondisi ini seharusnya sudah tidak perlu karena `inferBodyType` sudah mengembalikan `'raw-json'` sebagai default — tapi jika `normalizedDraft.body_type` hasil normalisasi adalah `'raw-json'`, kondisi ini akan meng-override header menjadi `{ 'Content-Type': 'application/json' }` meskipun body aslinya mungkin adalah form-urlencoded yang sudah di-infer sebelumnya. Ini silent bug: jika `inferBodyType` mengembalikan `'x-www-form-urlencoded'` tapi `req.body` tidak bertipe array (misal body sudah `{ raw: "..." }`), header yang diset tetap `application/json`.
- **Production risk:** Draft request yang di-buka dari example form-urlencoded bisa mengirimkan request dengan header `Content-Type: application/json` yang salah, menyebabkan server menolak request.
- **Recommendation:** Gunakan `normalizedDraft.body_type` langsung untuk menentukan default header:

```typescript
// ❌ Current (masih manual re-check)
headers: (normalizedDraft.headers as Record<string, string>) || (
  (!normalizedDraft.body_type || normalizedDraft.body_type === 'raw-json')
    ? { 'Content-Type': 'application/json' }
    : {}
),

// ✅ Recommended
const defaultHeaders: Record<string, string> =
  normalizedDraft.body_type === 'raw-json' ? { 'Content-Type': 'application/json' } : {}
headers: (normalizedDraft.headers as Record<string, string>) || defaultHeaders,
```

---

### [#2] 🟠 HIGH — `inferBodyType` salah memetakan array body ke `x-www-form-urlencoded` sebagai default

- **Location:** `apps/desktop/src/renderer/src/store/useDataStore.ts:34–41`
- **Function:** `inferBodyType`
- **Scope:** Reliability
- **Finding:** Ketika `body` berupa array dan tidak ada `Content-Type` header (atau `ct` kosong), fungsi ini mengembalikan `'x-www-form-urlencoded'` — bukan `'form-data'`. Logika: `ct.includes('multipart/form-data') ? 'form-data' : 'x-www-form-urlencoded'`. Jika tidak ada header sama sekali (misal Postman import tanpa header), array body akan salah diklasifikasikan sebagai urlencoded.
- **Production risk:** Form-data body (file upload, multipart) di-treat sebagai urlencoded, sehingga request gagal dikirim atau data tidak terkirim dengan benar.
- **Recommendation:** Jika `body` adalah array dan tidak ada clue dari Content-Type, default ke `'form-data'` bukan `'x-www-form-urlencoded'`:

```typescript
// ❌ Current
return ct.includes('multipart/form-data') ? 'form-data' : 'x-www-form-urlencoded'

// ✅ Recommended — array tanpa header clue lebih likely form-data
if (ct.includes('multipart/form-data')) return 'form-data'
if (ct.includes('application/x-www-form-urlencoded')) return 'x-www-form-urlencoded'
return 'form-data' // default untuk array
```

---

### [#3] 🟡 MEDIUM — `normalizeRequest` dipanggil dengan object literal yang bisa null-body

- **Location:** `apps/desktop/src/renderer/src/store/useDataStore.ts:768–773`
- **Function:** `openExampleTab` (inline normalization)
- **Scope:** Reliability
- **Finding:** Object yang dikirim ke `normalizeRequest` menggunakan `body_type: ''` (string kosong). Di dalam `normalizeRequest`, kondisi `(!req.body_type || req.body_type === 'raw-json')` akan true untuk string kosong, sehingga `inferBodyType` dipanggil. Jika `example.request_body` adalah `null` atau `undefined` (contoh: example lama yang belum punya request body), `body` akan `undefined` dan `inferBodyType` akan memanggil `Object.entries(headers || {})` dua kali dengan body `undefined` — ini aman, tapi menghasilkan body yang diproses sebagai `'raw-json'` dengan body `undefined`, lalu blok `raw-` akan mencoba memanipulasi body yang undefined.
- **Production risk:** Example tab yang di-buka tanpa request body bisa menyebabkan TypeError atau menampilkan `"undefined"` di editor body.
- **Recommendation:** Guard `example.request_body` sebelum normalisasi:

```typescript
// ✅ Add null guard
const normalizedExample = normalizeRequest({
  body: example.request_body ?? '',
  body_type: '',
  headers: (example.request_headers as Record<string, string>) || {},
} as ApiRequest)
```

---

### [#4] 🟡 MEDIUM — `request_body` di `saveExample` selalu wrap string ke `{ raw: string }` tapi body object asli juga di-wrap

- **Location:** `apps/desktop/src/renderer/src/store/useDataStore.ts:2307–2312`
- **Function:** `saveExample` / snapshot block
- **Scope:** Reliability
- **Finding:** Logic baru:
  ```ts
  Array.isArray(body) ? body
    : (typeof body === 'string' ? { raw: body } : body)
  ```
  Jika body sudah berupa object (misal `{ raw: "..." }` dari normalisasi sebelumnya), ia dikirim as-is. Tapi jika user mengedit body dan hasilnya adalah string, ia di-wrap ke `{ raw: string }`. Ini bisa menyebabkan double-wrap jika di suatu path body sudah `{ raw: "..." }` dan kemudian dikirim lagi.
- **Production risk:** Data `request_body` yang disimpan ke DB bisa inconsistent — sebagian `{ raw: "..." }`, sebagian object langsung, sehingga `openExampleTab` yang membaca kembali perlu handle semua format.
- **Recommendation:** Pastikan ada satu normalisasi tunggal sebelum save, dan `normalizeRequest` di openExampleTab sudah handle semua format tersebut. Tambahkan unit test yang cover round-trip: save → buka kembali → body tampil benar.

---

### [#5] 🔵 LOW — Migration `down` tidak idempotent untuk rows dengan body type selain `raw`

- **Location:** `backend/migrations/000031_add_body_type_to_examples.down.sql`
- **Scope:** Reliability
- **Finding:** `COALESCE(request_body->>'raw', request_body::text)` — jika `request_body` adalah array JSON (dari `form-data`), rollback akan menghasilkan teks seperti `[{"key":"file",...}]` sebagai text column. Ini bukan catastrophic tapi bisa menyebabkan data corrupt jika rollback dijalankan setelah ada data form-data tersimpan.
- **Production risk:** Rollback migrasi setelah ada data form-data akan mengubah body menjadi representasi JSON string yang tidak parseable sebagai form-data fields.
- **Recommendation:** Dokumentasikan di migration bahwa rollback hanya aman jika belum ada data non-raw body, atau tambahkan warning comment.

---

### [#6] 🔵 LOW — `(any)` cast di beberapa tempat bisa disederhanakan

- **Location:** `apps/desktop/src/renderer/src/store/useDataStore.ts:748, 784`
- **Scope:** Refactor Quality
- **Finding:** `(normalizedDraft as any).extraction_rules` dan `body: (normalizedDraft.body as any)` menggunakan `as any` yang menyembunyikan type mismatch. `ApiRequest` seharusnya sudah memiliki field ini.
- **Production risk:** Tidak ada runtime risk, tapi type safety hilang untuk field ini.
- **Recommendation:** Extend tipe `ApiRequest` untuk include `extraction_rules` dan `schema_assertions`, atau gunakan optional chaining dengan proper types.

---

## ⚖️ Verdict (Updated after manual review)

| # | Status | Action |
|---|---|---|
| #1 Header override | ❌ FALSE POSITIVE | Kondisi `body_type === 'raw-json'` sudah evaluate false untuk urlencoded — tidak ada bug |
| #2 Array default type | ❌ FALSE POSITIVE | `x-www-form-urlencoded` adalah default yang benar; form-data selalu punya Content-Type header |
| #3 Null body guard | ✅ VALID — FIXED | Tambah `?? ''` pada `example.request_body` |
| #4 Double-wrap risk | ❌ FALSE POSITIVE | Logic sudah handle array/string/object dengan benar, double-wrap tidak bisa terjadi |
| #5 Migration rollback | ✅ VALID — FIXED | Tambah warning comment di down.sql |
| #6 `as any` cast | ✅ VALID — FIXED | Hapus `as any`, field `extraction_rules`/`schema_assertions` sudah ada di type `ApiRequest` |

**Overall risk:** 🟢 Aman untuk commit
