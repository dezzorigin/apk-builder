# Alur Build — dari website jadi APK

Dokumen ini menjelaskan apa yang sebenarnya terjadi saat pengguna menekan
"Start Build". Ini cerita utama produk ini — dan bagian yang paling
sering disalahpahami.

## Kalimat jujurnya

**APK Builder tidak meng-compile Android apa pun.** Tidak ada JDK, SDK,
atau Gradle di server ini. Yang men-build APK adalah **GitHub Actions**,
di runner milik GitHub, di repo milik pengguna. APK Builder hanya
menyiapkan proyeknya dan men-dispatch workflow-nya. Itulah kenapa
produk ini bisa jalan sebagai situs statis + satu worker kecil.

## Langkah demi langkah

### 1. Pengguna mengisi wizard

- **App Details:** nama aplikasi, package name (application ID Android),
  ikon (opsional), URL website target.
- **GitHub Setup:** username, Personal Access Token (scope `repo` +
  `workflow`), nama repo.
- Validasi berjalan di dua tempat: frontend (tombol nonaktif sampai
  valid) dan worker (gagal = HTTP 400 + event SSE error).

### 2. Worker menyiapkan repo (`POST /api/build`)

| # | Panggilan GitHub API | Hasil |
|---|---|---|
| 1 | `GET /repos/{user}/{repo}` | 200 → pakai repo yang ada; 404 → lanjut ke 2 |
| 2 | `POST /user/repos` `{name, private: true}` | Repo privat baru |
| 3 | `PUT /repos/{user}/{repo}/contents/{path}` × 4 | `config.xml`, `package.json`, `www/index.html`, `.github/workflows/build-apk.yml` (placeholder sudah terisi; bila file sudah ada, update pakai `sha` lama) |
| 4 | `PUT .../contents/res/icon/android/icon-*.png` × 6 | Hanya bila ikon diunggah — satu gambar yang sama untuk semua densitas |
| 5 | `POST .../actions/workflows/build-apk.yml/dispatches` `{ref: "main"}` | Workflow mulai berjalan |
| 6 | `GET .../actions/workflows/build-apk.yml/runs?per_page=1` | Run terbaru → `actionsUrl`, `runId`, `runUrl` |

Semua langkah di-stream sebagai event SSE ke terminal di browser, jadi
pengguna melihat persis apa yang terjadi — bukan spinner buta.

### 3. GitHub Actions men-build (`public/cordova-template/build-apk.yml`)

```yaml
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-node 20
      - setup-java 17 (temurin)
      - setup-android (android-actions/setup-android@v3)
      - npm install -g cordova@12
      - cordova platform add android@13
      - cordova build android --debug
      - upload-artifact: apk → platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

Kenapa versi-versi itu terpin: Cordova 12 + cordova-android 13 adalah
pasangan yang teruji dengan JDK 17. Kalau salah satu naik mayor tanpa
diuji, build bisa pecah — dan yang merasakannya adalah pengguna di
tengah wizard, jadi jangan ubah tanpa menguji workflow-nya di repo
percobaan.

Waktu tipikal: **2–5 menit** (didominasi instalasi SDK + platform).

### 4. APK diambil sebagai artifact (`GET /api/artifact`)

Frontend tidak menunggu build selesai di dalam stream SSE — worker
tidak boleh menahan koneksi selama itu. Sebagai gantinya, setelah
dispatch, panel step 3 menampilkan tombol **"Cek APK"**:

- Run belum ada / masih jalan → `{found: false, status: "in_progress"}`.
- Run selesai tapi gagal → `{found: false, conclusion: "failure"}` +
  tautan ke log run.
- Run sukses → artifact bernama `apk` → `{found: true, downloadUrl:
  "/api/download?user=…&repo=…&artifact=…&token=…"}`.

### 5. Unduh (`GET /api/download`)

GitHub tidak mengizinkan unduhan artifact langsung dari browser dengan
fetch biasa (redirect ke blob storage). Worker mem-proxy:

```
GET api.github.com/.../artifacts/{id}/zip  (redirect: manual)
  → 302 Location: https://*.blob.core.windows.net/... (sekali pakai)
  → GET location → stream body sebagai application/zip
```

Frontend lalu mengarahkan browser ke URL itu (`window.location.href`),
sehingga unduhan dimulai seperti unduhan file biasa.

## Apa yang dihasilkan — dan apa yang tidak

| | |
|---|---|
| **Hasil** | `app-debug.apk` — APK debug (debug-signed), bisa langsung di-install di perangkat Android untuk testing (aktifkan "Install unknown apps" bila diminta). |
| **Bukan hasil** | APK release yang di-sign keystore; AAB untuk Play Store; build iOS. |
| **Kenapa debug?** | Signing release butuh keystore + password yang tidak boleh transit di repo, worker, atau browser tanpa manajemen secret yang serius. Menambahkan itu adalah proyek tersendiri — bukan tempelan. |
| **Masa berlaku artifact** | Default GitHub: 90 hari. Unduh segera setelah build selesai; setelah itu build ulang dari tombol yang sama. |

## Kegagalan yang umum

| Gejala | Arti | Yang dilakukan pengguna |
|---|---|---|
| `Token GitHub ditolak (401)` | Token salah / kedaluwarsa / dicabut | Buat token baru di GitHub → Settings → Developer settings → Personal access tokens (classic), scope `repo` + `workflow` |
| `GitHub menolak permintaan (403)` | Token tidak punya scope `workflow`, atau rate limit | Periksa scope token; tunggu sebentar bila rate limit |
| `Tidak ditemukan di GitHub (404)` | Username/repo salah, atau repo privat yang tokennya tidak berhak | Periksa ejaan username & repo |
| Build gagal di Actions (status `failed` saat "Cek APK") | Cordova/SDK gagal di runner | Buka "View Actions", baca log langkah yang merah — biasanya `cordova platform add` (jaringan npm) atau `cordova build` (config.xml tidak valid) |
| "Cek APK" terus `in_progress` | Runner masih bekerja / antre | Tunggu 1–2 menit, tekan lagi — build Cordova pertama di repo baru adalah yang paling lambat |

## Catatan verifikasi (18 Nov 2026)

- Alur penuh worker terverifikasi lewat 18 unit test dengan GitHub API
  di-mock (repo baru → push 4 file → dispatch → done, runId 42).
- Jalur error terverifikasi live-lokal: token contoh menghasilkan
  `401 Bad credentials` dari api.github.com sungguhan, diteruskan
  worker menjadi pesan Indonesia di terminal + panel error.
- **Yang belum terverifikasi end-to-end:** build sungguhan sampai APK
  jadi — butuh Personal Access Token GitHub yang valid milik Nabil, dan
  tidak dipakai dalam rebuild ini. Siapa pun yang memegang token bisa
  memverifikasi: isi wizard dengan token valid, tekan Start Build,
  tunggu run selesai, tekan "Cek APK", unduh APK, install di perangkat
  Android.
