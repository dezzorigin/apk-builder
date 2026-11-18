# Deployment — APK Builder v1.1.0

## Ringkasan

- **Platform:** Cloudflare Pages (direct upload via API, bukan
  git-connected — deploy dilakukan manual dari `out/`).
- **Project:** `apk-builder` → https://apk-builder.pages.dev
- **Isi deploy:** static export `out/` + `out/_worker.js`
  (Pages Worker sebagai `_worker.bundle`).
- **Helper:** `~/workspace/github-actions/cf_pages.py`
  (API token Cloudflare via konektor `custom.cloudflare`).

## Cara deploy

```bash
cd ~/workspace/apk-builder
npm run build
python3 ~/workspace/github-actions/cf_pages.py deploy apk-builder out
```

Lalu verifikasi:

```bash
curl -s -o /dev/null -w "landing %{http_code}\n" https://apk-builder.pages.dev/
curl -s -X POST https://apk-builder.pages.dev/api/build \
  -H 'content-type: application/json' -d '{"appName":"","packageName":"salah"}' \
  -w "\nbuild-invalid %{http_code}\n"
curl -s "https://apk-builder.pages.dev/api/artifact?user=a" -w "\nartifact %{http_code}\n"
```

Yang diharapkan: landing 200, `/api/build` invalid 400 + event SSE
error, `/api/artifact` kurang param 400.

## Nama Pages

Nama dicoba urut: `apk-builder` → `apkbuilder` → `bangun-apk`.
Ketersediaan nama **tidak bisa** dicek lewat GET project (404 hanya
berarti "bukan milik akun kita" — nama adalah namespace global).
Yang benar: buat project, lihat `subdomain` hasil create — bila
bersufiks (mis. `apk-builder-8hj.pages.dev`) berarti nama sudah dipakai
orang lain; bila create mengembalikan HTTP 409 berarti dipakai akun
Cloudflare lain. Bila nama final bersufiks dan jelek, jangan dipakai —
lanjut ke fallback berikutnya.

Nama final yang dipakai: **`apk-builder`** → https://apk-builder.pages.dev.

## Yang tidak perlu di-set

- Tidak ada environment variable / secret Pages yang dibutuhkan.
  Worker tidak membaca env var apa pun; token GitHub selalu datang
  dari pengguna di tiap request.
- Tidak ada build command di dashboard Pages (deploy adalah upload
  langsung `out/` yang sudah di-build lokal).

## Setelah deploy

1. Pasang URL live di About repo (GitHub → About → Website, atau
   `PATCH /repos/dezzorigin/apk-builder` `{"homepage": "https://apk-builder.pages.dev"}`) — lalu verifikasi lewat GET repo.
2. Jalankan live-smoke CI (job `live-smoke` di `main`).
3. Bila nama Pages berubah (fallback), ubah juga: `app/layout.tsx`
   (`metadataBase`), `.github/workflows/ci.yml` (URL live-smoke),
   `PRD.md`, `README.md`, dan semua tautan `apk-builder.pages.dev`.
