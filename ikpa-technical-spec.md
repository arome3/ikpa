# IKPA — Technical Specification Document
## AI-Powered Personal Finance Platform for Young Africans

---

**Version:** 1.0  
**Date:** December 2024  
**Status:** Draft  
**Classification:** Internal - Engineering  

---

## Table of Contents

1. [Technical Overview](#1-technical-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Database Design](#5-database-design)
6. [API Specification](#6-api-specification)
7. [AI Service Architecture](#7-ai-service-architecture)
8. [Finance Engine](#8-finance-engine)
9. [Authentication & Security](#9-authentication--security)
10. [Mobile Application](#10-mobile-application)
11. [Progressive Web Application](#11-progressive-web-application)
12. [Landing Page](#12-landing-page)
13. [Infrastructure & DevOps](#13-infrastructure--devops)
14. [Testing Strategy](#14-testing-strategy)
15. [Performance & Optimization](#15-performance--optimization)
16. [Monitoring & Observability](#16-monitoring--observability)
17. [Development Workflow](#17-development-workflow)
18. [Deployment Strategy](#18-deployment-strategy)
19. [Third-Party Integrations](#19-third-party-integrations)
20. [Data Privacy & Compliance](#20-data-privacy--compliance)
21. [Technical Roadmap](#21-technical-roadmap)

---

## 1. Technical Overview

### 1.1 System Components

| Component | Description | Technology |
|-----------|-------------|------------|
| **Backend API** | RESTful API serving all clients | Node.js, NestJS, TypeScript |
| **AI Service** | Claude-powered reasoning engine | Anthropic Claude API |
| **Finance Engine** | Calculations, simulations, projections | TypeScript, Decimal.js |
| **Mobile App** | iOS & Android application | React Native |
| **PWA** | Progressive Web Application | Next.js 14 |
| **Landing Page** | Marketing & waitlist | Next.js 14 |
| **Database** | Primary data store | PostgreSQL 15 |
| **Cache** | Sessions, caching, queues | Redis 7 |

### 1.2 Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                     DESIGN PRINCIPLES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  API-FIRST           Build backend independently of frontends   │
│  PLATFORM-AGNOSTIC   Same API serves mobile, web, future apps   │
│  OFFLINE-CAPABLE     Core features work without connectivity    │
│  SECURITY-FIRST      Encryption, auth, privacy by design        │
│  SCALABLE            Horizontal scaling from day one            │
│  OBSERVABLE          Comprehensive logging, metrics, tracing    │
│  TESTABLE            High coverage; automated testing pipeline  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Development Phases

```
PHASE 0: Landing Page ────────────────────── Weeks 1-3
         • Marketing site
         • Waitlist collection  
         • Email nurture setup

PHASE 1: Backend & AI ────────────────────── Months 1-3
         • Core API
         • AI Service integration
         • Finance Engine
         • Database & infrastructure

PHASE 2: Frontends ───────────────────────── Months 3-5
         • React Native mobile app
         • Next.js PWA
         • Shared packages

PHASE 3: Launch & Scale ──────────────────── Months 5-6
         • Beta testing
         • Production deployment
         • Monitoring & optimization
```

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   iOS App   │    │ Android App │    │   PWA/Web   │                 │
│  │   (React    │    │   (React    │    │  (Next.js)  │                 │
│  │   Native)   │    │   Native)   │    │             │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         └──────────────────┼──────────────────┘                         │
└────────────────────────────┼────────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         EDGE LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      CDN (Cloudflare)                            │   │
│  │  • Static assets    • DDoS protection    • Edge caching          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    API Gateway / Load Balancer                   │   │
│  │  • Rate limiting    • Request routing    • SSL termination       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      BACKEND API (NestJS)                         │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │  │
│  │  │  Auth   │  │  User   │  │ Finance │  │   AI    │             │  │
│  │  │ Module  │  │ Module  │  │ Module  │  │ Module  │             │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │  │
│  │  │ Income  │  │ Expense │  │  Goals  │  │ Assets  │             │  │
│  │  │ Module  │  │ Module  │  │ Module  │  │ Module  │             │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐            │
│  │ AI Service  │      │  Finance    │      │   Queue     │            │
│  │  (Claude)   │      │   Engine    │      │  (BullMQ)   │            │
│  └─────────────┘      └─────────────┘      └─────────────┘            │
└────────────────────────────┼────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │ PostgreSQL  │    │    Redis    │    │     S3      │                │
│  │  (Primary)  │    │   (Cache)   │    │  (Storage)  │                │
│  └─────────────┘    └─────────────┘    └─────────────┘                │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
User Input Flow:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │───►│Validation│───►│ Business │───►│ Database │
│  Input   │    │  Layer   │    │  Logic   │    │  Write   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

Metrics Calculation Flow:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Database │───►│ Finance  │───►│  Cache   │───►│  Client  │
│   Read   │    │  Engine  │    │ (Redis)  │    │ Response │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

AI Interaction Flow:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Query   │───►│ Context  │───►│  Claude  │───►│ Formatted│
│          │    │ Assembly │    │   API    │    │ Response │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## 3. Technology Stack

### 3.1 Backend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 20 LTS | JavaScript runtime |
| Language | TypeScript | 5.x | Type safety |
| Framework | NestJS | 10.x | Backend framework |
| ORM | Prisma | 5.x | Database access |
| Validation | class-validator | 0.14.x | DTO validation |
| API Docs | Swagger/OpenAPI | 3.0 | Documentation |
| Queue | BullMQ | 5.x | Background jobs |
| Cache | ioredis | 5.x | Redis client |

### 3.2 Database Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Primary DB | PostgreSQL 15 | Transactional data |
| Cache | Redis 7 | Sessions, caching, queues |
| File Storage | AWS S3 / Cloudflare R2 | Document storage |

### 3.3 AI Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| LLM Provider | Anthropic Claude | AI reasoning |
| Model | claude-sonnet-4-20250514 | Primary model |
| SDK | @anthropic-ai/sdk | API integration |

### 3.4 Frontend Stack (Mobile)

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | React Native | 0.73.x | Cross-platform |
| Navigation | React Navigation | 6.x | Navigation |
| State | Zustand | 4.x | State management |
| Data | TanStack Query | 5.x | Server state |
| Forms | React Hook Form | 7.x | Form handling |
| Storage | MMKV | 2.x | Local storage |
| Charts | Victory Native | 37.x | Visualization |

### 3.5 Frontend Stack (PWA)

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | 14.x | React framework |
| Styling | Tailwind CSS | 3.x | CSS |
| Components | shadcn/ui | - | UI components |
| State | Zustand | 4.x | State management |
| Data | TanStack Query | 5.x | Server state |
| Charts | Recharts | 2.x | Visualization |
| PWA | next-pwa | 5.x | PWA support |

### 3.6 Infrastructure Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Cloud | AWS / Railway | Hosting |
| Container | Docker | Containerization |
| CI/CD | GitHub Actions | Automation |
| CDN | Cloudflare | Edge & security |
| Monitoring | Sentry + Axiom | Observability |

### 3.7 Development Tools

| Tool | Purpose |
|------|---------|
| Turborepo | Monorepo management |
| pnpm | Package manager |
| ESLint + Prettier | Linting & formatting |
| Husky | Git hooks |
| Vitest | Unit testing |
| Playwright | E2E testing |

---

## 4. Project Structure

### 4.1 Monorepo Structure

```
ikpa/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-api.yml
│       ├── deploy-web.yml
│       └── deploy-mobile.yml
│
├── apps/
│   ├── api/                          # Backend API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.module.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── dto/
│   │   │   │   │   ├── guards/
│   │   │   │   │   └── strategies/
│   │   │   │   ├── user/
│   │   │   │   ├── transaction/
│   │   │   │   ├── income/
│   │   │   │   ├── expense/
│   │   │   │   ├── asset/
│   │   │   │   ├── debt/
│   │   │   │   ├── goal/
│   │   │   │   ├── family-support/
│   │   │   │   ├── finance/
│   │   │   │   │   ├── finance.module.ts
│   │   │   │   │   ├── finance.controller.ts
│   │   │   │   │   ├── finance.service.ts
│   │   │   │   │   ├── calculators/
│   │   │   │   │   │   ├── metrics.calculator.ts
│   │   │   │   │   │   └── projection.calculator.ts
│   │   │   │   │   ├── simulation/
│   │   │   │   │   │   └── simulation.engine.ts
│   │   │   │   │   └── patterns/
│   │   │   │   │       └── pattern-detector.ts
│   │   │   │   ├── ai/
│   │   │   │   │   ├── ai.module.ts
│   │   │   │   │   ├── ai.controller.ts
│   │   │   │   │   ├── ai.service.ts
│   │   │   │   │   ├── context-builder.ts
│   │   │   │   │   ├── prompt-templates.ts
│   │   │   │   │   └── response-parser.ts
│   │   │   │   └── notification/
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   └── pipes/
│   │   │   ├── config/
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma
│   │   │   │   ├── migrations/
│   │   │   │   └── seed.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── mobile/                       # React Native App
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   └── _layout.tsx       # Expo Router layout
│   │   │   ├── screens/
│   │   │   │   ├── auth/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── transactions/
│   │   │   │   ├── ai/
│   │   │   │   ├── goals/
│   │   │   │   └── profile/
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── transactions/
│   │   │   │   ├── ai/
│   │   │   │   └── common/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── stores/
│   │   │   ├── utils/
│   │   │   └── constants/
│   │   ├── assets/
│   │   ├── android/
│   │   ├── ios/
│   │   └── package.json
│   │
│   ├── web/                          # Next.js PWA
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/
│   │   │   │   │   ├── register/
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── transactions/
│   │   │   │   │   ├── ai/
│   │   │   │   │   ├── goals/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── stores/
│   │   ├── public/
│   │   │   ├── manifest.json
│   │   │   └── icons/
│   │   ├── next.config.js
│   │   └── package.json
│   │
│   └── landing/                      # Landing Page
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx
│       │   │   ├── blog/
│       │   │   └── api/waitlist/
│       │   └── components/
│       ├── content/blog/
│       └── package.json
│
├── packages/
│   ├── shared/                       # Shared code
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── client.ts
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── auth.ts
│   │   │   │   │   ├── user.ts
│   │   │   │   │   ├── income.ts
│   │   │   │   │   ├── expense.ts
│   │   │   │   │   ├── finance.ts
│   │   │   │   │   ├── ai.ts
│   │   │   │   │   └── goals.ts
│   │   │   │   └── index.ts
│   │   │   ├── types/
│   │   │   │   ├── user.ts
│   │   │   │   ├── transaction.ts
│   │   │   │   ├── finance.ts
│   │   │   │   ├── ai.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   ├── currency.ts
│   │   │   │   ├── date.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   │   ├── categories.ts
│   │   │   │   ├── countries.ts
│   │   │   │   ├── currencies.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── eslint-config/
│       └── package.json
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### 4.2 Module Structure Pattern

```
modules/{module-name}/
├── {name}.module.ts          # Module definition
├── {name}.controller.ts      # HTTP handlers
├── {name}.service.ts         # Business logic
├── {name}.repository.ts      # Data access (optional)
├── dto/
│   ├── create-{name}.dto.ts
│   ├── update-{name}.dto.ts
│   └── query-{name}.dto.ts
├── entities/
│   └── {name}.entity.ts
├── interfaces/
│   └── {name}.interface.ts
└── __tests__/
    ├── {name}.controller.spec.ts
    └── {name}.service.spec.ts
```

---

## 5. Database Design

### 5.1 Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    ENTITY RELATIONSHIP DIAGRAM                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                              ┌──────────────┐                            │
│                              │     USER     │                            │
│                              ├──────────────┤                            │
│                              │ id           │                            │
│                              │ email        │                            │
│                              │ password_hash│                            │
│                              │ name         │                            │
│                              │ country      │                            │
│                              │ currency     │                            │
│                              └──────┬───────┘                            │
│                                     │                                     │
│     ┌───────────────┬───────────────┼───────────────┬───────────────┐    │
│     │               │               │               │               │    │
│     ▼               ▼               ▼               ▼               ▼    │
│ ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐     │
│ │ INCOME │    │EXPENSE │    │SAVINGS │    │  DEBT  │    │  GOAL  │     │
│ │ SOURCE │    │        │    │ACCOUNT │    │        │    │        │     │
│ └────────┘    └────┬───┘    └────────┘    └────────┘    └────────┘     │
│                    │                                                     │
│                    ▼                                                     │
│              ┌──────────┐                                               │
│              │ EXPENSE  │                                               │
│              │ CATEGORY │                                               │
│              └──────────┘                                               │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │ FAMILY_SUPPORT  │    │   INVESTMENT    │    │    SNAPSHOT     │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐                            │
│  │AI_CONVERSATION  │    │ WAITLIST_ENTRY  │                            │
│  └─────────────────┘    └─────────────────┘                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Prisma Schema

```prisma
// apps/api/src/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// ENUMS
// ============================================================================

enum Country {
  NIGERIA
  GHANA
  KENYA
  SOUTH_AFRICA
  RWANDA
  UGANDA
  TANZANIA
  OTHER
}

enum Currency {
  NGN
  GHS
  KES
  ZAR
  RWF
  UGX
  TZS
  USD
  GBP
  EUR
}

enum IncomeType {
  SALARY
  FREELANCE
  BUSINESS
  INVESTMENT
  RENTAL
  GIFT
  OTHER
}

enum Frequency {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  QUARTERLY
  ANNUALLY
  ONE_TIME
  IRREGULAR
}

enum EmploymentType {
  EMPLOYED_FULL_TIME
  EMPLOYED_PART_TIME
  SELF_EMPLOYED
  FREELANCER
  BUSINESS_OWNER
  STUDENT
  UNEMPLOYED
  RETIRED
}

enum ExpenseCategoryType {
  FIXED
  VARIABLE
  DISCRETIONARY
}

enum SavingsType {
  BANK_ACCOUNT
  MOBILE_MONEY
  CASH
  AJO_ESUSU
  FIXED_DEPOSIT
  OTHER
}

enum InvestmentType {
  STOCKS
  BONDS
  MUTUAL_FUND
  REAL_ESTATE
  LAND
  CRYPTO
  BUSINESS_STAKE
  PENSION
  OTHER
}

enum DebtType {
  BANK_LOAN
  CREDIT_CARD
  MORTGAGE
  CAR_LOAN
  PERSONAL_LOAN
  BNPL
  OTHER
}

enum Relationship {
  PARENT
  SIBLING
  CHILD
  SPOUSE
  EXTENDED_FAMILY
  FRIEND
  OTHER
}

enum GoalStatus {
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}

enum GoalCategory {
  EMERGENCY_FUND
  DEBT_PAYOFF
  SAVINGS
  INVESTMENT
  MAJOR_PURCHASE
  EDUCATION
  TRAVEL
  RETIREMENT
  BUSINESS
  OTHER
}

// ============================================================================
// MODELS
// ============================================================================

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  passwordHash        String?   @map("password_hash")
  name                String
  country             Country   @default(NIGERIA)
  currency            Currency  @default(NGN)
  timezone            String    @default("Africa/Lagos")
  onboardingCompleted Boolean   @default(false) @map("onboarding_completed")
  dateOfBirth         DateTime? @map("date_of_birth")
  employmentType      EmploymentType? @map("employment_type")
  notificationsEnabled Boolean  @default(true) @map("notifications_enabled")
  weeklyReportEnabled Boolean   @default(true) @map("weekly_report_enabled")
  
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  lastLoginAt         DateTime? @map("last_login_at")
  
  // Relations
  incomeSources       IncomeSource[]
  expenses            Expense[]
  savingsAccounts     SavingsAccount[]
  debts               Debt[]
  goals               Goal[]
  familySupports      FamilySupport[]
  investments         Investment[]
  snapshots           FinancialSnapshot[]
  aiConversations     AIConversation[]
  refreshTokens       RefreshToken[]
  
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("refresh_tokens")
}

model IncomeSource {
  id                 String      @id @default(cuid())
  userId             String      @map("user_id")
  name               String
  type               IncomeType
  amount             Decimal     @db.Decimal(15, 2)
  currency           Currency    @default(NGN)
  frequency          Frequency
  isActive           Boolean     @default(true) @map("is_active")
  description        String?
  variancePercentage Float?      @map("variance_percentage")
  
  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")
  
  user               User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("income_sources")
}

model ExpenseCategory {
  id        String              @id @default(cuid())
  name      String
  type      ExpenseCategoryType
  icon      String
  color     String              @default("#6B7280")
  isSystem  Boolean             @default(false) @map("is_system")
  
  expenses  Expense[]
  
  @@map("expense_categories")
}

model Expense {
  id          String          @id @default(cuid())
  userId      String          @map("user_id")
  categoryId  String          @map("category_id")
  amount      Decimal         @db.Decimal(15, 2)
  currency    Currency        @default(NGN)
  date        DateTime        @db.Date
  description String?
  isRecurring Boolean         @default(false) @map("is_recurring")
  frequency   Frequency?
  merchant    String?
  location    String?
  
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")
  
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])
  
  @@index([userId, date])
  @@map("expenses")
}

model SavingsAccount {
  id                    String     @id @default(cuid())
  userId                String     @map("user_id")
  name                  String
  type                  SavingsType
  balance               Decimal    @db.Decimal(15, 2)
  currency              Currency   @default(NGN)
  contributionAmount    Decimal?   @db.Decimal(15, 2) @map("contribution_amount")
  contributionFrequency Frequency? @map("contribution_frequency")
  nextContributionDate  DateTime?  @map("next_contribution_date")
  
  lastUpdated           DateTime   @default(now()) @map("last_updated")
  createdAt             DateTime   @default(now()) @map("created_at")
  
  user                  User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("savings_accounts")
}

model Investment {
  id              String          @id @default(cuid())
  userId          String          @map("user_id")
  name            String
  type            InvestmentType
  value           Decimal         @db.Decimal(15, 2)
  currency        Currency        @default(NGN)
  acquisitionDate DateTime?       @map("acquisition_date")
  acquisitionCost Decimal?        @db.Decimal(15, 2) @map("acquisition_cost")
  notes           String?
  
  lastUpdated     DateTime        @default(now()) @map("last_updated")
  createdAt       DateTime        @default(now()) @map("created_at")
  
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("investments")
}

model Debt {
  id               String     @id @default(cuid())
  userId           String     @map("user_id")
  name             String
  type             DebtType
  principal        Decimal    @db.Decimal(15, 2)
  interestRate     Float      @map("interest_rate")
  monthlyPayment   Decimal    @db.Decimal(15, 2) @map("monthly_payment")
  remainingBalance Decimal    @db.Decimal(15, 2) @map("remaining_balance")
  currency         Currency   @default(NGN)
  startDate        DateTime   @map("start_date")
  endDate          DateTime?  @map("end_date")
  
  createdAt        DateTime   @default(now()) @map("created_at")
  updatedAt        DateTime   @updatedAt @map("updated_at")
  
  user             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("debts")
}

model FamilySupport {
  id            String       @id @default(cuid())
  userId        String       @map("user_id")
  recipientName String       @map("recipient_name")
  relationship  Relationship
  amount        Decimal      @db.Decimal(15, 2)
  currency      Currency     @default(NGN)
  frequency     Frequency
  isActive      Boolean      @default(true) @map("is_active")
  startDate     DateTime     @map("start_date")
  endDate       DateTime?    @map("end_date")
  notes         String?
  
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("family_supports")
}

model Goal {
  id            String       @id @default(cuid())
  userId        String       @map("user_id")
  name          String
  description   String?
  targetAmount  Decimal      @db.Decimal(15, 2) @map("target_amount")
  currentAmount Decimal      @default(0) @db.Decimal(15, 2) @map("current_amount")
  currency      Currency     @default(NGN)
  targetDate    DateTime?    @map("target_date")
  priority      Int          @default(1)
  status        GoalStatus   @default(ACTIVE)
  category      GoalCategory
  
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("goals")
}

model FinancialSnapshot {
  id              String    @id @default(cuid())
  userId          String    @map("user_id")
  date            DateTime  @db.Date
  
  cashFlowScore   Int       @map("cash_flow_score")
  savingsRate     Float     @map("savings_rate")
  runwayMonths    Float     @map("runway_months")
  burnRate        Decimal   @db.Decimal(15, 2) @map("burn_rate")
  dependencyRatio Float     @map("dependency_ratio")
  netWorth        Decimal   @db.Decimal(15, 2) @map("net_worth")
  
  totalIncome     Decimal   @db.Decimal(15, 2) @map("total_income")
  totalExpenses   Decimal   @db.Decimal(15, 2) @map("total_expenses")
  totalSavings    Decimal   @db.Decimal(15, 2) @map("total_savings")
  totalDebt       Decimal   @db.Decimal(15, 2) @map("total_debt")
  totalAssets     Decimal   @db.Decimal(15, 2) @map("total_assets")
  totalSupport    Decimal   @db.Decimal(15, 2) @map("total_support")
  
  currency        Currency  @default(NGN)
  createdAt       DateTime  @default(now()) @map("created_at")
  
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, date])
  @@index([userId, date])
  @@map("financial_snapshots")
}

model AIConversation {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  title     String?
  messages  Json     // [{role, content, timestamp}]
  context   Json?
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, createdAt])
  @@map("ai_conversations")
}

model WaitlistEntry {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String?
  country      Country?
  referralCode String?   @map("referral_code")
  referredBy   String?   @map("referred_by")
  source       String?
  
  createdAt    DateTime  @default(now()) @map("created_at")
  
  @@map("waitlist_entries")
}
```

### 5.3 Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX idx_expenses_user_category ON expenses(user_id, category_id);
CREATE INDEX idx_expenses_user_recurring ON expenses(user_id) WHERE is_recurring = true;
CREATE INDEX idx_income_sources_user_active ON income_sources(user_id) WHERE is_active = true;
CREATE INDEX idx_snapshots_user_date ON financial_snapshots(user_id, date DESC);
CREATE INDEX idx_ai_conversations_user_recent ON ai_conversations(user_id, created_at DESC);
CREATE INDEX idx_family_support_user_active ON family_supports(user_id) WHERE is_active = true;
CREATE INDEX idx_goals_user_active ON goals(user_id, priority) WHERE status = 'ACTIVE';
```

---

## 6. API Specification

### 6.1 Base Configuration

```
Production:  https://api.ikpa.app/v1
Staging:     https://api.staging.ikpa.app/v1
Development: http://localhost:3000/v1
```

### 6.2 Standard Response Format

```typescript
// Success Response
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
      nextCursor?: string;
    };
  };
}

// Error Response
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}
```

### 6.3 Authentication Endpoints

```yaml
POST /v1/auth/register:
  body: { email, password, name, country? }
  response: { user, accessToken, refreshToken }

POST /v1/auth/login:
  body: { email, password }
  response: { user, accessToken, refreshToken }

POST /v1/auth/refresh:
  body: { refreshToken }
  response: { accessToken, refreshToken }

POST /v1/auth/logout:
  headers: Authorization: Bearer <token>
  body: { refreshToken }

POST /v1/auth/forgot-password:
  body: { email }

POST /v1/auth/reset-password:
  body: { token, password }

POST /v1/auth/google:
  body: { idToken }
  response: { user, accessToken, refreshToken, isNewUser }

POST /v1/auth/apple:
  body: { identityToken, authorizationCode, fullName? }
  response: { user, accessToken, refreshToken, isNewUser }
```

### 6.4 User Endpoints

```yaml
GET /v1/users/me:
  response: User

PATCH /v1/users/me:
  body: { name?, country?, currency?, timezone?, dateOfBirth?, employmentType? }
  response: User

PATCH /v1/users/me/settings:
  body: { notificationsEnabled?, weeklyReportEnabled? }

POST /v1/users/me/complete-onboarding:
  response: User

DELETE /v1/users/me:
  body: { password }

GET /v1/users/me/export:
  response: { downloadUrl, expiresAt }
```

### 6.5 Income Endpoints

```yaml
GET /v1/income:
  query: { active?: boolean }
  response: IncomeSource[]

POST /v1/income:
  body: { name, type, amount, currency?, frequency, variancePercentage?, description? }
  response: IncomeSource

GET /v1/income/:id:
  response: IncomeSource

PATCH /v1/income/:id:
  body: { name?, type?, amount?, frequency?, isActive?, variancePercentage?, description? }
  response: IncomeSource

DELETE /v1/income/:id:
```

### 6.6 Expense Endpoints

```yaml
GET /v1/expenses:
  query: { startDate?, endDate?, categoryId?, isRecurring?, limit?, cursor? }
  response: { data: Expense[], meta: { pagination } }

POST /v1/expenses:
  body: { categoryId, amount, date, description?, isRecurring?, frequency?, merchant? }
  response: Expense

POST /v1/expenses/bulk:
  body: { expenses: CreateExpenseDto[] }
  response: { created: number, expenses: Expense[] }

GET /v1/expenses/:id:
  response: Expense

PATCH /v1/expenses/:id:
  response: Expense

DELETE /v1/expenses/:id:

GET /v1/expenses/categories:
  response: ExpenseCategory[]

GET /v1/expenses/summary:
  query: { startDate, endDate }
  response: {
    total: number,
    byCategory: { categoryId, categoryName, amount, percentage, count }[],
    byDay: { date, amount }[]
  }
```

### 6.7 Assets & Liabilities Endpoints

```yaml
# Savings
GET /v1/savings:
POST /v1/savings:
PATCH /v1/savings/:id:
DELETE /v1/savings/:id:

# Investments
GET /v1/investments:
POST /v1/investments:
PATCH /v1/investments/:id:
DELETE /v1/investments/:id:

# Debts
GET /v1/debts:
POST /v1/debts:
PATCH /v1/debts/:id:
DELETE /v1/debts/:id:

# Family Support
GET /v1/family-support:
POST /v1/family-support:
PATCH /v1/family-support/:id:
DELETE /v1/family-support/:id:
```

### 6.8 Goals Endpoints

```yaml
GET /v1/goals:
  query: { status?: GoalStatus }
  response: Goal[]

POST /v1/goals:
  body: { name, description?, targetAmount, targetDate?, priority?, category }
  response: Goal

GET /v1/goals/:id:
  response: {
    goal: Goal,
    projections: {
      estimatedCompletionDate: DateTime,
      monthlyContributionNeeded: number,
      onTrack: boolean
    }
  }

PATCH /v1/goals/:id:
  response: Goal

POST /v1/goals/:id/contribute:
  body: { amount, date? }
  response: Goal

DELETE /v1/goals/:id:
```

### 6.9 Finance Engine Endpoints

```yaml
GET /v1/finance/snapshot:
  response: {
    cashFlowScore: number,      # 0-100
    savingsRate: number,        # percentage
    runwayMonths: number,
    burnRate: number,
    dependencyRatio: number,    # percentage
    netWorth: number,
    totalIncome: number,
    totalExpenses: number,
    totalSavings: number,
    totalDebt: number,
    totalAssets: number,
    totalSupport: number,
    currency: Currency,
    calculatedAt: DateTime
  }

GET /v1/finance/snapshot/history:
  query: { startDate?, endDate?, interval?: "day" | "week" | "month" }
  response: FinancialSnapshot[]

GET /v1/finance/metrics/:metric:
  params: { metric: "cash-flow" | "savings-rate" | "runway" | "dependency" | "net-worth" }
  response: {
    current: number,
    change: number,
    trend: "up" | "down" | "stable",
    history: { date, value }[],
    breakdown: object
  }

GET /v1/finance/patterns:
  response: {
    patterns: {
      type: string,
      description: string,
      impact: "positive" | "negative" | "neutral",
      frequency: string,
      amount?: number
    }[]
  }

POST /v1/finance/simulate:
  body: {
    scenario: "CURRENT_TRAJECTORY" | "INCOME_CHANGE" | "EXPENSE_REDUCTION" | 
              "GOAL_ACCELERATION" | "LIFE_EVENT" | "ECONOMIC_SHOCK",
    parameters: object,
    timeframeMonths: number
  }
  response: {
    projections: { month, netWorth, cashFlow, runway, savingsRate }[],
    summary: { finalNetWorth, totalSaved, goalsAchieved, risks },
    comparison?: object
  }

POST /v1/finance/future-self:
  body: {
    timeframeYears: number,
    includeNarrative?: boolean,
    includeLetter?: boolean
  }
  response: {
    currentPath: {
      projections: Projection[],
      narrative: string,
      keyMilestones: Milestone[],
      risks: string[]
    },
    optimizedPath: {
      projections: Projection[],
      narrative: string,
      keyMilestones: Milestone[],
      changes: string[]
    },
    divergencePoint: {
      description: string,
      monthlyDifference: number,
      breakdown: object
    },
    letter?: string
  }
```

### 6.10 AI Endpoints

```yaml
POST /v1/ai/ask:
  body: {
    message: string,
    conversationId?: string,
    context?: { includeSnapshot?, includeGoals?, includePatterns? }
  }
  response: {
    response: string,
    conversationId: string,
    suggestedActions?: { type, label, payload }[]
  }

POST /v1/ai/explain:
  body: {
    topic: string,
    context?: "metric" | "concept" | "recommendation",
    userValue?: number
  }
  response: {
    explanation: string,
    relevance: string,
    actions?: string[]
  }

POST /v1/ai/insight:
  body: { type?: "spending" | "saving" | "goal" | "general" }
  response: {
    insight: string,
    category: string,
    actionable: boolean,
    suggestedAction?: object
  }

POST /v1/ai/plan:
  body: {
    horizon: "short" | "medium" | "long" | "all",
    focusAreas?: string[]
  }
  response: {
    phases: {
      name: string,
      duration: string,
      goals: string[],
      actions: { priority, action, rationale, impact }[]
    }[],
    projectedOutcome: string
  }

GET /v1/ai/conversations:
  query: { limit?, cursor? }
  response: AIConversation[]

GET /v1/ai/conversations/:id:
  response: AIConversation

DELETE /v1/ai/conversations/:id:
```

### 6.11 Waitlist Endpoints (Public)

```yaml
POST /v1/waitlist:
  body: { email, name?, country?, referralCode?, source? }
  response: { message, position, referralCode }

GET /v1/waitlist/count:
  response: { count }
```

### 6.12 Error Codes

```typescript
const ErrorCodes = {
  // Authentication (1xxx)
  AUTH_INVALID_CREDENTIALS: 'AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'AUTH_1002',
  AUTH_TOKEN_INVALID: 'AUTH_1003',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_1004',
  
  // Validation (2xxx)
  VALIDATION_ERROR: 'VAL_2001',
  VALIDATION_REQUIRED_FIELD: 'VAL_2002',
  VALIDATION_INVALID_FORMAT: 'VAL_2003',
  
  // Resources (3xxx)
  RESOURCE_NOT_FOUND: 'RES_3001',
  RESOURCE_ALREADY_EXISTS: 'RES_3002',
  RESOURCE_CONFLICT: 'RES_3003',
  
  // Rate Limiting (4xxx)
  RATE_LIMIT_EXCEEDED: 'RATE_4001',
  
  // AI Service (5xxx)
  AI_SERVICE_ERROR: 'AI_5001',
  AI_RATE_LIMIT: 'AI_5002',
  
  // Server (9xxx)
  INTERNAL_ERROR: 'SRV_9001',
  SERVICE_UNAVAILABLE: 'SRV_9002',
};
```

---

## 7. AI Service Architecture

### 7.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI SERVICE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    CONTEXT      │  │    PROMPT       │  │   RESPONSE      │         │
│  │    BUILDER      │  │   TEMPLATES     │  │    PARSER       │         │
│  │                 │  │                 │  │                 │         │
│  │ • User profile  │  │ • System        │  │ • Validation    │         │
│  │ • Snapshot      │  │   prompts       │  │ • Formatting    │         │
│  │ • Goals         │  │ • Task prompts  │  │ • Action        │         │
│  │ • History       │  │ • Few-shot      │  │   extraction    │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│           └────────────────────┼────────────────────┘                   │
│                                ▼                                        │
│                     ┌─────────────────────┐                            │
│                     │   CLAUDE CLIENT     │                            │
│                     │                     │                            │
│                     │ • API calls         │                            │
│                     │ • Retry logic       │                            │
│                     │ • Rate limiting     │                            │
│                     └─────────────────────┘                            │
│                                │                                        │
└────────────────────────────────┼────────────────────────────────────────┘
                                 ▼
                      ┌─────────────────────┐
                      │   ANTHROPIC API     │
                      │   (Claude claude-sonnet-4-20250514)    │
                      └─────────────────────┘
```

### 7.2 AI Service Implementation

```typescript
// apps/api/src/modules/ai/ai.service.ts

@Injectable()
export class AIService {
  private readonly client: Anthropic;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(
    private readonly config: ConfigService,
    private readonly contextBuilder: ContextBuilder,
    private readonly responseParser: ResponseParser,
  ) {
    this.client = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
    });
  }

  async ask(userId: string, message: string, conversationId?: string): Promise<AIResponse> {
    const context = await this.contextBuilder.buildContext(userId, {
      includeSnapshot: true,
      includeGoals: true,
      includePatterns: true,
    });

    const history = conversationId
      ? await this.getConversationHistory(conversationId)
      : [];

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: PromptTemplates.systemPrompt(context),
      messages: [...history, { role: 'user', content: message }],
    });

    return this.responseParser.parse(response);
  }

  async explain(userId: string, topic: string, userValue?: number): Promise<ExplanationResponse> {
    const context = await this.contextBuilder.buildContext(userId, {
      includeSnapshot: true,
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: PromptTemplates.educatorSystemPrompt(),
      messages: [{
        role: 'user',
        content: PromptTemplates.explainPrompt(topic, context, userValue)
      }],
    });

    return this.responseParser.parseExplanation(response);
  }

  async generateFutureSelf(
    userId: string,
    timeframeYears: number,
    options: FutureSelfOptions,
  ): Promise<FutureSelfResponse> {
    const context = await this.contextBuilder.buildFullContext(userId);
    const projections = await this.financeEngine.comparePaths(userId, timeframeYears);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: PromptTemplates.futureSelfSystemPrompt(),
      messages: [{
        role: 'user',
        content: PromptTemplates.futureSelfPrompt(context, projections, timeframeYears, options)
      }],
    });

    return this.responseParser.parseFutureSelf(response);
  }

  async generatePlan(userId: string, horizon: PlanHorizon): Promise<FinancialPlan> {
    const context = await this.contextBuilder.buildContext(userId, {
      includeSnapshot: true,
      includeGoals: true,
      includeDebts: true,
      includeSupport: true,
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: PromptTemplates.plannerSystemPrompt(),
      messages: [{
        role: 'user',
        content: PromptTemplates.planPrompt(context, horizon)
      }],
    });

    return this.responseParser.parsePlan(response);
  }
}
```

### 7.3 Context Builder

```typescript
// apps/api/src/modules/ai/context-builder.ts

@Injectable()
export class ContextBuilder {
  async buildContext(userId: string, options: ContextOptions): Promise<AIContext> {
    const user = await this.userService.findById(userId);
    
    const context: AIContext = {
      user: {
        name: user.name,
        country: user.country,
        currency: user.currency,
        employmentType: user.employmentType,
      },
    };

    if (options.includeSnapshot) {
      context.snapshot = await this.financeService.getCurrentSnapshot(userId);
    }

    if (options.includeGoals) {
      context.goals = await this.goalService.findActive(userId);
    }

    if (options.includePatterns) {
      context.patterns = await this.financeService.detectPatterns(userId);
    }

    if (options.includeIncome) {
      context.income = await this.financeService.getIncomeSummary(userId);
    }

    if (options.includeExpenses) {
      context.expenses = await this.financeService.getExpenseSummary(userId);
    }

    if (options.includeDebts) {
      context.debts = await this.financeService.getDebtSummary(userId);
    }

    if (options.includeSupport) {
      context.familySupport = await this.financeService.getSupportSummary(userId);
    }

    return context;
  }

  async buildFullContext(userId: string): Promise<AIContext> {
    return this.buildContext(userId, {
      includeSnapshot: true,
      includeGoals: true,
      includePatterns: true,
      includeIncome: true,
      includeExpenses: true,
      includeDebts: true,
      includeSupport: true,
    });
  }
}
```

### 7.4 Prompt Templates

```typescript
// apps/api/src/modules/ai/prompt-templates.ts

export class PromptTemplates {
  static systemPrompt(context: AIContext): string {
    return `You are Ikpa, an AI-powered personal finance co-pilot for young Africans.

Your role is to help users understand their finances, make better decisions, and build wealth.

USER CONTEXT:
Name: ${context.user.name}
Country: ${context.user.country}
Currency: ${context.user.currency}
Employment: ${context.user.employmentType || 'Not specified'}

FINANCIAL SNAPSHOT:
${this.formatSnapshot(context.snapshot)}

${context.goals ? `ACTIVE GOALS:\n${this.formatGoals(context.goals)}` : ''}

GUIDELINES:
1. Always use ${context.user.currency} for monetary values
2. Consider family obligations as normal, not obstacles
3. Acknowledge economic realities (inflation, currency volatility)
4. Provide specific, actionable guidance
5. Explain concepts simply
6. Never promise specific returns
7. Encourage without moralizing`;
  }

  static futureSelfSystemPrompt(): string {
    return `You are Ikpa's Future Self Engine. Create vivid narratives that help users connect with their future selves.

Generate two parallel futures:
1. CURRENT PATH: What happens continuing as-is
2. OPTIMIZED PATH: What happens with achievable improvements

GUIDELINES:
- Be specific and personal
- Show life outcomes, not just metrics
- Make both paths realistic
- Identify the divergence point
- Use narrative, not bullet points
- Account for African context`;
  }

  static futureSelfPrompt(
    context: AIContext,
    projections: PathComparison,
    years: number,
    options: FutureSelfOptions,
  ): string {
    return `Generate a Future Self comparison for ${context.user.name}.

TIMEFRAME: ${years} years

CURRENT SITUATION:
${JSON.stringify(context, null, 2)}

PROJECTIONS:
${JSON.stringify(projections, null, 2)}

Generate:
1. CURRENT PATH narrative (2-3 paragraphs)
2. OPTIMIZED PATH narrative (2-3 paragraphs)  
3. DIVERGENCE POINT - the single biggest change
${options.includeLetter ? '4. Letter from optimized future self' : ''}`;
  }

  static educatorSystemPrompt(): string {
    return `You are Ikpa's Financial Educator. Explain concepts clearly and personally.

GUIDELINES:
- Use simple language
- Connect to user's situation
- Explain why it matters for them
- Suggest actionable next steps`;
  }

  static plannerSystemPrompt(): string {
    return `You are Ikpa's Financial Planner. Create realistic, sequenced plans.

GUIDELINES:
- Prioritize by impact
- Explain rationale for sequence
- Account for African context
- Be realistic about timelines
- Build in flexibility`;
  }

  private static formatSnapshot(snapshot?: FinancialSnapshot): string {
    if (!snapshot) return 'No data available';
    return `
Cash Flow Score: ${snapshot.cashFlowScore}/100
Savings Rate: ${snapshot.savingsRate}%
Runway: ${snapshot.runwayMonths} months
Dependency Ratio: ${snapshot.dependencyRatio}%
Net Worth: ${snapshot.netWorth}`;
  }
}
```

### 7.5 Rate Limiting

```typescript
// apps/api/src/modules/ai/ai-rate-limiter.ts

@Injectable()
export class AIRateLimiter {
  private readonly limits = {
    ask: { points: 20, duration: 60 },           // 20/min
    explain: { points: 30, duration: 60 },       // 30/min
    futureSelf: { points: 5, duration: 3600 },   // 5/hour
    plan: { points: 10, duration: 3600 },        // 10/hour
  };

  async checkLimit(userId: string, operation: string): Promise<void> {
    const key = `ai:${operation}:${userId}`;
    const limit = this.limits[operation];
    
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, limit.duration);
    }
    
    if (current > limit.points) {
      throw new TooManyRequestsException(`AI rate limit exceeded for ${operation}`);
    }
  }
}
```

---

## 8. Finance Engine

### 8.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FINANCE ENGINE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    METRICS CALCULATOR                            │   │
│  │  Cash Flow Score │ Savings Rate │ Runway │ Net Worth │ Burn Rate│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SIMULATION ENGINE                             │   │
│  │  Projections │ Scenarios │ Monte Carlo │ Path Comparison        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PATTERN DETECTOR                              │   │
│  │  Spending Patterns │ Anomalies │ Trends │ Recurring Detection   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ECONOMIC CONTEXT                              │   │
│  │  Inflation Rates │ FX Rates │ Interest Rates                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Metrics Calculator

```typescript
// apps/api/src/modules/finance/calculators/metrics.calculator.ts

@Injectable()
export class MetricsCalculator {
  
  /**
   * Cash Flow Health Score (0-100)
   * 
   * Components:
   * - Savings rate (30%)
   * - Runway months (25%)
   * - Debt-to-income (20%)
   * - Income stability (15%)
   * - Expense control (10%)
   */
  calculateCashFlowScore(data: FinancialData): number {
    const savingsScore = this.scoreSavingsRate(data.savingsRate);
    const runwayScore = this.scoreRunway(data.runwayMonths);
    const debtScore = this.scoreDebtRatio(data.totalDebt, data.totalIncome);
    const stabilityScore = data.incomeStability;
    const controlScore = this.scoreExpenseControl(data.expenseVariance);

    const weightedScore = 
      savingsScore * 0.30 +
      runwayScore * 0.25 +
      debtScore * 0.20 +
      stabilityScore * 0.15 +
      controlScore * 0.10;

    return Math.round(Math.max(0, Math.min(100, weightedScore)));
  }

  /**
   * Savings Rate = (Income - Expenses) / Income * 100
   */
  calculateSavingsRate(income: Decimal, expenses: Decimal): number {
    if (income.isZero()) return 0;
    return income.minus(expenses).dividedBy(income).times(100).toNumber();
  }

  /**
   * Runway = Liquid Savings / Monthly Expenses
   */
  calculateRunway(liquidSavings: Decimal, monthlyExpenses: Decimal): number {
    if (monthlyExpenses.isZero()) return 12;
    return Math.min(24, liquidSavings.dividedBy(monthlyExpenses).toNumber());
  }

  /**
   * Dependency Ratio = Monthly Support / Monthly Income * 100
   */
  calculateDependencyRatio(monthlySupport: Decimal, monthlyIncome: Decimal): number {
    if (monthlyIncome.isZero()) return 0;
    return monthlySupport.dividedBy(monthlyIncome).times(100).toNumber();
  }

  /**
   * Net Worth = Assets - Liabilities
   */
  calculateNetWorth(
    savings: SavingsAccount[],
    investments: Investment[],
    debts: Debt[],
  ): Decimal {
    const totalAssets = savings.reduce((s, a) => s.plus(a.balance), new Decimal(0))
      .plus(investments.reduce((s, i) => s.plus(i.value), new Decimal(0)));
    
    const totalDebt = debts.reduce((s, d) => s.plus(d.remainingBalance), new Decimal(0));

    return totalAssets.minus(totalDebt);
  }

  // Scoring helpers
  private scoreSavingsRate(rate: number): number {
    if (rate >= 30) return 100;
    if (rate >= 20) return 80;
    if (rate >= 15) return 65;
    if (rate >= 10) return 50;
    if (rate >= 5) return 30;
    if (rate > 0) return 15;
    return 0;
  }

  private scoreRunway(months: number): number {
    if (months >= 12) return 100;
    if (months >= 6) return 80;
    if (months >= 3) return 60;
    if (months >= 1) return 30;
    return 0;
  }

  private scoreDebtRatio(debt: Decimal, income: Decimal): number {
    if (income.isZero()) return 50;
    const ratio = debt.dividedBy(income).toNumber();
    if (ratio === 0) return 100;
    if (ratio < 0.2) return 90;
    if (ratio < 0.4) return 70;
    if (ratio < 0.6) return 50;
    return 30;
  }
}
```

### 8.3 Simulation Engine

```typescript
// apps/api/src/modules/finance/simulation/simulation.engine.ts

@Injectable()
export class SimulationEngine {
  
  async projectFuture(
    userId: string,
    monthsAhead: number,
    scenario: SimulationScenario = 'CURRENT_TRAJECTORY',
    parameters?: ScenarioParameters,
  ): Promise<Projection[]> {
    const currentState = await this.getCurrentState(userId);
    const projections: Projection[] = [];

    let state = { ...currentState };

    for (let month = 1; month <= monthsAhead; month++) {
      state = this.simulateMonth(state, scenario, parameters, month);
      
      projections.push({
        month,
        date: addMonths(new Date(), month),
        netWorth: state.netWorth,
        totalSavings: state.totalSavings,
        totalDebt: state.totalDebt,
        cashFlow: state.monthlyIncome - state.monthlyExpenses,
        runway: state.totalSavings / state.monthlyExpenses,
        savingsRate: ((state.monthlyIncome - state.monthlyExpenses) / state.monthlyIncome) * 100,
      });
    }

    return projections;
  }

  private simulateMonth(
    state: FinancialState,
    scenario: SimulationScenario,
    parameters: ScenarioParameters,
    month: number,
  ): FinancialState {
    const newState = { ...state };

    // Apply scenario adjustments
    switch (scenario) {
      case 'INCOME_CHANGE':
        if (month >= (parameters?.incomeChangeMonth || 1)) {
          newState.monthlyIncome *= (1 + (parameters?.incomeChangePercent || 0) / 100);
        }
        break;

      case 'EXPENSE_REDUCTION':
        newState.monthlyExpenses *= (1 - (parameters?.expenseReductionPercent || 0) / 100);
        break;

      case 'OPTIMIZED':
        newState.monthlyExpenses *= 0.9;  // 10% reduction
        break;
    }

    // Apply inflation
    const monthlyInflation = Math.pow(1 + (parameters?.annualInflation || 0.15), 1/12) - 1;
    newState.monthlyExpenses *= (1 + monthlyInflation);

    // Calculate savings
    const monthlySavings = newState.monthlyIncome - newState.monthlyExpenses;
    newState.totalSavings += Math.max(0, monthlySavings);
    
    // Apply debt payments
    if (newState.totalDebt > 0 && newState.debtPayment) {
      const payment = Math.min(newState.debtPayment, newState.totalDebt);
      newState.totalDebt -= payment;
    }

    // Investment growth
    const monthlyReturn = Math.pow(1 + (parameters?.annualReturn || 0.08), 1/12) - 1;
    newState.investmentValue *= (1 + monthlyReturn);

    // Update net worth
    newState.netWorth = newState.totalSavings + newState.investmentValue - newState.totalDebt;

    return newState;
  }

  async comparePaths(userId: string, yearsAhead: number): Promise<PathComparison> {
    const months = yearsAhead * 12;

    const currentPath = await this.projectFuture(userId, months, 'CURRENT_TRAJECTORY');
    const optimizedPath = await this.projectFuture(userId, months, 'OPTIMIZED');

    const currentState = await this.getCurrentState(userId);
    const monthlyDifference = currentState.monthlyIncome * 0.1 + currentState.monthlyExpenses * 0.1;

    return {
      currentPath,
      optimizedPath,
      divergence: {
        monthlyDifference,
        yearlyDifference: monthlyDifference * 12,
        netWorthDifferenceAtEnd: optimizedPath[months - 1].netWorth - currentPath[months - 1].netWorth,
      },
    };
  }
}
```

### 8.4 Pattern Detector

```typescript
// apps/api/src/modules/finance/patterns/pattern-detector.ts

@Injectable()
export class PatternDetector {
  
  async detectPatterns(userId: string): Promise<SpendingPattern[]> {
    const expenses = await this.expenseRepository.findByUser(userId, {
      startDate: subMonths(new Date(), 6),
    });

    const patterns: SpendingPattern[] = [];

    // Month-end spending spike
    const monthEndPattern = this.analyzeMonthEndPattern(expenses);
    if (monthEndPattern) patterns.push(monthEndPattern);

    // Category trends
    patterns.push(...this.analyzeCategoryTrends(expenses));

    // Recurring detection
    patterns.push(...this.detectRecurringExpenses(expenses));

    return patterns;
  }

  private analyzeMonthEndPattern(expenses: Expense[]): SpendingPattern | null {
    const firstHalf = expenses.filter(e => getDate(e.date) <= 15);
    const lastWeek = expenses.filter(e => getDate(e.date) > 23);

    const firstHalfAvg = this.average(firstHalf.map(e => Number(e.amount)));
    const lastWeekAvg = this.average(lastWeek.map(e => Number(e.amount)));

    if (lastWeekAvg > firstHalfAvg * 1.5) {
      return {
        type: 'MONTH_END_SPIKE',
        description: 'You spend significantly more in the last week of the month',
        impact: 'negative',
        recommendation: 'Consider weekly budgeting to smooth spending',
      };
    }

    return null;
  }

  private detectRecurringExpenses(expenses: Expense[]): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    const grouped = groupBy(expenses.filter(e => e.merchant), e => 
      `${e.merchant}:${Math.round(Number(e.amount) / 100) * 100}`
    );

    for (const [key, exps] of Object.entries(grouped)) {
      if (exps.length >= 2) {
        const sorted = sortBy(exps, 'date');
        const intervals = [];
        
        for (let i = 1; i < sorted.length; i++) {
          intervals.push(differenceInDays(sorted[i].date, sorted[i-1].date));
        }

        const avgInterval = this.average(intervals);
        const variance = this.variance(intervals);

        if (variance < avgInterval * 0.2) {
          patterns.push({
            type: 'RECURRING_DETECTED',
            description: `${exps[0].merchant} appears recurring (~${avgInterval} days)`,
            impact: 'neutral',
            actionable: true,
          });
        }
      }
    }

    return patterns;
  }
}
```

---

## 9. Authentication & Security

### 9.1 JWT Configuration

```typescript
// apps/api/src/modules/auth/auth.config.ts

export const AuthConfig = {
  jwt: {
    accessToken: {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    },
  },
  bcrypt: {
    saltRounds: 12,
  },
};
```

### 9.2 Auth Service

```typescript
// apps/api/src/modules/auth/auth.service.ts

@Injectable()
export class AuthService {
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.userService.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      name: dto.name,
      country: dto.country || Country.NIGERIA,
    });

    const tokens = await this.generateTokens(user);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userService.findByEmail(dto.email.toLowerCase());
    
    if (!user || !await bcrypt.compare(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userService.updateLastLogin(user.id);
    const tokens = await this.generateTokens(user);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);
    
    const storedToken = await this.findRefreshToken(refreshToken);
    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.revokeRefreshToken(refreshToken);
    return this.generateTokens(user);
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    await this.storeRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }
}
```

### 9.3 Security Middleware

```typescript
// apps/api/src/main.ts

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }));

  // CORS
  app.enableCors({
    origin: [
      'https://ikpa.app',
      'https://www.ikpa.app',
      ...(process.env.NODE_ENV === 'development' 
        ? ['http://localhost:3000', 'http://localhost:8081'] 
        : []),
    ],
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(process.env.PORT || 3000);
}
```

---

## 10. Mobile Application

### 10.1 Navigation Structure

```typescript
// apps/mobile/src/navigation/types.ts

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  AI: undefined;
  Goals: undefined;
  Profile: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  MetricDetail: { metric: string };
  FutureSelf: undefined;
};
```

### 10.2 State Management

```typescript
// apps/mobile/src/stores/auth.store.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/storage';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  
  setAuth: (user: User, tokens: TokenPair) => void;
  setTokens: (tokens: TokenPair) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, tokens) => set({
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isAuthenticated: true,
      }),

      setTokens: (tokens) => set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),

      logout: () => set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
```

### 10.3 API Hooks

```typescript
// apps/mobile/src/hooks/finance.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@ikpa/shared';

export function useSnapshot() {
  return useQuery({
    queryKey: ['finance', 'snapshot'],
    queryFn: () => api.finance.getSnapshot(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useExpenses(params?: ExpenseQueryParams) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.expenses.list(params),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseDto) => api.expenses.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'snapshot'] });
    },
  });
}

export function useFutureSelf(params: FutureSelfParams) {
  return useQuery({
    queryKey: ['future-self', params],
    queryFn: () => api.finance.futureSelf(params),
    staleTime: 1000 * 60 * 60,
    enabled: !!params.timeframeYears,
  });
}
```

---

## 11. Progressive Web Application

### 11.1 PWA Configuration

```javascript
// apps/web/next.config.js

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.ikpa\.app\/v1\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 2592000 },
      },
    },
  ],
});

module.exports = withPWA({
  reactStrictMode: true,
  transpilePackages: ['@ikpa/shared'],
});
```

### 11.2 Web Manifest

```json
{
  "name": "Ikpa - Personal Finance Co-Pilot",
  "short_name": "Ikpa",
  "description": "AI-powered personal finance for young Africans",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#10B981",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 12. Landing Page

### 12.1 Waitlist API

```typescript
// apps/landing/src/app/api/waitlist/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  country: z.enum(['NIGERIA', 'GHANA', 'KENYA', 'SOUTH_AFRICA', 'OTHER']).optional(),
  referralCode: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = schema.parse(body);

    const existing = await prisma.waitlistEntry.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Already registered' }, { status: 409 });
    }

    const referralCode = `IKPA${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const entry = await prisma.waitlistEntry.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        country: data.country,
        referralCode,
        referredBy: data.referralCode,
        source: data.source,
      },
    });

    const position = await prisma.waitlistEntry.count({
      where: { createdAt: { lte: entry.createdAt } },
    });

    return NextResponse.json({ message: 'Success', position, referralCode });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

---

## 13. Infrastructure & DevOps

### 13.1 Docker Configuration

```dockerfile
# apps/api/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN pnpm --filter api prisma generate
RUN pnpm --filter api build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

### 13.2 Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/ikpa
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=ikpa

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 13.3 GitHub Actions CI

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ikpa_test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm --filter api prisma generate
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ikpa_test
          REDIS_URL: redis://localhost:6379

  build:
    runs-on: ubuntu-latest
    needs: lint-and-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

---

## 14. Testing Strategy

### 14.1 Testing Pyramid

```
              ┌─────────────┐
              │    E2E      │  10%
              │ (Playwright)│
              └──────┬──────┘
                     │
            ┌────────┴────────┐
            │  Integration    │  30%
            │  (API tests)    │
            └────────┬────────┘
                     │
     ┌───────────────┴───────────────┐
     │         Unit Tests            │  60%
     │         (Vitest)              │
     └───────────────────────────────┘
```

### 14.2 Unit Test Example

```typescript
// apps/api/src/modules/finance/__tests__/metrics.calculator.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCalculator } from '../calculators/metrics.calculator';
import Decimal from 'decimal.js';

describe('MetricsCalculator', () => {
  let calculator: MetricsCalculator;

  beforeEach(() => {
    calculator = new MetricsCalculator();
  });

  describe('calculateSavingsRate', () => {
    it('should calculate correct savings rate', () => {
      const income = new Decimal(500000);
      const expenses = new Decimal(400000);
      
      expect(calculator.calculateSavingsRate(income, expenses)).toBe(20);
    });

    it('should return 0 for zero income', () => {
      expect(calculator.calculateSavingsRate(new Decimal(0), new Decimal(100000))).toBe(0);
    });
  });

  describe('calculateRunway', () => {
    it('should calculate correct runway', () => {
      const savings = new Decimal(1500000);
      const expenses = new Decimal(500000);
      
      expect(calculator.calculateRunway(savings, expenses)).toBe(3);
    });

    it('should cap at 24 months', () => {
      expect(calculator.calculateRunway(new Decimal(50000000), new Decimal(500000))).toBe(24);
    });
  });
});
```

---

## 15. Performance & Optimization

### 15.1 Caching Strategy

```typescript
// apps/api/src/common/cache/cache.service.ts

@Injectable()
export class CacheService {
  private readonly ttl = {
    snapshot: 300,      // 5 minutes
    patterns: 3600,     // 1 hour
    categories: 86400,  // 24 hours
  };

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.redis.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await fetcher();
    await this.redis.setex(key, ttl || 300, JSON.stringify(data));
    
    return data;
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}
```

### 15.2 Database Optimization

```typescript
// Query optimization example
async getExpenseSummary(userId: string, startDate: Date, endDate: Date) {
  return this.prisma.expense.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
    _count: true,
  });
}
```

---

## 16. Monitoring & Observability

### 16.1 Logging

```typescript
// apps/api/src/common/logger/logger.service.ts

@Injectable()
export class LoggerService {
  private logger: Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    });
  }

  log(message: string, context?: object) {
    this.logger.info({ ...context }, message);
  }

  error(message: string, error?: Error, context?: object) {
    this.logger.error({ ...context, error: error?.stack }, message);
  }
}
```

### 16.2 Error Tracking

```typescript
// apps/api/src/common/sentry/sentry.config.ts

import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

---

## 17. Development Workflow

### 17.1 Git Workflow

```
main ─────────────────────────────────────────►
  │
  └─► develop ────────────────────────────────►
        │
        ├─► feature/auth ──────► PR ──► merge
        │
        ├─► feature/finance ───► PR ──► merge
        │
        └─► fix/bug-123 ───────► PR ──► merge
```

### 17.2 Branch Naming

```
feature/  - New features
fix/      - Bug fixes
refactor/ - Code refactoring
docs/     - Documentation
test/     - Tests
```

### 17.3 Commit Convention

```
feat: add user authentication
fix: resolve snapshot calculation bug
docs: update API documentation
refactor: simplify finance engine
test: add unit tests for metrics
chore: update dependencies
```

---

## 18. Deployment Strategy

### 18.1 Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| Development | Local development | localhost:3000 |
| Staging | Pre-production testing | staging.ikpa.app |
| Production | Live application | ikpa.app |

### 18.2 Deployment Flow

```
Code Push → CI Tests → Build → Deploy to Staging → Manual QA → Deploy to Production
```

---

## 19. Third-Party Integrations

| Service | Purpose | Priority |
|---------|---------|----------|
| Anthropic Claude | AI reasoning | P0 |
| Sentry | Error tracking | P0 |
| Resend | Email delivery | P1 |
| Cloudflare | CDN & security | P1 |
| AWS S3 | File storage | P2 |
| Firebase | Push notifications | P2 |

---

## 20. Data Privacy & Compliance

### 20.1 Data Handling

- All financial data encrypted at rest (AES-256)
- TLS 1.3 for data in transit
- User data never sold to third parties
- Users can export and delete their data

### 20.2 Compliance

- NDPR (Nigeria Data Protection Regulation)
- POPIA (South Africa)
- GDPR principles for data handling

---

## 21. Technical Roadmap

### Phase 0: Landing Page (Weeks 1-3)
- [ ] Next.js landing page
- [ ] Waitlist API
- [ ] Email integration
- [ ] Analytics setup

### Phase 1: Backend (Months 1-3)
- [ ] NestJS API setup
- [ ] Database schema
- [ ] Auth module
- [ ] User module
- [ ] Income/Expense modules
- [ ] Finance engine
- [ ] AI service integration
- [ ] Testing

### Phase 2: Frontends (Months 3-5)
- [ ] React Native mobile app
- [ ] Next.js PWA
- [ ] Shared packages
- [ ] Cross-platform testing

### Phase 3: Launch (Months 5-6)
- [ ] Beta testing
- [ ] Performance optimization
- [ ] Production deployment
- [ ] Monitoring setup

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2024 | NatQuest Limited | Initial specification |

---

**End of Technical Specification**