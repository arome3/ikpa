<p align="center">
  <img src="docs/assets/ikpa-logo.png" alt="IKPA Logo" width="200" height="200" />
</p>

<h1 align="center">IKPA</h1>

<p align="center">
  <strong>AI Agents That Change Financial Behavior - Not Just Track It</strong>
</p>

<p align="center">
  <em>Five specialized AI agents that defeat the five reasons 92% of financial resolutions fail.</em>
</p>

<p align="center">
  Built for anyone who's ever watched a financial resolution fail.
</p>

<p align="center">
  <a href="https://lablab.ai/event/commit-to-change-ai-agents-hackathon">
    <img src="https://img.shields.io/badge/Hackathon-Commit%20to%20Change-purple?style=for-the-badge" alt="Hackathon" />
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/Prize%20Pool-$10K-green?style=for-the-badge" alt="Prize Pool" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge" alt="Build Status" />
  </a>
</p>

<p align="center">
  <strong>Etymology:</strong> <em>"Ikpa"</em> means <strong>"purse"</strong> - where your financial future lives.
</p>

---

## Table of Contents

- [What Makes IKPA Different](#what-makes-ikpa-different)
- [The Problem](#the-problem)
- [The Solution: Five AI Agents](#the-solution-five-ai-agents)
- [Core Components](#core-components)
- [Cultural Intelligence](#cultural-intelligence)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [Documentation](#documentation)
- [API Overview](#api-overview)
- [Hackathon Context](#hackathon-context)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Team & License](#team--license)
- [Acknowledgments](#acknowledgments)

---

## What Makes IKPA Different

> **IKPA isn't a budgeting app. It's a behavior change system.**

| Traditional Finance Apps | IKPA |
|--------------------------|------|
| Track where money went | Change where money goes |
| Single AI chatbot | **5 specialized agents** working together |
| "You overspent on food" | "Here are 3 paths back on track by Friday" |
| Shame-based notifications | Non-judgmental recalculation |
| Ignore family obligations | Honor them as values, not expenses |
| Static future projections | **10,000 Monte Carlo simulations** with letters from your future self |

### The Agent Orchestra

IKPA doesn't use a single AI. It deploys a **team of specialists** that collaborate:

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER QUESTION                                │
│          "I keep failing to save money"                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                                │
│            Routes to relevant specialists                        │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│   SHARK   │  │    GPS    │  │  FUTURE   │  │  FAMILY   │
│  AUDITOR  │  │ RE-ROUTER │  │   SELF    │  │  VALUES   │
│           │  │           │  │           │  │           │
│ "Found 3  │  │ "Here's   │  │ "Your 60  │  │ "Family   │
│ forgotten │  │ how to    │  │ year-old  │  │ support   │
│ subscrip- │  │ recover   │  │ self has  │  │ is 23% -  │
│ tions"    │  │ by Friday"│  │ a message"│  │ healthy"  │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │              │
      └──────────────┴──────────────┴──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   COMBINED RESPONSE                              │
│  "I found $127 in zombie subscriptions. Let's redirect that    │
│   to your savings goal. Your future self wrote you a letter    │
│   about why this matters. Want to read it?"                     │
└─────────────────────────────────────────────────────────────────┘
```

**This is the key insight:** Financial apps fail because they treat money as math. IKPA treats money as *behavior* - and deploys AI agents trained in behavioral science to change it.

---

## The Problem

### Why 92% of Financial Resolutions Fail

| Statistic | Source | Reality |
|-----------|--------|---------|
| **92%** of New Year resolutions fail | Journal of Clinical Psychology | Standard tools don't work |
| **88%** quit within 2 weeks | Drive Research 2024 | Early intervention is critical |
| Approach goals are **2x more successful** | PMC Study | Reframe "don't spend" → "save for" |
| Social support = **3x success rate** | Swedish experiment | Accountability matters |
| **66 days** for habit formation | Behavior science | Long-term engagement required |

### The Core Insight

**People don't have a financial literacy problem. They have a financial clarity problem.**

They fail because they:

1. **Don't know where they actually stand** - No clear snapshot of income vs. expenses vs. obligations
2. **Can't visualize consequences** - Decisions feel abstract until it's too late
3. **Get generic advice** - Solutions designed for Western contexts, ignoring family obligations
4. **Feel shame instead of agency** - Apps judge overspending instead of understanding context
5. **Have no safe space to experiment** - Can't simulate "what if I saved $200 more?" without real risk

### Traditional Apps vs IKPA

| Aspect | Traditional Apps | IKPA |
|--------|------------------|------|
| Future visualization | Basic calculators | Financial Time Machine with Monte Carlo |
| Goal tracking | Static progress bars | Intervention engine (detects failure early) |
| AI chat | Generic responses | Multi-agent orchestra (5 specialized agents) |
| Future planning | Compound interest charts | Conversations with your 60-year-old self |
| Motivation | Push notifications | Commitment devices with real stakes |
| Goal setting | User input only | Auto-reframe avoidance → approach goals |
| Cultural context | Western assumptions | Values-aware, family obligations honored |
| Shareability | None | Viral story cards |

---

## The Solution: Five AI Agents

Research identified **five failure modes** that cause 92% of financial resolutions to fail. IKPA deploys a specialized agent to defeat each one:

| Failure Mode | Why People Fail | Agent That Defeats It |
|--------------|-----------------|----------------------|
| Invisible Leakage | Forgotten subscriptions drain money silently | **Shark Auditor** |
| Failure Spiral | One slip → shame → give up entirely | **GPS Re-Router** |
| Commitment Decay | Initial motivation fades over time | **Commitment Device** |
| Temporal Disconnect | Future consequences feel abstract | **Future Self Simulator** |
| Cultural Blindness | Apps ignore family obligations | **Family & Values Manager** |

### 1. Shark Auditor

> **Defeats:** Invisible Leakage

| Attribute | Detail |
|-----------|--------|
| **Function** | Hunts zombie subscriptions and forgotten recurring charges |
| **Key Insight** | Average user loses $200/month to subscriptions they forgot about |
| **Feature** | Tinder-style subscription swiper - swipe left to cancel, right to keep |

### 2. GPS Re-Router

> **Defeats:** Failure Spiral

| Attribute | Detail |
|-----------|--------|
| **Function** | When you slip, it recalculates - never judges, always redirects |
| **Key Insight** | 88% quit after first failure; we turn slips into recalculations |
| **Feature** | "You spent $500 over budget. Here are 3 paths back on track by Friday" |

### 3. Commitment Device Engine

> **Defeats:** Commitment Decay

| Attribute | Detail |
|-----------|--------|
| **Function** | Creates real stakes through social accountability and loss aversion |
| **Key Insight** | Based on behavioral economics research (stickK.com, Karlan research) |
| **Feature** | Stake $100 → goes to charity you oppose if you fail; accountability partners notified |

### 4. Future Self Simulator

> **Defeats:** Temporal Disconnect

| Attribute | Detail |
|-----------|--------|
| **Function** | Generates letters from your 60-year-old self based on financial decisions |
| **Key Insight** | MIT Media Lab research: users who talk to future selves save 16% more |
| **Feature** | "Dear 28-year-old me, thank you for starting that investment..." |

### 5. Family & Values Manager

> **Defeats:** Cultural Blindness

| Attribute | Detail |
|-----------|--------|
| **Function** | Tracks family obligations without guilt, honors your values |
| **Key Insight** | Family support isn't a budget leak - it's a value to optimize around |
| **Feature** | Dependency ratio tracking, group savings support, non-judgmental messaging |

---

## Core Components

### Cash Flow Score (0-100)

A single number that captures financial health:

```
Score = (Savings Rate × 30) + (Runway × 25) + (Debt Health × 20)
      + (Family Sustainability × 15) + (Goal Progress × 10)
```

| Range | Status | Meaning |
|-------|--------|---------|
| 80-100 | Thriving | Building wealth actively |
| 60-79 | Stable | Solid foundation, room to grow |
| 40-59 | Caution | Needs attention in some areas |
| 20-39 | Stress | Immediate action needed |
| 0-19 | Crisis | Emergency intervention mode |

### Simulation Engine

- **10,000 Monte Carlo iterations** per projection
- **Dual-path visualization**: Current behavior vs. IKPA-guided behavior
- **Probability distributions** for realistic variance
- **Time horizons**: 1, 5, 10, and 20 years

### G-Eval Metrics

LLM-as-a-Judge evaluation system ensuring AI quality:

| Metric | Purpose |
|--------|---------|
| ToneEmpathy | Measures supportive, non-judgmental communication |
| FinancialSafety | Ensures advice doesn't recommend risky behavior |
| CulturalSensitivity | Respects family obligations and cultural context |
| GoalAlignment | Advice moves user toward their stated goals |
| InterventionEffectiveness | Tracks if user took action after advice |

### Story Cards

Viral sharing system for financial milestones:

- Auto-generated shareable cards for achievements
- Privacy-safe (no actual amounts visible)
- Platform-optimized for Twitter, Instagram, WhatsApp

### Opik Optimizer

AI agent optimization pipeline:

- **A/B Testing**: Compare prompt variations
- **Evolutionary Optimization**: Prompts evolve based on engagement
- **Online Evaluation**: Real-time quality monitoring
- **Experiment Tracking**: Full history of prompt performance

---

## Cultural Intelligence

> Most finance apps assume you live alone, have no family obligations, and only care about yourself. **That's not reality for most people.**

### What Makes IKPA Different

| Feature | Description |
|---------|-------------|
| **Family Support Tracking** | Dependency ratio calculated, not judged - supporting family isn't a "leak" |
| **Non-Judgmental Messaging** | Banned words: "wasted," "bad," "failed," "irresponsible" |
| **Context-Aware Advice** | Understands that financial decisions involve values, not just math |
| **Community Savings** | Support for group savings (rotating credit, savings circles) |
| **Multi-Currency** | Works with any currency - USD, EUR, GBP, and more |

### The Core Philosophy

**"I am because we are"** - Financial wellness isn't just individual. IKPA understands that your money decisions affect and are affected by the people you care about. We optimize around your values, not against them.

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Backend** | NestJS | 10.4.15 |
| **Database** | PostgreSQL | Latest |
| **ORM** | Prisma | 6.1.0 |
| **Cache** | Redis | Latest |
| **Frontend** | Next.js | 15.1.3 |
| **UI Framework** | React | 19 |
| **Styling** | TailwindCSS | 3.4.17 |
| **Mobile** | React Native/Expo | 52 |
| **AI Model** | Anthropic Claude | claude-sonnet-4-20250514 |
| **Observability** | Opik | 1.9.85 |
| **Package Manager** | pnpm | 10.0.0 |
| **Monorepo** | Turborepo | 2.3.3 |

---

## Project Structure

```
ikpa/
├── apps/
│   ├── api/              # NestJS backend (port 3000)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── ai/           # AI agents, Opik integration
│   │   │   │   ├── auth/         # Authentication
│   │   │   │   ├── finance/      # Cash flow, calculators
│   │   │   │   └── users/        # User management
│   │   │   └── common/           # Shared utilities
│   │   └── prisma/               # Database schema
│   ├── web/              # Next.js PWA (port 3001)
│   ├── landing/          # Marketing landing page (port 3002)
│   └── mobile/           # React Native/Expo app
├── packages/
│   └── shared/           # Shared types and utilities
├── docs/                 # 22+ implementation guides
│   ├── implementation/   # 12 feature-specific guides
│   └── *.md              # Core documentation
├── turbo.json            # Turborepo configuration
├── pnpm-workspace.yaml   # Workspace definition
└── package.json          # Root scripts
```

---

## Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 10.0.0
- **Docker** (for PostgreSQL + Redis)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/natquest/ikpa.git
cd ikpa

# 2. Install dependencies
pnpm install

# 3. Copy environment file
cp .env.example .env
# Edit .env with your API keys (especially ANTHROPIC_API_KEY)

# 4. Start Docker services (PostgreSQL + Redis)
docker-compose up -d

# 5. Generate Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# 6. Start development servers
pnpm dev
```

### Access URLs

| Service | URL |
|---------|-----|
| API (NestJS) | http://localhost:3000 |
| Web App (Next.js) | http://localhost:3001 |
| Landing Page | http://localhost:3002 |
| API Docs (Swagger) | http://localhost:3000/docs |
| Prisma Studio | http://localhost:5555 |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm lint:fix` | Run ESLint with auto-fix |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm clean` | Clean build artifacts and node_modules |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations (dev) |
| `pnpm db:push` | Push schema changes to database |
| `pnpm db:studio` | Open Prisma Studio |

---

## Environment Variables

### Application

```bash
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
```

### Database

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/ikpa?schema=public"
```

### Redis

```bash
REDIS_URL="redis://localhost:6379"
```

### Authentication

```bash
JWT_ACCESS_SECRET="your-access-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# OAuth (Optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### AI Service

```bash
ANTHROPIC_API_KEY="sk-ant-..."
```

### External Services

```bash
# AWS S3 (file storage)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
AWS_REGION="eu-west-1"

# Email (Resend)
RESEND_API_KEY=""
```

### Frontend URLs

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_LANDING_API_URL=http://localhost:3000
```

See [`.env.example`](.env.example) for the complete list.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`ikpa.md`](ikpa.md) | Complete product specification |
| [`ikpa-technical-spec.md`](ikpa-technical-spec.md) | Technical architecture deep-dive |
| [`ikpa-ui-guide.md`](ikpa-ui-guide.md) | Design system and UI patterns |
| [`hackathon-info.md`](hackathon-info.md) | Hackathon strategy and timeline |
| [`docs/`](docs/) | 22 implementation guides |
| [`docs/implementation/`](docs/implementation/) | 12 feature-specific guides |

### Implementation Guides

| Guide | Feature |
|-------|---------|
| [01-opik-integration.md](docs/implementation/01-opik-integration.md) | Opik tracing setup |
| [02-cash-flow-score.md](docs/implementation/02-cash-flow-score.md) | Financial health metric |
| [03-simulation-engine.md](docs/implementation/03-simulation-engine.md) | Monte Carlo projections |
| [04-shark-auditor.md](docs/implementation/04-shark-auditor.md) | Subscription detector |
| [05-gps-rerouter.md](docs/implementation/05-gps-rerouter.md) | Recovery path generator |
| [06-commitment-device.md](docs/implementation/06-commitment-device.md) | Stakes system |
| [07-future-self.md](docs/implementation/07-future-self.md) | Letter from 2045 |
| [08-ubuntu-manager.md](docs/implementation/08-ubuntu-manager.md) | Family obligations |
| [09-g-eval-metrics.md](docs/implementation/09-g-eval-metrics.md) | LLM evaluation |
| [10-story-cards.md](docs/implementation/10-story-cards.md) | Viral sharing |
| [11-opik-optimizer.md](docs/implementation/11-opik-optimizer.md) | Prompt evolution |

---

## API Overview

### AI Agent Endpoints

```
POST /v1/ai/chat              # Main AI coach conversation
POST /v1/ai/analyze           # Analyze financial situation
POST /v1/ai/recommend         # Personalized recommendations
POST /v1/ai/shark-audit       # Subscription audit
POST /v1/ai/gps-reroute       # Recovery path calculation
```

### Future Self Endpoints

```
POST /v1/future-self/letter   # Generate letter from future self
POST /v1/future-self/simulate # Run dual-path simulation
GET  /v1/future-self/history  # Previous letters
```

### Commitment Endpoints

```
POST /v1/commitment           # Create commitment contract
GET  /v1/commitment/active    # Active commitments
POST /v1/commitment/:id/verify # Verify completion
```

### Financial Metrics

```
GET  /v1/metrics/score        # Cash Flow Score
GET  /v1/metrics/breakdown    # Score component breakdown
GET  /v1/metrics/trends       # Historical trends
```

### Core Finance

```
POST /v1/finance/snapshot     # Submit financial snapshot
GET  /v1/finance/insights     # AI-generated insights
POST /v1/goals                # Create financial goal
GET  /v1/goals/progress       # Goal progress tracking
```

---

## Hackathon Context

### Event Details

| Attribute | Detail |
|-----------|--------|
| **Event** | Commit to Change: An AI Agents Hackathon |
| **Theme** | Ship Your Best Self |
| **Organizer** | lablab.ai |
| **Timeline** | January 13 - February 10, 2026 |

### Prize Tracks

| Track | Prize | Focus |
|-------|-------|-------|
| **Financial Health** | $5,000 | Help users achieve financial goals |
| **Best Use of Opik** | $5,000 | Deep integration, evaluation, optimization |
| **Maximum Prize** | **$10,000** | Both tracks |

### Why IKPA Wins

**Financial Health Track:**
- Behavior change focus (not just tracking)
- Cultural intelligence (first AI to understand family obligations)
- Non-predatory (intelligence layer, not lending)
- Practical metrics (actionable Cash Flow Score)

**Best Use of Opik Track:**
- Deep integration (not just logging - evaluation + optimization)
- Custom metrics (financial-domain-specific)
- Demonstrable improvement (before/after from Opik insights)
- Production-ready patterns (online evaluation, dashboards)

---

## Roadmap

### Hackathon Timeline

| Week | Focus | Features |
|------|-------|----------|
| **Week 1** | Foundation | Opik integration, Cash Flow Score, Simulation Engine |
| **Week 2** | Core Agents | Shark Auditor, GPS Re-Router, Commitment Device |
| **Week 3** | Differentiation | Future Self, Family & Values Manager, G-Eval, Story Cards |
| **Week 4** | Polish | Demo video, documentation, submission |

### Post-Hackathon Vision

| Phase | Features |
|-------|----------|
| **Q1 2026** | App Store releases (iOS + Android) |
| **Q2 2026** | Bank statement import (Mono, Flutterwave) |
| **Q3 2026** | Multi-language support (Yoruba, Swahili, Zulu) |
| **Q4 2026** | WhatsApp bot integration |

---

## Contributing

We welcome contributions! Here's how:

```bash
# 1. Fork the repository

# 2. Create a feature branch
git checkout -b feature/amazing-feature

# 3. Make your changes
# Follow existing patterns and coding style

# 4. Run quality checks
pnpm lint
pnpm typecheck
pnpm test

# 5. Commit your changes
git commit -m "Add amazing feature"

# 6. Push and create a Pull Request
git push origin feature/amazing-feature
```

### Guidelines

- Follow existing code patterns and architecture
- Write tests for new features
- Update documentation as needed
- Ensure all checks pass before submitting PR

---

## Team & License

### Team

**NatQuest Limited**

Building AI-powered solutions that understand how people actually live.

### License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **[Anthropic Claude](https://anthropic.com)** - AI backbone powering all agents
- **[Opik (Comet.ml)](https://www.comet.com/opik)** - LLM observability and optimization
- **[MIT Media Lab](https://www.media.mit.edu/projects/future-you/overview/)** - Future Self research foundation
- **[stickK.com](https://www.stickk.com/)** - Commitment device research validation
- **Behavioral Economics Research** - The science of commitment devices and behavior change

---

<p align="center">
  <strong>92% of financial resolutions fail. We built the science to change that.</strong>
</p>

<p align="center">
  <em>Because your financial future deserves more than generic advice.</em>
</p>
