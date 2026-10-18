import type { Metadata } from 'next';
import { Urbanist } from 'next/font/google';
import './globals.css';

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Delisas Products',
  description: 'Delisas products dashboard interface',
  openGraph: {
    title: 'Delisas Products',
    description: 'Delisas products dashboard interface',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Delisas Products',
    description: 'Delisas products dashboard interface',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={urbanist.className}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
