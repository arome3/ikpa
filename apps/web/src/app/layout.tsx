import type { Metadata, Viewport } from 'next';
import { QueryProvider } from '@/providers/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ikpa - Personal Finance Co-Pilot',
  description: 'AI-Powered Personal Finance Co-Pilot for Young Africans',
  manifest: '/manifest.json',
  keywords: ['finance', 'budgeting', 'savings', 'AI', 'Africa', 'money management'],
  authors: [{ name: 'Ikpa Team' }],
  openGraph: {
    title: 'Ikpa - Personal Finance Co-Pilot',
    description: 'AI-Powered Personal Finance Co-Pilot for Young Africans',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-slate-900 antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
