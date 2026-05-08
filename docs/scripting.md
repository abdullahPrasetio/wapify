# Wapbolt Scripting Guide 🚀

Dokumen ini menjelaskan cara menggunakan fitur **Pre-request** dan **Post-request (Tests)** di Wapbolt menggunakan objek global `wap`.

---

## 1. Objek Global `wap`
Objek `wap` (atau alias `pm`) adalah SDK utama untuk berinteraksi dengan request, response, dan environment.

### Manajemen Variabel
| Fungsi | Deskripsi | Scope |
| :--- | :--- | :--- |
| `wap.set("key", "value")` | Inject variabel secara temporary. | Hanya Request saat ini |
| `wap.setEnv("key", "value")` | Simpan variabel ke Active Environment. | Permanen (Database) |
| `wap.getEnv("key")` | Ambil nilai dari Environment. | - |
| `wap.collectionVariables.set("key", "val")` | Alias untuk setEnv. | Permanen |

### Pengujian (Post-request Only)
| Fungsi | Deskripsi |
| :--- | :--- |
| `wap.test("Nama Test", fn)` | Membuat blok pengujian. |
| `wap.expect(val).to.eql(exp)` | Melakukan asersi (validasi) nilai. |
| `wap.response.to.have.status(code)` | Validasi HTTP Status Code. |

---

## 2. Library Terintegrasi
Wapbolt menyertakan library populer yang bisa langsung dipanggil tanpa `require`:

### Moment.js (`moment`)
Digunakan untuk manipulasi tanggal dan waktu.
```javascript
let besok = moment().add(1, 'days').format("YYYY-MM-DD");
wap.set("besok", besok);
```

### Lodash (`_`)
Digunakan untuk fungsi utility dan random.
```javascript
let randomStan = _.random(100000, 999999);
wap.set("stan", randomStan);
```

---

## 3. Contoh Skenario

### A. Pre-request: Inject Data Dinamis
Gunakan ini di tab **Pre-request** untuk mengisi data `{{ }}` secara otomatis sebelum request terkirim.

```javascript
// Generate data
let timestamp = moment().format("HHmmss");
let rrn = _.random(1000000000, 9999999999);

// Inject ke placeholder {{jam}} dan {{rrn}}
wap.set("jam", timestamp);
wap.set("rrn", rrn);
```

### B. Post-request: Chaining Token
Gunakan ini di tab **Tests** untuk mengambil token dari response login dan menyimpannya agar bisa dipakai request lain.

```javascript
// Ambil JSON dari response
let res = wap.response.json();

if (wap.response.status === 200 && res.data) {
    // Simpan permanen ke environment agar request lain bisa pakai {{token}}
    wap.setEnv("token", res.data.token);
    console.log("Token diperbarui!");
}

// Tambahkan pengujian status code
wap.test("Status harus sukses", () => {
    wap.response.to.have.status(200);
});
```

---

## 4. Tips Visual
*   **Titik Hijau**: Jika tab **Body** atau **Scripts** memiliki isi, akan muncul titik hijau di samping nama tab.
*   **Highlighting**: Variabel yang Anda set via `wap.set` atau `wap.setEnv` akan berwarna **Orange** di URL bar jika valid, dan **Merah** jika belum terdefinisi.
