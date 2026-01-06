# Web PWA

## Overview

The Ikpa web application is a Progressive Web App (PWA) built with Next.js 14, providing a full-featured financial management experience accessible from any browser. The PWA supports offline functionality, push notifications, and can be installed on desktop and mobile devices for a native-like experience.

## Technical Specifications

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework with App Router |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | latest | Component library |
| TanStack Query | 5.x | Server state management |
| Zustand | 4.x | Client state management |
| next-pwa | 5.x | PWA integration |
| Workbox | 7.x | Service worker tooling |

### Project Structure

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Dashboard
│   │   ├── transactions/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── income/
│   │   │   └── page.tsx
│   │   ├── expenses/
│   │   │   └── page.tsx
│   │   ├── savings/
│   │   │   └── page.tsx
│   │   ├── debts/
│   │   │   └── page.tsx
│   │   ├── family/
│   │   │   └── page.tsx
│   │   ├── goals/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── ai-coach/
│   │   │   └── page.tsx
│   │   ├── future-self/
│   │   │   └── page.tsx
│   │   ├── insights/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── api/
│   │   └── [...proxy]/
│   │       └── route.ts
│   ├── layout.tsx
│   ├── globals.css
│   ├── manifest.ts
│   └── sw.ts
├── components/
│   ├── ui/                              # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── sheet.tsx
│   │   ├── skeleton.tsx
│   │   ├── tabs.tsx
│   │   └── toast.tsx
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── mobile-nav.tsx
│   │   └── user-menu.tsx
│   ├── dashboard/
│   │   ├── metrics-overview.tsx
│   │   ├── cash-flow-chart.tsx
│   │   ├── recent-transactions.tsx
│   │   ├── goals-progress.tsx
│   │   └── ai-insights-card.tsx
│   ├── transactions/
│   │   ├── transaction-list.tsx
│   │   ├── transaction-form.tsx
│   │   └── transaction-filters.tsx
│   ├── ai/
│   │   ├── chat-interface.tsx
│   │   ├── message-bubble.tsx
│   │   └── quick-actions.tsx
│   ├── future-self/
│   │   ├── path-visualizer.tsx
│   │   ├── timeline-slider.tsx
│   │   └── letter-display.tsx
│   └── shared/
│       ├── currency-input.tsx
│       ├── date-picker.tsx
│       ├── loading-state.tsx
│       ├── empty-state.tsx
│       └── error-boundary.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── income.ts
│   │   ├── expenses.ts
│   │   ├── savings.ts
│   │   ├── debts.ts
│   │   ├── goals.ts
│   │   ├── metrics.ts
│   │   ├── ai.ts
│   │   └── future-self.ts
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-metrics.ts
│   │   ├── use-transactions.ts
│   │   ├── use-goals.ts
│   │   └── use-offline.ts
│   ├── stores/
│   │   ├── auth.store.ts
│   │   ├── ui.store.ts
│   │   └── offline.store.ts
│   ├── utils/
│   │   ├── format.ts
│   │   ├── currency.ts
│   │   ├── date.ts
│   │   └── cn.ts
│   └── constants.ts
├── public/
│   ├── icons/
│   │   ├── icon-72x72.png
│   │   ├── icon-96x96.png
│   │   ├── icon-128x128.png
│   │   ├── icon-144x144.png
│   │   ├── icon-152x152.png
│   │   ├── icon-192x192.png
│   │   ├── icon-384x384.png
│   │   └── icon-512x512.png
│   ├── screenshots/
│   │   ├── desktop-1.png
│   │   └── mobile-1.png
│   └── sw.js
├── styles/
│   └── themes.css
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Key Capabilities

### Core Features
- Full financial dashboard with real-time metrics
- Transaction management (income, expenses, savings, debts)
- AI Coach chat interface
- Future Self visualization with interactive timeline
- Goal tracking and progress monitoring
- Family support obligation management
- Pattern insights and recommendations

### PWA Features
- Installable on desktop and mobile
- Offline support with background sync
- Push notifications for alerts
- App-like navigation and transitions
- Persistent local storage
- Automatic updates

### Responsive Design
- Desktop-first layout with sidebar navigation
- Tablet-optimized views
- Mobile-responsive with bottom navigation
- Touch-friendly interactions

## Configuration

### Next.js Configuration

```typescript
// apps/web/next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.ikpa\.app\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ikpa/shared'],
  images: {
    domains: ['api.ikpa.app'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
```

### PWA Manifest

```typescript
// apps/web/app/manifest.ts
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ikpa - Your Financial Future Self',
    short_name: 'Ikpa',
    description: 'AI-powered personal finance for young Africans',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0A0A',
    theme_color: '#00A86B',
    orientation: 'portrait-primary',
    categories: ['finance', 'productivity', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/desktop-1.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Dashboard view',
      },
      {
        src: '/screenshots/mobile-1.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Mobile dashboard',
      },
    ],
    shortcuts: [
      {
        name: 'Add Transaction',
        short_name: 'Add',
        description: 'Quick add a new transaction',
        url: '/transactions?action=add',
        icons: [{ src: '/icons/add-icon.png', sizes: '96x96' }],
      },
      {
        name: 'AI Coach',
        short_name: 'Coach',
        description: 'Chat with your AI financial coach',
        url: '/ai-coach',
        icons: [{ src: '/icons/ai-icon.png', sizes: '96x96' }],
      },
    ],
    related_applications: [
      {
        platform: 'play',
        url: 'https://play.google.com/store/apps/details?id=app.ikpa',
        id: 'app.ikpa',
      },
      {
        platform: 'itunes',
        url: 'https://apps.apple.com/app/ikpa/id123456789',
      },
    ],
    prefer_related_applications: false,
  };
}
```

### Tailwind Configuration

```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Ikpa Brand Colors
        ikpa: {
          green: {
            DEFAULT: '#00A86B',
            50: '#E6F7F0',
            100: '#B3E8D4',
            200: '#80D9B8',
            300: '#4DCA9C',
            400: '#26BE85',
            500: '#00A86B',
            600: '#008F5B',
            700: '#00764B',
            800: '#005D3B',
            900: '#00442B',
          },
          gold: {
            DEFAULT: '#FFD700',
            50: '#FFFDE6',
            100: '#FFF9B3',
            200: '#FFF580',
            300: '#FFF14D',
            400: '#FFED26',
            500: '#FFD700',
            600: '#D9B700',
            700: '#B39700',
            800: '#8C7600',
            900: '#665600',
          },
        },
        // Semantic Colors
        success: '#00A86B',
        warning: '#FFD700',
        error: '#FF4D4D',
        info: '#3B82F6',
        // Dark Theme
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        // Display sizes
        'display-lg': ['3.5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'display-md': ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-sm': ['2rem', { lineHeight: '1.25', fontWeight: '600' }],
        // Body sizes
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body-md': ['1rem', { lineHeight: '1.5' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### Global Styles

```css
/* apps/web/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 156 100% 33%;
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 156 100% 33%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 0 0% 4%;
    --foreground: 0 0% 98%;
    --card: 0 0% 7%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 7%;
    --popover-foreground: 0 0% 98%;
    --primary: 156 100% 33%;
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 156 100% 33%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Glassmorphism utilities */
@layer utilities {
  .glass {
    @apply bg-white/10 backdrop-blur-md border border-white/20;
  }

  .glass-card {
    @apply bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl;
  }

  .glass-strong {
    @apply bg-white/20 backdrop-blur-lg border border-white/30;
  }

  /* Gradient backgrounds */
  .gradient-primary {
    @apply bg-gradient-to-br from-ikpa-green-500 to-ikpa-green-700;
  }

  .gradient-gold {
    @apply bg-gradient-to-br from-ikpa-gold-400 to-ikpa-gold-600;
  }

  .gradient-dark {
    @apply bg-gradient-to-br from-background to-card;
  }

  /* Text gradients */
  .text-gradient-primary {
    @apply bg-gradient-to-r from-ikpa-green-400 to-ikpa-green-600 bg-clip-text text-transparent;
  }

  .text-gradient-gold {
    @apply bg-gradient-to-r from-ikpa-gold-400 to-ikpa-gold-500 bg-clip-text text-transparent;
  }

  /* Cash flow score colors */
  .score-excellent {
    @apply text-ikpa-green-500;
  }

  .score-good {
    @apply text-ikpa-green-400;
  }

  .score-fair {
    @apply text-ikpa-gold-500;
  }

  .score-poor {
    @apply text-error;
  }
}

/* Scrollbar styling */
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted)) transparent;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: hsl(var(--muted));
    border-radius: 3px;
  }
}

/* Page transitions */
@layer utilities {
  .page-enter {
    animation: page-enter 0.3s ease-out;
  }

  @keyframes page-enter {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```

## Implementation Guide

### Root Layout

```typescript
// apps/web/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/toaster';
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
    default: 'Ikpa - Your Financial Future Self',
    template: '%s | Ikpa',
  },
  description: 'AI-powered personal finance for young Africans',
  keywords: ['finance', 'budget', 'savings', 'africa', 'ai', 'money'],
  authors: [{ name: 'Ikpa' }],
  creator: 'Ikpa',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://app.ikpa.app',
    title: 'Ikpa - Your Financial Future Self',
    description: 'AI-powered personal finance for young Africans',
    siteName: 'Ikpa',
    images: [
      {
        url: 'https://app.ikpa.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Ikpa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ikpa - Your Financial Future Self',
    description: 'AI-powered personal finance for young Africans',
    images: ['https://app.ikpa.app/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ikpa',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
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
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body
        className={`${inter.variable} ${jakarta.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### API Client

```typescript
// apps/web/lib/api/client.ts
import { useAuthStore } from '@/lib/stores/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAccessToken(): Promise<string | null> {
    const { accessToken, refreshToken, setTokens, logout } =
      useAuthStore.getState();

    if (accessToken) {
      // Check if token is expired (with 30s buffer)
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        if (payload.exp * 1000 > Date.now() + 30000) {
          return accessToken;
        }
      } catch {
        // Token parsing failed, try refresh
      }
    }

    // Need to refresh
    if (!refreshToken) {
      logout();
      return null;
    }

    // Deduplicate refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshAccessToken(refreshToken)
      .then((tokens) => {
        if (tokens) {
          setTokens(tokens.accessToken, tokens.refreshToken);
          return tokens.accessToken;
        }
        logout();
        return null;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.data;
    } catch {
      return null;
    }
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...init } = options;
    const url = this.buildUrl(endpoint, params);

    const token = await this.getAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...init.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    const data = await response.json();
    return data.data as T;
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
```

### Auth Store

```typescript
// apps/web/lib/stores/auth.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  currency: string;
  profilePicture?: string;
  onboardingCompleted: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: 'ikpa-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
```

### Query Provider

```typescript
// apps/web/components/providers/query-provider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (error instanceof Error && error.message.includes('40')) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Dashboard Layout

```typescript
// apps/web/app/(dashboard)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { useAuthStore } from '@/lib/stores/auth.store';
import { api } from '@/lib/api/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, setUser, setLoading, logout } =
    useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const user = await api.get<User>('/users/me');
        setUser(user);

        if (!user.onboardingCompleted) {
          router.replace('/onboarding');
        }
      } catch (error) {
        logout();
        router.replace('/login');
      }
    };

    if (!isLoading) {
      initAuth();
    } else {
      setLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse">
          <div className="h-12 w-12 rounded-full gradient-primary" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <div className="mx-auto max-w-7xl page-enter">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav className="lg:hidden" />
    </div>
  );
}
```

### Sidebar Component

```typescript
// apps/web/components/layout/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  ArrowUpDown,
  Wallet,
  PiggyBank,
  CreditCard,
  Users,
  Target,
  Bot,
  Sparkles,
  TrendingUp,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: ArrowUpDown },
  { name: 'Income', href: '/income', icon: Wallet },
  { name: 'Expenses', href: '/expenses', icon: CreditCard },
  { name: 'Savings', href: '/savings', icon: PiggyBank },
  { name: 'Debts', href: '/debts', icon: CreditCard },
  { name: 'Family Support', href: '/family', icon: Users },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'AI Coach', href: '/ai-coach', icon: Bot },
  { name: 'Future Self', href: '/future-self', icon: Sparkles },
  { name: 'Insights', href: '/insights', icon: TrendingUp },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex w-64 flex-col border-r border-border bg-card',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary" />
          <span className="font-display text-xl font-bold">Ikpa</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto scrollbar-thin">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="border-t border-border p-4">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
```

### Mobile Navigation

```typescript
// apps/web/components/layout/mobile-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  ArrowUpDown,
  Bot,
  Target,
  Menu,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from './sidebar';

const tabs = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Activity', href: '/transactions', icon: ArrowUpDown },
  { name: 'Coach', href: '/ai-coach', icon: Bot },
  { name: 'Goals', href: '/goals', icon: Target },
];

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex items-center justify-around px-2 py-2 safe-area-pb">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/' && pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{tab.name}</span>
            </Link>
          );
        })}

        {/* More menu */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center gap-1 px-3 py-1.5 text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
              <span className="text-xs font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
```

### Dashboard Page

```typescript
// apps/web/app/(dashboard)/page.tsx
'use client';

import { MetricsOverview } from '@/components/dashboard/metrics-overview';
import { CashFlowChart } from '@/components/dashboard/cash-flow-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { GoalsProgress } from '@/components/dashboard/goals-progress';
import { AIInsightsCard } from '@/components/dashboard/ai-insights-card';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Your financial overview at a glance
        </p>
      </div>

      {/* Metrics */}
      <MetricsOverview />

      {/* Charts and Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CashFlowChart />
        <RecentTransactions />
      </div>

      {/* Goals and AI */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GoalsProgress />
        <AIInsightsCard />
      </div>
    </div>
  );
}
```

### Metrics Overview Component

```typescript
// apps/web/components/dashboard/metrics-overview.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils/cn';

interface Metrics {
  cashFlowScore: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  runwayMonths: number;
  netWorth: number;
  trends: {
    income: number;
    expenses: number;
    savings: number;
  };
}

export function MetricsOverview() {
  const { data: metrics, isLoading } = useQuery<Metrics>({
    queryKey: ['metrics'],
    queryFn: () => api.get('/metrics'),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const scoreColor = (score: number) => {
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-fair';
    return 'score-poor';
  };

  const cards = [
    {
      title: 'Cash Flow Score',
      value: metrics.cashFlowScore,
      suffix: '/100',
      icon: TrendingUp,
      trend: null,
      className: scoreColor(metrics.cashFlowScore),
    },
    {
      title: 'Monthly Income',
      value: formatCurrency(metrics.totalIncome),
      icon: Wallet,
      trend: metrics.trends.income,
      trendLabel: 'vs last month',
    },
    {
      title: 'Monthly Expenses',
      value: formatCurrency(metrics.totalExpenses),
      icon: TrendingDown,
      trend: metrics.trends.expenses,
      trendLabel: 'vs last month',
      invertTrend: true,
    },
    {
      title: 'Runway',
      value: metrics.runwayMonths.toFixed(1),
      suffix: ' months',
      icon: Calendar,
      trend: null,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{card.title}</span>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className={cn('text-2xl font-bold', card.className)}>
              {card.value}
              {card.suffix && (
                <span className="text-lg font-normal text-muted-foreground">
                  {card.suffix}
                </span>
              )}
            </div>
            {card.trend !== null && (
              <div
                className={cn(
                  'flex items-center gap-1 text-sm mt-1',
                  card.invertTrend
                    ? card.trend > 0
                      ? 'text-error'
                      : 'text-success'
                    : card.trend > 0
                    ? 'text-success'
                    : 'text-error'
                )}
              >
                {card.trend > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(card.trend).toFixed(1)}%</span>
                <span className="text-muted-foreground">{card.trendLabel}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### AI Coach Chat Interface

```typescript
// apps/web/app/(dashboard)/ai-coach/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  messages: Message[];
}

const quickActions = [
  { label: 'Spending Review', prompt: 'Review my spending this month' },
  { label: 'Savings Tips', prompt: 'How can I save more money?' },
  { label: 'Debt Strategy', prompt: "What's the best way to pay off my debts?" },
  { label: 'Goal Planning', prompt: 'Help me plan for my financial goals' },
];

export default function AICoachPage() {
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation
  const { data: conversation, isLoading } = useQuery<Conversation>({
    queryKey: ['ai-conversation', conversationId],
    queryFn: () =>
      conversationId
        ? api.get(`/ai/conversations/${conversationId}`)
        : api.post('/ai/conversations'),
    enabled: true,
  });

  // Update conversation ID when created
  useEffect(() => {
    if (conversation?.id && !conversationId) {
      setConversationId(conversation.id);
    }
  }, [conversation?.id]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      return api.post<Message>(`/ai/conversations/${conversationId}/messages`, {
        message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['ai-conversation', conversationId],
      });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;

    const message = input.trim();
    setInput('');

    // Optimistic update
    queryClient.setQueryData<Conversation>(
      ['ai-conversation', conversationId],
      (old) => ({
        ...old!,
        messages: [
          ...(old?.messages || []),
          {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: message,
            createdAt: new Date().toISOString(),
          },
        ],
      })
    );

    await sendMessage.mutateAsync(message);
    inputRef.current?.focus();
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          AI Coach
        </h1>
        <p className="text-muted-foreground">
          Your personal financial advisor, powered by AI
        </p>
      </div>

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col glass-card overflow-hidden">
        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : conversation?.messages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="h-12 w-12 text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">
                Start a Conversation
              </h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Ask me anything about your finances, spending habits, or savings
                goals.
              </p>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action.prompt)}
                    className="text-left h-auto py-2"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {conversation?.messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {sendMessage.isPending && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" />
                      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              disabled={sendMessage.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
```

### Service Worker for Offline Support

```typescript
// apps/web/public/sw-custom.js
// Custom service worker logic (merged with next-pwa generated sw.js)

// Background sync for pending mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  const cache = await caches.open('pending-mutations');
  const requests = await cache.keys();

  for (const request of requests) {
    try {
      const response = await fetch(request.clone());
      if (response.ok) {
        await cache.delete(request);
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Ikpa', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
```

### Offline Hook

```typescript
// apps/web/lib/hooks/use-offline.ts
'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

export function useOffline() {
  const [isOffline, setIsOffline] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Initial check
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      toast({
        title: 'Back online',
        description: 'Your connection has been restored',
      });

      // Trigger background sync
      if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.sync.register('sync-transactions');
        });
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast({
        title: 'You are offline',
        description: 'Changes will be synced when you reconnect',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  return { isOffline };
}
```

### Utility Functions

```typescript
// apps/web/lib/utils/cn.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// apps/web/lib/utils/currency.ts
const currencyFormatters: Record<string, Intl.NumberFormat> = {};

export function formatCurrency(
  amount: number,
  currency: string = 'NGN',
  compact: boolean = false
): string {
  const key = `${currency}-${compact}`;

  if (!currencyFormatters[key]) {
    currencyFormatters[key] = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    });
  }

  return currencyFormatters[key].format(amount);
}

export function parseCurrency(value: string): number {
  // Remove currency symbols and formatting
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

// apps/web/lib/utils/date.ts
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isToday(d)) {
    return `Today, ${format(d, 'h:mm a')}`;
  }

  if (isYesterday(d)) {
    return `Yesterday, ${format(d, 'h:mm a')}`;
  }

  return format(d, 'MMM d, yyyy');
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}
```

## Dependencies

### package.json

```json
{
  "name": "@ikpa/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-sheet": "^1.0.5",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@tanstack/react-query": "^5.28.4",
    "@tanstack/react-query-devtools": "^5.28.4",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "cmdk": "^0.2.1",
    "date-fns": "^3.3.1",
    "lucide-react": "^0.344.0",
    "next": "14.1.3",
    "next-pwa": "^5.6.0",
    "next-themes": "^0.2.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.51.0",
    "recharts": "^2.12.2",
    "tailwind-merge": "^2.2.1",
    "tailwindcss-animate": "^1.0.7",
    "workbox-window": "^7.0.0",
    "zod": "^3.22.4",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "@types/react": "^18.2.64",
    "@types/react-dom": "^18.2.21",
    "autoprefixer": "^10.4.18",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.1.3",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.2"
  }
}
```

## Related Modules

| Module | Relationship |
|--------|--------------|
| [API Foundation](./02-api-foundation.md) | Backend API consumption |
| [Authentication](./03-authentication.md) | User auth flow |
| [Financial Metrics](./10-financial-metrics.md) | Dashboard metrics display |
| [AI Service](./14-ai-service.md) | AI Coach chat |
| [Future Self Engine](./15-future-self-engine.md) | Path visualization |
| [UI Design System](./19-ui-design-system.md) | Shared design tokens |
| [Mobile App](./16-mobile-app.md) | Shared API patterns |
