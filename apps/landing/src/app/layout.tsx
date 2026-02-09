import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ikpa – See Your Financial Future | AI Finance for Young Adults',
  description:
    "Ikpa shows you exactly where you're headed financially and what to change. AI-powered personal finance built for how young adults actually manage money. Join the waitlist.",
  keywords: [
    'personal finance app',
    'AI financial coach',
    'budgeting app',
    'financial planning young professionals',
    'cash flow score',
    'future self visualization',
    'family support tracking',
    'irregular income app',
    'money management',
    'financial behavior change',
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
      "AI-powered personal finance for young adults. See where you're headed. Understand what it means. Plan what to do.",
    type: 'website',
    locale: 'en_US',
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
      "AI-powered personal finance for young adults. See where you're headed. Understand what it means. Plan what to do.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body suppressHydrationWarning className="font-sans bg-cream text-forest antialiased">{children}</body>
    </html>
  );
}
