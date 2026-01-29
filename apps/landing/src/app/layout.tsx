import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ikpa – See Your Financial Future | AI Finance for Young Africans',
  description:
    "Ikpa shows you exactly where you're headed financially and what to change. AI-powered personal finance built for how young Africans actually manage money. Join the waitlist.",
  keywords: [
    'personal finance Africa',
    'AI financial coach',
    'Nigeria fintech',
    'budgeting app Africa',
    'financial planning young professionals',
    'cash flow score',
    'future self visualization',
    'family support tracking',
    'irregular income app',
    'Ghana',
    'Kenya',
    'South Africa',
  ],
  authors: [{ name: 'Ikpa' }],
  creator: 'Ikpa',
  publisher: 'Ikpa',
  metadataBase: new URL('https://ikpa.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Ikpa – See Your Financial Future',
    description:
      "AI-powered personal finance for young Africans. See where you're headed. Understand what it means. Plan what to do.",
    type: 'website',
    locale: 'en_NG',
    url: 'https://ikpa.app',
    siteName: 'Ikpa',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Ikpa - See Your Financial Future',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ikpa – See Your Financial Future',
    description:
      "AI-powered personal finance for young Africans. See where you're headed. Understand what it means. Plan what to do.",
    site: '@ikpaapp',
    creator: '@ikpaapp',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">{children}</body>
    </html>
  );
}
