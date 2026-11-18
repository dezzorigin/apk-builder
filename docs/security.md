# Keamanan — APK Builder v1.1.0

## Model ancaman yang dijawab dokumen ini

Produk ini meminta pengguna memasukkan **Personal Access Token (PAT)
GitHub** — kredensial yang bisa membuat repo dan men-dispatch workflow
atas nama pengguna. Dokumen ini menjelaskan ke mana token itu pergi,
ke mana tidak, dan apa yang harus dilakukan bila token bocor.

## Ke mana token pergi

1. **Browser → Pages Worker** (`POST /api/build`, JSON body;
   `GET /api/artifact` dan `GET /api/download`, query string).
2. **Pages Worker → `api.github.com`** — sebagai header
   `Authorization: Bearer <token>`. Hanya ke host itu. Worker tidak
   memanggil host lain dengan token.
3. **Selesai.** Worker tidak menyimpan token di mana pun: tidak di
   KV, tidak di D1, tidak di log, tidak di variabel lingkungan.

## Ke mana token TIDAK pergi

- **Tidak ke server kami dalam bentuk tersimpan.** Tidak ada database
  server, tidak ada log akses worker yang mencatat body/query.
- **Tidak ke repo target.** Token tidak pernah ditulis ke file proyek
  Cordova mana pun.
- **Tidak ke pihak ketiga lain.** Tidak ada analytics, tidak ada
  telemetri (Next telemetry dimatikan di build).

## Yang tersimpan di perangkat pengguna

Frontend menyimpan kredensial di **IndexedDB** perangkat pengguna
sendiri (`apk_builder_db`, store `settings`) — hanya bila pengguna
menekan "Save Credentials" di Settings atau "Start Build":

| Key | Isi |
|---|---|
| `githubUsername` | username GitHub |
| `githubToken` | PAT (teks polos di IndexedDB) |

Ini perilaku produk sejak awal (bukan penambahan v1.1.0) dan ada
alasannya: tanpa itu pengguna harus mengetik ulang token di setiap
build. Konsekuensinya jujur:

- Siapa pun yang punya akses ke browser/perangkat itu bisa membaca
  token dari DevTools → Application → IndexedDB.
- Token **tidak** keluar dari perangkat lewat jalur ini — IndexedDB
  tidak tersinkron ke mana pun.
- Menghapus data situs / "Clear site data" menghapus token.
- Token bisa dicabut kapan saja dari GitHub → Settings → Developer
  settings → Personal access tokens. Mencabut membuat semua salinan
  token tidak berguna — itu cara yang benar untuk "mengganti" token
  yang terlanjur tersebar.

Rekomendasi untuk pengguna: pakai token **classic dengan scope minimal**
(`repo` + `workflow` saja, tanpa `admin:*`, tanpa `delete_repo`),
beri masa kedaluwarsa (mis. 30–90 hari), dan beri nama yang jelas
(mis. "apk-builder") supaya mudah dikenali dan dicabut.

## Token di query string (`/api/artifact`, `/api/download`)

Dua endpoint GET itu menerima token lewat query string — mengikuti
desain `/api/download` yang sudah ada sejak repo ini dibuat. Risikonya
diketahui: URL lengkap (termasuk query) bisa tercatat di log akses
server perantara. Mitigasinya:

- Cloudflare Pages tidak mencatat query string ke log yang bisa diakses
  publik; token juga hanya berlaku untuk repo pengguna itu sendiri.
- Frontend memanggil kedua endpoint itu langsung dari browser pengguna
  (bukan dari server lain), dan token yang sama sudah dikirim lewat
  body di `POST /api/build`.
- Bila ini dianggap tidak cukup, perbaikan yang benar adalah memindahkan
  token ke header `Authorization` di kedua endpoint GET itu — dicatat
  sebagai follow-up, bukan dikerjakan diam-diam di v1.1.0.

## Secret di repo

Nol. Verifikasi v1.1.0:

- Tidak ada file `.env` (hanya `.env.example` yang berisi
  `NEXT_TELEMETRY_DISABLED=1` — bukan secret).
- Tidak ada token, keystore, atau kredensial di riwayat commit yang
  disentuh rebuild ini. (Riwayat lama tidak ditulis ulang — lihat
  `CHANGELOG.md` bila ada temuan di commit awal.)
- `postcss.config.mjs` lama memanggil `autoprefixer` yang sudah tidak
  ada di dependencies — diperbaiki (bukan masalah keamanan, tapi
  build gagal karenanya).
- Dependensi yang tidak dipakai dan memperluas permukaan serangan
  dibuang: `@google/genai`, `@hookform/resolvers`, `firebase-tools`,
  `motion`, `autoprefixer`, `tw-animate-css`,
  `class-variance-authority`.

## Dependensi

- `postcss` di-pin lewat `overrides` ke `^8.5.18` (kini 8.5.33):
  menambal 2 HIGH di `postcss@8.4.31` tersarang di `next`
  (GHSA-r28c-9q8g-f849, GHSA-6g55-p6wh-862q) — temuan yang sama
  seperti repo P1 #19/#20.
- CI tidak memakai `npm audit --omit=dev` (bocor ke dev deps — bug npm
  yang diketahui); gantinya `scripts/advisory-sweep.py` yang memeriksa
  hanya pohon produksi di GitHub Advisory Database dan FAIL bila ada
  temuan high/critical di produksi.

## Yang produk ini hasilkan (batasan keamanan)

- APK yang dihasilkan adalah **debug-signed**. Jangan jadikan itu
  jalur rilis Play Store: siapa pun bisa menandatangani ulang APK
  debug. Untuk rilis, build release + sign dengan keystore yang
  disimpan aman — di luar ruang lingkup repo ini.
- Repo target dibuat **privat** oleh worker. Bila pengguna mengubahnya
  jadi publik, file proyek Cordova (termasuk URL target dan nama
  aplikasi) ikut publik — itu keputusan pengguna, bukan kebocoran
  dari produk ini.
