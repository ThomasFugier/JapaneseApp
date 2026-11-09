import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const japaneseFont = localFont({
  src: './fonts/YujiSyuku-Regular.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-japanese',
  adjustFontFallback: false,
});

const japanesePlainFont = localFont({
  src: './fonts/NotoSansJP-Regular.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  variable: '--font-japanese-plain',
  preload: false,
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'Japanese',
  description: 'Japanese library and spaced repetition.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Japanese' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${japaneseFont.variable} ${japanesePlainFont.variable}`}><body>{children}</body></html>;
}
