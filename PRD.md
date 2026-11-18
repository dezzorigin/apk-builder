# PRD — APK Builder v2.0

| Field | Nilai |
|---|---|
| Nama Proyek | APK Builder |
| Tech Stack | Next.js 15 (static export) + React 19 + Tailwind CSS 4 + Cloudflare Pages Worker |
| Status | Proper — live |
| Penanggung Jawab | Nabil Aulia Dika (dezzorigin) |
| Live Demo | https://apk-builder.pages.dev |
| Repo | https://github.com/dezzorigin/apk-builder |
| Versi Dokumen | 2.0 (18 Nov 2026 — rewrite total dari PRD v1.0) |

## 1. Latar Belakang

Membuat APK Android dari sebuah website biasanya butuh Android Studio,
JDK, Android SDK, dan Gradle — instalasi berat yang menakutkan untuk
pemula dan lambat untuk yang sekadar mau mencoba. APK Builder memindahkan
seluruh beban itu ke tempat yang memang dirancang untuk build: GitHub
Actions.

Pengguna cukup mengisi nama aplikasi dan URL website di browser. APK
Builder membuat proyek Cordova, mem-push-nya ke repo GitHub pengguna
sendiri, dan men-dispatch workflow GitHub Actions yang menjalankan
`cordova build android`. APK yang jadi diunduh sebagai artifact.

## 2. Tujuan

1. Website apa pun bisa jadi APK Android tanpa instalasi apa pun di
   laptop pengguna.
2. Build berjalan di akun GitHub pengguna sendiri — repo, workflow, dan
   artifact semuanya milik pengguna, bukan milik layanan ini.
3. Setiap langkah transparan: log build tampil live di terminal, dan
   kegagalan dijelaskan dengan bahasa yang bisa ditindaklanjuti.

## 3. Ruang Lingkup

**Masuk:**
- Landing page SaaS (navbar, hero + preview, fitur, cara kerja, keamanan, footer).
- Wizard build 3 langkah: App Details → GitHub Setup → Build Process.
- Pages Worker: `POST /api/build` (SSE), `GET /api/artifact`,
  `GET /api/download`.
- Template Cordova (`public/cordova-template/`): `config.xml`,
  `www/index.html`, `package.json`, workflow `build-apk.yml`.
- Riwayat aplikasi di IndexedDB (cari, ubah nama/ikon, hapus, unduh ulang).
- PWA (manifest + service worker).
- CI: build, typecheck, lint, worker-test, advisory-sweep,
  template-check, smoke, live-smoke.

**Tidak masuk (sengaja):**
- APK release yang di-sign keystore — yang dihasilkan adalah APK debug
  (debug-signed, siap install untuk testing). Signing release adalah
  langkah lanjutan, lihat `docs/build-flow.md`.
- Build iOS — Cordova di runner GitHub Actions hanya menargetkan Android.
- Akun/pembayaran — tidak ada backend pengguna; token GitHub adalah
  satu-satunya kredensial dan milik pengguna.

## 4. Persona & Skenario

| Persona | Skenario |
|---|---|
| Pemilik website/toko online | Punya website (mis. toko kopi) dan mau pelanggan install sebagai aplikasi — isi form 3 langkah, tunggu 2–5 menit, bagikan APK. |
| Developer web | Mau demo cepat "website ini juga ada versi aplikasinya" tanpa menyiapkan Android Studio. |
| Pelajar | Belajar alur CI/CD: lihat langsung bagaimana GitHub Actions men-build sesuatu dari repo. |

## 5. Fitur & Persyaratan Fungsional

### 5.1 Landing page (`/`)

- Navbar sticky: logo + nama, tautan Fitur / Cara Kerja / Keamanan,
  ikon GitHub (kanan) → repo, tombol "Mulai Build".
- Hero dua kolom: copy + preview produk (terminal build + kartu aplikasi).
- Section fitur (6 kartu), cara kerja (3 langkah), keamanan, CTA band, footer.
- Toggle tema terang/gelap.

### 5.2 Wizard build

| Langkah | Input | Validasi |
|---|---|---|
| 1. App Details | App Name, Package Name, App Icon (opsional), Target URL | Package harus `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`; URL tanpa skema otomatis ditambah `https://`; ikon PNG/JPG maks. ~1 MB |
| 2. GitHub Setup | GitHub Username, Personal Access Token, Repository Name | Token wajib; repo hanya huruf/angka/titik/`_`/`-`; tombol Start Build nonaktif sampai semua valid |
| 3. Build Process | Terminal log (SSE) | Menampilkan tiap langkah worker; panel hasil: APK siap (unduh) / build berjalan (View Actions + Cek APK) / error (pesan + Close) |

### 5.3 `POST /api/build` (SSE, Pages Worker)

1. Validasi input → gagal: HTTP 400 + event SSE `{"error": ...}`.
2. Cek repo `GET /repos/{user}/{repo}` → 404: buat repo privat baru.
3. Push 4 file template (placeholder terisi) lewat Contents API:
   `config.xml`, `package.json`, `www/index.html`,
   `.github/workflows/build-apk.yml`. Bila ikon diunggah, ikon yang sama
   di-push ke 6 densitas `res/icon/android/`.
4. Dispatch workflow `POST .../actions/workflows/build-apk.yml/dispatches`.
5. Ambil run terbaru → event `{"done": true, "actionsUrl", "runId", "runUrl"}`.
   `downloadUrl` sengaja tidak ada di tahap ini: build di runner butuh
   menit, bukan detik.

### 5.4 `GET /api/artifact`

Mencari artifact APK di run sukses terakhir workflow `build-apk.yml`:
`{found, status, conclusion, runUrl, artifact, downloadUrl}`.
Dipanggil frontend lewat tombol "Cek APK".

### 5.5 `GET /api/download`

Proxy unduhan artifact: `GET .../actions/artifacts/{id}/zip` (GitHub
menjawab 302 ke blob storage) → ikuti redirect → stream kembali sebagai
`application/zip` dengan `Content-Disposition: attachment`.

### 5.6 Riwayat (IndexedDB, `lib/db.ts`)

- `app_history`: tiap build tersimpan (nama, package, repo, downloadUrl,
  status `building`/`ready`/`failed`, actionsUrl, runUrl, ikon, waktu).
- `settings`: username + token GitHub (hanya di perangkat pengguna).
- Operasi: tambah, baca (terbaru dulu), ubah nama/ikon, hapus, cari
  berdasarkan nama/repo.

## 6. Persyaratan Non-Fungsional

- **Performa:** landing static; First Load JS ~117 kB; build tidak
  membebani server ini (runner GitHub yang bekerja).
- **Keamanan:** token diteruskan hanya ke `api.github.com`, tidak pernah
  disimpan/dicatat di server; tidak ada secret di repo (lihat
  `docs/security.md`).
- **Keterandalan:** validasi 400 sebelum stream; error GitHub (401/403/
  404/422) dipetakan ke pesan Indonesia yang bisa ditindaklanjuti;
  worker tidak pernah menggantung UI (semua kegagalan menutup stream
  dengan event error).
- **Maintainability:** template Cordova adalah file nyata di repo
  (bukan string di kode) dan divalidasi CI; worker punya 18 unit test.

## 7. Arsitektur & Tech Stack

Lihat `docs/architecture.md` dan `docs/diagram.svg`. Ringkasnya:
Next.js static export (`out/`) + Pages Worker (`worker/_worker.js`,
di-copy ke `out/_worker.js`) → GitHub REST API → GitHub Actions
(Cordova 12, cordova-android 13, JDK 17, Node 20).

## 8. Milestone

| Fase | Status |
|---|---|
| Scaffold awal (AI Studio) | ✅ (4 commit, Okt–Nov 2026) |
| Rebuild total v1.1.0 — `/api/build` yang hilang, Pages Worker, landing SaaS, validasi, riwayat lengkap, CI, docs | ✅ 18 Nov 2026 |
| Verifikasi live + play-test end-to-end | ✅ 18 Nov 2026 |
| Signing APK release (keystore) | ⏳ follow-up |
| Build iOS | ❌ tidak direncanakan |

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Token GitHub bocor / disalahgunakan | Token tidak disimpan di server; scope minimal (`repo` + `workflow`); pengguna bisa revoke kapan saja; docs/security.md menjelaskan semuanya |
| Rate limit GitHub API (IP egress bersama) | Semua panggilan memakai token pengguna (limit terautentikasi, jauh lebih tinggi) |
| Build Actions gagal (mis. Cordova/Android SDK berubah) | Workflow memakai versi terpin (`cordova@12`, `android@13`, JDK 17, Node 20); log run bisa dibuka dari "View Actions" |
| Artifact kedaluwarsa (default GitHub: 90 hari) | Status kartu menunjukkan "APK siap" hanya bila artifact ada; unduh segera setelah build selesai |
| Repo target sudah berisi file lain | File proyek hanya menimpa 4 path template + ikon; file lain tidak disentuh |

## 10. Kriteria Keberhasilan

- Landing + wizard berjalan tanpa error di dev dan di live.
- `POST /api/build` dengan input valid men-dispatch workflow sungguhan
  (terverifikasi lewat unit test mock + error 401 live dengan token contoh).
- CI hijau di semua job; live-smoke 200 di landing + 400 di validasi API.
- README + docs lengkap; screenshot tampilan asli + video demo.

## 11. Lisensi

MIT (LICENSE)
