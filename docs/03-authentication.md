# Authentication

## Overview

This document covers the authentication system for Ikpa, including email/password authentication, JWT token management, refresh token rotation, and OAuth integration with Google and Apple. The system is designed with security best practices including short-lived access tokens, secure refresh token storage, and protection against common attacks.

---

## Technical Specifications

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Passport.js | 0.7.x | Authentication middleware |
| @nestjs/jwt | 10.x | JWT signing and verification |
| bcrypt | 5.x | Password hashing |
| passport-jwt | 4.x | JWT strategy |
| passport-google-oauth20 | 2.x | Google OAuth |

### Security Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| Access Token TTL | 15 minutes | Short-lived for security |
| Refresh Token TTL | 7 days | Balance security and UX |
| Bcrypt Salt Rounds | 12 | Industry standard |
| Token Algorithm | HS256 | Symmetric signing |

---

## Key Capabilities

- Email/password registration and login
- JWT access tokens with short expiry
- Secure refresh token rotation
- Google OAuth 2.0 integration
- Apple Sign-In integration
- Password reset via email
- Token revocation on logout
- Rate limiting on auth endpoints

---

## API Endpoints

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
  response: { message }

POST /v1/auth/forgot-password:
  body: { email }
  response: { message }

POST /v1/auth/reset-password:
  body: { token, password }
  response: { message }

POST /v1/auth/google:
  body: { idToken }
  response: { user, accessToken, refreshToken }

POST /v1/auth/apple:
  body: { idToken, nonce }
  response: { user, accessToken, refreshToken }
```

---

## Implementation Guide

### Step 1: Install Dependencies

```bash
cd apps/api
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
pnpm add -D @types/passport-jwt @types/bcrypt
```

### Step 2: Auth Module Structure

```
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── auth.config.ts
├── strategies/
│   ├── jwt.strategy.ts
│   ├── jwt-refresh.strategy.ts
│   ├── google.strategy.ts
│   └── apple.strategy.ts
├── guards/
│   └── jwt-auth.guard.ts
└── dto/
    ├── register.dto.ts
    ├── login.dto.ts
    ├── refresh-token.dto.ts
    └── auth-response.dto.ts
```

### Step 3: Auth Configuration

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
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
    },
  },
};
```

### Step 4: DTOs

```typescript
// apps/api/src/modules/auth/dto/register.dto.ts

import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { Country } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(Country)
  country?: Country;
}
```

```typescript
// apps/api/src/modules/auth/dto/login.dto.ts

import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

```typescript
// apps/api/src/modules/auth/dto/refresh-token.dto.ts

import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
```

```typescript
// apps/api/src/modules/auth/dto/auth-response.dto.ts

import { User } from '@prisma/client';

export class AuthResponseDto {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
}

export class TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
```

### Step 5: Auth Service

```typescript
// apps/api/src/modules/auth/auth.service.ts

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, TokenPair, JwtPayload } from './dto/auth-response.dto';
import { ConflictException, UnauthorizedException } from '../../common/exceptions/api.exception';
import { User, Country } from '@prisma/client';
import { AuthConfig } from './auth.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if email already exists
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, AuthConfig.bcrypt.saltRounds);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        country: dto.country || Country.NIGERIA,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Find user
    const user = await this.userService.findByEmail(dto.email.toLowerCase());

    // Validate credentials
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token exists in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Get user
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generate new tokens
    return this.generateTokens(user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific token
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    } else {
      // Revoke all tokens for user
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  async validateGoogleToken(idToken: string): Promise<AuthResponseDto> {
    // Verify Google ID token
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(this.config.get('GOOGLE_CLIENT_ID'));

    const ticket = await client.verifyIdToken({
      idToken,
      audience: this.config.get('GOOGLE_CLIENT_ID'),
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { googleId: payload.sub },
    });

    if (!user) {
      // Check if email already exists
      const existingUser = await this.userService.findByEmail(payload.email);
      if (existingUser) {
        // Link Google account to existing user
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { googleId: payload.sub },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            email: payload.email.toLowerCase(),
            name: payload.name || payload.email.split('@')[0],
            googleId: payload.sub,
            country: Country.NIGERIA, // Default, can be updated later
          },
        });
      }
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    // Generate refresh token
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    // Store refresh token
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
```

### Step 6: JWT Strategy

```typescript
// apps/api/src/modules/auth/strategies/jwt.strategy.ts

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../dto/auth-response.dto';
import { UnauthorizedException } from '../../../common/exceptions/api.exception';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
```

### Step 7: Auth Guard

```typescript
// apps/api/src/common/guards/jwt-auth.guard.ts

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthorizedException } from '../exceptions/api.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired');
      }
      throw new UnauthorizedException('Invalid token');
    }
    return user;
  }
}
```

### Step 8: Auth Controller

```typescript
// apps/api/src/modules/auth/auth.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Body('refreshToken') refreshToken?: string,
  ) {
    await this.authService.logout(userId, refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(@Body('idToken') idToken: string) {
    return this.authService.validateGoogleToken(idToken);
  }
}
```

### Step 9: Auth Module

```typescript
// apps/api/src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## UI/UX Specifications

### Login Screen Layout

```
┌─────────────────────────────────────────┐
│                                         │
│            [IKPA LOGO]                  │
│                                         │
│         Welcome back                    │
│   Sign in to continue your journey      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📧 Email                        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🔒 Password               👁️   │   │
│  └─────────────────────────────────┘   │
│                                         │
│           Forgot password?              │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │          Sign In                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ──────────── or ────────────          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [G] Continue with Google        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [] Continue with Apple          │   │
│  └─────────────────────────────────┘   │
│                                         │
│    Don't have an account? Sign up       │
│                                         │
└─────────────────────────────────────────┘
```

### Design Tokens

| Element | Value |
|---------|-------|
| Input background | `rgba(255,255,255,0.7)` (glass) |
| Input border | `#E5E7EB` |
| Input focus border | `#10B981` (Ikpa Green) |
| Primary button | `#10B981` |
| OAuth button background | `#FFFFFF` |
| Error text | `#EF4444` |

### Validation Feedback

- Email: Real-time format validation
- Password: Minimum 8 characters indicator
- Error states: Red border + error message below input
- Success: Brief green checkmark animation

---

## Password Reset Flow

```typescript
// apps/api/src/modules/auth/auth.service.ts (additional methods)

async forgotPassword(email: string): Promise<void> {
  const user = await this.userService.findByEmail(email);
  if (!user) {
    // Don't reveal if email exists
    return;
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Store token (expires in 1 hour)
  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetTokenHash,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  // Send email (implement email service)
  await this.emailService.sendPasswordReset(user.email, resetToken);
}

async resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await this.prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new UnauthorizedException('Invalid or expired reset token');
  }

  // Update password
  const passwordHash = await bcrypt.hash(newPassword, AuthConfig.bcrypt.saltRounds);

  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  // Revoke all refresh tokens
  await this.prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });
}
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/jwt` | ^10.2.0 | JWT signing/verification |
| `@nestjs/passport` | ^10.0.0 | Passport integration |
| `passport` | ^0.7.0 | Authentication middleware |
| `passport-jwt` | ^4.0.1 | JWT strategy |
| `bcrypt` | ^5.1.0 | Password hashing |
| `google-auth-library` | ^9.0.0 | Google OAuth verification |

---

## Security Best Practices

1. **Token Storage**: Refresh tokens stored server-side in database
2. **Token Rotation**: New refresh token on each refresh
3. **Password Hashing**: bcrypt with 12 salt rounds
4. **Rate Limiting**: Aggressive limits on auth endpoints
5. **HTTPS Only**: Tokens only transmitted over HTTPS
6. **Logout**: Revoke refresh tokens on logout

---

## Next Steps

After authentication, proceed to:
1. [04-user-management.md](./04-user-management.md) - User profile management
2. [05-income-sources.md](./05-income-sources.md) - Income tracking
