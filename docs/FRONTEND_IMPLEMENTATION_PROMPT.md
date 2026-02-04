# IKPA Frontend Implementation Guide

> **Purpose:** This document provides comprehensive prompts for a coding agent to implement the IKPA web frontend, one feature at a time. Each section is self-contained and can be passed to the agent independently.

---

## Table of Contents

1. [Foundation Setup](#1-foundation-setup)
2. [Dashboard - Cash Flow Score](#2-dashboard---cash-flow-score)
3. [AI Chat Interface](#3-ai-chat-interface)
4. [Future Self Simulator](#4-future-self-simulator)
5. [Transaction Management](#5-transaction-management)
6. [Goals & Commitments](#6-goals--commitments)
7. [Subscription Auditor (Shark)](#7-subscription-auditor-shark)
8. [GPS Recovery Paths](#8-gps-recovery-paths)
9. [Story Cards](#9-story-cards)
10. [Settings & Profile](#10-settings--profile)

---

## Global Context (Include with Every Feature)

```markdown
## Project Context

You are implementing the frontend for IKPA, an AI-powered personal finance app.

### IMPORTANT: Design Reference
**Before implementing any UI, read the design guide:**
- **File:** `ikpa-ui-guide.md` (in project root)
- **Contains:** Complete design system with colors, typography, spacing, components, animations, and screen layouts
- **Sections to reference:** Color System (§4), Typography (§5), Component Design (§8), Motion Design (§9), Data Visualization (§10), Mobile-First Design (§13), Dark Mode (§14)

Always consult `ikpa-ui-guide.md` for detailed specifications on any UI element.

### Tech Stack
- **Framework:** Next.js 15.1.3 (App Router)
- **UI:** React 19, TailwindCSS 3.4.17
- **State:** Zustand 5.0.2
- **Data Fetching:** TanStack React Query 5.62.7
- **Charts:** Recharts 2.15.0
- **Icons:** Lucide React (install if needed)
- **Animations:** Framer Motion (install if needed)

### API Base URL
- Development: `http://localhost:3000`
- Environment variable: `NEXT_PUBLIC_API_URL`

### Design Philosophy
1. **Clarity over cleverness** - Information hierarchy is immediately clear
2. **Progressive disclosure** - Show essentials first, details on demand
3. **Celebrate progress** - Acknowledge every positive step
4. **Non-judgmental** - No shame-inducing language or red colors for negatives

### Color System (TailwindCSS)
```css
/* Primary - Emerald/Green for growth */
primary-500: #10B981
primary-600: #059669
primary-700: #047857

/* Secondary - Amber/Gold for achievements */
secondary-500: #F59E0B
secondary-600: #D97706

/* Caution - Orange (NOT red) */
caution-500: #F97316

/* Info - Blue */
info-500: #3B82F6

/* Backgrounds */
light-bg: #FFFFFF
light-bg-secondary: #F9FAFB
light-bg-tertiary: #F3F4F6

dark-bg: #0F172A
dark-bg-secondary: #1E293B
dark-bg-tertiary: #334155
```

### Typography
- **Primary Font:** Inter (UI, numbers)
- **Display Font:** Plus Jakarta Sans (headlines)
- **Financial Numbers:** Use `font-feature-settings: "tnum"` for tabular figures

### Key Rules
- ❌ NEVER use red (#EF4444) for negative financial metrics - use orange
- ❌ NEVER use shame words: "wasted," "bad," "failed," "irresponsible"
- ✅ Use glassmorphism for cards: `bg-white/70 backdrop-blur-xl`
- ✅ Border radius: 12px for buttons, 16px for cards
- ✅ Animations: 150-250ms, ease-out for enters, ease-in for exits
- ✅ Mobile-first: Design for 375px width, then scale up
```

---

## 1. Foundation Setup

### Prompt

```markdown
## Task: Set Up IKPA Frontend Foundation

Implement the foundational UI system for the IKPA web app.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §3 Design System Foundation
- §4 Color System (full palette with hex codes)
- §5 Typography (font families, sizes, weights)
- §7 Layout Principles (grid system, spacing scale)
- §17 Design Tokens

### Files to Create/Modify

1. **`apps/web/tailwind.config.ts`** - Extended theme with IKPA colors
2. **`apps/web/src/app/globals.css`** - Global styles, fonts, CSS variables
3. **`apps/web/src/lib/api.ts`** - API client with React Query setup
4. **`apps/web/src/stores/auth.store.ts`** - Zustand auth store
5. **`apps/web/src/stores/user.store.ts`** - Zustand user/financial data store
6. **`apps/web/src/components/ui/`** - Base UI components

### 1. Tailwind Config

Extend the default config with IKPA's design tokens:

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981', // Main primary
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        secondary: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B', // Main secondary (gold)
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        caution: {
          500: '#F97316', // Orange, NOT red
          600: '#EA580C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

### 2. Global CSS

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 255 255 255;
    --foreground: 17 24 39;
  }

  .dark {
    --background: 15 23 42;
    --foreground: 249 250 251;
  }

  body {
    @apply bg-white text-gray-900 dark:bg-slate-900 dark:text-gray-50;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Tabular numbers for financial data */
  .tabular-nums {
    font-feature-settings: "tnum" 1;
  }
}

@layer components {
  /* Glassmorphism card */
  .glass-card {
    @apply bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl;
    @apply border border-white/30 dark:border-slate-700/50;
    @apply rounded-2xl shadow-lg;
  }

  /* Primary button */
  .btn-primary {
    @apply bg-gradient-to-r from-primary-500 to-primary-600;
    @apply text-white font-medium rounded-xl px-6 py-3;
    @apply shadow-lg shadow-primary-500/30;
    @apply hover:shadow-xl hover:shadow-primary-500/40;
    @apply active:scale-[0.98] transition-all duration-150;
  }

  /* Secondary button */
  .btn-secondary {
    @apply bg-primary-500/10 text-primary-600 dark:text-primary-400;
    @apply border border-primary-500/30 rounded-xl px-6 py-3;
    @apply hover:bg-primary-500/20 transition-colors;
  }

  /* Ghost button */
  .btn-ghost {
    @apply text-gray-600 dark:text-gray-400 rounded-xl px-6 py-3;
    @apply hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors;
  }
}
```

### 3. API Client

```typescript
// lib/api.ts
import { QueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
```

### 4. Base UI Components to Create

Create these in `components/ui/`:

- `Button.tsx` - Primary, secondary, ghost variants
- `Card.tsx` - Glass card with optional header/footer
- `Input.tsx` - Form input with label, error state, currency prefix
- `Badge.tsx` - Status badges
- `Spinner.tsx` - Loading spinner
- `Skeleton.tsx` - Loading skeleton
- `Modal.tsx` - Modal/dialog component

Each component should:
- Support dark mode
- Use the design tokens from tailwind config
- Accept className prop for customization
- Be properly typed with TypeScript

### Acceptance Criteria

- [ ] Tailwind config includes all IKPA colors
- [ ] Fonts (Inter, Plus Jakarta Sans) load correctly
- [ ] Glass card style renders with blur effect
- [ ] Button variants look correct
- [ ] API client can make authenticated requests
- [ ] Dark mode toggles correctly
```

---

## 2. Dashboard - Cash Flow Score

### Prompt

```markdown
## Task: Implement the Dashboard with Cash Flow Score

Create the main dashboard showing the user's financial health.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §8.1 Card Components (Metric Card design)
- §10.2 Chart Types (Cash Flow Score Gauge)
- §13.2 Screen Layouts (Dashboard Mobile layout)
- §8.4 Navigation Components (Bottom Navigation)
- §9.3 Micro-Interactions (Number animations)

### API Endpoints

```
GET /v1/metrics/score
Response: {
  score: number;           // 0-100
  previousScore: number;
  change: number;          // e.g., +5 or -3
  breakdown: {
    savingsRate: { value: number; score: number; weight: 30 };
    runwayMonths: { value: number; score: number; weight: 25 };
    debtToIncome: { value: number; score: number; weight: 20 };
    incomeStability: { value: number; score: number; weight: 15 };
    dependencyRatio: { value: number; score: number; weight: 10 };
  };
  status: 'THRIVING' | 'STABLE' | 'CAUTION' | 'STRESS' | 'CRISIS';
  lastUpdated: string;
}

GET /v1/finance/summary
Response: {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  savingsRate: number;
  currency: string;
}

GET /v1/transactions/recent?limit=5
Response: {
  transactions: Array<{
    id: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    description: string;
    date: string;
  }>;
}
```

### Files to Create

1. `apps/web/src/app/(dashboard)/page.tsx` - Dashboard page
2. `apps/web/src/app/(dashboard)/layout.tsx` - Dashboard layout with nav
3. `apps/web/src/components/dashboard/CashFlowScoreGauge.tsx`
4. `apps/web/src/components/dashboard/MetricCard.tsx`
5. `apps/web/src/components/dashboard/QuickActions.tsx`
6. `apps/web/src/components/dashboard/RecentTransactions.tsx`
7. `apps/web/src/components/dashboard/AIInsightCard.tsx`
8. `apps/web/src/components/navigation/BottomNav.tsx`
9. `apps/web/src/hooks/useCashFlowScore.ts`
10. `apps/web/src/hooks/useFinancialSummary.ts`

### Cash Flow Score Gauge Design

```
         ╭───────────────╮
       ╱                   ╲
      ╱   ┌───────────┐    ╲
     │    │    78     │     │
      ╲   │Cash Flow  │    ╱
       ╲  │  Score    │   ╱
         ╰───────────────╯
         +5 from last month
```

- Semi-circular gauge (180 degrees)
- Gradient: Orange (0) → Yellow (50) → Green (100)
- Large center number with animated count-up
- Status text below
- Subtle glow at current position
- Use Recharts PieChart with custom shape or SVG

### Score Status Colors

| Range | Status | Color |
|-------|--------|-------|
| 80-100 | THRIVING | #10B981 (primary-500) |
| 60-79 | STABLE | #34D399 (primary-400) |
| 40-59 | CAUTION | #FBBF24 (secondary-400) |
| 20-39 | STRESS | #F97316 (caution-500) |
| 0-19 | CRISIS | #F97316 (caution-500) |

### Metric Cards Layout

```
┌───────────┐ ┌───────────┐
│  $1,500   │ │   15.2%   │
│  Saved    │ │  Savings  │
│  +$230 ↗  │ │   Rate    │
└───────────┘ └───────────┘
```

- 2-column grid on mobile
- Show trend arrow (↗ or ↘) with color
- Tap to see breakdown

### Quick Actions

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│  +  │ │  ?  │ │  📊 │ │  🎯 │
│ Add │ │ Ask │ │View │ │Goals│
└─────┘ └─────┘ └─────┘ └─────┘
```

- Icon buttons in a row
- Haptic-style feedback on press
- Link to respective features

### Bottom Navigation

```
┌─────────────────────────────────────────┐
│  🏠     💳      🤖      🎯      👤     │
│ Home  Trans    AI    Goals  Profile    │
└─────────────────────────────────────────┘
```

- Fixed at bottom
- Glass background
- Active state: green icon + dot below
- Height: 64px + safe area

### Mobile Layout (375px)

```
┌─────────────────────────────────────────┐
│ Good morning, [Name] 👋          🔔 ⚙️ │
├─────────────────────────────────────────┤
│                                         │
│   ┌─────────────────────────────────┐   │
│   │           78                    │   │
│   │      Cash Flow Score            │   │
│   │      +5 this month ↗            │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌───────────┐ ┌───────────┐          │
│   │  $1,500   │ │   15.2%   │          │
│   │  Saved    │ │  Savings  │          │
│   └───────────┘ └───────────┘          │
│                                         │
│   Quick Actions                         │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│   │  +  │ │  ?  │ │  📊 │ │  🎯 │     │
│   └─────┘ └─────┘ └─────┘ └─────┘     │
│                                         │
│   Recent Transactions          See all  │
│   ┌─────────────────────────────────┐   │
│   │ 🍽️ Restaurant        -$35.00   │   │
│   │ 💳 Salary           +$5,000    │   │
│   └─────────────────────────────────┘   │
│                                         │
│   💡 AI Insight                         │
│   ┌─────────────────────────────────┐   │
│   │ Your food spending is 23%       │   │
│   │ higher this week...             │   │
│   └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  🏠     💳      🤖      🎯      👤     │
└─────────────────────────────────────────┘
```

### Acceptance Criteria

- [ ] Cash Flow Score gauge animates on load
- [ ] Score color matches status range
- [ ] Metric cards show real data from API
- [ ] Recent transactions list is scrollable
- [ ] Bottom navigation highlights active tab
- [ ] Pull-to-refresh updates data
- [ ] Loading states show skeletons
- [ ] Error states are handled gracefully
- [ ] Works on mobile (375px) and desktop
```

---

## 3. AI Chat Interface

### Prompt

```markdown
## Task: Implement the AI Chat Interface

Create the conversational AI interface for IKPA's financial coaching.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §8.1 Card Components (Glass card for messages)
- §9.3 Micro-Interactions (Typing indicator)
- §5 Typography (Message text styles)
- §4 Color System (User vs AI message colors)
- §9.4 Page Transitions (Message animations)

### API Endpoints

```
POST /v1/ai/chat
Request: {
  message: string;
  conversationId?: string;
}
Response: {
  response: string;
  conversationId: string;
  agentsUsed: string[];  // e.g., ['shark-auditor', 'gps-rerouter']
  suggestions?: string[];
  actionItems?: Array<{
    type: string;
    title: string;
    action: string;
  }>;
}

GET /v1/ai/conversations
Response: {
  conversations: Array<{
    id: string;
    title: string;
    lastMessage: string;
    updatedAt: string;
  }>;
}
```

### Files to Create

1. `apps/web/src/app/(dashboard)/chat/page.tsx`
2. `apps/web/src/components/chat/ChatInterface.tsx`
3. `apps/web/src/components/chat/MessageBubble.tsx`
4. `apps/web/src/components/chat/ChatInput.tsx`
5. `apps/web/src/components/chat/SuggestionChips.tsx`
6. `apps/web/src/components/chat/ActionCard.tsx`
7. `apps/web/src/components/chat/TypingIndicator.tsx`
8. `apps/web/src/hooks/useChat.ts`
9. `apps/web/src/stores/chat.store.ts`

### Chat Interface Design

```
┌─────────────────────────────────────────┐
│ ←  IKPA AI Coach                   •••  │
├─────────────────────────────────────────┤
│                                         │
│   ┌─────────────────────────────────┐   │
│   │ 🤖 Hi! I'm your IKPA coach.    │   │
│   │    How can I help you today?   │   │
│   └─────────────────────────────────┘   │
│                                         │
│       ┌─────────────────────────────┐   │
│       │ I keep failing to save      │   │
│       │ money. What should I do?    │   │
│       └─────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │ 🤖 I understand. Let me help   │   │
│   │    you figure this out...      │   │
│   │                                 │   │
│   │ I found 3 subscriptions you    │   │
│   │ might have forgotten about,    │   │
│   │ totaling $127/month.           │   │
│   │                                 │   │
│   │ ┌─────────────────────────┐    │   │
│   │ │ 📋 Review Subscriptions │    │   │
│   │ └─────────────────────────┘    │   │
│   │                                 │   │
│   │ Would you like to see them?    │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌────────────────────────────────┐    │
│   │ Show me │ Tips │ Future self   │    │
│   └────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│ ┌───────────────────────────────┐  📤  │
│ │ Type a message...             │       │
│ └───────────────────────────────┘       │
└─────────────────────────────────────────┘
```

### Message Bubble Styles

**AI Messages (left-aligned):**
- Background: Glass card style
- Avatar: IKPA logo/icon
- Max-width: 80%
- Border-radius: 16px 16px 16px 4px

**User Messages (right-aligned):**
- Background: primary-500 gradient
- Text: white
- Max-width: 80%
- Border-radius: 16px 16px 4px 16px

### Typing Indicator

```
┌─────────────────────────────────┐
│ 🤖 ●●●                         │
└─────────────────────────────────┘
```

- Three dots with staggered animation
- Pulse/bounce effect

### Suggestion Chips

```
┌────────────┐ ┌────────────┐ ┌────────────┐
│ Show me    │ │ Give tips  │ │ Future self│
└────────────┘ └────────────┘ └────────────┘
```

- Horizontal scroll if overflow
- Tap to send as message
- Outline style, primary color

### Action Cards (inline in messages)

```
┌─────────────────────────────┐
│ 📋 Review Subscriptions     │
│    Found 3 unused services  │
│                    View →   │
└─────────────────────────────┘
```

- Tappable, links to relevant feature
- Icon + title + subtitle

### Features

1. **Streaming responses** (if API supports) or typing indicator
2. **Conversation history** persisted
3. **Agent badges** - Show which agents contributed
4. **Quick suggestions** - Context-aware chips
5. **Action cards** - Deep links to features
6. **Markdown support** - For formatted responses

### Acceptance Criteria

- [ ] Messages appear in real-time
- [ ] Typing indicator shows while waiting
- [ ] Suggestion chips are tappable
- [ ] Action cards link to correct features
- [ ] Conversation persists across sessions
- [ ] Auto-scroll to newest message
- [ ] Input clears after sending
- [ ] Works on mobile keyboard
```

---

## 4. Future Self Simulator

### Prompt

```markdown
## Task: Implement the Future Self Simulator

Create the signature Future Self feature with dual-path visualization and letters.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §12 The Future Self Engine UI (COMPLETE SECTION - this is the signature feature)
- §12.1 Future Self Visual Design (Path comparison view)
- §12.2 Narrative Cards (Current vs Optimized path cards)
- §12.3 Letter From Future Self (Letter interface design)
- §10.2 Chart Types (Future Projection dual line chart)
- §9.5 Celebration Animations (Achievement moments)

### API Endpoints

```
POST /v1/future-self/simulate
Request: {
  horizonYears?: number;  // default 10
}
Response: {
  currentPath: {
    netWorth: number[];         // Array of values over time
    milestones: Milestone[];
    probability: number;
  };
  optimizedPath: {
    netWorth: number[];
    milestones: Milestone[];
    probability: number;
    monthlySavingsRequired: number;
  };
  timePoints: string[];         // ["Now", "5yr", "10yr", ...]
  difference: {
    amount: number;
    percentage: number;
  };
}

POST /v1/future-self/letter
Request: {
  pathType: 'current' | 'optimized';
  horizonYears: number;
}
Response: {
  letter: string;
  generatedAt: string;
  pathType: string;
}

GET /v1/future-self/history
Response: {
  letters: Array<{
    id: string;
    pathType: string;
    horizonYears: number;
    preview: string;
    createdAt: string;
  }>;
}
```

### Files to Create

1. `apps/web/src/app/(dashboard)/future-self/page.tsx`
2. `apps/web/src/components/future-self/PathComparisonChart.tsx`
3. `apps/web/src/components/future-self/TimeSlider.tsx`
4. `apps/web/src/components/future-self/PathCard.tsx`
5. `apps/web/src/components/future-self/LetterModal.tsx`
6. `apps/web/src/components/future-self/LetterCard.tsx`
7. `apps/web/src/hooks/useFutureSelf.ts`

### Path Comparison View

```
┌─────────────────────────────────────────┐
│ ←  Your Financial Future                │
├─────────────────────────────────────────┤
│                                         │
│                         ★ Optimized     │
│                       ╱╱                │
│                    ╱╱╱                  │
│                 ╱╱╱                     │
│              ╱╱╱                        │
│           ╱╱╱───── Current              │
│        ╱╱╱                              │
│     ╱╱╱                                 │
│  ●                                      │
│ You                                     │
│                                         │
│  Now    5yr    10yr    15yr    20yr    │
│         ◄══════════════════►           │
│              TIME SLIDER                │
│                                         │
│ ┌─────────────┐  ┌─────────────┐       │
│ │ CURRENT     │  │ OPTIMIZED   │       │
│ │             │  │      ✨     │       │
│ │   $42,000   │  │  $284,000   │       │
│ │  Net Worth  │  │  Net Worth  │       │
│ │             │  │             │       │
│ │ [Read Story]│  │ [Read Story]│       │
│ └─────────────┘  └─────────────┘       │
│                                         │
│   The difference: $670/month            │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │   📨 Get Letter From Future     │   │
│   └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Chart Design

- Use Recharts AreaChart with two areas
- Current path: Solid line, muted green
- Optimized path: Gradient fill, bright green
- Animated draw-in on load
- Interactive: tap to see value at point
- Time slider scrubs through both paths

### Time Slider

```
◄═══════════●══════════════════════►
         10 years
```

- Draggable thumb
- Updates chart focus point
- Shows values at selected time

### Path Cards

**Current Path Card:**
- White background
- Muted styling
- Shows realistic projection

**Optimized Path Card:**
- Golden/amber border glow
- Star/sparkle indicator
- Shows aspirational projection

### Letter Modal

```
┌─────────────────────────────────────────┐
│           📨 Letter From Your           │
│              Future Self                │
│                                         │
│  ╭────────────────────────────────────╮ │
│  │                                    │ │
│  │  Dear [Name],                      │ │
│  │                                    │ │
│  │  I'm writing to you from 10       │ │
│  │  years in the future...           │ │
│  │                                    │ │
│  │  [Letter content with personal    │ │
│  │   details about their journey]    │ │
│  │                                    │ │
│  │  With pride,                      │ │
│  │  Future [Name]                    │ │
│  │                                    │ │
│  ╰────────────────────────────────────╯ │
│                                         │
│  [Save Letter]  [Share]  [My Plan]      │
│                                         │
└─────────────────────────────────────────┘
```

- Paper/letter texture (subtle background)
- Animated text reveal (optional)
- Share button generates image card
- Emotional, personal design

### Animations

1. **Chart draw-in:** Lines animate from left to right
2. **Path divergence:** Show split point with animation
3. **Number count-up:** Values animate when changing
4. **Letter reveal:** Text fades in paragraph by paragraph

### Acceptance Criteria

- [ ] Dual-path chart renders correctly
- [ ] Time slider updates chart values
- [ ] Path cards show correct projections
- [ ] Letter generates with personalized content
- [ ] Letter modal has emotional design
- [ ] Share creates shareable image
- [ ] Loading states during API calls
- [ ] Works on mobile (responsive chart)
```

---

## 5. Transaction Management

### Prompt

```markdown
## Task: Implement Transaction Management

Create the transaction list, entry, and categorization features.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §8.1 Card Components (Transaction Card design)
- §8.3 Form Components (Input fields, validation)
- §6.2 Category Icons (Income and Expense categories)
- §13.2 Screen Layouts (Transaction Entry mobile layout)
- §13.3 Gesture Patterns (Swipe to edit/delete)

### API Endpoints

```
GET /v1/transactions?page=1&limit=20&type=EXPENSE
Response: {
  transactions: Transaction[];
  pagination: { page: number; total: number; hasMore: boolean };
}

POST /v1/transactions
Request: {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description?: string;
  date: string;
  isRecurring?: boolean;
}

PUT /v1/transactions/:id
DELETE /v1/transactions/:id

GET /v1/transactions/categories
Response: {
  income: string[];
  expense: string[];
}
```

### Files to Create

1. `apps/web/src/app/(dashboard)/transactions/page.tsx`
2. `apps/web/src/app/(dashboard)/transactions/add/page.tsx`
3. `apps/web/src/components/transactions/TransactionList.tsx`
4. `apps/web/src/components/transactions/TransactionItem.tsx`
5. `apps/web/src/components/transactions/TransactionForm.tsx`
6. `apps/web/src/components/transactions/CategoryPicker.tsx`
7. `apps/web/src/components/transactions/AmountInput.tsx`
8. `apps/web/src/hooks/useTransactions.ts`

### Transaction List Design

```
┌─────────────────────────────────────────┐
│ ←  Transactions               🔍 Filter │
├─────────────────────────────────────────┤
│                                         │
│   ┌──────────────────────────────────┐  │
│   │ All │ Income │ Expenses          │  │
│   │ ═══                              │  │
│   └──────────────────────────────────┘  │
│                                         │
│   Today                                 │
│   ┌──────────────────────────────────┐  │
│   │ 🍽️ Chicken Republic    -$35.00  │  │
│   │    Food • 2:30 PM                │  │
│   ├──────────────────────────────────┤  │
│   │ 🚗 Uber                 -$12.50  │  │
│   │    Transport • 11:00 AM          │  │
│   └──────────────────────────────────┘  │
│                                         │
│   Yesterday                             │
│   ┌──────────────────────────────────┐  │
│   │ 💳 Salary            +$5,000.00  │  │
│   │    Income • 9:00 AM              │  │
│   └──────────────────────────────────┘  │
│                                         │
│   ┌──────────────────────────────────┐  │
│   │            ＋ Add New             │  │
│   └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Transaction Item

- Icon based on category
- Description + category + time
- Amount (green for income, default for expense)
- Swipe left to delete (with confirmation)
- Swipe right to edit
- Tap to view details

### Add Transaction Screen

```
┌─────────────────────────────────────────┐
│ ←  Add Expense                          │
├─────────────────────────────────────────┤
│                                         │
│            $35.00                       │
│           ________                      │
│                                         │
│   Category                              │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│   │ 🍽️ │ │ 🚗 │ │ 🛒 │ │ ⚡ │     │
│   │Food │ │Trans│ │Shop│ │Utils│     │
│   └─────┘ └─────┘ └─────┘ └─────┘     │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│   │ 🎬 │ │ 🏥 │ │ 👥 │ │ ••• │     │
│   │Fun  │ │Health│ │Family│ │More│     │
│   └─────┘ └─────┘ └─────┘ └─────┘     │
│                                         │
│   Date                                  │
│   ┌──────────────────────────────────┐  │
│   │  Today, Dec 15                   │  │
│   └──────────────────────────────────┘  │
│                                         │
│   Note (optional)                       │
│   ┌──────────────────────────────────┐  │
│   │  Lunch with team                 │  │
│   └──────────────────────────────────┘  │
│                                         │
│   ☐ This is recurring                   │
│                                         │
│   ┌──────────────────────────────────┐  │
│   │         Save Expense             │  │
│   └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Amount Input

- Large, centered number
- Currency symbol prefix
- Numeric keyboard on mobile
- Auto-format with commas

### Category Picker

- Grid of icon buttons
- Active state shows check
- "More" expands to full list
- Custom category option

### Acceptance Criteria

- [ ] Transaction list loads with pagination
- [ ] Filter tabs work (All/Income/Expenses)
- [ ] Swipe gestures work on mobile
- [ ] Add transaction form validates input
- [ ] Category picker highlights selection
- [ ] Date picker allows past dates
- [ ] Recurring toggle works
- [ ] Success feedback after saving
- [ ] List updates optimistically
```

---

## 6. Goals & Commitments

### Prompt

```markdown
## Task: Implement Goals and Commitment Devices

Create the goal setting and commitment contract features.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §8.1 Card Components (Goal card with progress)
- §9.3 Micro-Interactions (Progress bar animations)
- §9.5 Celebration Animations (Goal completion)
- §10.3 Chart Styling (Progress indicators)
- §8.3 Form Components (Goal creation form)

### API Endpoints

```
GET /v1/goals
POST /v1/goals
PUT /v1/goals/:id
DELETE /v1/goals/:id

GET /v1/commitment/active
POST /v1/commitment
POST /v1/commitment/:id/verify
```

### Files to Create

1. `apps/web/src/app/(dashboard)/goals/page.tsx`
2. `apps/web/src/app/(dashboard)/goals/new/page.tsx`
3. `apps/web/src/components/goals/GoalCard.tsx`
4. `apps/web/src/components/goals/GoalProgress.tsx`
5. `apps/web/src/components/goals/CreateGoalForm.tsx`
6. `apps/web/src/components/commitment/CommitmentCard.tsx`
7. `apps/web/src/components/commitment/StakeSelector.tsx`
8. `apps/web/src/hooks/useGoals.ts`
9. `apps/web/src/hooks/useCommitments.ts`

### Goal Card Design

```
┌─────────────────────────────────────────┐
│  🏠 Down Payment Fund                   │
│                                         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  65%       │
│                                         │
│  $6,500 of $10,000                      │
│  $3,500 to go • 4 months left           │
│                                         │
│  [+ Add Funds]              [Details →] │
└─────────────────────────────────────────┘
```

### Commitment Card Design

```
┌─────────────────────────────────────────┐
│  ⚡ Active Commitment                   │
│                                         │
│  "Save $500 by January 31"              │
│                                         │
│  Stakes: $50 to charity if failed       │
│  Referee: @friend                       │
│  Progress: 3 of 4 weeks ✓               │
│                                         │
│  [Verify Progress]                      │
└─────────────────────────────────────────┘
```

### Stake Types

1. **Social** - Accountability partner notified
2. **Anti-Charity** - Money to cause you oppose
3. **Loss Pool** - Locked funds released on success

### Create Goal Flow

1. Goal name and emoji
2. Target amount
3. Target date
4. Optional: Add commitment stakes

### Acceptance Criteria

- [ ] Goals list shows progress bars
- [ ] Create goal form validates
- [ ] Commitment stakes are selectable
- [ ] Progress can be verified
- [ ] Celebrations on goal completion
- [ ] Edit and delete goals work
```

---

## 7. Subscription Auditor (Shark)

### Prompt

```markdown
## Task: Implement Subscription Auditor (Shark)

Create the Tinder-style subscription review interface.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §8.1 Card Components (Swipeable card design)
- §9.4 Page Transitions (Card swipe animations)
- §9.5 Celebration Animations (Audit complete celebration)
- §4.2 Semantic Colors (Keep=green, Cancel=orange reveals)
- §13.3 Gesture Patterns (Swipe mechanics)

### API Endpoints

```
GET /v1/subscriptions/audit
Response: {
  subscriptions: Array<{
    id: string;
    name: string;
    amount: number;
    frequency: 'MONTHLY' | 'YEARLY';
    lastUsed?: string;
    category: string;
    annualizedCost: number;
    zombieScore: number;  // 0-100, higher = more likely unused
  }>;
  totalMonthly: number;
  potentialSavings: number;
}

POST /v1/subscriptions/:id/decision
Request: {
  decision: 'KEEP' | 'CANCEL' | 'REVIEW';
}
```

### Files to Create

1. `apps/web/src/app/(dashboard)/subscriptions/page.tsx`
2. `apps/web/src/components/subscriptions/SubscriptionCard.tsx`
3. `apps/web/src/components/subscriptions/SwipeableCard.tsx`
4. `apps/web/src/components/subscriptions/AuditSummary.tsx`
5. `apps/web/src/hooks/useSubscriptionAudit.ts`

### Swipe Interface Design

```
┌─────────────────────────────────────────┐
│ ←  Subscription Audit                   │
├─────────────────────────────────────────┤
│                                         │
│   Found 8 subscriptions                 │
│   Potential savings: $127/month         │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │      📺 Netflix                 │   │
│   │                                 │   │
│   │      $15.99/month               │   │
│   │      $191.88/year               │   │
│   │                                 │   │
│   │      Last used: 2 weeks ago     │   │
│   │                                 │   │
│   │   ← CANCEL        KEEP →        │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│    ❌              ?              ✓     │
│   Cancel        Review          Keep    │
│                                         │
│   4 of 8 reviewed                       │
│   ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░                  │
│                                         │
└─────────────────────────────────────────┘
```

### Swipe Mechanics

- Swipe right = Keep (green reveal)
- Swipe left = Cancel (orange reveal)
- Tap buttons below as alternative
- Card animates off screen
- Next card slides up

### Summary After Completion

```
┌─────────────────────────────────────────┐
│                                         │
│      🎉 Audit Complete!                 │
│                                         │
│      You're saving $47/month            │
│      That's $564/year!                  │
│                                         │
│      ┌─────────────────────────────┐    │
│      │  3 kept                     │    │
│      │  2 cancelled                │    │
│      │  3 to review later          │    │
│      └─────────────────────────────┘    │
│                                         │
│      [Share Achievement]                │
│                                         │
└─────────────────────────────────────────┘
```

### Acceptance Criteria

- [ ] Swipe gestures work smoothly
- [ ] Card reveals color on swipe
- [ ] Progress bar updates
- [ ] Summary shows results
- [ ] Decisions are saved to API
- [ ] Can undo last decision
```

---

## 8. GPS Recovery Paths

### Prompt

```markdown
## Task: Implement GPS Recovery Paths

Create the non-judgmental budget recovery interface.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §1.2 Design Manifesto (Non-judgmental messaging principles)
- §8.1 Card Components (Recovery path cards)
- §4.2 Semantic Colors (Avoid red, use orange for attention)
- §10.3 Chart Styling (Probability indicators)
- §3.2 Design Principles (Respect & Empower)

### API Endpoints

```
POST /v1/gps/calculate-recovery
Request: {
  overspendAmount: number;
  targetDate: string;
}
Response: {
  paths: Array<{
    id: string;
    effort: 'EASY' | 'MEDIUM' | 'HARD';
    description: string;
    actions: Array<{
      category: string;
      reduction: number;
      suggestion: string;
    }>;
    daysToRecover: number;
    probability: number;
  }>;
  currentOverspend: number;
  message: string;  // Non-judgmental framing
}
```

### Files to Create

1. `apps/web/src/app/(dashboard)/recovery/page.tsx`
2. `apps/web/src/components/recovery/RecoveryPathCard.tsx`
3. `apps/web/src/components/recovery/ActionItem.tsx`
4. `apps/web/src/hooks/useRecoveryPaths.ts`

### Recovery Path Card Design

```
┌─────────────────────────────────────────┐
│  Path 1: Easy Adjustments               │
│  ─────────────────────────────          │
│                                         │
│  "Small changes, back on track by       │
│   Friday"                               │
│                                         │
│  • Reduce dining out: -$50              │
│  • Skip one subscription: -$15          │
│  • Adjust transport: -$35               │
│                                         │
│  Total recovery: $100                   │
│  ████████████████████░░░ 80% likely     │
│                                         │
│  [Choose This Path]                     │
└─────────────────────────────────────────┘
```

### Non-Judgmental Messaging

- "Let's recalculate" not "You overspent"
- "Here are your options" not "You need to fix this"
- Focus on paths forward, not blame

### Acceptance Criteria

- [ ] Shows multiple recovery paths
- [ ] Effort levels are clear
- [ ] Actions are specific and actionable
- [ ] Probability indicator is visual
- [ ] Choosing a path tracks progress
- [ ] Messaging is non-judgmental
```

---

## 9. Story Cards

### Prompt

```markdown
## Task: Implement Story Cards for Viral Sharing

Create shareable achievement cards.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §11 Illustrations & Graphics (Card visual style)
- §4.4 Gradient System (Card backgrounds)
- §9.5 Celebration Animations (Achievement moments)
- §2.3 Design Style "African Glassmorphism" (Card aesthetics)
- §5.1 Type Scale (Card typography)

### API Endpoints

```
POST /v1/story-cards/generate
Request: {
  type: 'FUTURE_SELF' | 'COMMITMENT' | 'MILESTONE' | 'RECOVERY';
  sourceId: string;
  anonymize?: boolean;
}
Response: {
  cardId: string;
  imageUrl: string;
  shareUrl: string;
  text: string;
}
```

### Files to Create

1. `apps/web/src/components/story-cards/StoryCardPreview.tsx`
2. `apps/web/src/components/story-cards/ShareModal.tsx`
3. `apps/web/src/hooks/useStoryCards.ts`

### Card Design Templates

```
┌─────────────────────────────────────────┐
│                                         │
│   ╔═════════════════════════════════╗   │
│   ║                                 ║   │
│   ║  🎯 Goal Achieved!              ║   │
│   ║                                 ║   │
│   ║  "I saved for 90 days          ║   │
│   ║   straight with IKPA"          ║   │
│   ║                                 ║   │
│   ║        ───── IKPA ─────        ║   │
│   ║                                 ║   │
│   ╚═════════════════════════════════╝   │
│                                         │
│   [📱 Share to Twitter]                 │
│   [📱 Share to WhatsApp]                │
│   [📋 Copy Link]                        │
│                                         │
└─────────────────────────────────────────┘
```

### Privacy Options

- Anonymize amounts (show percentages)
- Hide specific numbers
- Generic achievement text

### Acceptance Criteria

- [ ] Cards generate with correct data
- [ ] Share buttons work for each platform
- [ ] Privacy options respected
- [ ] Cards are visually appealing
```

---

## 10. Settings & Profile

### Prompt

```markdown
## Task: Implement Settings and Profile

Create user settings and profile management.

### Design Reference
**Read `ikpa-ui-guide.md` sections:**
- §8.3 Form Components (Settings inputs, toggles)
- §14 Dark Mode Design (Theme toggle implementation)
- §8.1 Card Components (Settings sections)
- §7.2 Spacing Scale (List item spacing)
- §4.3 Background Colors (Section backgrounds)

### Files to Create

1. `apps/web/src/app/(dashboard)/profile/page.tsx`
2. `apps/web/src/app/(dashboard)/settings/page.tsx`
3. `apps/web/src/components/settings/SettingsSection.tsx`
4. `apps/web/src/components/settings/CurrencySelector.tsx`
5. `apps/web/src/components/settings/ThemeToggle.tsx`
6. `apps/web/src/components/profile/ProfileHeader.tsx`

### Settings Screen

```
┌─────────────────────────────────────────┐
│ ←  Settings                             │
├─────────────────────────────────────────┤
│                                         │
│   Account                               │
│   ┌──────────────────────────────────┐  │
│   │ Email                   a@b.com  │  │
│   │ Password                 Change  │  │
│   │ Currency                    USD  │  │
│   └──────────────────────────────────┘  │
│                                         │
│   Preferences                           │
│   ┌──────────────────────────────────┐  │
│   │ Dark Mode                    ○●  │  │
│   │ Notifications               ●○   │  │
│   │ Weekly Summary              ●○   │  │
│   └──────────────────────────────────┘  │
│                                         │
│   Privacy                               │
│   ┌──────────────────────────────────┐  │
│   │ Export Data                   →  │  │
│   │ Delete Account                →  │  │
│   └──────────────────────────────────┘  │
│                                         │
│   [Sign Out]                            │
│                                         │
└─────────────────────────────────────────┘
```

### Acceptance Criteria

- [ ] Dark mode toggle works
- [ ] Currency can be changed
- [ ] Settings persist
- [ ] Sign out clears data
- [ ] Delete account has confirmation
```

---

## Implementation Order (Recommended)

1. **Foundation Setup** - Required for everything else
2. **Dashboard** - Core experience, shows value immediately
3. **Transaction Management** - Basic data entry
4. **AI Chat** - Key differentiator
5. **Future Self** - Signature feature for demo
6. **Goals & Commitments** - Engagement driver
7. **Subscription Auditor** - Quick win feature
8. **GPS Recovery** - Support feature
9. **Story Cards** - Viral growth
10. **Settings** - Polish

---

## Notes for Coding Agent

1. **Always check existing components** before creating new ones
2. **Use the design tokens** from tailwind config
3. **Test on mobile first** (375px width)
4. **Handle loading and error states** for every API call
5. **Use React Query** for server state, Zustand for client state
6. **Animations should respect `prefers-reduced-motion`**
7. **All text should be non-judgmental** - review copy carefully

---

*Generated for IKPA Frontend Implementation*
