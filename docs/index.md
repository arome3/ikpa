# IKPA Documentation

> AI-Powered Personal Finance Co-Pilot for Young Africans

---

## About This Documentation

This documentation provides comprehensive implementation guides for the Ikpa platform. Each document is designed to be self-contained, allowing developers to implement features independently while maintaining consistency with the overall architecture.

**Ikpa** (meaning "purse" in Igbo) is a financial intelligence platform that helps users understand, simulate, and plan their financial lives without touching their money.

---

## Quick Start

1. Begin with [00-project-setup.md](./00-project-setup.md) to set up the monorepo
2. Follow [01-database-design.md](./01-database-design.md) to create the database schema
3. Implement [02-api-foundation.md](./02-api-foundation.md) to establish API patterns
4. Continue with feature modules in numerical order

---

## Documentation Index

### Foundation (00-02)
| Document | Feature | Description |
|----------|---------|-------------|
| [00-project-setup.md](./00-project-setup.md) | Project Setup | Monorepo structure, pnpm workspace, Turborepo, environment configuration |
| [01-database-design.md](./01-database-design.md) | Database Design | PostgreSQL schema, Prisma models, migrations, enums |
| [02-api-foundation.md](./02-api-foundation.md) | API Foundation | NestJS setup, response formats, error handling, middleware |

### User & Authentication (03-04)
| Document | Feature | Description |
|----------|---------|-------------|
| [03-authentication.md](./03-authentication.md) | Authentication | JWT, refresh tokens, OAuth (Google/Apple), password reset |
| [04-user-management.md](./04-user-management.md) | User Management | Profile CRUD, settings, onboarding flow |

### Financial Data Modules (05-09)
| Document | Feature | Description |
|----------|---------|-------------|
| [05-income-sources.md](./05-income-sources.md) | Income Sources | Multi-source income tracking with frequency/variance |
| [06-expense-management.md](./06-expense-management.md) | Expense Management | Categories, recurring expenses, bulk operations |
| [07-savings-assets.md](./07-savings-assets.md) | Savings & Assets | Bank accounts, mobile money, ajo/susu, investments |
| [08-debt-management.md](./08-debt-management.md) | Debt Management | Loans, interest tracking, payment schedules |
| [09-family-support.md](./09-family-support.md) | Family Support | Africa-specific obligation tracking |

### Financial Intelligence (10-15)
| Document | Feature | Description |
|----------|---------|-------------|
| [10-financial-metrics.md](./10-financial-metrics.md) | Financial Metrics | Cash flow score, savings rate, runway, dependency ratio |
| [11-pattern-detection.md](./11-pattern-detection.md) | Pattern Detection | Spending patterns, anomalies, trends |
| [12-simulation-engine.md](./12-simulation-engine.md) | Simulation Engine | Future projections, scenario modeling |
| [13-goals-system.md](./13-goals-system.md) | Goals System | Goal CRUD, progress tracking, contributions |
| [14-ai-service.md](./14-ai-service.md) | AI Service | Claude integration, context building, prompts |
| [15-future-self-engine.md](./15-future-self-engine.md) | Future Self Engine | Dual-path visualization, narratives, letters |

### Frontend Applications (16-18)
| Document | Feature | Description |
|----------|---------|-------------|
| [16-mobile-app.md](./16-mobile-app.md) | Mobile App | React Native, navigation, state management |
| [17-web-pwa.md](./17-web-pwa.md) | Web PWA | Next.js, service workers, offline support |
| [18-landing-page.md](./18-landing-page.md) | Landing Page | Marketing site, waitlist, referrals |

### Design & Operations (19-21)
| Document | Feature | Description |
|----------|---------|-------------|
| [19-ui-design-system.md](./19-ui-design-system.md) | UI Design System | Colors, typography, components, motion |
| [20-infrastructure.md](./20-infrastructure.md) | Infrastructure | Docker, CI/CD, deployment, monitoring |
| [21-testing-strategy.md](./21-testing-strategy.md) | Testing Strategy | Unit, integration, E2E testing approaches |

---

## Technology Stack Overview

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | NestJS, TypeScript, Prisma | RESTful API |
| **Database** | PostgreSQL 15, Redis 7 | Data persistence, caching |
| **AI** | Claude API (Anthropic) | Financial reasoning, narratives |
| **Mobile** | React Native, Expo | iOS & Android apps |
| **Web** | Next.js 14, Tailwind CSS | Progressive Web App |
| **Infrastructure** | Docker, GitHub Actions | Containerization, CI/CD |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  iOS App    │  │ Android App │  │   Web PWA   │              │
│  │  (React     │  │  (React     │  │  (Next.js)  │              │
│  │  Native)    │  │  Native)    │  │             │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┴────────────────┴────────────────┴─────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    BACKEND API (NestJS)                    │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │  │
│  │  │  Auth   │  │  User   │  │ Finance │  │   AI    │      │  │
│  │  │ Module  │  │ Module  │  │ Module  │  │ Module  │      │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ PostgreSQL  │  │    Redis    │  │     S3      │              │
│  │  (Primary)  │  │   (Cache)   │  │  (Storage)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Product Layers

Ikpa is built on **five integrated layers**:

1. **Financial Lens (Clarity)** - Shows users where they stand financially
2. **Financial Educator (Understanding)** - Explains what numbers mean
3. **Simulator (What-If Engine)** - Models future scenarios
4. **Planner (Guided Action)** - Provides sequenced recommendations
5. **Mindset & Behavioral Layer** - Enables identity-level transformation

---

## Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **API-First** | Backend built independently of frontends |
| **Platform-Agnostic** | Same API serves mobile, web, future apps |
| **Offline-Capable** | Core features work without connectivity |
| **Security-First** | Encryption, auth, privacy by design |
| **Africa-Context** | Built for African financial realities |

---

## Source Specifications

This documentation synthesizes content from:
- `ikpa.md` - Product specifications and business logic
- `ikpa-technical-spec.md` - Technical architecture and API specs
- `ikpa-ui-guide.md` - Design system and UI components

---

*Ikpa: See your money clearly. Understand it deeply. Plan it wisely.*
