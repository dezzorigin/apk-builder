import { MetadataRoute } from 'next';

// Static export: manifest harus force-static.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'APK Builder',
    short_name: 'APK Builder',
    description: 'Ubah website jadi aplikasi Android (APK) lewat GitHub Actions + Cordova.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f9fa',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
