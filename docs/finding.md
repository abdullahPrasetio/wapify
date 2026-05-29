# Local Diff Review — P3-2 OpenAPI Import, Collection Runner & Batch Commit P2–P3

**Tanggal review:** 2026-05-29
**Stack:** Go / Fiber (backend) + TypeScript / React / Electron (Zustand)
**Branch:** main
**Files reviewed:** `collection.go`, `request.go`, `mock_server.go`, `admin.go`, `auth.go`, `donation.go`, `models.go`, `main/index.ts`, `useDataStore.ts`, `useAuthStore.ts`, `types/index.ts`
**Files skipped:** Pure UI — `CollectionRunnerPanel.tsx`, `WebSocketPanel.tsx`, `SSEPanel.tsx`, `MainArea.tsx`, `ResponseArea.tsx`, `GlobalSearchModal.tsx`, modals (sudah di-review di P2-x sessions sebelumnya)

---

## Kesesuaian Devplan

Batch commit mencakup P2-1 s/d P3-1. Fitur baru signifikan di diff ini: OpenAPI/Swagger 2.0 & 3.x Import (dengan auth detection), `toJSONB` refactor untuk safe type assertion di `request.go`, file upload via `fs.createReadStream` di IPC main, Collection Runner options (selectedIds, iterations, delay, stopOnFailure), Response Snapshots.

---

## Open Findings

*(semua non-blocker)*

---

## Resolved / Acknowledged

| # | Severity | Finding | Status |
|---|---|---|---|
| #1 | 🔵 LOW | `ImportOpenAPI` `collection.go`: unguarded `.(float64)` type assertion — pola lama belum konsisten diperbaiki (5 tempat lain di file sama juga belum difix) | ✅ Fixed — semua 5 tempat di `collection.go` diubah ke comma-ok pattern; return 401 jika assertion gagal |
| #2 | 🔵 LOW | `toJSONB` refactor: `string` body kini disimpan sebagai `{"raw":"..."}` di JSONB — perlu awareness jika ada legacy client | ✅ By design — renderer selalu mengirim objek, bukan raw string |

---

---

# Local Diff Review — P3-1 Premium Member Badge & Toggle

**Tanggal review:** 2026-05-29
**Stack:** Go / Fiber (backend) + TypeScript / React / Electron (Zustand)
**Branch:** main
**Files reviewed:** `admin.go`, `auth.go`, `donation.go`, `models.go`, `Sidebar.tsx`, `UserManagement.tsx`, `TeamManagement.tsx`, `DonationSettings.tsx`, `ActivityLogView.tsx`, `Header.tsx`, `useAuthStore.ts`, `useNotificationStore.ts`, `types/index.ts`

---

## Kesesuaian Devplan

Fitur baru: Premium Member badge (Crown icon di Sidebar, Header, ActivityLog, TeamManagement), toggle premium di UserManagement, PremiumBadge modal dengan pesan dari admin, field `is_premium` + `premium_since` di User model, endpoint `/auth/me`, `/admin/users/:id/premium`, `/donations/premium-message`.

---

## Open Findings

*(semua resolved)*

---

## Resolved

| # | Severity | Finding | Fix |
|---|---|---|---|
| #1 | 🟠 HIGH | `DB.First` tanpa error check di `SetUserPremium` — returns 200 + empty User jika update berhasil tapi fetch gagal | ✅ Error check ditambahkan; return 404 jika user tidak ditemukan setelah update |
| #2 | 🟡 MEDIUM | Unguarded type assertion `c.Locals("user_id").(float64)` di `GetCurrentUser` — panic jika middleware tidak set value | ✅ Ganti ke comma-ok pattern `raw, ok := c.Locals("user_id").(float64)`; return 401 jika `!ok` |
| #3 | 🟡 MEDIUM | `id` path param tidak divalidasi sebagai integer di `SetUserPremium` — string acak lolos ke query | ✅ Ganti `c.Params("id")` dengan `parseUint(c.Params("id"))`; return 400 jika `id == 0` |
| #4 | 🔵 LOW | Dynamic `import()` untuk `apiClient` di dalam event handler `PremiumBadge` — tidak perlu, tidak ada circular dependency | ✅ Ganti ke static `import { apiClient }` di top-level `Sidebar.tsx`; dynamic import dihapus |

---

---

# Local Diff Review — P2-6 SSE Support, Insomnia Import & Timing Tab

**Tanggal review:** 2026-05-27  
**Stack:** TypeScript / React / Electron (Zustand)  
**Branch:** main  
**Files reviewed:** `MainArea.tsx`, `ResponseArea.tsx`, `store/useDataStore.ts`

---

## Kesesuaian Devplan

Fitur baru: SSE (Server-Sent Events) support, Insomnia v4 Import, Timing tab (SVG response time chart + stats dari history).

---

## Open Findings

| # | Severity | Finding | Status |
|---|---|---|---|
*(semua resolved)*

---

## Resolved

| # | Severity | Finding | Fix |
|---|---|---|---|
| #1 | 🟡 MEDIUM | Switch ke SSE mode tidak convert URL `wss://` → `https://` — SSEPanel gagal konek | ✅ Tambah branch `proto === 'sse'` di onClick toggle: replace `wss://` → `https://` dan `ws://` → `http://` sebelum set `request_type` |
| #2 | 🔵 LOW | `buildItems()` rekursif tanpa depth limit — stack overflow pada export corrupt/circular | ✅ Tambah param `depth = 0` + `MAX_DEPTH = 20`; early return `[]` jika `depth >= MAX_DEPTH` |
| #3 | 🔵 LOW | `importInsomnia` tidak validasi shape tiap item di `resources` — silent TypeError | ✅ Guard `typeof r._id === 'string' && typeof r.name === 'string'` sebelum masuk `folderMap`; guard `typeof r.parentId === 'string'` di `buildItems` filter |

---

---

# Local Diff Review — P2-5 Chaos Mode, Error Injection & Mock Request Logs

**Tanggal review:** 2026-05-27  
**Stack:** Go / Fiber (backend) + TypeScript / React / Electron (frontend)  
**Branch:** main  
**Files reviewed:** `mock_server.go`, `models.go`, `MockServerPanel.tsx`, `GlobalSearchModal.tsx`, `types/index.ts`

---

## Kesesuaian Devplan

Fitur baru: Chaos Mode (collection-level), Error Injection per endpoint, Random Delay Range, Mock Request Logs, GlobalSearchModal refactor (grouped results, fuzzy match, folder/env-var/history search).

---

## Open Findings

*(semua resolved atau tidak relevan)*

---

## Resolved

| # | Severity | Finding | Resolusi |
|---|---|---|---|
| #1 | ~~🟠 HIGH~~ | `rand.Intn` global source — thread-safety + predictable | **Tidak relevan** — Go 1.24: global rand sudah thread-safe & random-seeded by default sejak Go 1.20 |
| #2 | 🟠 HIGH | Goroutine log insert tanpa `recover()` — DB panic bisa crash server | ✅ Tambah `defer recover()` + `log.Error()` di goroutine async log |
| #3 | 🔵 LOW | `collectionID` path param tidak divalidasi sebagai integer | ✅ `parseUint()` di `updateCollectionChaosMode` + `listMockRequestLogs`, return 400 jika 0 |
| #4 | 🟡 MEDIUM | Chaos mode DB query per-request — N+1 bottleneck | ✅ Cache `getChaosMode()` dengan `sync.Map` + TTL 5 detik; `invalidateChaosCache()` dipanggil saat toggle |
| #5 | ~~🔵 LOW~~ | `globalIndex++` di JSX — side effect di Strict Mode | **Tidak relevan** — variabel di-reset ke 0 setiap render call, output deterministik, bukan side effect |
| #6 | 🔵 LOW | `errorStatusCode` tidak di-clamp — nilai `999` bisa dikirim | ✅ Clamp ke range 400–599, fallback `500` jika di luar range |

---

---

# Local Diff Review — P2-4 File Upload, Response Snapshots & Keyboard Shortcuts

**Tanggal review:** 2026-05-27  
**Stack:** TypeScript / React / Electron (IPC, Node.js fs, Zustand)  
**Branch:** main  
**Files reviewed:** `main/index.ts`, `preload/index.ts`, `KeyValueEditor.tsx`, `ResponseArea.tsx`, `MainArea.tsx`, `useDataStore.ts`

---

## Kesesuaian Devplan

Fitur baru: File upload di form-data (via IPC + `fs.createReadStream`), Response Snapshots (in-memory), Response Diff Modal, Keyboard Shortcuts Modal (Shift+?).

---

## Open Findings

*(semua resolved)*

---

## Resolved
t
| # | Severity | Finding | Fix |
|---|---|---|---|
| #1 | 🟡 MEDIUM | `handleFilePick` tanpa try-catch + `fs.statSync` uncaught di IPC handler — silent failure | ✅ try-catch di `handleFilePick` (renderer) + try-catch di IPC handler `fs.statSync` (main), fallback `size: 0` |
| #2 | 🟡 MEDIUM | `responseSnapshots` unbounded — tidak ada max cap per request | ✅ Guard `MAX_SNAPSHOTS = 10` di `saveResponseSnapshot` — early return + toast error jika sudah penuh |
| #3 | 🔵 LOW | `(window as any).api` — type unsafe, bypass preload type contract | ✅ Tambah `openFileDialog` & `reloadApp` ke `WapboltAPI` interface di `env.d.ts`; hapus `(window as any)` cast |
| #4 | 🔵 LOW | Tombol keyboard hint dispatch synthetic `KeyboardEvent` — rapuh, bisa konflik handler | ✅ Ganti `new KeyboardEvent` dengan `new CustomEvent('wapbolt:open-shortcuts')`; listener di MainArea `useEffect` |

---

---

# Local Diff Review — P2-3 Variable Extraction & Schema Assertions

**Tanggal review:** 2026-05-27  
**Stack:** TypeScript / React / Electron (Zustand + AJV)  
**Branch:** main  
**Files reviewed:** `MainArea.tsx`, `ResponseArea.tsx`, `store/useDataStore.ts`, `types/index.ts`

---

## Kesesuaian Devplan

Fitur baru: Variable Extraction Rules + JSON Schema Assertions. Terimplementasi di Tests tab (sub-tab Extract & Schema), Collection Runner, dan ResponseArea quick-extract panel.

---

## Open Findings

*(semua resolved)*

---

## Resolved

| # | Severity | Finding | Fix |
|---|---|---|---|
| #1 | 🟠 HIGH | `new Ajv()` diinstansiasi setiap request — GC pressure di Collection Runner | ✅ Singleton `ajv` di module level `useDataStore.ts` |
| #2 | 🟠 HIGH | `_.get(response.data, rule.jsonPath)` — path tidak disanitasi, rentan prototype pollution | ✅ Guard `isSafeJsonPath()` — blokir `__proto__`, `constructor`, `prototype` sebelum `_.get` |
| #3 | 🟡 MEDIUM | `handleAddExtractionRule` di ResponseArea tidak cek `isLocked` — bisa bypass lock | ✅ Cek `locksByRequest[activeTabId]` di `handleAddExtractionRule` sebelum mutasi |
| #4 | 🟡 MEDIUM | Schema assertion results tidak dipersist di Collection Runner jika tidak ada post-script | ✅ Sudah handled — `runnerSchemaResults` selalu dimerge ke `result.testResults` terlepas dari post-script |
| #5 | 🔵 LOW | `Math.random().toString(36)` sebagai ID — tidak dijamin unik | ✅ Ganti `crypto.randomUUID()` di `MainArea.tsx` (2 tempat) dan `ResponseArea.tsx` |
| #6 | 🔵 LOW | `(req as any).extraction_rules` dipakai 5+ tempat — field belum masuk `ApiRequest` interface | ✅ Field sudah ada di `ApiRequest` interface; `(req as any)` di `normalizeRequest` dihapus |

---

---

# Local Diff Review — P2-2 GraphQL Support

**Tanggal review:** 2026-05-26  
**Stack:** TypeScript / React / Electron (Zustand)  
**Branch:** main  
**Files reviewed:** `MainArea.tsx`, `store/useDataStore.ts`, `docs/devplan_v2.md`

---

## Kesesuaian Devplan

Semua checklist [x] di devplan P2-2 sudah terimplementasi. Autocomplete query (`Monaco completion provider`) tetap di backlog sesuai devplan.

---

## Open Findings

| # | Severity | Finding | Status |
|---|---|---|---|
*(semua resolved)*

---

## Resolved

| # | Severity | Finding | Fix |
|---|---|---|---|
| #1 | 🟠 HIGH | `fetch()` langsung dari renderer di `loadSchema()` — bypass `apiClient` | ✅ Ganti dengan `apiClient.executeRequest` — lewat IPC, bebas CORS |
| #2 | 🟡 MEDIUM | Stale closure `updateGql` — capture `gqlBody` dari render lama | ✅ `parseGqlBody(workingRequest.body)` dipanggil ulang saat update |
| #3 | 🟡 MEDIUM | Introspection query minimal — tidak ada `args`, `description`, `enumValues` | ✅ Query diperluas: `args`, `description`, `enumValues`, `inputFields`, `interfaces` |
| #4 | 🔵 LOW | `let finalMethod/finalBodyType/finalBody` bisa jadi `const` | ✅ Refactor ke `const` + IIFE |
| #5 | 🔵 LOW | `gqlSchema` tidak di-reset saat URL berubah | ✅ `useEffect` watch `workingRequest.url` → `setGqlSchema(null)` |

---

---

# Local Diff Review — P2-1 WebSocket Testing

**Tanggal review:** 2026-05-26  
**Stack:** TypeScript / React / Electron (Zustand)  
**Branch:** main  
**Files reviewed:** `WebSocketPanel.tsx`, `MainArea.tsx`, `store/useDataStore.ts`

---

## Kesesuaian Devplan

Semua checklist [x] di devplan P2-1 sudah terimplementasi.

---

## Open Findings

Tidak ada open findings.

---

## Resolved

| # | Finding | Resolved |
|---|---|---|
| #1 | Stale environment resolve di `resolveUrl()` | ✅ `environments` & `activeEnvironmentId` dari hook + deps array benar |
| #2 | Zombie WebSocket connection saat tab switch | ✅ cleanup effect deps `[]` |
| #3 | Tidak ada reverse-convert URL saat switch kembali ke HTTP | ✅ `wss://` → `https://` ditambahkan di `MainArea.tsx` |
| #4 | System message dideteksi dari `payload.startsWith('⚙')`, fragile | ✅ field `isSystem?: boolean` ditambahkan ke `WsMessage`; render pakai flag, bukan string prefix |
| #5 | `RequestForm` masih visible saat WS mode | ✅ dikondisikan `=== 'http'` di `MainArea.tsx` |
| #6 | Global `Cmd+Enter` trigger HTTP request di WS mode | ✅ `handleKeyDown` skip jika `request_type === 'ws'` |
