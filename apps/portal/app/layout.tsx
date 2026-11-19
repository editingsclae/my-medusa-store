import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted so the build never has to download the font from Google Fonts.
// One variable file (latin subset, weights 100-900), see app/fonts/README.md.
const urbanist = localFont({
  src: './fonts/urbanist-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GetCardy Portal',
  description: 'GetCardy merchant portal',
  openGraph: {
    title: 'GetCardy Portal',
    description: 'GetCardy merchant portal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GetCardy Portal',
    description: 'GetCardy merchant portal',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={urbanist.className} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
