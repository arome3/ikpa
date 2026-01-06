# Testing Strategy

## Overview

This document covers the testing strategy for Ikpa, including unit tests, integration tests, and end-to-end tests. The testing pyramid emphasizes fast, reliable unit tests at the base, with fewer but comprehensive integration and E2E tests at the top.

---

## Testing Pyramid

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

### Distribution

| Type | Coverage | Tools |
|------|----------|-------|
| Unit Tests | 60% | Vitest |
| Integration Tests | 30% | Vitest + Supertest |
| E2E Tests | 10% | Playwright |

---

## Technology Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration testing |
| Supertest | HTTP API testing |
| Playwright | E2E browser testing |
| MSW | API mocking |
| Testing Library | React component testing |

---

## Unit Testing

### Vitest Configuration

```typescript
// apps/api/vitest.config.ts

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.module.ts',
        '**/index.ts',
      ],
    },
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### Test Setup

```typescript
// apps/api/test/setup.ts

import { vi } from 'vitest';

// Mock environment variables
vi.stubEnv('JWT_ACCESS_SECRET', 'test-access-secret-min-32-chars');
vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-min-32-chars');
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
```

### Unit Test Example: MetricsCalculator

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

      const result = calculator.calculateSavingsRate(income, expenses);

      expect(result).toBe(20);
    });

    it('should return 0 for zero income', () => {
      const income = new Decimal(0);
      const expenses = new Decimal(100000);

      const result = calculator.calculateSavingsRate(income, expenses);

      expect(result).toBe(0);
    });

    it('should handle negative savings rate', () => {
      const income = new Decimal(300000);
      const expenses = new Decimal(400000);

      const result = calculator.calculateSavingsRate(income, expenses);

      expect(result).toBeCloseTo(-33.33, 1);
    });
  });

  describe('calculateRunway', () => {
    it('should calculate correct runway months', () => {
      const savings = new Decimal(600000);
      const expenses = new Decimal(200000);

      const result = calculator.calculateRunway(savings, expenses);

      expect(result).toBe(3);
    });

    it('should cap at 24 months', () => {
      const savings = new Decimal(10000000);
      const expenses = new Decimal(100000);

      const result = calculator.calculateRunway(savings, expenses);

      expect(result).toBe(24);
    });

    it('should return 24 for zero expenses', () => {
      const savings = new Decimal(100000);
      const expenses = new Decimal(0);

      const result = calculator.calculateRunway(savings, expenses);

      expect(result).toBe(24);
    });
  });

  describe('calculateCashFlowScore', () => {
    it('should return score between 0 and 100', () => {
      const data = {
        totalIncome: new Decimal(500000),
        totalExpenses: new Decimal(400000),
        totalSavings: new Decimal(600000),
        totalDebt: new Decimal(100000),
        totalAssets: new Decimal(700000),
        totalSupport: new Decimal(50000),
        incomeStability: 90,
        expenseVariance: 10,
        liquidSavings: new Decimal(500000),
      };

      const { score } = calculator.calculateCashFlowScore(data);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return higher score for better financial health', () => {
      const goodData = {
        totalIncome: new Decimal(500000),
        totalExpenses: new Decimal(250000), // 50% savings rate
        totalSavings: new Decimal(3000000),  // 12 months runway
        totalDebt: new Decimal(0),
        totalAssets: new Decimal(3000000),
        totalSupport: new Decimal(25000),
        incomeStability: 100,
        expenseVariance: 5,
        liquidSavings: new Decimal(3000000),
      };

      const poorData = {
        totalIncome: new Decimal(500000),
        totalExpenses: new Decimal(480000), // 4% savings rate
        totalSavings: new Decimal(100000),  // < 1 month runway
        totalDebt: new Decimal(400000),
        totalAssets: new Decimal(100000),
        totalSupport: new Decimal(100000),
        incomeStability: 50,
        expenseVariance: 30,
        liquidSavings: new Decimal(100000),
      };

      const { score: goodScore } = calculator.calculateCashFlowScore(goodData);
      const { score: poorScore } = calculator.calculateCashFlowScore(poorData);

      expect(goodScore).toBeGreaterThan(poorScore);
    });
  });

  describe('calculateDependencyRatio', () => {
    it('should calculate correct dependency ratio', () => {
      const support = new Decimal(75000);
      const income = new Decimal(500000);

      const result = calculator.calculateDependencyRatio(support, income);

      expect(result).toBe(15);
    });
  });

  describe('calculateNetWorth', () => {
    it('should calculate correct net worth', () => {
      const savings = new Decimal(500000);
      const investments = new Decimal(300000);
      const debt = new Decimal(200000);

      const result = calculator.calculateNetWorth(savings, investments, debt);

      expect(result.toNumber()).toBe(600000);
    });

    it('should handle negative net worth', () => {
      const savings = new Decimal(100000);
      const investments = new Decimal(50000);
      const debt = new Decimal(500000);

      const result = calculator.calculateNetWorth(savings, investments, debt);

      expect(result.toNumber()).toBe(-350000);
    });
  });
});
```

### Unit Test Example: AuthService

```typescript
// apps/api/src/modules/auth/__tests__/auth.service.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../../user/user.service';
import { ConflictException, UnauthorizedException } from '../../../common/exceptions/api.exception';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let userService: UserService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    country: 'NIGERIA',
    currency: 'NGN',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: vi.fn(),
              findUnique: vi.fn(),
              update: vi.fn(),
            },
            refreshToken: {
              create: vi.fn(),
              findUnique: vi.fn(),
              delete: vi.fn(),
              deleteMany: vi.fn(),
            },
          },
        },
        {
          provide: UserService,
          useValue: {
            findByEmail: vi.fn(),
            findById: vi.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: vi.fn().mockReturnValue('mock-token'),
            verify: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key) => {
              if (key === 'JWT_ACCESS_SECRET') return 'access-secret';
              if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      vi.mocked(userService.findByEmail).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      vi.mocked(prismaService.user.create).mockResolvedValue(mockUser as any);
      vi.mocked(prismaService.refreshToken.create).mockResolvedValue({} as any);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('should throw ConflictException if email exists', async () => {
      vi.mocked(userService.findByEmail).mockResolvedValue(mockUser as any);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      vi.mocked(userService.findByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prismaService.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(prismaService.refreshToken.create).mockResolvedValue({} as any);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      vi.mocked(userService.findByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      vi.mocked(userService.findByEmail).mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

---

## Integration Testing

### API Integration Tests

```typescript
// apps/api/test/integration/auth.integration.spec.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

describe('Auth Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      // Duplicate registration
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password456',
          name: 'Another User',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RES_3002');
    });

    it('should validate email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /v1/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      accessToken = response.body.data.accessToken;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/v1/users/me')
        .expect(401);
    });
  });
});
```

---

## E2E Testing

### Playwright Configuration

```typescript
// playwright.config.ts

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example

```typescript
// e2e/auth.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/register');

    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('[name="password"]', 'password123');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/onboarding');
  });

  test('should login and see dashboard', async ({ page }) => {
    // Assuming test user exists
    await page.goto('/login');

    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Cash Flow Score')).toBeVisible();
  });

  test('should show validation errors', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid email')).toBeVisible();
  });
});
```

---

## Test Commands

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner |
| `@nestjs/testing` | NestJS testing utilities |
| `supertest` | HTTP assertions |
| `@playwright/test` | E2E testing |
| `@testing-library/react` | React component testing |
| `msw` | API mocking |

---

## Coverage Goals

| Metric | Target |
|--------|--------|
| Line Coverage | 80% |
| Branch Coverage | 75% |
| Function Coverage | 85% |

---

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Use descriptive test names** - Clear descriptions of expected behavior
3. **Isolate tests** - Each test should be independent
4. **Mock external dependencies** - Database, APIs, etc.
5. **Keep tests fast** - Unit tests should run in milliseconds
6. **Test edge cases** - Zero values, negative numbers, empty arrays
7. **Use factories** - Create test data consistently
