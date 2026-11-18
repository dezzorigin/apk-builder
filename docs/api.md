# API — APK Builder v1.1.0

Semua rute dilayani Pages Worker (`worker/_worker.js`), bukan Next.js.
Base lokal: `http://127.0.0.1:8330/` (`npm run build && npm run serve`).
Base live: `https://apk-builder.pages.dev`.

Semua perilaku di bawah diverifikasi: unit test (`npm test`, GitHub API
di-mock) + serve lokal + play-test browser (18 Nov 2026).

## POST /api/build — mulai satu build (SSE)

Request (JSON):

```json
{
  "appName": "Toko Kopi Saya",
  "packageName": "com.toko.kopi",
  "url": "https://toko-kopi.example.com",
  "githubUsername": "octocat",
  "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "repoName": "toko-kopi-apk",
  "iconBase64": "data:image/png;base64,iVBOR..."
}
```

Validasi (gagal → **HTTP 400** + satu event SSE error):

| Field | Aturan |
|---|---|
| `appName` | tak kosong, maks. 100 karakter |
| `packageName` | `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$` (huruf kecil, min. 2 segmen) |
| `url` | diawali `http://` atau `https://` |
| `githubUsername` | format username GitHub |
| `githubToken` | tak kosong |
| `repoName` | `^[a-zA-Z0-9._-]+$`, maks. 100 karakter |
| `iconBase64` | opsional; bila ada harus `data:image/png` atau `jpeg`, base64 maks. ~1 MB |

Respons sukses — stream `text/event-stream`, satu JSON per baris `data:`:

```
data: {"message":"> Initializing Build Environment..."}
data: {"message":"> App: Toko Kopi Saya (com.toko.kopi)"}
data: {"message":"✓ Repository octocat/toko-kopi-apk created."}
data: {"message":"✓ Pushed config.xml"}
...
data: {"message":"✓ Workflow dispatched."}
data: {"done":true,"actionsUrl":"https://github.com/octocat/toko-kopi-apk/actions","runId":42,"runUrl":"https://github.com/octocat/toko-kopi-apk/actions/runs/42","repo":"octocat/toko-kopi-apk"}
```

Error di tengah stream (mis. token ditolak setelah beberapa pesan
terkirim) → HTTP tetap 200, event terakhir:

```
data: {"error":"Token GitHub ditolak (401): Bad credentials. Periksa token di Settings."}
```

Pemetaan error GitHub: 401 → token ditolak; 403 → scope/rate limit;
404 → tidak ditemukan; 422 → data ditolak; sisanya → `GitHub API error
{status}`. Pesan selalu Indonesia dan tidak pernah memuat token.

Method selain POST → 405 JSON.

## GET /api/artifact — cari artifact APK run terakhir

```
GET /api/artifact?user=octocat&repo=toko-kopi-apk&token=ghp_...
```

Respons (selalu JSON 200 bila parameter lengkap):

```json
// Run masih berjalan:
{"success":true,"found":false,"status":"in_progress","runId":42,"runUrl":"https://github.com/.../actions/runs/42"}

// Run sukses, artifact ketemu:
{"success":true,"found":true,"status":"completed","conclusion":"success","runId":42,
 "runUrl":"https://github.com/.../actions/runs/42",
 "artifact":{"id":55,"name":"apk","sizeInBytes":1234567,"expired":false},
 "downloadUrl":"/api/download?user=octocat&repo=toko-kopi-apk&artifact=55&token=ghp_..."}

// Run selesai tapi gagal:
{"success":true,"found":false,"status":"completed","conclusion":"failure","runId":42,"runUrl":"..."}
```

Parameter kurang → 400 `{"success":false,"error":"Parameter {k} wajib diisi."}`.
Error GitHub (mis. 401) → status HTTP yang sama + `error` berbahasa
Indonesia.

## GET /api/download — unduh artifact (zip)

```
GET /api/download?user=octocat&repo=toko-kopi-apk&artifact=55&token=ghp_...
```

- Parameter kurang → 400 teks.
- Sukses → `200 application/zip`, header
  `Content-Disposition: attachment; filename="toko-kopi-apk-apk.zip"`,
  body di-stream dari blob storage GitHub (worker mengikuti redirect
  302 dari `api.github.com`).
- Artifact tidak ada / token salah → status error GitHub diteruskan
  (`Failed to download artifact`).

## Rute statis

Selain `/api/*`, worker meneruskan request ke binding `ASSETS`
(static export): `/`, `/_next/*`, `/cordova-template/*`,
`/favicon.svg`, `/manifest.webmanifest`, `/404.html`. Halaman tak
dikenal → 404.
