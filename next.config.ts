import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Static export untuk Cloudflare Pages. API dinamis (/api/build,
  // /api/artifact, /api/download) TIDAK bisa hidup di sini — `next build`
  // menolak route handler dinamis saat output: 'export'. Logika rutenya
  // pindah ke Pages Worker (worker/_worker.js), yang di-copy ke
  // out/_worker.js saat build dan di-deploy sebagai _worker.bundle.
  output: 'export',
};

export default nextConfig;
