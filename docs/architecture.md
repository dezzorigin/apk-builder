# Arsitektur — APK Builder v1.1.0

## Gambaran

```
┌─────────────┐      ┌──────────────────────────────┐
│   Browser   │─────►│  Cloudflare Pages            │
│ (React 19)  │      │  apk-builder.pages.dev       │
│             │      │                              │
│ IndexedDB:  │      │  out/ (static export)        │
│  app_history│      │   index.html, _next/*,       │
│  settings   │      │   favicon.svg, 404.html      │
│             │      │   cordova-template/*         │
│             │      │                              │
│             │      │  out/_worker.js              │
│             │      │  (Pages Worker)              │
└─────────────┘      └──────┬───────────────────────┘
                            │ POST /api/build (SSE)
                            │ GET  /api/artifact
                            │ GET  /api/download
                            ▼
                     ┌──────────────────────┐
                     │ api.github.com       │
                     │  repos (GET/POST)    │
                     │  contents (GET/PUT)  │
                     │  dispatches (POST)   │
                     │  runs · artifacts    │
                     └──────┬───────────────┘
                            ▼
                     ┌──────────────────────┐
                     │ GitHub Actions       │
                     │  runner ubuntu-latest│
                     │  cordova build       │
                     │  android --debug     │
                     │  → artifact `apk`    │
                     └──────────────────────┘
```

Diagram visual: [`diagram.svg`](./diagram.svg).

## Kenapa static export + Worker?

Next.js dengan `output: 'export'` tidak boleh punya route handler
dinamis — `next build` menolaknya. Tapi produk ini butuh server kecil:
meneruskan token pengguna ke GitHub API dan men-stream log build.
Solusinya adalah pola yang sama seperti repo P1 #19 (web2native):

- **Frontend** jadi file statis murni (`out/`).
- **API** tinggal di Pages Worker (`worker/_worker.js`), di-copy ke
  `out/_worker.js` saat `npm run build` dan di-deploy sebagai
  `_worker.bundle` oleh `cf_pages.py`. Semua `/api/*` dirutekan ke
  worker; sisanya disajikan dari `ASSETS`.

Konsekuensinya: route Next.js lama (`app/api/download/route.ts`)
**dihapus** — logikanya pindah ke worker (`handleDownload`). Jangan
mengembalikan route handler ke `app/` selama `output: 'export'` aktif.

## Komponen

### Frontend — `app/page.tsx` (satu halaman, tiga tampilan)

| Tampilan | State | Isi |
|---|---|---|
| Landing | `showLanding` | Navbar, hero + preview, fitur, cara kerja, keamanan, CTA, footer |
| Dashboard | default setelah landing | Grid riwayat dari IndexedDB (cari, ubah, hapus, unduh) |
| Builder | `showBuilder` | Wizard 3 langkah + terminal SSE + panel hasil |

Semua tampilan hidup dalam satu komponen klien (`'use client'`). Tema
terang/gelap disimpan di state (bukan localStorage — sengaja, supaya
tidak ada preferensi yang menetap tanpa izin).

### Penyimpanan lokal — `lib/db.ts`

IndexedDB `apk_builder_db` (versi 2):

- `app_history` (keyPath `id`): `AppHistory` — nama, package, repo,
  downloadUrl, status (`building` | `ready` | `failed`), actionsUrl,
  runUrl, iconBase64, createdAt.
- `settings` (keyPath `key`): `githubUsername`, `githubToken`.

Semua fungsi membungkus IndexedDB dengan Promise dan mengembalikan
`[]`/`null` bila IndexedDB tidak tersedia (mis. SSR) — tidak pernah throw
ke UI.

### Pages Worker — `worker/_worker.js`

Satu file, tanpa dependensi, tanpa bundling. Tiga rute:

- `POST /api/build` → SSE. Validasi dulu (gagal = HTTP 400 + satu event
  error), lalu: cek/buat repo → push 4 file template (+ ikon) → dispatch
  workflow → ambil run terbaru → event `done`. Semua error GitHub
  dipetakan ke pesan Indonesia (`ghErrorMessage`).
- `GET /api/artifact` → JSON. Run terakhir workflow `build-apk.yml`:
  belum ada / masih jalan / gagal / sukses + artifact `apk`.
- `GET /api/download` → zip. Port dari route Next.js lama: `GET
  .../actions/artifacts/{id}/zip` dengan `redirect: 'manual'`, ikuti
  302 ke blob storage, stream kembali.

Template Cordova dibaca worker lewat binding `ASSETS` dari
`/cordova-template/*` (file statis hasil export) — jadi template punya
satu sumber kebenaran di repo, bukan string yang diduplikasi di kode
worker. Konsekuensi: file template harus ikut ter-deploy sebagai aset
statis (diperiksa `scripts/smoke.mjs`).

### Template Cordova — `public/cordova-template/`

| File | Peran | Placeholder |
|---|---|---|
| `config.xml` | Manifest Cordova; `<content src>` = URL target | `__APP_NAME__`, `__PACKAGE_NAME__`, `__TARGET_URL__` |
| `package.json` | Deklarasi platform `android` | sama |
| `www/index.html` | Halaman cadangan bila URL target gagal dimuat | sama |
| `build-apk.yml` | Workflow GitHub Actions (di-push ke `.github/workflows/`) | — (tanpa placeholder) |

Placeholder diganti worker (`fillTemplate`) sebelum push. CI job
`templates` memvalidasi: YAML valid + trigger `workflow_dispatch` +
langkah `cordova build` + `upload-artifact` ada; XML valid; placeholder
lengkap.

### PWA — `app/manifest.ts`, `public/sw.js`

Manifest statis (`dynamic = 'force-static'`). Service worker minimal:
`skipWaiting` + `clients.claim` + fetch passthrough dengan fallback
`"Offline"`. Didaftarkan dari `useEffect` di halaman.

## Alur data (sekali build)

1. Pengguna mengisi wizard → `POST /api/build` (JSON, token di body).
2. Worker memvalidasi → cek/buat repo → push file → dispatch.
3. Browser menerima event SSE → terminal terisi baris demi baris.
4. Event `done` → entri riwayat `status: 'building'` + tombol "Cek APK".
5. Pengguna menekan "Cek APK" → `GET /api/artifact` → bila run sukses,
   `downloadUrl` = `/api/download?...` → unduh otomatis → entri riwayat
   jadi `status: 'ready'`.
6. Bila run gagal → status `failed` + tautan ke log Actions.

Detail tiap langkah (termasuk batasan APK debug): `docs/build-flow.md`.

## Keputusan yang sengaja dibuat

- **Tidak ada database server.** Riwayat dan kredensial hidup di
  perangkat pengguna. Konsekuensinya jujur: ganti perangkat = riwayat
  hilang. Itu lebih baik daripada membangun auth + backend untuk produk
  yang intinya adalah "jalankan build di akun GitHub kamu".
- **Token lewat body/query, bukan cookie.** Desain produk sejak awal:
  token milik pengguna dan dikirim langsung ke GitHub API. Worker tidak
  pernah menyimpannya (lihat `docs/security.md`).
- **APK debug, bukan release.** Signing release butuh keystore yang
  tidak boleh ada di repo maupun di server tanpa manajemen secret yang
  serius. Debug-signed cukup untuk install & testing.
- **Satu file worker, tanpa bundler.** Mudah dibaca, mudah diuji
  (`node --test`), dan `cf_pages.py` bisa men-deploy-nya sebagai
  `_worker.bundle` tanpa langkah build tambahan.

## Direktori

```
app/                  Next.js App Router (page, layout, manifest, error, not-found)
lib/                  db.ts (IndexedDB), utils.ts (cn)
public/               icon.svg, favicon.svg, sw.js, cordova-template/*
worker/               _worker.js + _worker.test.mjs (18 test)
scripts/              serve-worker.mjs, smoke.mjs, advisory-sweep.py
docs/                 arsitektur, api, build-flow, security, development,
                      deployment, diagram.svg, screenshots/, demo/
.github/workflows/   ci.yml
```
