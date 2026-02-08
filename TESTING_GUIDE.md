# UI Testing Guide — 5 Hackathon Features

This guide walks through testing each feature entirely from the browser UI. No API calls or terminal commands needed.

**Prerequisites:**
- The app is running locally (`apps/api` + `apps/web`)
- You are logged in to your account
- You have at least one expense category and one budget set up (from onboarding)

---

## Feature 1: AI Spending Coach Agent

**Route:** `/dashboard/expenses`

### What it does
Every time you log a new expense, an AI agent instantly analyzes it against your budget and goals, then shows a short, non-judgmental nudge (e.g., "That's 23% of your weekly food budget").

### Steps to test

1. Navigate to `/dashboard/expenses`
2. Tap the **"+"** button (top-right corner, or the floating action button at bottom-right)
3. In the Add Expense modal:
   - Pick a **category** (e.g., Food & Dining)
   - Enter an **amount** (try something meaningful like $50 or $200)
   - Add a **description** (e.g., "Dinner at Buka")
   - Tap **Submit**
4. After the modal closes, watch the **bottom-left corner** of the screen
5. Within 1-3 seconds, an **AI Nudge toast** should appear with:
   - A short nudge message (1-2 sentences)
   - Color-coded severity: **blue** = info (within budget), **amber** = warning (80%+ of budget), **red** = critical (over budget)
6. The toast auto-dismisses after **12 seconds**, or you can close it manually

### What to look for
- The nudge text should be **contextual** — it should reference your actual budget/spending data
- The nudge should be **non-judgmental** — no words like "wasteful" or "irresponsible"
- Severity should match your budget status (if you're over budget, it should be warning/critical)

### Trigger different severities
- **Info:** Log a small expense in a category where you have plenty of budget left
- **Warning:** Log an expense that pushes a category to 80-90% of budget
- **Critical:** Log an expense that exceeds your monthly budget for that category

---

## Feature 2: Time Machine Spending Visualizer

**Route:** `/dashboard/expenses` (triggered from any expense)

### What it does
For any expense, shows a compound-interest visualization: "If you spent $X/day on this for 20 years, it would cost $Y. If you invested it instead, it would grow to $Z."

### Steps to test

1. Navigate to `/dashboard/expenses`
2. Find any expense in your list
3. Tap the **clock icon** on the expense row (it's the leftmost of the three action icons)
4. A **bottom sheet** slides up showing:
   - Header: "What if you invested this instead?"
   - The expense amount pre-filled
   - A **frequency toggle** with three buttons: **Daily**, **Weekly**, **Monthly**
   - A **dual-line area chart**:
     - **Red area** = Cumulative spending over 20 years
     - **Green area** = Investment growth (at 10% annual return)
   - A **bottom stats card** showing the opportunity cost difference

### Interactive elements to test

5. **Switch frequencies:** Tap "Daily" → "Weekly" → "Monthly" and watch the chart re-render
   - Daily shows the largest numbers (spending $50/day for 20 years is massive)
   - Monthly shows the smallest
6. **Hover/tap on the chart** to see a tooltip with exact year-by-year values
7. Check the **Opportunity Cost** stat at the bottom — this is the difference between what you'd spend vs. what you'd earn by investing
8. Tap the **X button** (top-right of the sheet) to close

### What to look for
- The chart should clearly show investment growth outpacing spending over time (compound interest effect)
- Numbers should be formatted with currency symbols and K/M suffixes
- Switching frequency should instantly update the chart (no loading delay — it's pure math)

---

## Feature 3: Weekly AI Financial Debrief

**Route:** `/dashboard/future-self`

### What it does
Every Sunday evening, an AI agent writes you a "letter from your financial advisor" summarizing your week: top spending categories, budget adherence, goal progress, and actionable tips. It's stored as a letter you can re-read anytime.

### Steps to test

1. Navigate to `/dashboard/future-self`
2. Scroll down past the commitment card and the "Two Futures" chart
3. Look for the **"Weekly Debriefs"** section (has a ScrollText icon)
4. If a debrief exists, you'll see:
   - A **"WEEKLY DEBRIEF"** badge in violet
   - The **date** it was generated
   - A **content preview** (first 250 characters of the letter)
   - A **"New"** badge if you haven't read it yet
5. Tap on a debrief card to read the full content

### What to look for
- The debrief should reference your **actual spending data** (categories, amounts)
- It should mention **budget adherence** (e.g., "You stayed within 85% of your food budget")
- It should mention your **streak status** if you have an active micro-commitment
- The tone should be warm and encouraging — like a letter from your future self

### Note on timing
- Debriefs are generated automatically every **Sunday at 6PM WAT** (5PM UTC)
- If you don't see one yet, it means the cron hasn't run since the feature was deployed
- Ask the developer to trigger one manually if needed for demo purposes

---

## Feature 4: Streak Leaderboard

**Route:** `/dashboard/future-self/leaderboard`

### What it does
An opt-in public leaderboard showing the top micro-commitment streakers. Names are anonymized (first name + last initial) for privacy.

### Steps to test — Getting there

1. Navigate to `/dashboard/future-self`
2. Look for the **"Streak Leaderboard"** card (Trophy icon, amber-tinted)
   - It shows "See how your streak ranks"
   - If you have an active commitment, your current streak is shown as a badge (e.g., "3d")
3. Tap the card — it navigates to `/dashboard/future-self/leaderboard`

### Steps to test — On the leaderboard page

4. You'll see:
   - A **back arrow** (top-left) to return to the future-self page
   - Title: "Streak Leaderboard" with Trophy icon
   - An **opt-in toggle**: "Show me on leaderboard"

5. **Toggle opt-in ON:**
   - Tap the toggle switch so it turns green/active
   - The subtitle reads "Others see your streak (name anonymized)"
   - A **"Your Rank"** card should appear showing your rank number and streak

6. **View the leaderboard list:**
   - Top 3 entries show **crown/medal icons** in gold, silver, and bronze
   - Other entries show their rank number
   - Each entry shows: anonymized name (e.g., "Abraham O."), streak days with flame icon
   - **Your entry** is highlighted with a blue ring and a "You" badge
   - Flame colors indicate streak strength:
     - **Red flame:** 30+ days
     - **Orange flame:** 7-29 days
     - **Amber flame:** under 7 days

7. **Toggle opt-out:**
   - Tap the toggle switch to turn it off
   - Your rank card disappears
   - Your entry is removed from the leaderboard

8. Tap the **refresh button** (circular arrow, top-right) to reload rankings

### Prerequisite
- You need an **active micro-commitment** to appear on the leaderboard
- If you don't have one, go back to `/dashboard/future-self`, generate a letter, and accept the micro-commitment that appears after it

---

## Feature 5: Opik Evaluation Dashboard

**Route:** `/dashboard/opik`

### What it does
A judge-facing dashboard that showcases the AI evaluation infrastructure. Displays real-time quality metrics, experiment results, and lets you trigger evaluation suites live.

### How to get there

**On mobile:** Tap the **"Opik"** icon (gauge icon) in the bottom navigation bar — it's the rightmost tab.

**On desktop:** The bottom nav is hidden on desktop screens. Navigate directly to `/dashboard/opik` in the browser URL bar.

### Steps to test

1. Navigate to `/dashboard/opik`

2. **Hero Stats (top of page):**
   - 4 stat cards in a row: Total Traces, Avg Score, Experiments, Evals Run
   - These pull from the live Opik backend — numbers should be non-zero if the system has been used

3. **AI Quality Metrics section:**
   - 5 metric cards in a grid:
     - **Tone & Empathy** (violet)
     - **Cultural Sensitivity** (cyan)
     - **Financial Safety** (amber)
     - **Actionability** (emerald)
     - **Engagement** (red)
   - Each card shows: score percentage, description, progress bar, sample count
   - These are the LLM-as-Judge metrics that evaluate every AI response in the app

4. **Live Evaluation Suites:**
   - Two cards:
     - **"GPS Re-Router Eval"** — tests 20 budget overspend scenarios
     - **"Commitment Engine Eval"** — tests commitment creation and streak handling
   - Tap **"Run Evaluation"** on either card:
     - Button shows a loading spinner
     - After 10-30 seconds, results appear below:
       - Pass count (e.g., "18/20 passed")
       - Average score percentage
       - Progress bar

5. **Experiments section:**
   - Shows a list of A/B experiments (e.g., gratitude vs regret letter variants)
   - Tap any experiment row to **expand** it
   - The expanded view shows a **bar chart** comparing variant scores side-by-side

6. **Prompt Optimization History:**
   - A line chart at the bottom showing how the AI's fitness score has improved across optimization generations
   - Hover over data points to see exact values

### What to look for
- All sections should load with data (not empty states) if the backend has been used
- Running an eval suite should complete within 30 seconds and show pass/fail results
- Experiment charts should show meaningful score differences between variants
- The dashboard demonstrates that every AI response in the app is being measured and optimized

---

## Quick Reference

| Feature | Route | Entry Point |
|---------|-------|-------------|
| AI Spending Coach | `/dashboard/expenses` | Create any new expense |
| Time Machine | `/dashboard/expenses` | Clock icon on any expense |
| Weekly Debrief | `/dashboard/future-self` | Scroll to "Weekly Debriefs" section |
| Streak Leaderboard | `/dashboard/future-self/leaderboard` | Tap "Streak Leaderboard" card on future-self page |
| Opik Dashboard | `/dashboard/opik` | Bottom nav "Opik" tab (mobile) or direct URL (desktop) |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No nudge appears after creating expense | The AI agent runs async — wait 2-3 seconds. Check that the API server is running and has an Anthropic API key configured. |
| Time Machine chart shows flat lines | Try switching frequency to "Daily" for more dramatic visualization. Very small amounts may look flat. |
| No weekly debriefs visible | Debriefs generate on Sunday 6PM WAT. Ask the developer to trigger one manually for demo. |
| Leaderboard is empty | You need to: (1) have an active micro-commitment, and (2) toggle opt-in on the leaderboard page. |
| Can't find Opik tab on desktop | The bottom navigation is mobile-only. Navigate directly to `/dashboard/opik` in the URL bar. |
| Eval suite takes too long | Each suite runs 20 AI evaluation calls — allow up to 60 seconds. Check API server logs if it times out. |
