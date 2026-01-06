# API Foundation

## Overview

This document covers the foundational setup for the Ikpa NestJS backend API. It establishes patterns for module structure, response formats, error handling, validation, middleware, and rate limiting that will be used consistently across all feature modules.

---

## Technical Specifications

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 10.x | Backend framework |
| Express | 4.x | HTTP server (default adapter) |
| class-validator | 0.14.x | Request validation |
| class-transformer | 0.5.x | Object transformation |
| helmet | 7.x | Security headers |
| @nestjs/throttler | 5.x | Rate limiting |

### Architecture Decisions

- **Modular structure**: Each feature is a self-contained NestJS module
- **RESTful API**: Standard REST conventions with versioned endpoints (`/v1/...`)
- **DTOs for validation**: All request bodies validated with class-validator
- **Consistent responses**: Standardized success and error response formats
- **Guard-based auth**: JWT authentication via custom guards

---

## Key Capabilities

- Consistent API response formats
- Comprehensive error handling with custom error codes
- Request validation with detailed error messages
- Rate limiting to prevent abuse
- Security headers via Helmet
- CORS configuration for frontend apps
- Request logging and monitoring hooks

---

## Project Structure

```
apps/api/
├── src/
│   ├── main.ts                 # Application bootstrap
│   ├── app.module.ts           # Root module
│   │
│   ├── common/                 # Shared utilities
│   │   ├── decorators/         # Custom decorators
│   │   │   ├── current-user.decorator.ts
│   │   │   └── public.decorator.ts
│   │   ├── filters/            # Exception filters
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/             # Auth guards
│   │   │   └── jwt-auth.guard.ts
│   │   ├── interceptors/       # Response interceptors
│   │   │   └── transform.interceptor.ts
│   │   ├── pipes/              # Validation pipes
│   │   └── dto/                # Common DTOs
│   │       ├── pagination.dto.ts
│   │       └── api-response.dto.ts
│   │
│   └── modules/                # Feature modules
│       ├── auth/
│       ├── user/
│       ├── finance/
│       ├── ai/
│       └── ...
│
├── prisma/
│   └── schema.prisma
│
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
│
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

---

## Implementation Guide

### Step 1: Initialize NestJS Application

```bash
cd apps/api
pnpm add @nestjs/core @nestjs/common @nestjs/platform-express rxjs reflect-metadata
pnpm add @nestjs/config @nestjs/throttler
pnpm add class-validator class-transformer
pnpm add helmet
pnpm add -D @types/express
```

### Step 2: Package Configuration

```json
{
  "name": "api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "test:e2e": "vitest run --config ./vitest.e2e.config.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.1.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/throttler": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "bcrypt": "^5.1.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "helmet": "^7.1.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/bcrypt": "^5.0.0",
    "@types/express": "^4.17.17",
    "@types/passport-jwt": "^4.0.0",
    "prisma": "^5.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### Step 3: Application Bootstrap

```typescript
// apps/api/src/main.ts

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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
      ...(configService.get('NODE_ENV') === 'development'
        ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081']
        : []),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Response transformer
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`🚀 API running on http://localhost:${port}`);
}

bootstrap();
```

### Step 4: App Module

```typescript
// apps/api/src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { FinanceModule } from './modules/finance/finance.module';
import { AIModule } from './modules/ai/ai.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,    // 1 second
        limit: 10,    // 10 requests
      },
      {
        name: 'medium',
        ttl: 10000,   // 10 seconds
        limit: 50,    // 50 requests
      },
      {
        name: 'long',
        ttl: 60000,   // 1 minute
        limit: 200,   // 200 requests
      },
    ]),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    UserModule,
    FinanceModule,
    AIModule,
  ],
  providers: [
    // Global rate limiter
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global authentication (with @Public() decorator for exceptions)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

### Step 5: Prisma Module

```typescript
// apps/api/src/modules/prisma/prisma.module.ts

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript
// apps/api/src/modules/prisma/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### Step 6: Response DTOs

```typescript
// apps/api/src/common/dto/api-response.dto.ts

export class ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;

  constructor(data: T, message?: string) {
    this.success = true;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }
}

export class ApiErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;

  constructor(code: string, message: string, details?: Record<string, any>) {
    this.success = false;
    this.error = { code, message, details };
    this.timestamp = new Date().toISOString();
  }
}

export class PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  timestamp: string;

  constructor(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    this.success = true;
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    };
    this.timestamp = new Date().toISOString();
  }
}
```

```typescript
// apps/api/src/common/dto/pagination.dto.ts

import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class CursorPaginationDto {
  @IsOptional()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

### Step 7: Error Codes

```typescript
// apps/api/src/common/constants/error-codes.ts

export const ErrorCodes = {
  // Authentication (1xxx)
  AUTH_INVALID_CREDENTIALS: 'AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'AUTH_1002',
  AUTH_TOKEN_INVALID: 'AUTH_1003',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_1004',
  AUTH_UNAUTHORIZED: 'AUTH_1005',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_1006',

  // Validation (2xxx)
  VALIDATION_ERROR: 'VAL_2001',
  VALIDATION_REQUIRED_FIELD: 'VAL_2002',
  VALIDATION_INVALID_FORMAT: 'VAL_2003',
  VALIDATION_INVALID_VALUE: 'VAL_2004',

  // Resources (3xxx)
  RESOURCE_NOT_FOUND: 'RES_3001',
  RESOURCE_ALREADY_EXISTS: 'RES_3002',
  RESOURCE_CONFLICT: 'RES_3003',
  RESOURCE_FORBIDDEN: 'RES_3004',

  // Rate Limiting (4xxx)
  RATE_LIMIT_EXCEEDED: 'RATE_4001',

  // AI Service (5xxx)
  AI_SERVICE_ERROR: 'AI_5001',
  AI_RATE_LIMIT: 'AI_5002',
  AI_CONTEXT_TOO_LARGE: 'AI_5003',

  // External Services (6xxx)
  EXTERNAL_SERVICE_ERROR: 'EXT_6001',
  EXTERNAL_SERVICE_TIMEOUT: 'EXT_6002',

  // Server (9xxx)
  INTERNAL_ERROR: 'SRV_9001',
  SERVICE_UNAVAILABLE: 'SRV_9002',
  DATABASE_ERROR: 'SRV_9003',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

### Step 8: Exception Filter

```typescript
// apps/api/src/common/filters/http-exception.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCodes } from '../constants/error-codes';
import { ApiErrorResponse } from '../dto/api-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status: number;
    let code: string;
    let message: string;
    let details: Record<string, any> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as any;
        code = res.code || this.getDefaultCode(status);
        message = res.message || exception.message;
        details = res.details;

        // Handle validation errors from class-validator
        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          details = { errors: res.message };
          code = ErrorCodes.VALIDATION_ERROR;
        }
      } else {
        code = this.getDefaultCode(status);
        message = exception.message;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ErrorCodes.INTERNAL_ERROR;
      message = 'An unexpected error occurred';

      // Log unexpected errors
      this.logger.error(
        `Unexpected error: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const errorResponse = new ApiErrorResponse(code, message, details);

    // Log all errors in development
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug({
        path: request.url,
        method: request.method,
        status,
        code,
        message,
        details,
      });
    }

    response.status(status).json(errorResponse);
  }

  private getDefaultCode(status: number): string {
    switch (status) {
      case 400:
        return ErrorCodes.VALIDATION_ERROR;
      case 401:
        return ErrorCodes.AUTH_UNAUTHORIZED;
      case 403:
        return ErrorCodes.RESOURCE_FORBIDDEN;
      case 404:
        return ErrorCodes.RESOURCE_NOT_FOUND;
      case 409:
        return ErrorCodes.RESOURCE_CONFLICT;
      case 429:
        return ErrorCodes.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
```

### Step 9: Transform Interceptor

```typescript
// apps/api/src/common/interceptors/transform.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../dto/api-response.dto';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If already wrapped in ApiResponse, return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Wrap in standard response format
        return new ApiResponse(data);
      }),
    );
  }
}
```

### Step 10: Custom Decorators

```typescript
// apps/api/src/common/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
```

```typescript
// apps/api/src/common/decorators/public.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### Step 11: Custom Exceptions

```typescript
// apps/api/src/common/exceptions/api.exception.ts

import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodes } from '../constants/error-codes';

export class ApiException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ) {
    super({ code, message, details }, status);
  }
}

export class NotFoundException extends ApiException {
  constructor(resource: string, id?: string) {
    super(
      ErrorCodes.RESOURCE_NOT_FOUND,
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ConflictException extends ApiException {
  constructor(message: string) {
    super(ErrorCodes.RESOURCE_CONFLICT, message, HttpStatus.CONFLICT);
  }
}

export class UnauthorizedException extends ApiException {
  constructor(message: string = 'Unauthorized') {
    super(ErrorCodes.AUTH_UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends ApiException {
  constructor(message: string = 'Forbidden') {
    super(ErrorCodes.RESOURCE_FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}
```

### Step 12: Module Pattern Example

```typescript
// Example: apps/api/src/modules/user/user.module.ts

import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

```typescript
// Example: apps/api/src/modules/user/user.controller.ts

import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: User) {
    return this.userService.findById(user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateDto: UpdateUserDto,
  ) {
    return this.userService.update(userId, updateDto);
  }
}
```

```typescript
// Example: apps/api/src/modules/user/user.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '../../common/exceptions/api.exception';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User', id);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
```

---

## UI/UX Specifications

### API Response Format

All API responses follow a consistent JSON structure:

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional success message",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_1001",
    "message": "Invalid credentials",
    "details": { /* optional additional info */ }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrevious": false
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## NestJS CLI Configuration

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": false,
    "tsConfigPath": "tsconfig.build.json"
  },
  "generateOptions": {
    "spec": false
  }
}
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/core` | Core NestJS framework |
| `@nestjs/common` | Common NestJS utilities |
| `@nestjs/config` | Configuration management |
| `@nestjs/throttler` | Rate limiting |
| `class-validator` | Request validation |
| `class-transformer` | Object transformation |
| `helmet` | Security headers |
| `bcrypt` | Password hashing |

---

## Next Steps

After API foundation, proceed to:
1. [03-authentication.md](./03-authentication.md) - Implement JWT authentication
2. [04-user-management.md](./04-user-management.md) - User profile management
