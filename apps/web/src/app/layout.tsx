import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ikpa - Personal Finance Co-Pilot',
  description: 'AI-Powered Personal Finance Co-Pilot for Young Africans',
  manifest: '/manifest.json',
  themeColor: '#1E3A5F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
