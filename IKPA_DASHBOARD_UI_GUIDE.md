# Ikpa Dashboard: UI/UX Design Direction

**Version:** 1.0 | **Theme:** "The Financial Operating System"
**Aesthetic Goal:** Editorial, Calm, Scientific, High-Trust.

---

## 1. Core Visual Philosophy

Most fintech dashboards look like spreadsheets. Ikpa looks like a **digital magazine combined with a laboratory.**

- **The Vibe:** "Oboe" meets "Voyage AI".
- **The Metaphor:** "Clean Paper & Ink." We avoid heavy shadows and distinct "app" containers. The interface should feel breathable.
- **The Rule:** If it doesn't help behavior change, remove it.

---

## 2. Color System (The "Natural" Palette)

We are strictly avoiding "Neon Fintech Blue" or "Alert Red".

### Base Layers

- **Canvas (Background):** `#FDFCF8` (Warm Cream / Old Paper). _This is the global background._
- **Surface (Cards/Sidebar):** `#FFFFFF` (Pure White). _Used for content areas to create subtle separation._
- **Surface Highlight:** `#F2F0E9` (Darker Cream). _Used for hover states or active sidebar items._

### Typography & Ink

- **Primary Ink:** `#1A2E22` (Deep Forest Green). _Used for Headers._
- **Secondary Ink:** `#44403C` (Warm Charcoal). _Used for Body text._
- **Tertiary Ink:** `#A8A29E` (Stone Gray). _Used for metadata/labels._

### Functional Accents

- **Action (Primary):** `#064E3B` (Deep Emerald).
- **Success:** `#3F6212` (Earthy Olive).
- **Warning:** `#C2410C` (Burnt Orange/Terracotta). _Not bright red._
- **Focus:** `#1D4ED8` (Deep Blue). _Used sparingly for "Shark Auditor" alerts._

---

## 3. Typography System

This is the differentiator. We use a **Serif** font for UI navigation, which is rare but adds instant class (like Oboe).

- **Headers & Navigation:** `font-serif` (Playfair Display / Merriweather).
  - _Why:_ Makes the dashboard feel like a personal journal.
  - _Usage:_ Sidebar links, Page Titles, Card Headers.
- **Data & UI Text:** `font-sans` (Inter / Geist / DM Sans).
  - _Why:_ Legibility for numbers and small labels is non-negotiable.
  - _Usage:_ Tables, Charts, Buttons, Inputs.

---

## 4. Component Library

### A. The "Paper Card" (Container)

Unlike standard SaaS cards with drop shadows, Ikpa cards should feel flat and integrated.

- **Style:** `bg-white border border-stone-100 rounded-xl`.
- **Shadow:** None or extremely subtle `shadow-sm`.
- **Padding:** Generous (`p-6` or `p-8`).

### B. Navigation Sidebar (The "Oboe" Style)

- **Position:** Fixed Left.
- **Background:** Transparent or Glass (`bg-[#FDFCF8]/90`).
- **Links:**
  - _Font:_ Serif (`font-serif`).
  - _Size:_ `text-sm`.
  - _Active State:_ A subtle vertical green line on the left + `text-green-900` + `bg-stone-100/50`.
  - _Inactive State:_ `text-stone-500`.

### C. Buttons & Actions

- **Primary:** Pill-shaped (`rounded-full`), Deep Green bg, White text.
- **Secondary:** Outline (`border border-stone-200`), Stone text.
- **"Micro" Actions:** Small icon-only buttons with a circular hover effect (`hover:bg-stone-100 rounded-full`).

### D. Inputs & Search

- **Style:** "Underlined" or "Minimal Box".
  - Instead of a heavy border box, use a `bg-transparent border-b border-stone-300 focus:border-green-600` style. This looks more like filling out a form on paper.
  - _Search Bar:_ Large, pill-shaped, floating at the top (like Oboe's "I want to learn about...").

---

## 5. Dashboard Layout Strategy

### The "Morning Briefing" (Home View)

Instead of a dashboard full of widgets, present a **Feed**.

1.  **Greeting:** "Good Morning, Tunde." (Serif, Large).
2.  **The "Financial GPS" Status:** A single sentence summary.
    - _Example:_ "You are **on track** for your Lagos trip. ₦45,000 saved this month."
3.  **Action Items (The To-Do List):**
    - "Review 3 flagged transactions (Shark Auditor)."
    - "Approve weekly transfer to Cowrywise."

### The "Visualizer" (Data View)

- **Avoid:** Pie charts.
- **Use:** **Sankey Diagrams** (Flow of money) and **Progress Bars**.
  - _Style:_ Thicker lines, rounded caps, earthy colors.
- **The "Future Self" Widget:**
  - A split card showing "Current Trajectory" vs. "Optimized Trajectory" using two simple curves (Solid vs. Dashed).

---

## 6. Specific Page Concepts (Prompt Ready)

### Concept 1: The "Shark Auditor" Page

- **Layout:** A "Feed" of transactions, not a table.
- **Visual:** Each subscription is a "Ticket" card.
  - _Left:_ Logo of service (Netflix, DSTV).
  - _Middle:_ "₦4,500 / month".
  - _Right:_ A Toggle Switch ("Keep" vs. "Kill").
- **Interaction:** Clicking "Kill" triggers a "Cancel Script" modal.

### Concept 2: The "Commitment" Page

- **Visual:** Looks like a legal contract or a certificate.
- **Elements:**
  - "I, [Name], promise to save [Amount]..."
  - **The Stakes:** A "Locked" icon showing where the money goes if they fail (e.g., "Anti-Charity Wallet").
  - **Referees:** Avatar circles of the friends verifying this goal.

---

## 7. Animation & Interaction

- **Page Transitions:** Soft Fade-in (`opacity-0` -> `opacity-100` over 0.5s).
- **Hover States:** Cards should **lift** slightly (`-translate-y-1`) on hover.
- **Loading:** No spinners. Use **Skeleton Shimmer** effects that match the text lines (like text appearing on a page).
