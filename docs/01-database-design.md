# Database Design

## Overview

This document covers the PostgreSQL database design for Ikpa, including the complete Prisma schema, entity relationships, and migration workflows. The database is designed to handle personal finance data with support for African-specific financial concepts like family support obligations and informal savings (ajo/susu).

---

## Technical Specifications

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 15.x | Primary database |
| Prisma | 5.x | ORM and migration management |
| Redis | 7.x | Caching and rate limiting |

### Architecture Decisions

- **Prisma ORM**: Type-safe database access with auto-generated client
- **Decimal precision**: Using `Decimal` type for all monetary values (avoids floating-point errors)
- **Soft deletes**: Not implemented - hard deletes with cascade for data minimization
- **UUID primary keys**: For security and distributed systems compatibility
- **Timezone-aware dates**: All timestamps stored in UTC

---

## Key Capabilities

- Multi-currency support for African currencies
- Income tracking with variance for irregular income
- Expense categorization with recurring detection
- Savings across multiple account types (bank, mobile money, ajo/susu)
- Debt tracking with interest calculations
- Family support obligation modeling
- Goal tracking with contribution history
- Financial snapshot history for trends
- AI conversation persistence

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────┐                                                          │
│    │    USER     │                                                          │
│    └──────┬──────┘                                                          │
│           │                                                                  │
│    ┌──────┼──────┬──────────┬──────────┬──────────┬──────────┐             │
│    │      │      │          │          │          │          │             │
│    ▼      ▼      ▼          ▼          ▼          ▼          ▼             │
│ ┌──────┐ ┌──────┐ ┌────────┐ ┌───────┐ ┌───────┐ ┌──────┐ ┌──────┐       │
│ │Income│ │Expense│ │Savings │ │ Debt  │ │Support│ │ Goal │ │Snapshot│     │
│ │Source│ │      │ │Account │ │       │ │       │ │      │ │       │       │
│ └──────┘ └───┬──┘ └────────┘ └───────┘ └───────┘ └──┬───┘ └───────┘       │
│              │                                       │                      │
│              ▼                                       ▼                      │
│         ┌────────┐                            ┌────────────┐                │
│         │Category│                            │Contribution│                │
│         └────────┘                            └────────────┘                │
│                                                                              │
│    ┌─────────────┐        ┌─────────────┐                                  │
│    │ Investment  │        │ AIConversation│                                │
│    └─────────────┘        └──────┬──────┘                                  │
│                                  │                                          │
│                                  ▼                                          │
│                           ┌────────────┐                                    │
│                           │ AIMessage  │                                    │
│                           └────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Step 1: Prisma Setup

```bash
# Navigate to API app
cd apps/api

# Install Prisma
pnpm add prisma @prisma/client
pnpm add -D prisma

# Initialize Prisma
npx prisma init
```

### Step 2: Configure Prisma

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 3: Define Enums

```prisma
// apps/api/prisma/schema.prisma

// ============================================
// ENUMS
// ============================================

enum Country {
  NIGERIA
  GHANA
  KENYA
  SOUTH_AFRICA
  EGYPT
  OTHER
}

enum Currency {
  NGN
  GHS
  KES
  ZAR
  EGP
  USD
}

enum EmploymentType {
  EMPLOYED
  SELF_EMPLOYED
  FREELANCER
  BUSINESS_OWNER
  STUDENT
  UNEMPLOYED
  OTHER
}

enum IncomeType {
  SALARY
  FREELANCE
  BUSINESS
  INVESTMENT
  RENTAL
  ALLOWANCE
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
}

enum SavingsType {
  BANK_ACCOUNT
  MOBILE_MONEY
  CASH
  FIXED_DEPOSIT
  AJO_SUSU        // Rotating savings
  COOPERATIVE
  OTHER
}

enum InvestmentType {
  STOCKS
  BONDS
  MUTUAL_FUNDS
  REAL_ESTATE
  CRYPTO
  PENSION
  OTHER
}

enum DebtType {
  BANK_LOAN
  CREDIT_CARD
  BNPL          // Buy Now Pay Later
  PERSONAL_LOAN
  MORTGAGE
  STUDENT_LOAN
  BUSINESS_LOAN
  OTHER
}

enum RelationshipType {
  PARENT
  SIBLING
  EXTENDED_FAMILY
  SPOUSE
  CHILD
  FRIEND
  COMMUNITY
  OTHER
}

enum GoalCategory {
  EMERGENCY_FUND
  SAVINGS
  INVESTMENT
  DEBT_PAYOFF
  MAJOR_PURCHASE
  EDUCATION
  TRAVEL
  FAMILY
  BUSINESS
  RETIREMENT
  OTHER
}

enum GoalStatus {
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}
```

### Step 4: User Model

```prisma
// apps/api/prisma/schema.prisma

model User {
  id                   String    @id @default(uuid())
  email                String    @unique
  passwordHash         String?
  name                 String
  country              Country   @default(NIGERIA)
  currency             Currency  @default(NGN)
  timezone             String    @default("Africa/Lagos")
  dateOfBirth          DateTime?
  employmentType       EmploymentType?
  onboardingCompleted  Boolean   @default(false)
  notificationsEnabled Boolean   @default(true)
  weeklyReportEnabled  Boolean   @default(true)
  lastLoginAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  // OAuth
  googleId             String?   @unique
  appleId              String?   @unique

  // Relations
  incomeSources        IncomeSource[]
  expenses             Expense[]
  savingsAccounts      SavingsAccount[]
  investments          Investment[]
  debts                Debt[]
  familySupport        FamilySupport[]
  goals                Goal[]
  snapshots            FinancialSnapshot[]
  refreshTokens        RefreshToken[]
  aiConversations      AIConversation[]

  @@index([email])
  @@index([country])
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@map("refresh_tokens")
}
```

### Step 5: Income Model

```prisma
// apps/api/prisma/schema.prisma

model IncomeSource {
  id                 String      @id @default(uuid())
  userId             String
  name               String
  type               IncomeType
  amount             Decimal     @db.Decimal(15, 2)
  currency           Currency    @default(NGN)
  frequency          Frequency
  variancePercentage Int         @default(0)  // For irregular income
  description        String?
  isActive           Boolean     @default(true)
  startDate          DateTime    @default(now())
  endDate            DateTime?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("income_sources")
}
```

### Step 6: Expense Models

```prisma
// apps/api/prisma/schema.prisma

model ExpenseCategory {
  id          String    @id @default(uuid())
  name        String
  icon        String
  color       String
  isDefault   Boolean   @default(false)
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())

  expenses Expense[]

  @@map("expense_categories")
}

model Expense {
  id          String    @id @default(uuid())
  userId      String
  categoryId  String
  amount      Decimal   @db.Decimal(15, 2)
  currency    Currency  @default(NGN)
  date        DateTime
  description String?
  merchant    String?
  isRecurring Boolean   @default(false)
  frequency   Frequency?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  category ExpenseCategory @relation(fields: [categoryId], references: [id])

  @@index([userId])
  @@index([userId, date])
  @@index([userId, categoryId])
  @@index([userId, isRecurring])
  @@map("expenses")
}
```

### Step 7: Savings & Investment Models

```prisma
// apps/api/prisma/schema.prisma

model SavingsAccount {
  id              String      @id @default(uuid())
  userId          String
  name            String
  type            SavingsType
  balance         Decimal     @db.Decimal(15, 2)
  currency        Currency    @default(NGN)
  interestRate    Decimal?    @db.Decimal(5, 2)
  institution     String?
  accountNumber   String?     // Last 4 digits only
  isEmergencyFund Boolean     @default(false)
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("savings_accounts")
}

model Investment {
  id            String         @id @default(uuid())
  userId        String
  name          String
  type          InvestmentType
  value         Decimal        @db.Decimal(15, 2)
  currency      Currency       @default(NGN)
  costBasis     Decimal?       @db.Decimal(15, 2)
  institution   String?
  notes         String?
  isActive      Boolean        @default(true)
  purchaseDate  DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("investments")
}
```

### Step 8: Debt Model

```prisma
// apps/api/prisma/schema.prisma

model Debt {
  id               String    @id @default(uuid())
  userId           String
  name             String
  type             DebtType
  originalAmount   Decimal   @db.Decimal(15, 2)
  remainingBalance Decimal   @db.Decimal(15, 2)
  currency         Currency  @default(NGN)
  interestRate     Decimal   @db.Decimal(5, 2)
  minimumPayment   Decimal   @db.Decimal(15, 2)
  dueDate          Int?      // Day of month (1-31)
  institution      String?
  notes            String?
  isActive         Boolean   @default(true)
  startDate        DateTime
  targetPayoffDate DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("debts")
}
```

### Step 9: Family Support Model

```prisma
// apps/api/prisma/schema.prisma

model FamilySupport {
  id               String           @id @default(uuid())
  userId           String
  name             String           // "Mom", "Brother Emeka", etc.
  relationship     RelationshipType
  amount           Decimal          @db.Decimal(15, 2)
  currency         Currency         @default(NGN)
  frequency        Frequency
  description      String?
  isActive         Boolean          @default(true)
  startDate        DateTime         @default(now())
  endDate          DateTime?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("family_support")
}
```

### Step 10: Goal Model

```prisma
// apps/api/prisma/schema.prisma

model Goal {
  id            String       @id @default(uuid())
  userId        String
  name          String
  description   String?
  category      GoalCategory
  targetAmount  Decimal      @db.Decimal(15, 2)
  currentAmount Decimal      @db.Decimal(15, 2) @default(0)
  currency      Currency     @default(NGN)
  targetDate    DateTime?
  priority      Int          @default(0)
  status        GoalStatus   @default(ACTIVE)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  user          User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  contributions GoalContribution[]

  @@index([userId])
  @@index([userId, status])
  @@map("goals")
}

model GoalContribution {
  id        String   @id @default(uuid())
  goalId    String
  amount    Decimal  @db.Decimal(15, 2)
  date      DateTime @default(now())
  note      String?
  createdAt DateTime @default(now())

  goal Goal @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@index([goalId])
  @@index([goalId, date])
  @@map("goal_contributions")
}
```

### Step 11: Financial Snapshot Model

```prisma
// apps/api/prisma/schema.prisma

model FinancialSnapshot {
  id              String   @id @default(uuid())
  userId          String
  date            DateTime @default(now())

  // Core metrics
  cashFlowScore   Int      // 0-100
  savingsRate     Decimal  @db.Decimal(5, 2)
  runwayMonths    Decimal  @db.Decimal(5, 2)
  burnRate        Decimal  @db.Decimal(15, 2)
  dependencyRatio Decimal  @db.Decimal(5, 2)

  // Totals
  netWorth        Decimal  @db.Decimal(15, 2)
  totalIncome     Decimal  @db.Decimal(15, 2)
  totalExpenses   Decimal  @db.Decimal(15, 2)
  totalSavings    Decimal  @db.Decimal(15, 2)
  totalDebt       Decimal  @db.Decimal(15, 2)
  totalAssets     Decimal  @db.Decimal(15, 2)
  totalSupport    Decimal  @db.Decimal(15, 2)

  currency        Currency @default(NGN)
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, date])
  @@map("financial_snapshots")
}
```

### Step 12: AI Conversation Models

```prisma
// apps/api/prisma/schema.prisma

model AIConversation {
  id        String      @id @default(uuid())
  userId    String
  title     String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  user     User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages AIMessage[]

  @@index([userId])
  @@index([userId, updatedAt])
  @@map("ai_conversations")
}

model AIMessage {
  id             String   @id @default(uuid())
  conversationId String
  role           String   // 'user' | 'assistant'
  content        String   @db.Text
  createdAt      DateTime @default(now())

  conversation AIConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("ai_messages")
}
```

### Step 13: Waitlist Model (Landing Page)

```prisma
// apps/api/prisma/schema.prisma

model WaitlistEntry {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String?
  country      Country?
  referralCode String   @unique
  referredBy   String?
  source       String?
  createdAt    DateTime @default(now())

  @@index([email])
  @@index([referralCode])
  @@map("waitlist_entries")
}
```

---

## Complete Schema File

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// ENUMS
// ============================================

enum Country {
  NIGERIA
  GHANA
  KENYA
  SOUTH_AFRICA
  EGYPT
  OTHER
}

enum Currency {
  NGN
  GHS
  KES
  ZAR
  EGP
  USD
}

enum EmploymentType {
  EMPLOYED
  SELF_EMPLOYED
  FREELANCER
  BUSINESS_OWNER
  STUDENT
  UNEMPLOYED
  OTHER
}

enum IncomeType {
  SALARY
  FREELANCE
  BUSINESS
  INVESTMENT
  RENTAL
  ALLOWANCE
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
}

enum SavingsType {
  BANK_ACCOUNT
  MOBILE_MONEY
  CASH
  FIXED_DEPOSIT
  AJO_SUSU
  COOPERATIVE
  OTHER
}

enum InvestmentType {
  STOCKS
  BONDS
  MUTUAL_FUNDS
  REAL_ESTATE
  CRYPTO
  PENSION
  OTHER
}

enum DebtType {
  BANK_LOAN
  CREDIT_CARD
  BNPL
  PERSONAL_LOAN
  MORTGAGE
  STUDENT_LOAN
  BUSINESS_LOAN
  OTHER
}

enum RelationshipType {
  PARENT
  SIBLING
  EXTENDED_FAMILY
  SPOUSE
  CHILD
  FRIEND
  COMMUNITY
  OTHER
}

enum GoalCategory {
  EMERGENCY_FUND
  SAVINGS
  INVESTMENT
  DEBT_PAYOFF
  MAJOR_PURCHASE
  EDUCATION
  TRAVEL
  FAMILY
  BUSINESS
  RETIREMENT
  OTHER
}

enum GoalStatus {
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}

// ============================================
// MODELS
// ============================================

model User {
  id                   String          @id @default(uuid())
  email                String          @unique
  passwordHash         String?
  name                 String
  country              Country         @default(NIGERIA)
  currency             Currency        @default(NGN)
  timezone             String          @default("Africa/Lagos")
  dateOfBirth          DateTime?
  employmentType       EmploymentType?
  onboardingCompleted  Boolean         @default(false)
  notificationsEnabled Boolean         @default(true)
  weeklyReportEnabled  Boolean         @default(true)
  lastLoginAt          DateTime?
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
  googleId             String?         @unique
  appleId              String?         @unique

  incomeSources   IncomeSource[]
  expenses        Expense[]
  savingsAccounts SavingsAccount[]
  investments     Investment[]
  debts           Debt[]
  familySupport   FamilySupport[]
  goals           Goal[]
  snapshots       FinancialSnapshot[]
  refreshTokens   RefreshToken[]
  aiConversations AIConversation[]

  @@index([email])
  @@index([country])
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@map("refresh_tokens")
}

model IncomeSource {
  id                 String     @id @default(uuid())
  userId             String
  name               String
  type               IncomeType
  amount             Decimal    @db.Decimal(15, 2)
  currency           Currency   @default(NGN)
  frequency          Frequency
  variancePercentage Int        @default(0)
  description        String?
  isActive           Boolean    @default(true)
  startDate          DateTime   @default(now())
  endDate            DateTime?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("income_sources")
}

model ExpenseCategory {
  id        String    @id @default(uuid())
  name      String
  icon      String
  color     String
  isDefault Boolean   @default(false)
  sortOrder Int       @default(0)
  createdAt DateTime  @default(now())

  expenses Expense[]

  @@map("expense_categories")
}

model Expense {
  id          String     @id @default(uuid())
  userId      String
  categoryId  String
  amount      Decimal    @db.Decimal(15, 2)
  currency    Currency   @default(NGN)
  date        DateTime
  description String?
  merchant    String?
  isRecurring Boolean    @default(false)
  frequency   Frequency?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  category ExpenseCategory @relation(fields: [categoryId], references: [id])

  @@index([userId])
  @@index([userId, date])
  @@index([userId, categoryId])
  @@index([userId, isRecurring])
  @@map("expenses")
}

model SavingsAccount {
  id              String      @id @default(uuid())
  userId          String
  name            String
  type            SavingsType
  balance         Decimal     @db.Decimal(15, 2)
  currency        Currency    @default(NGN)
  interestRate    Decimal?    @db.Decimal(5, 2)
  institution     String?
  accountNumber   String?
  isEmergencyFund Boolean     @default(false)
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("savings_accounts")
}

model Investment {
  id           String         @id @default(uuid())
  userId       String
  name         String
  type         InvestmentType
  value        Decimal        @db.Decimal(15, 2)
  currency     Currency       @default(NGN)
  costBasis    Decimal?       @db.Decimal(15, 2)
  institution  String?
  notes        String?
  isActive     Boolean        @default(true)
  purchaseDate DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("investments")
}

model Debt {
  id               String   @id @default(uuid())
  userId           String
  name             String
  type             DebtType
  originalAmount   Decimal  @db.Decimal(15, 2)
  remainingBalance Decimal  @db.Decimal(15, 2)
  currency         Currency @default(NGN)
  interestRate     Decimal  @db.Decimal(5, 2)
  minimumPayment   Decimal  @db.Decimal(15, 2)
  dueDate          Int?
  institution      String?
  notes            String?
  isActive         Boolean  @default(true)
  startDate        DateTime
  targetPayoffDate DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("debts")
}

model FamilySupport {
  id           String           @id @default(uuid())
  userId       String
  name         String
  relationship RelationshipType
  amount       Decimal          @db.Decimal(15, 2)
  currency     Currency         @default(NGN)
  frequency    Frequency
  description  String?
  isActive     Boolean          @default(true)
  startDate    DateTime         @default(now())
  endDate      DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@map("family_support")
}

model Goal {
  id            String       @id @default(uuid())
  userId        String
  name          String
  description   String?
  category      GoalCategory
  targetAmount  Decimal      @db.Decimal(15, 2)
  currentAmount Decimal      @db.Decimal(15, 2) @default(0)
  currency      Currency     @default(NGN)
  targetDate    DateTime?
  priority      Int          @default(0)
  status        GoalStatus   @default(ACTIVE)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  user          User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  contributions GoalContribution[]

  @@index([userId])
  @@index([userId, status])
  @@map("goals")
}

model GoalContribution {
  id        String   @id @default(uuid())
  goalId    String
  amount    Decimal  @db.Decimal(15, 2)
  date      DateTime @default(now())
  note      String?
  createdAt DateTime @default(now())

  goal Goal @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@index([goalId])
  @@index([goalId, date])
  @@map("goal_contributions")
}

model FinancialSnapshot {
  id              String   @id @default(uuid())
  userId          String
  date            DateTime @default(now())
  cashFlowScore   Int
  savingsRate     Decimal  @db.Decimal(5, 2)
  runwayMonths    Decimal  @db.Decimal(5, 2)
  burnRate        Decimal  @db.Decimal(15, 2)
  dependencyRatio Decimal  @db.Decimal(5, 2)
  netWorth        Decimal  @db.Decimal(15, 2)
  totalIncome     Decimal  @db.Decimal(15, 2)
  totalExpenses   Decimal  @db.Decimal(15, 2)
  totalSavings    Decimal  @db.Decimal(15, 2)
  totalDebt       Decimal  @db.Decimal(15, 2)
  totalAssets     Decimal  @db.Decimal(15, 2)
  totalSupport    Decimal  @db.Decimal(15, 2)
  currency        Currency @default(NGN)
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, date])
  @@map("financial_snapshots")
}

model AIConversation {
  id        String      @id @default(uuid())
  userId    String
  title     String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  user     User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages AIMessage[]

  @@index([userId])
  @@index([userId, updatedAt])
  @@map("ai_conversations")
}

model AIMessage {
  id             String   @id @default(uuid())
  conversationId String
  role           String
  content        String   @db.Text
  createdAt      DateTime @default(now())

  conversation AIConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("ai_messages")
}

model WaitlistEntry {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String?
  country      Country?
  referralCode String   @unique
  referredBy   String?
  source       String?
  createdAt    DateTime @default(now())

  @@index([email])
  @@index([referralCode])
  @@map("waitlist_entries")
}
```

---

## Seed Data

```typescript
// apps/api/prisma/seed.ts

import { PrismaClient, Currency, Country } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed default expense categories
  const categories = [
    { name: 'Food & Dining', icon: 'utensils', color: '#F59E0B', isDefault: true, sortOrder: 1 },
    { name: 'Transportation', icon: 'car', color: '#3B82F6', isDefault: true, sortOrder: 2 },
    { name: 'Shopping', icon: 'shopping-bag', color: '#EC4899', isDefault: true, sortOrder: 3 },
    { name: 'Utilities', icon: 'zap', color: '#8B5CF6', isDefault: true, sortOrder: 4 },
    { name: 'Entertainment', icon: 'film', color: '#10B981', isDefault: true, sortOrder: 5 },
    { name: 'Healthcare', icon: 'heart-pulse', color: '#EF4444', isDefault: true, sortOrder: 6 },
    { name: 'Family Support', icon: 'users', color: '#F97316', isDefault: true, sortOrder: 7 },
    { name: 'Education', icon: 'graduation-cap', color: '#06B6D4', isDefault: true, sortOrder: 8 },
    { name: 'Housing', icon: 'home', color: '#84CC16', isDefault: true, sortOrder: 9 },
    { name: 'Other', icon: 'more-horizontal', color: '#6B7280', isDefault: true, sortOrder: 10 },
  ];

  for (const category of categories) {
    await prisma.expenseCategory.upsert({
      where: { id: category.name.toLowerCase().replace(/\s+/g, '-') },
      update: category,
      create: { id: category.name.toLowerCase().replace(/\s+/g, '-'), ...category },
    });
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Migration Workflow

### Create Migration

```bash
# Create a new migration
pnpm --filter api prisma migrate dev --name init

# Apply migrations to production
pnpm --filter api prisma migrate deploy
```

### Generate Client

```bash
# Generate Prisma client after schema changes
pnpm --filter api prisma generate
```

### Reset Database

```bash
# Reset database (development only!)
pnpm --filter api prisma migrate reset
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `prisma` | ^5.x | CLI and migration tool |
| `@prisma/client` | ^5.x | Generated database client |

---

## Next Steps

After database design, proceed to:
1. [02-api-foundation.md](./02-api-foundation.md) - Set up NestJS API patterns
2. [03-authentication.md](./03-authentication.md) - Implement authentication
