import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CineTogether — Watch Movies Together, Miles Apart',
  description:
    'A private virtual cinema for two. Stream movies in perfect sync with your special someone, no matter the distance.',
  openGraph: {
    title: 'CineTogether 🎬',
    description: 'Watch movies together, miles apart.',
    type: 'website',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} style={{ background: 'var(--bg-deep)', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
