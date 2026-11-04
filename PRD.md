# PRD — APK Builder

## 1. Informasi Proyek

| Field | Nilai |
|---|---|
| Nama Proyek | APK Builder |
| Tech Stack | Next.js |
| Status | Dalam pengembangan |
| Penanggung Jawab | Nabil Aulia Dika |
| Live Demo | https://apk-builder.pages.dev |
| Versi Dokumen | 1.0 |
| Tanggal | 2026 |

## 2. Latar Belakang

Vercel-style APK Builder menggunakan GitHub Actions dan Cordova. Membangun APK Android secara otomatis dari repository GitHub.

## 3. Tujuan

Menyediakan solusi digital yang efisien, terukur, dan mudah dipelihara.

## 4. Ruang Lingkup

- Fitur inti aplikasi sesuai struktur repo.
- Setup & konfigurasi pengembangan lokal.
- Dokumentasi (README + PRD).

## 5. Fitur & Persyaratan Fungsional

Struktur proyek:
- app/
- hooks/
- lib/
- public/
- LICENSE
- PRD.md
- README.md
- eslint.config.mjs
- metadata.json
- next-env.d.ts
- next.config.ts
- package.json
- postcss.config.mjs
- test.js
- tsconfig.json

## 6. Persyaratan Non-Fungsional

- **Performa:** responsif untuk penggunaan normal.
- **Keamanan:** rahasia (`.env`) tidak boleh ter-commit.
- **Maintainability:** kode terstruktur, terdokumentasi.

## 7. Arsitektur & Tech Stack

Next.js

## 8. Milestone

| Fase | Status |
|---|---|
| Inisialisasi & scaffolding | ✅ |
| Pengembangan fitur inti | 🔄 |
| Testing & QA | ⏳ |
| Deployment | ✅ |
| Dokumentasi | ✅ |

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Konfigurasi env bocor | `.gitignore` + `.env.example` |
| Dependency usang | Audit berkala |

## 10. Kriteria Keberhasilan

- Aplikasi berjalan tanpa error di lingkungan dev.
- README & PRD lengkap dan up-to-date.

## 11. Lisensi

MIT (LICENSE)
