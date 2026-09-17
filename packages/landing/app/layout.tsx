import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// Switzer (Fontshare, free for web use), self-hosted from public/fonts so the
// site stays fully static with no third-party font request.
const switzer = localFont({
  variable: '--font-switzer',
  display: 'swap',
  src: [
    { path: '../public/fonts/Switzer-400.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/Switzer-500.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/Switzer-600.woff2', weight: '600', style: 'normal' },
  ],
});
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'Flagrship',
  description:
    'Feature flags for teams that ship often. Deploy dark, roll out by percentage, roll back in one command. CLI-first, with JavaScript and Python SDKs.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${switzer.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
