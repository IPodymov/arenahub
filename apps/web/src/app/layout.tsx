import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'ArenaHub — онлайн-турниры', template: '%s · ArenaHub' },
  description: 'Турниры по Dota 2, CS2, Clash Royale и Brawl Stars',
};

export const viewport: Viewport = { themeColor: '#16181f', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-dvh font-sans">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
