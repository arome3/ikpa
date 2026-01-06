# Project Setup

## Overview

This document covers the initial setup of the Ikpa platform monorepo. Ikpa uses a modern TypeScript monorepo architecture with Turborepo for build orchestration and pnpm for package management. This setup enables code sharing between the API, mobile app, web PWA, and landing page while maintaining clear separation of concerns.

---

## Technical Specifications

### Technology Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x LTS | Runtime environment |
| pnpm | 8.x | Package manager |
| Turborepo | 1.x | Build system and task orchestration |
| TypeScript | 5.x | Type safety across all packages |
| ESLint | 8.x | Code linting |
| Prettier | 3.x | Code formatting |

### Architecture Decisions

- **Monorepo**: Single repository for all applications and shared packages
- **pnpm workspaces**: Efficient dependency management with workspace protocol
- **Turborepo**: Parallel builds with intelligent caching
- **Shared packages**: Common types, utilities, and API client shared across apps

---

## Key Capabilities

- Unified TypeScript configuration across all packages
- Parallel task execution with dependency awareness
- Remote caching for CI/CD builds
- Hot module reloading in development
- Consistent linting and formatting rules
- Shared types between backend and frontend

---

## Project Structure

```
ikpa/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules
│   │   │   │   ├── auth/
│   │   │   │   ├── user/
│   │   │   │   ├── finance/
│   │   │   │   ├── ai/
│   │   │   │   └── ...
│   │   │   ├── common/         # Shared decorators, guards, filters
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── mobile/                 # React Native (Expo)
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── navigation/
│   │   │   ├── stores/
│   │   │   └── hooks/
│   │   ├── app.json
│   │   └── package.json
│   │
│   ├── web/                    # Next.js PWA
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   ├── public/
│   │   └── package.json
│   │
│   └── landing/                # Next.js landing page
│       ├── src/
│       │   ├── app/
│       │   └── components/
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared types, utils, API client
│       ├── src/
│       │   ├── types/          # TypeScript interfaces
│       │   ├── api/            # API client
│       │   ├── utils/          # Utility functions
│       │   └── constants/      # Shared constants
│       └── package.json
│
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
├── package.json                # Root package.json
├── tsconfig.base.json          # Base TypeScript config
├── .eslintrc.js               # ESLint configuration
├── .prettierrc                # Prettier configuration
└── .env.example               # Environment variables template
```

---

## Implementation Guide

### Step 1: Initialize the Monorepo

```bash
# Create project directory
mkdir ikpa && cd ikpa

# Initialize pnpm
pnpm init

# Create pnpm workspace file
touch pnpm-workspace.yaml
```

### Step 2: Configure pnpm Workspace

```yaml
# pnpm-workspace.yaml

packages:
  - 'apps/*'
  - 'packages/*'
```

### Step 3: Root package.json

```json
{
  "name": "ikpa",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "clean": "turbo clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "db:generate": "pnpm --filter api prisma generate",
    "db:migrate": "pnpm --filter api prisma migrate dev",
    "db:push": "pnpm --filter api prisma db push",
    "db:studio": "pnpm --filter api prisma studio"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0",
    "turbo": "^1.11.0",
    "typescript": "^5.3.0"
  },
  "packageManager": "pnpm@8.11.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### Step 4: Turborepo Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    ".env.local"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "env": [
        "NODE_ENV",
        "DATABASE_URL",
        "REDIS_URL",
        "JWT_ACCESS_SECRET",
        "JWT_REFRESH_SECRET",
        "ANTHROPIC_API_KEY"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "env": ["DATABASE_URL", "REDIS_URL"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### Step 5: Base TypeScript Configuration

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "exclude": ["node_modules", "dist", "build", ".next", ".turbo"]
}
```

### Step 6: ESLint Configuration

```javascript
// .eslintrc.js

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist', 'build', '.next', 'node_modules', '*.js'],
};
```

### Step 7: Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Step 8: Environment Variables Template

```bash
# .env.example

# ===========================================
# APPLICATION
# ===========================================
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# ===========================================
# DATABASE
# ===========================================
DATABASE_URL="postgresql://postgres:password@localhost:5432/ikpa?schema=public"

# ===========================================
# REDIS
# ===========================================
REDIS_URL="redis://localhost:6379"

# ===========================================
# AUTHENTICATION
# ===========================================
JWT_ACCESS_SECRET="your-access-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"

# OAuth (Optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
APPLE_CLIENT_ID=""
APPLE_TEAM_ID=""
APPLE_KEY_ID=""
APPLE_PRIVATE_KEY=""

# ===========================================
# AI SERVICE
# ===========================================
ANTHROPIC_API_KEY="sk-ant-..."

# ===========================================
# EXTERNAL SERVICES
# ===========================================
# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
AWS_REGION="eu-west-1"

# Email Service (e.g., Resend)
RESEND_API_KEY=""

# ===========================================
# MOBILE APP
# ===========================================
EXPO_PUBLIC_API_URL=http://localhost:3000

# ===========================================
# LANDING PAGE
# ===========================================
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Step 9: Create Application Directories

```bash
# Create directory structure
mkdir -p apps/{api,mobile,web,landing}
mkdir -p packages/shared

# Initialize each app (details in their respective docs)
```

### Step 10: Shared Package Setup

```json
{
  "name": "@ikpa/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

```typescript
// packages/shared/src/index.ts

export * from './types';
export * from './constants';
export * from './utils';
export * from './api';
```

```typescript
// packages/shared/src/types/index.ts

export * from './user';
export * from './finance';
export * from './api';
```

```typescript
// packages/shared/src/types/user.ts

export enum Country {
  NIGERIA = 'NIGERIA',
  GHANA = 'GHANA',
  KENYA = 'KENYA',
  SOUTH_AFRICA = 'SOUTH_AFRICA',
  EGYPT = 'EGYPT',
  OTHER = 'OTHER',
}

export enum Currency {
  NGN = 'NGN',
  GHS = 'GHS',
  KES = 'KES',
  ZAR = 'ZAR',
  EGP = 'EGP',
  USD = 'USD',
}

export interface User {
  id: string;
  email: string;
  name: string;
  country: Country;
  currency: Currency;
  timezone: string;
  employmentType?: EmploymentType;
  dateOfBirth?: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum EmploymentType {
  EMPLOYED = 'EMPLOYED',
  SELF_EMPLOYED = 'SELF_EMPLOYED',
  FREELANCER = 'FREELANCER',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  STUDENT = 'STUDENT',
  UNEMPLOYED = 'UNEMPLOYED',
  OTHER = 'OTHER',
}
```

```typescript
// packages/shared/src/constants/index.ts

export const API_VERSION = 'v1';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
  ZAR: 'R',
  EGP: 'E£',
  USD: '$',
};

export const DEFAULT_PAGINATION = {
  limit: 20,
  maxLimit: 100,
};
```

---

## UI/UX Specifications

### Development Environment Setup

For optimal development experience, configure your IDE:

**VS Code Extensions (Recommended):**
- ESLint
- Prettier
- Prisma
- Tailwind CSS IntelliSense
- TypeScript Importer
- GitLens

**VS Code Settings:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## Development Commands

### Root Commands

```bash
# Install all dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Build all apps
pnpm build

# Run linting across all packages
pnpm lint

# Run type checking
pnpm typecheck

# Run all tests
pnpm test

# Clean all build outputs
pnpm clean

# Format all files
pnpm format
```

### Filtered Commands

```bash
# Run only the API
pnpm --filter api dev

# Build only the mobile app
pnpm --filter mobile build

# Run tests for the API only
pnpm --filter api test

# Add a dependency to the API
pnpm --filter api add <package>

# Add a shared dependency
pnpm --filter @ikpa/shared add <package>
```

### Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations in development
pnpm db:migrate

# Push schema to database (no migration)
pnpm db:push

# Open Prisma Studio
pnpm db:studio
```

---

## Dependencies

### Root Dependencies

| Package | Purpose |
|---------|---------|
| `turbo` | Build system orchestration |
| `typescript` | Type system |
| `eslint` | Code linting |
| `prettier` | Code formatting |
| `@types/node` | Node.js type definitions |

### Development Tools

| Package | Purpose |
|---------|---------|
| `@typescript-eslint/parser` | ESLint TypeScript parser |
| `@typescript-eslint/eslint-plugin` | ESLint TypeScript rules |
| `eslint-config-prettier` | Disable ESLint rules that conflict with Prettier |

---

## Getting Started

1. **Clone and Install:**
   ```bash
   git clone <repository-url>
   cd ikpa
   pnpm install
   ```

2. **Setup Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Setup Database:**
   ```bash
   # Start PostgreSQL and Redis (via Docker or locally)
   docker-compose up -d db redis

   # Generate Prisma client and run migrations
   pnpm db:generate
   pnpm db:migrate
   ```

4. **Start Development:**
   ```bash
   pnpm dev
   ```

5. **Access Applications:**
   - API: http://localhost:3000
   - Web: http://localhost:3001
   - Landing: http://localhost:3002
   - Mobile: Expo Go app

---

## Next Steps

After completing project setup, proceed to:
1. [01-database-design.md](./01-database-design.md) - Set up the database schema
2. [02-api-foundation.md](./02-api-foundation.md) - Configure the NestJS API
