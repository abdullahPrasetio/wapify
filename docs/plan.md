# Plan: Per-Body-Type Storage

**Status:** Draft  
**Target:** Desktop App (Electron + React)  
**Inspired by:** Postman — setiap body type (raw, urlencoded, form-data, dll) menyimpan datanya masing-masing, tidak saling menimpa saat user switch tab body

---

## Latar Belakang

Saat ini request hanya punya satu field `body: unknown` yang di-replace setiap kali user ganti body type. Akibatnya, data yang sudah diisi di tipe sebelumnya hilang begitu user pindah ke tipe lain.

**Contoh masalah:**
1. User isi form-data dengan 5 field
2. User switch ke raw-json, isi JSON body
3. User switch kembali ke form-data → data 5 field tadi hilang

---

## Desain Solusi

### Prinsip Utama

- Field `bodies` (plural) hanya hidup **in-memory di client** (Zustand store per tab)
- Field `body` + `body_type` tetap dipakai untuk **save ke server** dan **kirim HTTP request** — hanya ambil dari `bodies[body_type]` yang aktif
- Tidak ada perubahan schema backend
- Saat tab ditutup, `bodies` ikut hilang — expected behavior sama seperti Postman

### Struktur Data Baru

```ts
interface BodyRow {
  key: string
  value: string
  enabled: boolean
  type: 'text' | 'file'
}

interface RequestBodies {
  'none': null
  'raw-json': string
  'raw-xml': string
  'raw-text': string
  'graphql': string
  'binary': string
  'x-www-form-urlencoded': BodyRow[]
  'form-data': BodyRow[]
}

// Ditambahkan ke WorkingRequest (field opsional, tidak dikirim ke server):
bodies?: Partial<RequestBodies>
```

---

## Step-by-Step Implementasi

### Step 1 — `types/index.ts`

- Tambah interface `RequestBodies`
- Tambah field opsional `bodies?: Partial<RequestBodies>` ke `WorkingRequest`

```ts
export interface RequestBodies {
  'none': null
  'raw-json': string
  'raw-xml': string
  'raw-text': string
  'graphql': string
  'binary': string
  'x-www-form-urlencoded': BodyRow[]
  'form-data': BodyRow[]
}

// Di WorkingRequest:
bodies?: Partial<RequestBodies>
```

---

### Step 2 — `useDataStore.ts`: Inisialisasi `bodies` saat buka tab

Saat request di-load dari server (open tab / load collection), isi `bodies` dari saved data:

```ts
bodies: {
  [bodyType]: normalizedBody  // isi hanya tipe yang aktif dari server
}
// Tipe lain dibiarkan undefined — belum pernah diisi user
```

---

### Step 3 — `useDataStore.ts`: Sync `bodies` di `updateWorkingRequest`

Ada dua kondisi update yang perlu ditangani:

**A. User ganti body type (switch tab body):**
```ts
// Simpan body aktif ke bodies[tipe_lama]
// Ambil bodies[tipe_baru] atau default kosong sesuai tipe
const prevBodies = tab.workingRequest.bodies || {}
const prevBodyType = tab.workingRequest.body_type
const currentBody = tab.workingRequest.body

const newBody = prevBodies[newBodyType] ?? getDefaultBody(newBodyType)
// getDefaultBody: kembalikan '' untuk raw/graphql/binary, [] untuk form-data/urlencoded, null untuk none

return {
  workingRequest: {
    ...tab.workingRequest,
    body_type: newBodyType,
    body: newBody,
    bodies: {
      ...prevBodies,
      [prevBodyType]: currentBody,  // simpan yang lama
    }
  }
}
```

**B. User edit isi body (ketik di editor):**
```ts
// Sync bodies[body_type] dengan nilai terbaru
const currentBodyType = tab.workingRequest.body_type
return {
  workingRequest: {
    ...tab.workingRequest,
    body: update.body,
    bodies: {
      ...tab.workingRequest.bodies,
      [currentBodyType]: update.body,
    }
  }
}
```

---

### Step 4 — `MainArea.tsx`: Sederhanakan `handleBodyTypeChange`

Setelah store menangani konversi, fungsi ini cukup:

```ts
const handleBodyTypeChange = (type: string): void => {
  onUpdate({ body_type: type })
}
```

Tidak perlu lagi konversi manual array↔string di sini.

---

### Step 5 — `useDataStore.ts`: Saat save ke server

Field yang dikirim ke API tetap `body` + `body_type` (dari tipe aktif saja):

```ts
// Saat save, ambil body dari bodies[body_type] yang aktif
const bodyToSave = workingRequest.bodies?.[workingRequest.body_type] ?? workingRequest.body

// Kirim ke server:
{ body: bodyToSave, body_type: workingRequest.body_type }
// Field `bodies` TIDAK dikirim ke server
```

---

## Scope Perubahan

| File | Jenis Perubahan |
|------|----------------|
| `types/index.ts` | Tambah `RequestBodies`, update `WorkingRequest` |
| `useDataStore.ts` | Init `bodies` saat load tab, sync di `updateWorkingRequest`, strip `bodies` saat save |
| `MainArea.tsx` | Sederhanakan `handleBodyTypeChange`, hapus konversi manual |
| `curlParser.ts` | Tidak perlu diubah |
| `ExportCodeModal.tsx` | Tidak perlu diubah |
| `api/client.ts` | Tidak perlu diubah |
| Backend | Tidak perlu diubah |

---

## Edge Cases

| Kasus | Handling |
|-------|----------|
| Tab baru / request baru | `bodies` kosong, semua tipe mulai dari default |
| Request lama dari server | `bodies` hanya terisi tipe aktif dari saved data, tipe lain kosong |
| Ganti tab request lalu balik | `bodies` in-memory per tab, tidak hilang selama tab terbuka |
| Close tab | `bodies` ikut hilang bersama working state — expected |
| Import curl (curlParser) | Hasil parse tetap `body` + `body_type`, store yang init `bodies` |

---

## Out of Scope

- Persist `bodies` ke server per tipe — butuh schema change di backend
- Sync `bodies` antar kolaborator real-time via WebSocket
