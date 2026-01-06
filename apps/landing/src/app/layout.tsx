import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ikpa - AI-Powered Personal Finance Co-Pilot for Young Africans',
  description:
    'See your money clearly. Understand it deeply. Plan it wisely. Join the waitlist for the financial clarity you deserve.',
  keywords: [
    'personal finance',
    'Africa',
    'financial planning',
    'AI',
    'budgeting',
    'savings',
    'Nigeria',
    'Ghana',
    'Kenya',
  ],
  openGraph: {
    title: 'Ikpa - Personal Finance Co-Pilot',
    description: 'See your money clearly. Understand it deeply. Plan it wisely.',
    type: 'website',
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ikpa - Personal Finance Co-Pilot',
    description: 'See your money clearly. Understand it deeply. Plan it wisely.',
  },
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
