# UI Design System

## Overview

This document covers Ikpa's design system, establishing the visual language, components, and patterns used across all platforms. The design philosophy is "African Glassmorphism" - combining modern glass effects with warm African-inspired colors and cultural elements.

---

## Design Philosophy

### Core Pillars

| Pillar | Description |
|--------|-------------|
| **Clarity** | Financial data should be instantly understandable |
| **Trust** | Design choices that inspire confidence in the platform |
| **Optimism** | Warm, encouraging aesthetics that motivate action |
| **Cultural Relevance** | Subtle African influences without being stereotypical |

### Visual Identity

**African Glassmorphism**: Modern glass morphism with:
- Warm color temperature (not cold/corporate)
- Subtle African-inspired patterns
- Natural, organic shapes
- Earth-tone accent colors

---

## Color System

### Primary Colors

```css
/* Ikpa Green - Primary brand color */
--green-50: #ECFDF5;
--green-100: #D1FAE5;
--green-200: #A7F3D0;
--green-300: #6EE7B7;
--green-400: #34D399;
--green-500: #10B981;  /* Primary */
--green-600: #059669;
--green-700: #047857;
--green-800: #065F46;
--green-900: #064E3B;
```

### Accent Colors

```css
/* Ikpa Gold - Achievement, success */
--gold-400: #FBBF24;
--gold-500: #F59E0B;
--gold-600: #D97706;

/* Amber - Attention, warnings */
--amber-400: #FBBF24;
--amber-500: #F59E0B;
--amber-600: #D97706;

/* Orange - Energy, action */
--orange-400: #FB923C;
--orange-500: #F97316;
--orange-600: #EA580C;
```

### Semantic Colors

```css
/* Success */
--success: #10B981;
--success-light: #D1FAE5;

/* Warning */
--warning: #F59E0B;
--warning-light: #FEF3C7;

/* Error */
--error: #EF4444;
--error-light: #FEE2E2;

/* Info */
--info: #3B82F6;
--info-light: #DBEAFE;
```

### Neutral Colors

```css
/* Gray scale */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-400: #9CA3AF;
--gray-500: #6B7280;
--gray-600: #4B5563;
--gray-700: #374151;
--gray-800: #1F2937;
--gray-900: #111827;
```

### Dark Mode Colors

```css
/* Dark backgrounds */
--dark-bg: #0F172A;
--dark-surface: #1E293B;
--dark-elevated: #334155;

/* Dark text */
--dark-text-primary: #F9FAFB;
--dark-text-secondary: #E5E7EB;
--dark-text-muted: #9CA3AF;
```

---

## Typography

### Font Families

```css
/* Primary - UI text */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Display - Headings, hero text */
--font-display: 'Plus Jakarta Sans', 'Inter', sans-serif;

/* Mono - Numbers, code */
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;
```

### Type Scale

| Name | Size | Weight | Line Height | Use |
|------|------|--------|-------------|-----|
| Display | 48px | 700 | 1.1 | Hero sections |
| H1 | 36px | 700 | 1.2 | Page titles |
| H2 | 28px | 600 | 1.3 | Section headers |
| H3 | 22px | 600 | 1.4 | Card titles |
| H4 | 18px | 600 | 1.4 | Subsections |
| Body | 16px | 400 | 1.5 | Default text |
| Body Small | 14px | 400 | 1.5 | Secondary text |
| Caption | 12px | 400 | 1.4 | Labels, hints |
| Overline | 11px | 600 | 1.2 | Category labels |

### Number Formatting

```css
/* Currency display - Large */
.currency-large {
  font-family: var(--font-mono);
  font-size: 36px;
  font-weight: 700;
  font-feature-settings: 'tnum' 1;  /* Tabular numbers */
}

/* Currency display - Regular */
.currency {
  font-family: var(--font-mono);
  font-feature-settings: 'tnum' 1;
}
```

---

## Spacing System

```css
/* Base unit: 4px */
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

---

## Component Library

### Cards

```css
/* Glass Card */
.card-glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

/* Solid Card */
.card-solid {
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Metric Card */
.card-metric {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  border-radius: 20px;
  color: white;
  padding: 24px;
}
```

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #10B981;
  color: white;
  border-radius: 12px;
  padding: 14px 24px;
  font-weight: 600;
  font-size: 16px;
  transition: all 150ms ease-out;
}

.btn-primary:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-primary:active {
  transform: scale(0.98);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #10B981;
  border: 2px solid #10B981;
  border-radius: 12px;
  padding: 12px 22px;
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: #374151;
  padding: 12px 16px;
}
```

### Inputs

```css
/* Text Input */
.input {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 16px;
  transition: all 150ms ease-out;
}

.input:focus {
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  outline: none;
}

.input::placeholder {
  color: #9CA3AF;
}

/* Input with Icon */
.input-icon {
  position: relative;
}

.input-icon .icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #9CA3AF;
}

.input-icon input {
  padding-left: 48px;
}
```

### Navigation

```css
/* Bottom Navigation (Mobile) */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-around;
  padding: 8px 16px 24px;  /* Extra padding for safe area */
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #6B7280;
  font-size: 11px;
}

.nav-item.active {
  color: #10B981;
}

.nav-item .icon {
  font-size: 24px;
}
```

---

## Motion Design

### Duration Scale

| Name | Duration | Use Case |
|------|----------|----------|
| Instant | 50ms | Micro-feedback (button press) |
| Fast | 150ms | Standard interactions |
| Normal | 250ms | Card transitions, modals |
| Slow | 400ms | Complex transitions |
| Slower | 600ms | Celebration animations |

### Easing Functions

```css
/* Standard easings */
--ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);    /* Elements entering */
--ease-in: cubic-bezier(0.4, 0.0, 1, 1);       /* Elements leaving */
--ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1); /* Elements on screen */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Celebratory */
```

### Animation Examples

```css
/* Button press */
.btn:active {
  transform: scale(0.98);
  transition: transform 50ms var(--ease-out);
}

/* Modal enter */
.modal-enter {
  opacity: 0;
  transform: translateY(20px);
}

.modal-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 250ms var(--ease-out);
}

/* Number count-up */
@keyframes countUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.number-animate {
  animation: countUp 600ms var(--ease-out);
}

/* Progress bar */
.progress-bar {
  transition: width 400ms var(--ease-out);
}

/* Success checkmark */
@keyframes checkmark {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.success-check {
  animation: checkmark 400ms var(--ease-spring);
}
```

---

## Data Visualization

### Chart Colors

```css
/* Primary chart colors */
--chart-green: #10B981;
--chart-blue: #3B82F6;
--chart-amber: #F59E0B;
--chart-purple: #8B5CF6;
--chart-pink: #EC4899;
--chart-cyan: #06B6D4;

/* Semantic chart colors */
--chart-positive: #10B981;
--chart-negative: #EF4444;
--chart-neutral: #9CA3AF;
```

### Chart Styling

```css
/* Grid lines */
.chart-grid {
  stroke: #E5E7EB;
  stroke-dasharray: 4 4;
  stroke-width: 1;
}

/* Axis labels */
.chart-axis-label {
  font-family: var(--font-primary);
  font-size: 12px;
  fill: #6B7280;
}

/* Tooltips */
.chart-tooltip {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 12px;
}
```

### Cash Flow Score Gauge

```
         ╭───────────────╮
       ╱   ▓▓▓▓▓▓▓░░░░   ╲
      ╱                     ╲
     │          78          │
      ╲                     ╱
       ╲     Cash Flow     ╱
         ╰───────────────╯

Color gradient:
0-19:   #EF4444 (Red)
20-39:  #F97316 (Orange)
40-59:  #F59E0B (Amber)
60-79:  #84CC16 (Lime)
80-100: #10B981 (Green)
```

---

## Icons

### Icon Style

- **Style**: Outlined, 2px stroke
- **Size**: 24px default, 20px small, 32px large
- **Library**: Lucide Icons (recommended)

### Common Icons

| Context | Icon | Name |
|---------|------|------|
| Dashboard | 🏠 | `home` |
| Transactions | 💳 | `credit-card` |
| AI Chat | 🤖 | `bot` |
| Goals | 🎯 | `target` |
| Profile | 👤 | `user` |
| Income | 📈 | `trending-up` |
| Expense | 📉 | `trending-down` |
| Savings | 🏦 | `landmark` |
| Add | ➕ | `plus` |
| Settings | ⚙️ | `settings` |

---

## Responsive Breakpoints

```css
/* Mobile first */
--breakpoint-sm: 640px;   /* Large phones */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large screens */
```

---

## Accessibility

### Requirements

- **Color Contrast**: WCAG 2.1 Level AA (4.5:1 for text)
- **Touch Targets**: Minimum 44×44pt
- **Focus States**: Visible focus rings on all interactive elements
- **Motion**: Respect `prefers-reduced-motion`

### Focus States

```css
/* Focus ring */
.focusable:focus-visible {
  outline: 2px solid #10B981;
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Tailwind CSS Configuration

```javascript
// tailwind.config.js

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        gold: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'glass': '0 4px 6px rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'elevated': '0 10px 40px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `tailwindcss` | Utility CSS framework |
| `lucide-react` | Icon library |
| `recharts` | Chart library |
| `framer-motion` | Animation library |

---

## Next Steps

After design system, proceed to:
1. [20-infrastructure.md](./20-infrastructure.md) - Docker, CI/CD
2. [21-testing-strategy.md](./21-testing-strategy.md) - Testing approach
