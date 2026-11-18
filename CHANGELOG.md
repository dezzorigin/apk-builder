# Changelog — APK Builder

## v1.1.0 — 18 Nov 2026 (rebuild total, "proper")

Rebuild total repo P1 #21. Yang berubah bukan kosmetik — produk ini
sebelumnya **tidak bisa build sama sekali**.

### Yang diperbaiki (bug)

- **`POST /api/build` tidak pernah ada.** Frontend sejak awal memanggil
  endpoint ini, tapi repo hanya punya `app/api/download/route.ts`.
  Next.js menjawab 404, jadi tidak ada build yang bisa dimulai. Endpoint
  ini sekarang ada sebagai SSE di Pages Worker (`worker/_worker.js`),
  dengan kontrak event yang sama seperti yang sudah di-parse frontend.
- **Log terminal ganda.** Baris "> Initializing Build Environment..."
  tampil dua kali (sekali dari frontend, sekali dari worker). Sekarang
  hanya dari worker.
- **Tombol Close hilang saat build error.** Footer step 3 hanya
  menampilkan Close bila `buildDone` — pengguna yang build-nya gagal
  (mis. token 401) terjebak di step 3 tanpa jalan keluar yang jelas.
  Sekarang Close tampil bila `buildDone || buildError`.
- **Kelas hover rusak.** `hover:${...}` di header dashboard tidak
  pernah di-generate Tailwind (nama kelas dinamis) — diganti kelas
  kondisional eksplisit.
- **`postcss.config.mjs` memanggil `autoprefixer`** yang sudah tidak
  ada di dependencies (build gagal). Dihapus — Tailwind v4 tidak
  membutuhkannya.
- **`app/manifest.ts` tanpa `dynamic = 'force-static'`** — static
  export gagal di tahap collect page data. Ditambahkan.
- **Favicon 404.** Menambahkan `public/favicon.svg` + metadata icons.
- **Metadata "My Google AI Studio App".** Diganti judul + deskripsi
  APK Builder yang sebenarnya (sisa scaffold AI Studio).

### Yang ditambahkan

- **Pages Worker** (`worker/_worker.js`): `POST /api/build` (SSE —
  buat/cek repo, push template Cordova, dispatch workflow, ambil run
  terbaru), `GET /api/artifact` (cari artifact APK run sukses
  terakhir), `GET /api/download` (port route Next.js lama; mengikuti
  redirect 302 GitHub ke blob storage). 18 unit test
  (`worker/_worker.test.mjs`).
- **Template Cordova sebagai file repo** (`public/cordova-template/`):
  `config.xml`, `package.json`, `www/index.html`, `build-apk.yml`
  (Cordova 12, cordova-android 13, JDK 17, Node 20, APK debug +
  upload-artifact). Worker membacanya lewat binding `ASSETS`.
- **Tombol "Cek APK"** di step 3: memeriksa status run GitHub Actions
  dan mengunduh APK begitu artifact tersedia (sebelumnya frontend
  hanya bisa menampilkan "View Actions").
- **Landing page SaaS**: navbar (logo GitHub kanan → repo), hero dua
  kolom + preview produk, fitur (6), cara kerja (3), keamanan, CTA,
  footer.
- **Validasi input** di frontend + worker (package name, URL,
  repo, ikon) + normalisasi URL tanpa skema (`example.com` →
  `https://example.com`).
- **Riwayat lengkap**: status build (`building`/`ready`/`failed`),
  tautan Actions, hapus entri (sebelumnya tidak bisa dihapus).
- **CI** (`.github/workflows/ci.yml`): build, worker-test,
  advisory-sweep, templates, smoke (serve lokal + curl kontrak API),
  live-smoke (main, non-gating).
- **Docs**: PRD v2.0, arsitektur, alur build, API, keamanan,
  development, deployment, `docs/diagram.svg`.
- **Screenshot asli + video demo** (`docs/screenshots/`,
  `docs/demo/demo.mp4`).
- **Deploy live**: https://apk-builder.pages.dev (Cloudflare Pages).

### Yang dibuang

- `app/api/download/route.ts` — route handler tidak bisa hidup dengan
  `output: 'export'`; logikanya pindah ke worker.
- `hooks/use-mobile.ts`, `test.js` (`const x = 1;`), `metadata.json`
  (sisa scaffold AI Studio) — tidak dipakai di mana pun.
- Dependensi tak terpakai: `@google/genai`, `@hookform/resolvers`,
  `firebase-tools`, `motion`, `autoprefixer`, `tw-animate-css`,
  `class-variance-authority`.
- `package-lock.json` dibuat (repo lama tidak memilikinya — `npm ci`
  tidak bisa jalan tanpa itu).

### Keamanan

- `postcss` di-pin `^8.5.18` via `overrides` (kini 8.5.33) — menambal
  2 HIGH di `postcss@8.4.31` (GHSA-r28c-9q8g-f849,
  GHSA-6g55-p6wh-862q), pola yang sama seperti repo P1 #19/#20.
- CI memakai `scripts/advisory-sweep.py` (GitHub Advisory Database,
  hanya pohon produksi) sebagai pengganti `npm audit --omit=dev`
  yang bocor ke dev deps.

### Yang belum terverifikasi

- **Build sungguhan sampai APK jadi** — butuh Personal Access Token
  GitHub yang valid; tidak dipakai dalam rebuild ini. Lihat
  `docs/build-flow.md` ("Catatan verifikasi") untuk cara memverifikasi.

## v1.0.0 — scaffold awal (Okt–Nov 2026)

- Scaffold Next.js (AI Studio): landing seadanya (langsung dashboard
  "My Apps"), wizard 3 langkah, IndexedDB, PWA, `app/api/download`,
  README + PRD v1.0, LICENSE, `.gitignore`.
- Diketahui saat itu tapi belum ditangani: `/api/build` tidak ada.
