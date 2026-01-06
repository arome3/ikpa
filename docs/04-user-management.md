# User Management

## Overview

This document covers user profile management, settings, onboarding flow, and account operations for Ikpa. Users can update their profile information, configure notification preferences, complete onboarding, export their data, and delete their account.

---

## Technical Specifications

### API Endpoints

```yaml
GET /v1/users/me:
  description: Get current user profile
  response: User

PATCH /v1/users/me:
  description: Update user profile
  body: { name?, country?, currency?, timezone?, dateOfBirth?, employmentType? }
  response: User

PATCH /v1/users/me/settings:
  description: Update user settings
  body: { notificationsEnabled?, weeklyReportEnabled? }
  response: User

POST /v1/users/me/complete-onboarding:
  description: Mark onboarding as completed
  response: User

GET /v1/users/me/export:
  description: Request data export
  response: { downloadUrl, expiresAt }

DELETE /v1/users/me:
  description: Delete user account
  body: { password }
  response: { message }
```

---

## Key Capabilities

- Profile viewing and editing
- Currency and country preferences
- Timezone management for accurate date handling
- Notification settings
- Onboarding completion tracking
- GDPR-compliant data export
- Account deletion with data purge

---

## Implementation Guide

### Step 1: DTOs

```typescript
// apps/api/src/modules/user/dto/update-user.dto.ts

import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Country, Currency, EmploymentType } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;
}
```

```typescript
// apps/api/src/modules/user/dto/update-settings.dto.ts

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyReportEnabled?: boolean;
}
```

```typescript
// apps/api/src/modules/user/dto/delete-account.dto.ts

import { IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  password: string;
}
```

### Step 2: User Service

```typescript
// apps/api/src/modules/user/user.service.ts

import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { NotFoundException, UnauthorizedException } from '../../common/exceptions/api.exception';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User', id);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async updateSettings(id: string, dto: UpdateSettingsDto): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: dto,
    });
  }

  async completeOnboarding(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { onboardingCompleted: true },
    });
  }

  async exportData(userId: string): Promise<{ downloadUrl: string; expiresAt: Date }> {
    // Gather all user data
    const [
      user,
      incomeSources,
      expenses,
      savingsAccounts,
      investments,
      debts,
      familySupport,
      goals,
      snapshots,
    ] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.incomeSource.findMany({ where: { userId } }),
      this.prisma.expense.findMany({ where: { userId } }),
      this.prisma.savingsAccount.findMany({ where: { userId } }),
      this.prisma.investment.findMany({ where: { userId } }),
      this.prisma.debt.findMany({ where: { userId } }),
      this.prisma.familySupport.findMany({ where: { userId } }),
      this.prisma.goal.findMany({ where: { userId } }),
      this.prisma.financialSnapshot.findMany({ where: { userId } }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: this.sanitizeUser(user),
      incomeSources,
      expenses,
      savingsAccounts,
      investments,
      debts,
      familySupport,
      goals,
      snapshots,
    };

    // Store export file (implement S3 or local storage)
    const fileName = `export-${userId}-${Date.now()}.json`;
    // const downloadUrl = await this.storageService.uploadJson(fileName, exportData);

    // For now, return a placeholder
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      downloadUrl: `/exports/${fileName}`,
      expiresAt,
    };
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.findById(userId);

    // Verify password
    if (user.passwordHash) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    // Delete user (cascade will delete all related data)
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  private sanitizeUser(user: User | null): Omit<User, 'passwordHash'> | null {
    if (!user) return null;
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
```

### Step 3: User Controller

```typescript
// apps/api/src/modules/user/user.controller.ts

import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { User } from '@prisma/client';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: User) {
    const { passwordHash, ...profile } = user;
    return profile;
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.userService.update(userId, dto);
    const { passwordHash, ...profile } = user;
    return profile;
  }

  @Patch('me/settings')
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    const user = await this.userService.updateSettings(userId, dto);
    const { passwordHash, ...profile } = user;
    return profile;
  }

  @Post('me/complete-onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(@CurrentUser('id') userId: string) {
    const user = await this.userService.completeOnboarding(userId);
    const { passwordHash, ...profile } = user;
    return profile;
  }

  @Get('me/export')
  async exportData(@CurrentUser('id') userId: string) {
    return this.userService.exportData(userId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.userService.deleteAccount(userId, dto.password);
    return { message: 'Account deleted successfully' };
  }
}
```

### Step 4: User Module

```typescript
// apps/api/src/modules/user/user.module.ts

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

---

## UI/UX Specifications

### Profile Screen Layout

```
┌─────────────────────────────────────────┐
│ ← Profile                         Edit  │
├─────────────────────────────────────────┤
│                                         │
│         ┌───────────────┐              │
│         │               │              │
│         │   [Avatar]    │              │
│         │               │              │
│         └───────────────┘              │
│           Arome Oyibo                   │
│         arome@email.com                 │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Personal Information                   │
│  ┌─────────────────────────────────┐   │
│  │ Name           Arome Oyibo    > │   │
│  ├─────────────────────────────────┤   │
│  │ Email      arome@email.com    > │   │
│  ├─────────────────────────────────┤   │
│  │ Country           Nigeria     > │   │
│  ├─────────────────────────────────┤   │
│  │ Currency              ₦NGN    > │   │
│  ├─────────────────────────────────┤   │
│  │ Employment      Employed      > │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Preferences                            │
│  ┌─────────────────────────────────┐   │
│  │ Notifications              🔘   │   │
│  ├─────────────────────────────────┤   │
│  │ Weekly Report              🔘   │   │
│  ├─────────────────────────────────┤   │
│  │ Dark Mode                  ○    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Data & Privacy                         │
│  ┌─────────────────────────────────┐   │
│  │ Export My Data                > │   │
│  ├─────────────────────────────────┤   │
│  │ Delete Account                > │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │           Sign Out               │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Onboarding Flow

```
Step 1: Welcome
├── Name input
├── Country selection
└── Currency (auto-set based on country)

Step 2: Employment
├── Employment type selection
└── Optional: Date of birth

Step 3: Financial Setup
├── Add first income source
├── Set savings goal (optional)
└── Skip option

Step 4: Complete
├── Dashboard preview
└── "Start Your Journey" CTA
```

### Design Patterns

| Element | Specification |
|---------|---------------|
| Section cards | Glass morphism effect |
| Toggle switches | Ikpa Green when active |
| Destructive actions | Red with confirmation modal |
| Avatar | Initials with gradient background |

---

## Onboarding Implementation

```typescript
// apps/api/src/modules/user/dto/onboarding.dto.ts

import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { Country, Currency, EmploymentType } from '@prisma/client';

export class OnboardingStep1Dto {
  @IsString()
  name: string;

  @IsEnum(Country)
  country: Country;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}

export class OnboardingStep2Dto {
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `class-validator` | Request validation |
| `bcrypt` | Password verification for account deletion |

---

## Next Steps

After user management, proceed to:
1. [05-income-sources.md](./05-income-sources.md) - Income tracking
2. [06-expense-management.md](./06-expense-management.md) - Expense tracking
