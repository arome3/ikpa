# Infrastructure

## Overview

This document covers the infrastructure setup for Ikpa, including Docker containerization, CI/CD pipelines with GitHub Actions, deployment strategies, monitoring, and environment management.

---

## Technical Specifications

### Infrastructure Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Container Runtime | Docker | Application packaging |
| Orchestration | Docker Compose | Local development |
| CI/CD | GitHub Actions | Automated pipelines |
| Cloud Platform | Railway / AWS | Production hosting |
| Database | PostgreSQL 15 | Primary database |
| Cache | Redis 7 | Caching, rate limiting |
| CDN | Cloudflare | Static assets, DDoS protection |

---

## Docker Configuration

### API Dockerfile

```dockerfile
# apps/api/Dockerfile

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Generate Prisma client
RUN pnpm --filter api prisma generate

# Build
RUN pnpm --filter api build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built assets
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
```

### Web PWA Dockerfile

```dockerfile
# apps/web/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

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
      - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3000
    depends_on:
      - api
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=ikpa
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Development Docker Compose

```yaml
# docker-compose.dev.yml

version: '3.8'

services:
  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=ikpa

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data

volumes:
  postgres_dev_data:
  redis_dev_data:
```

---

## GitHub Actions CI/CD

### CI Pipeline

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ikpa_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter api prisma generate

      - name: Run migrations
        run: pnpm --filter api prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ikpa_test

      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ikpa_test
          REDIS_URL: redis://localhost:6379
          JWT_ACCESS_SECRET: test-access-secret-min-32-chars
          JWT_REFRESH_SECRET: test-refresh-secret-min-32-chars

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api prisma generate
      - run: pnpm build
```

### Deploy Pipeline

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push API
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/api:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to Railway
        uses: railway/deploy@v1
        with:
          token: ${{ secrets.RAILWAY_TOKEN }}
          service: api

  deploy-web:
    runs-on: ubuntu-latest
    needs: deploy-api

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  run-migrations:
    runs-on: ubuntu-latest
    needs: deploy-api

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api prisma generate

      - name: Run migrations
        run: pnpm --filter api prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Health Check Endpoint

```typescript
// apps/api/src/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../modules/prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'disconnected',
        },
      };
    }
  }
}
```

---

## Environment Management

### Environment Files

```bash
# .env.example (committed to repo)
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:password@localhost:5432/ikpa"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ANTHROPIC_API_KEY=

# .env.local (local development, not committed)
# .env.production (production, not committed)
```

### Secrets Management

| Secret | Where Stored | Used By |
|--------|--------------|---------|
| DATABASE_URL | GitHub Secrets / Railway | API, Migrations |
| REDIS_URL | GitHub Secrets / Railway | API |
| JWT_ACCESS_SECRET | GitHub Secrets / Railway | API |
| JWT_REFRESH_SECRET | GitHub Secrets / Railway | API |
| ANTHROPIC_API_KEY | GitHub Secrets / Railway | API |
| VERCEL_TOKEN | GitHub Secrets | Deploy workflow |
| RAILWAY_TOKEN | GitHub Secrets | Deploy workflow |

---

## Monitoring

### Logging

```typescript
// apps/api/src/main.ts

import { Logger } from '@nestjs/common';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ... rest of bootstrap

  logger.log(`Application running on port ${port}`);
}
```

### Error Tracking (Optional)

```typescript
// apps/api/src/common/filters/sentry.filter.ts

import * as Sentry from '@sentry/node';

// Initialize Sentry in main.ts
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
}
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `docker` | Container runtime |
| `docker-compose` | Local orchestration |
| `@sentry/node` | Error tracking (optional) |

---

## Next Steps

After infrastructure, proceed to:
1. [21-testing-strategy.md](./21-testing-strategy.md) - Testing approach
