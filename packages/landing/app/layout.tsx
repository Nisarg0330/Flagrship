import type { Metadata } from 'next';
import { Geist, Geist_Mono, Newsreader } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', weight: ['400', '500', '600'] });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', weight: ['400', '500'] });
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  style: ['normal', 'italic'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Flagrship',
  description:
    'Feature flags for teams that ship often. Deploy dark, roll out by percentage, roll back in one command. CLI-first, with JavaScript and Python SDKs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
