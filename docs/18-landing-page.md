# Landing Page

## Overview

The Ikpa landing page serves as the primary marketing website for the platform, designed to capture leads through a waitlist, explain the product value proposition, and build pre-launch momentum. It features a modern, conversion-optimized design with a referral system to encourage viral growth among the target audience of young African professionals.

## Technical Specifications

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework with App Router |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| Framer Motion | 11.x | Animations |
| Resend | latest | Email delivery |
| Vercel Analytics | latest | Traffic analytics |
| Prisma | 5.x | Database ORM |

### Project Structure

```
apps/landing/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                     # Home/Hero
│   │   ├── features/
│   │   │   └── page.tsx
│   │   ├── pricing/
│   │   │   └── page.tsx
│   │   ├── about/
│   │   │   └── page.tsx
│   │   └── blog/
│   │       ├── page.tsx
│   │       └── [slug]/
│   │           └── page.tsx
│   ├── waitlist/
│   │   ├── page.tsx                     # Waitlist form
│   │   └── success/
│   │       └── page.tsx                 # Confirmation page
│   ├── r/
│   │   └── [code]/
│   │       └── page.tsx                 # Referral landing
│   ├── api/
│   │   ├── waitlist/
│   │   │   ├── route.ts                 # Join waitlist
│   │   │   └── verify/
│   │   │       └── route.ts             # Verify email
│   │   ├── referrals/
│   │   │   └── [code]/
│   │   │       └── route.ts             # Referral tracking
│   │   └── analytics/
│   │       └── route.ts                 # Event tracking
│   ├── layout.tsx
│   ├── globals.css
│   └── manifest.ts
├── components/
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   └── mobile-menu.tsx
│   ├── sections/
│   │   ├── hero.tsx
│   │   ├── problem.tsx
│   │   ├── solution.tsx
│   │   ├── features.tsx
│   │   ├── how-it-works.tsx
│   │   ├── future-self.tsx
│   │   ├── testimonials.tsx
│   │   ├── pricing.tsx
│   │   ├── faq.tsx
│   │   └── cta.tsx
│   ├── waitlist/
│   │   ├── waitlist-form.tsx
│   │   ├── referral-share.tsx
│   │   └── countdown.tsx
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   └── animated-text.tsx
│   └── shared/
│       ├── logo.tsx
│       ├── phone-mockup.tsx
│       └── feature-card.tsx
├── lib/
│   ├── db.ts
│   ├── email.ts
│   ├── analytics.ts
│   └── utils.ts
├── content/
│   ├── blog/
│   │   └── *.mdx
│   └── legal/
│       ├── privacy.mdx
│       └── terms.mdx
├── public/
│   ├── images/
│   │   ├── hero-mockup.png
│   │   ├── app-screenshots/
│   │   └── icons/
│   └── og-image.png
├── next.config.js
├── tailwind.config.ts
└── package.json
```

## Database Schema

### Prisma Models

```prisma
// packages/shared/prisma/schema.prisma (additions for landing)

model WaitlistEntry {
  id              String    @id @default(cuid())
  email           String    @unique
  firstName       String?
  country         Country   @default(NIGERIA)
  referralCode    String    @unique
  referredBy      String?   // Referral code used
  position        Int       @default(autoincrement())
  verified        Boolean   @default(false)
  verifiedAt      DateTime?
  referralCount   Int       @default(0)
  priorityBoost   Int       @default(0)   // Earned through referrals
  source          String?                  // utm_source
  campaign        String?                  // utm_campaign
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  referrer        WaitlistEntry?  @relation("Referrals", fields: [referredBy], references: [referralCode])
  referrals       WaitlistEntry[] @relation("Referrals")

  @@index([email])
  @@index([referralCode])
  @@index([position])
}

model WaitlistAnalytics {
  id          String   @id @default(cuid())
  event       String   // page_view, waitlist_join, referral_click, etc.
  page        String?
  referrer    String?
  userAgent   String?
  ip          String?
  country     String?
  data        Json?
  createdAt   DateTime @default(now())

  @@index([event])
  @@index([createdAt])
}

model BlogPost {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  excerpt     String
  content     String    @db.Text
  coverImage  String?
  author      String
  published   Boolean   @default(false)
  publishedAt DateTime?
  tags        String[]
  views       Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([slug])
  @@index([published, publishedAt])
}
```

## Key Capabilities

### Marketing Features
- Hero section with animated phone mockup
- Problem/Solution narrative flow
- Feature showcase with interactive demos
- How It Works step-by-step guide
- Future Self visualization preview
- Social proof with testimonials
- Pricing preview (freemium model)
- FAQ accordion section

### Waitlist System
- Email capture with validation
- Unique referral code generation
- Position tracking with priority boosts
- Email verification flow
- Referral tracking and rewards
- Social sharing integration

### Analytics & Tracking
- Page view tracking
- Conversion funnel analysis
- Referral source attribution
- UTM parameter capture
- Event-based analytics

## Implementation Guide

### Root Layout

```typescript
// apps/landing/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: {
    default: 'Ikpa - See Your Financial Future',
    template: '%s | Ikpa',
  },
  description:
    'AI-powered personal finance for young Africans. Build wealth, not just budgets.',
  keywords: [
    'personal finance',
    'africa',
    'nigeria',
    'budget',
    'savings',
    'ai',
    'financial planning',
    'money management',
  ],
  authors: [{ name: 'Ikpa' }],
  creator: 'Ikpa',
  metadataBase: new URL('https://ikpa.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ikpa.app',
    title: 'Ikpa - See Your Financial Future',
    description:
      'AI-powered personal finance for young Africans. Build wealth, not just budgets.',
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
    title: 'Ikpa - See Your Financial Future',
    description:
      'AI-powered personal finance for young Africans. Build wealth, not just budgets.',
    images: ['/og-image.png'],
    creator: '@ikpaapp',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#00A86B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} ${jakarta.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### Marketing Layout

```typescript
// apps/landing/app/(marketing)/layout.tsx
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
```

### Header Component

```typescript
// apps/landing/components/layout/header.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Features', href: '#features' },
  { name: 'How It Works', href: '#how-it-works' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'Blog', href: '/blog' },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setIsScrolled(latest > 50);
  });

  return (
    <motion.header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-background/80 backdrop-blur-lg border-b border-border/50'
          : 'bg-transparent'
      )}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-display text-xl font-bold">Ikpa</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="https://app.ikpa.app/login">Sign In</Link>
            </Button>
            <Button asChild className="gradient-primary">
              <Link href="/waitlist">Join Waitlist</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <motion.div
            className="md:hidden py-4 border-t border-border/50"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col gap-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-border/50">
                <Button variant="ghost" asChild>
                  <Link href="https://app.ikpa.app/login">Sign In</Link>
                </Button>
                <Button asChild className="gradient-primary">
                  <Link href="/waitlist">Join Waitlist</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </nav>
    </motion.header>
  );
}
```

### Home Page

```typescript
// apps/landing/app/(marketing)/page.tsx
import { Hero } from '@/components/sections/hero';
import { Problem } from '@/components/sections/problem';
import { Solution } from '@/components/sections/solution';
import { Features } from '@/components/sections/features';
import { HowItWorks } from '@/components/sections/how-it-works';
import { FutureSelf } from '@/components/sections/future-self';
import { Testimonials } from '@/components/sections/testimonials';
import { Pricing } from '@/components/sections/pricing';
import { FAQ } from '@/components/sections/faq';
import { CTA } from '@/components/sections/cta';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <Solution />
      <Features />
      <HowItWorks />
      <FutureSelf />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
```

### Hero Section

```typescript
// apps/landing/components/sections/hero.tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhoneMockup } from '@/components/shared/phone-mockup';
import { AnimatedText } from '@/components/ui/animated-text';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-ikpa-green-500/10 via-background to-background" />

      {/* Animated Background Orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-ikpa-green-500/20 rounded-full blur-3xl"
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ikpa-gold-500/10 rounded-full blur-3xl"
        animate={{
          x: [0, -30, 0],
          y: [0, -50, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ikpa-green-500/10 border border-ikpa-green-500/20 mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="h-4 w-4 text-ikpa-green-500" />
              <span className="text-sm font-medium text-ikpa-green-500">
                AI-Powered Finance for Africa
              </span>
            </motion.div>

            {/* Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              <AnimatedText text="See Your" />
              <br />
              <span className="text-gradient-primary">
                <AnimatedText text="Financial Future" delay={0.3} />
              </span>
            </h1>

            {/* Subheadline */}
            <motion.p
              className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Meet your future self. Ikpa shows you exactly where you&apos;re
              headed financially — and helps you change course before
              it&apos;s too late.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Button size="lg" asChild className="gradient-primary group">
                <Link href="/waitlist">
                  Join the Waitlist
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#how-it-works">See How It Works</Link>
              </Button>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              className="mt-8 flex items-center gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-background bg-gradient-to-br from-ikpa-green-400 to-ikpa-green-600"
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">2,847+</span>{' '}
                people on the waitlist
              </p>
            </motion.div>
          </motion.div>

          {/* Phone Mockup */}
          <motion.div
            className="relative hidden lg:block"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <PhoneMockup
              screen="/images/app-screenshots/dashboard.png"
              className="mx-auto"
            />

            {/* Floating Cards */}
            <motion.div
              className="absolute -left-8 top-1/4 glass-card p-4 rounded-xl shadow-xl"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-white font-bold">85</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cash Flow Score</p>
                  <p className="font-semibold text-ikpa-green-500">Excellent</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="absolute -right-4 bottom-1/3 glass-card p-4 rounded-xl shadow-xl"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full gradient-gold flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-background" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">AI Insight</p>
                  <p className="font-medium text-sm">Save ₦45k this month</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

### Features Section

```typescript
// apps/landing/components/sections/features.tsx
'use client';

import { motion } from 'framer-motion';
import {
  Bot,
  Sparkles,
  TrendingUp,
  Shield,
  Users,
  Target,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { FeatureCard } from '@/components/shared/feature-card';

const features = [
  {
    icon: Bot,
    title: 'AI Financial Coach',
    description:
      'Get personalized advice that understands Nigerian money realities — family obligations, irregular income, and multiple hustles.',
    color: 'green',
  },
  {
    icon: Sparkles,
    title: 'Future Self Visualization',
    description:
      'See two versions of your future: where you\'re heading now vs. where you could be with small changes.',
    color: 'gold',
  },
  {
    icon: TrendingUp,
    title: 'Cash Flow Score',
    description:
      'Your overall financial health in one number (0-100). Track progress and watch your score improve.',
    color: 'green',
  },
  {
    icon: Users,
    title: 'Family Support Tracking',
    description:
      'Built for Africa. Track obligations to family while still building your own wealth.',
    color: 'gold',
  },
  {
    icon: Target,
    title: 'Smart Goals',
    description:
      'Set financial goals with AI-powered projections that show exactly when you\'ll reach them.',
    color: 'green',
  },
  {
    icon: Wallet,
    title: 'Multi-Source Income',
    description:
      'Track salary, side hustles, business income, and investments all in one place.',
    color: 'gold',
  },
  {
    icon: BarChart3,
    title: 'Pattern Detection',
    description:
      'AI spots spending patterns and warns you about potential issues before they become problems.',
    color: 'green',
  },
  {
    icon: Shield,
    title: 'Bank-Level Security',
    description:
      'Your data is encrypted and secure. We never sell your information.',
    color: 'gold',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Everything You Need to{' '}
            <span className="text-gradient-primary">Build Wealth</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Ikpa combines AI intelligence with deep understanding of African
            financial realities to give you the tools you need.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Waitlist API

```typescript
// apps/landing/app/api/waitlist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendWelcomeEmail, sendVerificationEmail } from '@/lib/email';
import { generateReferralCode } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

const waitlistSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1).optional(),
  country: z.enum(['NIGERIA', 'KENYA', 'GHANA', 'SOUTH_AFRICA', 'OTHER']).default('NIGERIA'),
  referralCode: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = waitlistSchema.parse(body);

    // Check if email already exists
    const existing = await prisma.waitlistEntry.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_EXISTS',
          message: 'This email is already on the waitlist',
          data: {
            referralCode: existing.referralCode,
            position: existing.position,
          },
        },
        { status: 400 }
      );
    }

    // Validate referral code if provided
    let referrer = null;
    if (data.referralCode) {
      referrer = await prisma.waitlistEntry.findUnique({
        where: { referralCode: data.referralCode },
      });
    }

    // Generate unique referral code
    const referralCode = generateReferralCode(data.email);

    // Get current position
    const lastEntry = await prisma.waitlistEntry.findFirst({
      orderBy: { position: 'desc' },
    });
    const position = (lastEntry?.position ?? 0) + 1;

    // Create waitlist entry
    const entry = await prisma.waitlistEntry.create({
      data: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        country: data.country,
        referralCode,
        referredBy: data.referralCode,
        position,
        source: data.source,
        campaign: data.campaign,
      },
    });

    // Update referrer's count
    if (referrer) {
      await prisma.waitlistEntry.update({
        where: { id: referrer.id },
        data: {
          referralCount: { increment: 1 },
          priorityBoost: { increment: 1 }, // Move up 1 position per referral
        },
      });
    }

    // Send verification email
    await sendVerificationEmail(entry.email, entry.id);

    // Track analytics
    await trackEvent('waitlist_join', {
      email: entry.email,
      position: entry.position,
      hasReferral: !!data.referralCode,
      source: data.source,
      campaign: data.campaign,
    });

    return NextResponse.json({
      success: true,
      data: {
        referralCode: entry.referralCode,
        position: entry.position,
        referralLink: `https://ikpa.app/r/${entry.referralCode}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.errors[0].message,
        },
        { status: 400 }
      );
    }

    console.error('Waitlist join error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'SERVER_ERROR',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json(
      { success: false, error: 'Email required' },
      { status: 400 }
    );
  }

  const entry = await prisma.waitlistEntry.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      position: true,
      referralCode: true,
      referralCount: true,
      priorityBoost: true,
      verified: true,
    },
  });

  if (!entry) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }

  // Calculate effective position (position - priorityBoost)
  const effectivePosition = Math.max(1, entry.position - entry.priorityBoost);

  return NextResponse.json({
    success: true,
    data: {
      ...entry,
      effectivePosition,
      referralLink: `https://ikpa.app/r/${entry.referralCode}`,
    },
  });
}
```

### Email Verification API

```typescript
// apps/landing/app/api/waitlist/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';
import { trackEvent } from '@/lib/analytics';
import { verifyToken } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token required' },
        { status: 400 }
      );
    }

    // Verify token and extract entry ID
    const entryId = verifyToken(token);

    if (!entryId) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    // Update entry as verified
    const entry = await prisma.waitlistEntry.update({
      where: { id: entryId },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    // Send welcome email
    await sendWelcomeEmail(entry.email, entry.firstName, entry.referralCode);

    // Track analytics
    await trackEvent('waitlist_verified', {
      email: entry.email,
      position: entry.position,
    });

    return NextResponse.json({
      success: true,
      data: {
        email: entry.email,
        position: entry.position,
        referralCode: entry.referralCode,
      },
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}
```

### Waitlist Form Component

```typescript
// apps/landing/components/waitlist/waitlist-form.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  firstName: z.string().min(1, 'Please enter your name'),
  country: z.string().min(1, 'Please select your country'),
});

type FormData = z.infer<typeof formSchema>;

interface WaitlistFormProps {
  referralCode?: string;
  source?: string;
  campaign?: string;
  onSuccess?: (data: { referralCode: string; position: number }) => void;
}

export function WaitlistForm({
  referralCode,
  source,
  campaign,
  onSuccess,
}: WaitlistFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    referralCode: string;
    position: number;
  } | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      firstName: '',
      country: 'NIGERIA',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          referralCode,
          source,
          campaign,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.message);
        return;
      }

      setSuccess(result.data);
      onSuccess?.(result.data);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {success ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-ikpa-green-500/20 mb-6">
            <CheckCircle className="h-8 w-8 text-ikpa-green-500" />
          </div>
          <h3 className="text-2xl font-bold mb-2">You&apos;re on the list!</h3>
          <p className="text-muted-foreground mb-6">
            You&apos;re #{success.position} on the waitlist. Check your email
            to verify and move up.
          </p>
          <div className="glass-card p-4 rounded-xl mb-6">
            <p className="text-sm text-muted-foreground mb-2">
              Your referral link:
            </p>
            <code className="text-sm text-ikpa-green-500">
              ikpa.app/r/{success.referralCode}
            </code>
          </div>
          <p className="text-sm text-muted-foreground">
            Share with friends to move up the waitlist!
          </p>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Input
                placeholder="Your name"
                {...form.register('firstName')}
                className="h-12"
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-error">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Select
                value={form.watch('country')}
                onValueChange={(value) => form.setValue('country', value)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NIGERIA">Nigeria 🇳🇬</SelectItem>
                  <SelectItem value="KENYA">Kenya 🇰🇪</SelectItem>
                  <SelectItem value="GHANA">Ghana 🇬🇭</SelectItem>
                  <SelectItem value="SOUTH_AFRICA">South Africa 🇿🇦</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              type="email"
              placeholder="your@email.com"
              {...form.register('email')}
              className="h-12"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-error">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {error && (
            <motion.div
              className="flex items-center gap-2 text-sm text-error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle className="h-4 w-4" />
              {error}
            </motion.div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full gradient-primary h-12"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Join the Waitlist
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By joining, you agree to our{' '}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
            . We&apos;ll only email you about Ikpa.
          </p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
```

### Referral Landing Page

```typescript
// apps/landing/app/r/[code]/page.tsx
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { WaitlistForm } from '@/components/waitlist/waitlist-form';
import { Logo } from '@/components/shared/logo';

interface Props {
  params: { code: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const referrer = await prisma.waitlistEntry.findUnique({
    where: { referralCode: params.code },
    select: { firstName: true },
  });

  const name = referrer?.firstName || 'A friend';

  return {
    title: `${name} invited you to Ikpa`,
    description: 'Join Ikpa and see your financial future. AI-powered personal finance for young Africans.',
    openGraph: {
      title: `${name} invited you to Ikpa`,
      description: 'Join Ikpa and see your financial future.',
    },
  };
}

export default async function ReferralPage({ params }: Props) {
  const referrer = await prisma.waitlistEntry.findUnique({
    where: { referralCode: params.code },
    select: { firstName: true, referralCode: true },
  });

  if (!referrer) {
    redirect('/waitlist');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-ikpa-green-500/10 via-background to-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="h-12 w-12 mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">
            {referrer.firstName || 'A friend'} thinks you&apos;d love Ikpa
          </h1>
          <p className="text-muted-foreground">
            Join the waitlist and both of you move up in line.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl">
          <WaitlistForm
            referralCode={referrer.referralCode}
            source="referral"
          />
        </div>
      </div>
    </div>
  );
}
```

### Email Service

```typescript
// apps/landing/lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Ikpa <hello@ikpa.app>';

export async function sendVerificationEmail(
  email: string,
  entryId: string
): Promise<void> {
  const verificationUrl = `https://ikpa.app/api/waitlist/verify?token=${generateToken(entryId)}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your spot on the Ikpa waitlist',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto;">
            <!-- Logo -->
            <div style="text-align: center; margin-bottom: 32px;">
              <img src="https://ikpa.app/logo.png" alt="Ikpa" width="48" height="48" />
            </div>

            <!-- Content -->
            <div style="background: linear-gradient(135deg, rgba(0, 168, 107, 0.1), rgba(0, 168, 107, 0.05)); border: 1px solid rgba(0, 168, 107, 0.2); border-radius: 16px; padding: 32px;">
              <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 16px; color: #FFFFFF;">
                Verify your email
              </h1>
              <p style="color: #A1A1AA; margin: 0 0 24px; line-height: 1.6;">
                Click the button below to verify your email and secure your spot on the Ikpa waitlist.
              </p>

              <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #00A86B, #008F5B); color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                Verify Email
              </a>

              <p style="color: #71717A; font-size: 14px; margin: 24px 0 0;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 32px; color: #71717A; font-size: 12px;">
              <p>Ikpa - See Your Financial Future</p>
              <p>Lagos, Nigeria</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}

export async function sendWelcomeEmail(
  email: string,
  firstName: string | null,
  referralCode: string
): Promise<void> {
  const referralLink = `https://ikpa.app/r/${referralCode}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Welcome to the Ikpa waitlist! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto;">
            <!-- Logo -->
            <div style="text-align: center; margin-bottom: 32px;">
              <img src="https://ikpa.app/logo.png" alt="Ikpa" width="48" height="48" />
            </div>

            <!-- Content -->
            <div style="background: linear-gradient(135deg, rgba(0, 168, 107, 0.1), rgba(0, 168, 107, 0.05)); border: 1px solid rgba(0, 168, 107, 0.2); border-radius: 16px; padding: 32px;">
              <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 16px; color: #FFFFFF;">
                You're in${firstName ? `, ${firstName}` : ''}! 🎉
              </h1>
              <p style="color: #A1A1AA; margin: 0 0 24px; line-height: 1.6;">
                Thanks for joining the Ikpa waitlist. We're building something special for young Africans who want to take control of their financial future.
              </p>

              <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #71717A; font-size: 14px; margin: 0 0 8px;">Move up the waitlist by sharing:</p>
                <p style="color: #00A86B; font-size: 14px; margin: 0; word-break: break-all;">${referralLink}</p>
              </div>

              <p style="color: #A1A1AA; font-size: 14px; line-height: 1.6; margin: 0;">
                Each friend who joins using your link moves you up one spot. The higher you are, the sooner you get access!
              </p>
            </div>

            <!-- Social -->
            <div style="text-align: center; margin-top: 24px;">
              <p style="color: #71717A; font-size: 14px; margin-bottom: 12px;">Share on:</p>
              <a href="https://twitter.com/intent/tweet?text=I%20just%20joined%20the%20Ikpa%20waitlist!%20It's%20an%20AI%20financial%20coach%20built%20for%20young%20Africans.%20Join%20me%3A%20${encodeURIComponent(referralLink)}" style="display: inline-block; margin: 0 8px; color: #00A86B; text-decoration: none;">Twitter</a>
              <a href="https://wa.me/?text=I%20just%20joined%20the%20Ikpa%20waitlist!%20It's%20an%20AI%20financial%20coach%20built%20for%20young%20Africans.%20Join%20me%3A%20${encodeURIComponent(referralLink)}" style="display: inline-block; margin: 0 8px; color: #00A86B; text-decoration: none;">WhatsApp</a>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 32px; color: #71717A; font-size: 12px;">
              <p>Ikpa - See Your Financial Future</p>
              <p>Lagos, Nigeria</p>
              <p style="margin-top: 16px;">
                <a href="https://ikpa.app/unsubscribe?email=${encodeURIComponent(email)}" style="color: #71717A; text-decoration: underline;">Unsubscribe</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}

function generateToken(entryId: string): string {
  // In production, use a proper JWT or signed token
  const payload = { id: entryId, exp: Date.now() + 24 * 60 * 60 * 1000 };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}
```

### Analytics Service

```typescript
// apps/landing/lib/analytics.ts
import { prisma } from './db';

interface EventData {
  [key: string]: string | number | boolean | undefined;
}

export async function trackEvent(
  event: string,
  data?: EventData
): Promise<void> {
  try {
    await prisma.waitlistAnalytics.create({
      data: {
        event,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      },
    });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Don't throw - analytics should never break the main flow
  }
}

export async function trackPageView(
  page: string,
  referrer?: string,
  userAgent?: string
): Promise<void> {
  await trackEvent('page_view', {
    page,
    referrer,
    userAgent,
  });
}

// Get waitlist stats for dashboard
export async function getWaitlistStats() {
  const [total, verified, today, referrals] = await Promise.all([
    prisma.waitlistEntry.count(),
    prisma.waitlistEntry.count({ where: { verified: true } }),
    prisma.waitlistEntry.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.waitlistEntry.aggregate({
      _sum: { referralCount: true },
    }),
  ]);

  return {
    total,
    verified,
    today,
    referrals: referrals._sum.referralCount || 0,
    verificationRate: total > 0 ? (verified / total) * 100 : 0,
  };
}

// Get top referrers
export async function getTopReferrers(limit = 10) {
  return prisma.waitlistEntry.findMany({
    where: { referralCount: { gt: 0 } },
    orderBy: { referralCount: 'desc' },
    take: limit,
    select: {
      firstName: true,
      email: true,
      referralCount: true,
      position: true,
    },
  });
}
```

### Utility Functions

```typescript
// apps/landing/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import crypto from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateReferralCode(email: string): string {
  // Create a short, unique code based on email + timestamp
  const hash = crypto
    .createHash('sha256')
    .update(`${email}${Date.now()}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();

  return hash;
}

export function generateToken(data: object, expiresIn: number = 24 * 60 * 60 * 1000): string {
  const payload = {
    ...data,
    exp: Date.now() + expiresIn,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function verifyToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());

    if (payload.exp < Date.now()) {
      return null; // Expired
    }

    return payload.id;
  } catch {
    return null;
  }
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
```

## Dependencies

### package.json

```json
{
  "name": "@ikpa/landing",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@prisma/client": "^5.10.2",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@vercel/analytics": "^1.2.2",
    "@vercel/speed-insights": "^1.0.10",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "framer-motion": "^11.0.8",
    "lucide-react": "^0.344.0",
    "next": "14.1.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.51.0",
    "resend": "^3.2.0",
    "tailwind-merge": "^2.2.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "@types/react": "^18.2.64",
    "@types/react-dom": "^18.2.21",
    "autoprefixer": "^10.4.18",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.1.3",
    "postcss": "^8.4.35",
    "prisma": "^5.10.2",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.2"
  }
}
```

## Related Modules

| Module | Relationship |
|--------|--------------|
| [Database Design](./01-database-design.md) | Waitlist schema |
| [UI Design System](./19-ui-design-system.md) | Shared design tokens |
| [Infrastructure](./20-infrastructure.md) | Deployment configuration |
| [Web PWA](./17-web-pwa.md) | Links to main app |
