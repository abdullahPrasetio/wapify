# Cancel Request — Wapbolt Desktop v2.5.19 & Wapbolt Local v1.0.0-beta.6

Fitur baru: tombol **Cancel** untuk menghentikan request yang sedang berjalan (baik ke API target user maupun, secara arsitektur, request lain lewat jalur yang sama), tersedia identik di kedua aplikasi.

## Kenapa dibutuhkan

Sebelumnya, sekali tombol "Send" ditekan, request harus menunggu sampai selesai (atau timeout 30 detik) — tidak ada cara menghentikannya dari UI, misalnya saat salah pilih environment/URL atau target API lambat merespons.

## Bagaimana cara kerjanya

`window.api.wapboltRequest` dipanggil lewat `ipcRenderer.invoke` (request-response), yang secara desain tidak bisa dibatalkan sepihak dari sisi renderer begitu sudah terkirim ke main process. Solusinya: setiap request dikirim bersama `requestId` unik, dan main process menyimpan `AbortController` per id di sebuah `Map`. Tombol Cancel di renderer memicu channel terpisah (`wapbolt:request-cancel`, `ipcRenderer.send`, bukan `invoke`) yang mencari `AbortController` sesuai id dan memanggil `.abort()` — axios lalu langsung menghentikan koneksi lewat `signal`.

Respons yang dibatalkan dikembalikan sebagai `{ status: 0, cancelled: true }`, bukan error biasa — di store, hasil ini di-skip dari History dan tidak memicu toast error, tab langsung kembali ke state siap kirim.

## Perubahan per file

**Main process**
- `apps/desktop/src/main/index.ts` — `Map<string, AbortController>`, handler `wapbolt:request-cancel`, `signal` diteruskan ke axios di handler `wapbolt:request`.
- `apps/desktop-local/src/main/ipc.ts` — perubahan identik pada `httpExecute` (jalur "Send" ke target API arbitrary; tidak menyentuh `LocalRouter` yang menangani `/api/v1/...` internal).

**Preload**
- `apps/desktop/src/preload/index.ts`, `apps/desktop-local/src/preload/index.ts` — expose `cancelRequest(requestId)`.

**Renderer (`packages/ui-shared`, dipakai kedua app)**
- `types/index.ts`, `env.d.ts` — tambah `requestId` di request config, `cancelled` di response.
- `api/client.ts` — `apiClient.executeRequest(...)` kini menerima `requestId`; tambah `apiClient.cancelRequest(requestId)`.
- `store/useDataStore.ts` — `RequestTab.pendingRequestId`; `executeActiveRequest` generate id per send; action baru `cancelActiveRequest()`; hasil `cancelled` di-skip dari history/toast.
- `components/layout/Header.tsx`, `components/layout/MainArea.tsx` — tombol Send berubah jadi tombol Cancel (merah) selama `isSending`.

## Verifikasi

- Typecheck bersih di `apps/desktop` dan `apps/desktop-local`.
- 51 test vitest `apps/desktop-local` tetap lulus (tidak ada regresi pada LocalRouter/SyncEngine/backup).
- Manual test disarankan: GET ke endpoint yang sengaja delay (`https://httpbin.org/delay/10` atau server lokal `sleep`), klik Send lalu Cancel sebelum respons kembali.

## Versi & rilis

| App | Versi | Tag | Target release repo |
|---|---|---|---|
| Wapbolt Desktop (Cloud) | 2.5.19 | `v2.5.19` | `abdullahPrasetio/wapbolt-desktop-releases` (auto-update) |
| Wapbolt Local | 1.0.0-beta.6 | `local-v1.0.0-beta.6` | `abdullahPrasetio/wapbolt-lite-releases` |
