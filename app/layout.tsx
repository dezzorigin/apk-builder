import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'APK Builder — Ubah Website Jadi Aplikasi Android',
  description:
    'APK Builder mengubah website apa pun menjadi aplikasi Android (APK) lewat GitHub Actions + Cordova. Tanpa Android Studio, tanpa instalasi — isi nama aplikasi, sambungkan GitHub, unduh APK.',
  metadataBase: new URL('https://apk-builder.pages.dev'),
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'APK Builder — Ubah Website Jadi Aplikasi Android',
    description:
      'Website jadi APK lewat GitHub Actions + Cordova. Gratis, tanpa Android Studio.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
