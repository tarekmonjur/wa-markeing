import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18nProvider } from '@/lib/layout.shared';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import 'fumadocs-ui/css/neutral.css';
import 'fumadocs-ui/css/preset.css';
import './global.css';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <RootProvider i18n={i18nProvider(lang)}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
