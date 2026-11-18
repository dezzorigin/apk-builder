# Development — APK Builder v1.1.0

## Prasyarat

- Node.js 20, npm 10.
- Tidak butuh env var apa pun (lihat `.env.example` — produk ini tidak
  punya secret server-side).

## Perintah

```bash
npm install        # install dependencies (menghasilkan package-lock.json)
npm run dev        # Next.js dev server (tanpa worker — /api/* akan 404!)
npm run build      # static export + copy worker/_worker.js ke out/_worker.js
npm run serve      # sajikan out/ + worker di http://127.0.0.1:8330/
npm test           # unit test worker (node --test, GitHub API di-mock)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
```

**Catatan penting:** `npm run dev` menjalankan Next.js biasa — route
`/api/*` tidak ada di sana (sengaja, karena `output: 'export'`).
Untuk menguji API, selalu `npm run build && npm run serve`.

## Struktur

```
app/                  halaman (landing + dashboard + wizard, satu file page.tsx)
lib/db.ts             IndexedDB: riwayat + settings
public/cordova-template/  template yang di-push worker ke repo target
worker/_worker.js     Pages Worker: /api/build, /api/artifact, /api/download
worker/_worker.test.mjs
scripts/serve-worker.mjs   server lokal (out/ + worker, ASSETS dari filesystem)
scripts/smoke.mjs          cek marker di out/
scripts/advisory-sweep.py  gate keamanan dependensi produksi
```

## Mengubah template Cordova

Template adalah file nyata di `public/cordova-template/`:

- `config.xml`, `package.json`, `www/index.html` memakai placeholder
  `__APP_NAME__`, `__PACKAGE_NAME__`, `__TARGET_URL__` (diganti worker).
- `build-apk.yml` adalah workflow yang di-push ke
  `.github/workflows/build-apk.yml` di repo target.

Setelah mengubah template, jalankan `npm run build && node
scripts/smoke.mjs` (memeriksa file ikut ter-deploy) dan job CI
`templates` (YAML/XML/JSON valid + placeholder lengkap).

## Mengubah worker

- Worker satu file, tanpa dependensi. Jangan import dari `app/` atau
  `node_modules` — file ini di-copy mentah ke `out/`.
- Template dibaca lewat `env.ASSETS.fetch(...)`, bukan import.
- Tambah/ubah perilaku → tambah/ubah test di
  `worker/_worker.test.mjs` (`npm test` harus tetap 18/18 atau lebih).
- Test memakai `globalThis.fetch` yang di-mock — jangan pernah
  memanggil `api.github.com` sungguhan dari test.

## Mengubah frontend

- `app/page.tsx` berisi tiga tampilan (landing, dashboard, builder)
  dalam satu komponen. Jaga agar teks Indonesia di UI konsisten dengan
  pesan error worker.
- Pesan error dari worker tampil apa adanya di terminal + panel —
  jangan menimpa dengan pesan generik.
- Validasi input ada di dua tempat (frontend + worker) dan harus
  dijaga tetap sama: regex package `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`,
  repo `^[a-zA-Z0-9._-]+$`.

## Play-test (wajib sebelum PR)

```bash
npm run build && npm run serve   # port 8330
# lalu, dari ~/workspace/absensirapat-audit/diag/ (puppeteer-core ada di sana):
node shot-apk.mjs    # 12 cek: landing, validasi, wizard, error 401, dashboard, dark mode
node record-apk.mjs  # rekam ulang docs/demo/demo.mp4 bila UI berubah
```

Play-test memakai token GitHub **contoh** (`ghp_faketoken...`) —
GitHub menjawab 401 sungguhan, dan itulah jalur error yang diuji.
Jangan pernah memakai token asli di skrip play-test.

## CI (`.github/workflows/ci.yml`)

| Job | Isi |
|---|---|
| `build` | `npm ci` → typecheck → lint → build → upload `out/` |
| `worker-test` | `npm test` |
| `advisory-sweep` | `scripts/advisory-sweep.py` (produksi, high+) |
| `templates` | validasi YAML/XML/JSON + placeholder template Cordova |
| `smoke` | `scripts/smoke.mjs` + serve lokal + curl kontrak API |
| `live-smoke` | hanya push ke `main`, non-gating: landing 200 + validasi API 400 di live |

## Deploy

Lihat `docs/deployment.md`.
