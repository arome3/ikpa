# Savings & Assets

## Overview

This document covers Ikpa's savings and asset tracking system, designed specifically for African financial contexts. It supports traditional bank accounts, mobile money wallets (M-Pesa, OPay, etc.), cash holdings, ajo/susu (rotating savings groups), and investment accounts.

---

## Technical Specifications

### Prisma Schema

```prisma
// Already defined in schema.prisma

enum SavingsType {
  BANK_ACCOUNT
  MOBILE_MONEY
  CASH
  AJO_SUSU
  INVESTMENT
  PENSION
  EMERGENCY_FUND
}

model SavingsAccount {
  id            String          @id @default(cuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  type          SavingsType
  balance       Decimal         @db.Decimal(12, 2)
  currency      Currency        @default(NGN)
  institution   String?         // Bank name, mobile money provider
  accountNumber String?         // Masked for security
  targetAmount  Decimal?        @db.Decimal(12, 2)
  interestRate  Decimal?        @db.Decimal(5, 2)
  isActive      Boolean         @default(true)
  notes         String?
  contributions SavingsContribution[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([userId, type])
  @@index([userId, isActive])
}

model SavingsContribution {
  id               String         @id @default(cuid())
  savingsAccountId String
  savingsAccount   SavingsAccount @relation(fields: [savingsAccountId], references: [id], onDelete: Cascade)
  amount           Decimal        @db.Decimal(12, 2)
  type             ContributionType
  date             DateTime
  notes            String?
  createdAt        DateTime       @default(now())

  @@index([savingsAccountId, date])
}

enum ContributionType {
  DEPOSIT
  WITHDRAWAL
  INTEREST
  BONUS
  ADJUSTMENT
}

model Investment {
  id             String         @id @default(cuid())
  userId         String
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String
  type           InvestmentType
  platform       String?        // e.g., Risevest, Bamboo, Cowrywise
  principalAmount Decimal       @db.Decimal(12, 2)
  currentValue   Decimal        @db.Decimal(12, 2)
  currency       Currency       @default(NGN)
  purchaseDate   DateTime
  maturityDate   DateTime?
  interestRate   Decimal?       @db.Decimal(5, 2)
  isActive       Boolean        @default(true)
  notes          String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([userId, type])
  @@index([userId, isActive])
}

enum InvestmentType {
  STOCKS
  BONDS
  MUTUAL_FUND
  MONEY_MARKET
  TREASURY_BILLS
  REAL_ESTATE
  CRYPTO
  OTHER
}
```

---

## Module Structure

```
apps/api/src/modules/savings/
├── savings.module.ts
├── savings.controller.ts
├── savings.service.ts
├── contributions/
│   ├── contributions.controller.ts
│   └── contributions.service.ts
├── investments/
│   ├── investments.controller.ts
│   └── investments.service.ts
├── dto/
│   ├── create-savings-account.dto.ts
│   ├── update-savings-account.dto.ts
│   ├── create-contribution.dto.ts
│   ├── create-investment.dto.ts
│   └── update-investment.dto.ts
└── entities/
    ├── savings-account.entity.ts
    ├── savings-contribution.entity.ts
    └── investment.entity.ts
```

---

## DTOs

### Create Savings Account DTO

```typescript
// apps/api/src/modules/savings/dto/create-savings-account.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { Currency, SavingsType } from '@prisma/client';

export class CreateSavingsAccountDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(SavingsType)
  type: SavingsType;

  @IsNumber()
  @Min(0)
  balance: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  institution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### Update Savings Account DTO

```typescript
// apps/api/src/modules/savings/dto/update-savings-account.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSavingsAccountDto } from './create-savings-account.dto';

export class UpdateSavingsAccountDto extends PartialType(CreateSavingsAccountDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

### Create Contribution DTO

```typescript
// apps/api/src/modules/savings/dto/create-contribution.dto.ts

import {
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { ContributionType } from '@prisma/client';

export class CreateContributionDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(ContributionType)
  type: ContributionType;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### Create Investment DTO

```typescript
// apps/api/src/modules/savings/dto/create-investment.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Currency, InvestmentType } from '@prisma/client';

export class CreateInvestmentDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(InvestmentType)
  type: InvestmentType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  platform?: string;

  @IsNumber()
  @Min(0.01)
  principalAmount: number;

  @IsNumber()
  @Min(0)
  currentValue: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsDateString()
  purchaseDate: string;

  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### Update Investment DTO

```typescript
// apps/api/src/modules/savings/dto/update-investment.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateInvestmentDto } from './create-investment.dto';

export class UpdateInvestmentDto extends PartialType(CreateInvestmentDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

---

## Service Implementation

### Savings Service

```typescript
// apps/api/src/modules/savings/savings.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsAccountDto } from './dto/create-savings-account.dto';
import { UpdateSavingsAccountDto } from './dto/update-savings-account.dto';
import { SavingsType, ContributionType } from '@prisma/client';

@Injectable()
export class SavingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSavingsAccountDto) {
    // Mask account number if provided
    const maskedAccountNumber = dto.accountNumber
      ? this.maskAccountNumber(dto.accountNumber)
      : undefined;

    return this.prisma.savingsAccount.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        balance: dto.balance,
        currency: dto.currency,
        institution: dto.institution,
        accountNumber: maskedAccountNumber,
        targetAmount: dto.targetAmount,
        interestRate: dto.interestRate,
        notes: dto.notes,
      },
    });
  }

  async findAll(userId: string, includeInactive = false) {
    return this.prisma.savingsAccount.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { contributions: true },
        },
      },
    });
  }

  async findByType(userId: string, type: SavingsType) {
    return this.prisma.savingsAccount.findMany({
      where: { userId, type, isActive: true },
      orderBy: { balance: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const account = await this.prisma.savingsAccount.findUnique({
      where: { id },
      include: {
        contributions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Savings account not found');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return account;
  }

  async update(userId: string, id: string, dto: UpdateSavingsAccountDto) {
    await this.findOne(userId, id);

    return this.prisma.savingsAccount.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.balance !== undefined && { balance: dto.balance }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.institution !== undefined && { institution: dto.institution }),
        ...(dto.accountNumber !== undefined && {
          accountNumber: this.maskAccountNumber(dto.accountNumber),
        }),
        ...(dto.targetAmount !== undefined && { targetAmount: dto.targetAmount }),
        ...(dto.interestRate !== undefined && { interestRate: dto.interestRate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.savingsAccount.delete({ where: { id } });

    return { message: 'Savings account deleted successfully' };
  }

  // Summary & Analytics
  async getTotalSavings(userId: string) {
    const accounts = await this.prisma.savingsAccount.findMany({
      where: { userId, isActive: true },
      select: {
        type: true,
        balance: true,
        currency: true,
      },
    });

    // Group by type
    const byType = accounts.reduce((acc, account) => {
      const type = account.type;
      if (!acc[type]) {
        acc[type] = { type, total: 0, count: 0 };
      }
      acc[type].total += Number(account.balance);
      acc[type].count += 1;
      return acc;
    }, {} as Record<SavingsType, { type: SavingsType; total: number; count: number }>);

    const total = accounts.reduce(
      (sum, acc) => sum + Number(acc.balance),
      0
    );

    return {
      total,
      accountCount: accounts.length,
      byType: Object.values(byType),
    };
  }

  async getAjoSusuAccounts(userId: string) {
    return this.prisma.savingsAccount.findMany({
      where: {
        userId,
        type: 'AJO_SUSU',
        isActive: true,
      },
      include: {
        contributions: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    });
  }

  async getEmergencyFundStatus(userId: string) {
    const emergencyFund = await this.prisma.savingsAccount.findFirst({
      where: {
        userId,
        type: 'EMERGENCY_FUND',
        isActive: true,
      },
    });

    if (!emergencyFund) {
      return {
        hasEmergencyFund: false,
        current: 0,
        target: 0,
        progress: 0,
      };
    }

    const current = Number(emergencyFund.balance);
    const target = Number(emergencyFund.targetAmount ?? 0);
    const progress = target > 0 ? (current / target) * 100 : 0;

    return {
      hasEmergencyFund: true,
      current,
      target,
      progress: Math.round(progress * 10) / 10,
      monthsOfExpenses: 0, // Calculated with expense data
    };
  }

  // Helpers
  private maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) return accountNumber;
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  }
}
```

### Contributions Service

```typescript
// apps/api/src/modules/savings/contributions/contributions.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContributionDto } from '../dto/create-contribution.dto';
import { ContributionType } from '@prisma/client';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    savingsAccountId: string,
    dto: CreateContributionDto,
  ) {
    // Verify account ownership
    const account = await this.validateAccountOwnership(userId, savingsAccountId);

    // Calculate new balance
    let balanceChange = Number(dto.amount);
    if (dto.type === ContributionType.WITHDRAWAL) {
      balanceChange = -balanceChange;

      // Check if sufficient balance for withdrawal
      if (Number(account.balance) + balanceChange < 0) {
        throw new BadRequestException('Insufficient balance for withdrawal');
      }
    }

    // Create contribution and update balance in transaction
    const [contribution] = await this.prisma.$transaction([
      this.prisma.savingsContribution.create({
        data: {
          savingsAccountId,
          amount: dto.amount,
          type: dto.type,
          date: new Date(dto.date),
          notes: dto.notes,
        },
      }),
      this.prisma.savingsAccount.update({
        where: { id: savingsAccountId },
        data: {
          balance: { increment: balanceChange },
        },
      }),
    ]);

    return contribution;
  }

  async findAll(userId: string, savingsAccountId: string, page = 1, limit = 20) {
    await this.validateAccountOwnership(userId, savingsAccountId);

    const [contributions, total] = await Promise.all([
      this.prisma.savingsContribution.findMany({
        where: { savingsAccountId },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.savingsContribution.count({
        where: { savingsAccountId },
      }),
    ]);

    return {
      contributions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContributionSummary(userId: string, savingsAccountId: string) {
    await this.validateAccountOwnership(userId, savingsAccountId);

    const contributions = await this.prisma.savingsContribution.findMany({
      where: { savingsAccountId },
    });

    const summary = contributions.reduce(
      (acc, contrib) => {
        const amount = Number(contrib.amount);
        switch (contrib.type) {
          case ContributionType.DEPOSIT:
            acc.totalDeposits += amount;
            acc.depositCount += 1;
            break;
          case ContributionType.WITHDRAWAL:
            acc.totalWithdrawals += amount;
            acc.withdrawalCount += 1;
            break;
          case ContributionType.INTEREST:
            acc.totalInterest += amount;
            break;
          case ContributionType.BONUS:
            acc.totalBonus += amount;
            break;
        }
        return acc;
      },
      {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalInterest: 0,
        totalBonus: 0,
        depositCount: 0,
        withdrawalCount: 0,
      }
    );

    return {
      ...summary,
      netContributions: summary.totalDeposits - summary.totalWithdrawals,
    };
  }

  async remove(userId: string, savingsAccountId: string, contributionId: string) {
    const account = await this.validateAccountOwnership(userId, savingsAccountId);

    const contribution = await this.prisma.savingsContribution.findUnique({
      where: { id: contributionId },
    });

    if (!contribution || contribution.savingsAccountId !== savingsAccountId) {
      throw new NotFoundException('Contribution not found');
    }

    // Reverse the balance change
    let balanceChange = -Number(contribution.amount);
    if (contribution.type === ContributionType.WITHDRAWAL) {
      balanceChange = Number(contribution.amount);
    }

    await this.prisma.$transaction([
      this.prisma.savingsContribution.delete({
        where: { id: contributionId },
      }),
      this.prisma.savingsAccount.update({
        where: { id: savingsAccountId },
        data: {
          balance: { increment: balanceChange },
        },
      }),
    ]);

    return { message: 'Contribution deleted successfully' };
  }

  private async validateAccountOwnership(userId: string, accountId: string) {
    const account = await this.prisma.savingsAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Savings account not found');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return account;
  }
}
```

### Investments Service

```typescript
// apps/api/src/modules/savings/investments/investments.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvestmentDto } from '../dto/create-investment.dto';
import { UpdateInvestmentDto } from '../dto/update-investment.dto';
import { InvestmentType } from '@prisma/client';

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateInvestmentDto) {
    return this.prisma.investment.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        platform: dto.platform,
        principalAmount: dto.principalAmount,
        currentValue: dto.currentValue,
        currency: dto.currency,
        purchaseDate: new Date(dto.purchaseDate),
        maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : undefined,
        interestRate: dto.interestRate,
        notes: dto.notes,
      },
    });
  }

  async findAll(userId: string, includeInactive = false) {
    return this.prisma.investment.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { currentValue: 'desc' },
    });
  }

  async findByType(userId: string, type: InvestmentType) {
    return this.prisma.investment.findMany({
      where: { userId, type, isActive: true },
      orderBy: { currentValue: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const investment = await this.prisma.investment.findUnique({
      where: { id },
    });

    if (!investment) {
      throw new NotFoundException('Investment not found');
    }

    if (investment.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return investment;
  }

  async update(userId: string, id: string, dto: UpdateInvestmentDto) {
    await this.findOne(userId, id);

    return this.prisma.investment.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.platform !== undefined && { platform: dto.platform }),
        ...(dto.principalAmount !== undefined && { principalAmount: dto.principalAmount }),
        ...(dto.currentValue !== undefined && { currentValue: dto.currentValue }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.purchaseDate && { purchaseDate: new Date(dto.purchaseDate) }),
        ...(dto.maturityDate !== undefined && {
          maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : null,
        }),
        ...(dto.interestRate !== undefined && { interestRate: dto.interestRate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.investment.delete({ where: { id } });

    return { message: 'Investment deleted successfully' };
  }

  // Portfolio Summary
  async getPortfolioSummary(userId: string) {
    const investments = await this.prisma.investment.findMany({
      where: { userId, isActive: true },
    });

    const portfolio = investments.reduce(
      (acc, inv) => {
        const principal = Number(inv.principalAmount);
        const current = Number(inv.currentValue);
        const gainLoss = current - principal;

        acc.totalPrincipal += principal;
        acc.totalValue += current;
        acc.totalGainLoss += gainLoss;

        // Group by type
        const type = inv.type;
        if (!acc.byType[type]) {
          acc.byType[type] = {
            type,
            count: 0,
            totalValue: 0,
            totalGainLoss: 0,
          };
        }
        acc.byType[type].count += 1;
        acc.byType[type].totalValue += current;
        acc.byType[type].totalGainLoss += gainLoss;

        // Group by platform
        const platform = inv.platform ?? 'Other';
        if (!acc.byPlatform[platform]) {
          acc.byPlatform[platform] = {
            platform,
            count: 0,
            totalValue: 0,
          };
        }
        acc.byPlatform[platform].count += 1;
        acc.byPlatform[platform].totalValue += current;

        return acc;
      },
      {
        totalPrincipal: 0,
        totalValue: 0,
        totalGainLoss: 0,
        byType: {} as Record<
          InvestmentType,
          { type: InvestmentType; count: number; totalValue: number; totalGainLoss: number }
        >,
        byPlatform: {} as Record<
          string,
          { platform: string; count: number; totalValue: number }
        >,
      }
    );

    const returnPercentage =
      portfolio.totalPrincipal > 0
        ? (portfolio.totalGainLoss / portfolio.totalPrincipal) * 100
        : 0;

    return {
      investmentCount: investments.length,
      totalPrincipal: portfolio.totalPrincipal,
      totalValue: portfolio.totalValue,
      totalGainLoss: portfolio.totalGainLoss,
      returnPercentage: Math.round(returnPercentage * 100) / 100,
      byType: Object.values(portfolio.byType).sort((a, b) => b.totalValue - a.totalValue),
      byPlatform: Object.values(portfolio.byPlatform).sort((a, b) => b.totalValue - a.totalValue),
    };
  }

  async getUpcomingMaturities(userId: string, days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.prisma.investment.findMany({
      where: {
        userId,
        isActive: true,
        maturityDate: {
          gte: new Date(),
          lte: futureDate,
        },
      },
      orderBy: { maturityDate: 'asc' },
    });
  }
}
```

---

## Controller Implementation

### Savings Controller

```typescript
// apps/api/src/modules/savings/savings.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SavingsService } from './savings.service';
import { CreateSavingsAccountDto } from './dto/create-savings-account.dto';
import { UpdateSavingsAccountDto } from './dto/update-savings-account.dto';
import { SavingsType } from '@prisma/client';

@Controller('savings')
@UseGuards(JwtAuthGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateSavingsAccountDto) {
    return this.savingsService.create(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.savingsService.findAll(userId, includeInactive === 'true');
  }

  @Get('summary')
  getTotalSavings(@CurrentUser('id') userId: string) {
    return this.savingsService.getTotalSavings(userId);
  }

  @Get('emergency-fund')
  getEmergencyFundStatus(@CurrentUser('id') userId: string) {
    return this.savingsService.getEmergencyFundStatus(userId);
  }

  @Get('ajo-susu')
  getAjoSusuAccounts(@CurrentUser('id') userId: string) {
    return this.savingsService.getAjoSusuAccounts(userId);
  }

  @Get('type/:type')
  findByType(
    @CurrentUser('id') userId: string,
    @Param('type') type: SavingsType,
  ) {
    return this.savingsService.findByType(userId, type);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.savingsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSavingsAccountDto,
  ) {
    return this.savingsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.savingsService.remove(userId, id);
  }
}
```

### Contributions Controller

```typescript
// apps/api/src/modules/savings/contributions/contributions.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from '../dto/create-contribution.dto';

@Controller('savings/:accountId/contributions')
@UseGuards(JwtAuthGuard)
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('accountId') accountId: string,
    @Body() dto: CreateContributionDto,
  ) {
    return this.contributionsService.create(userId, accountId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Param('accountId') accountId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.contributionsService.findAll(userId, accountId, page, limit);
  }

  @Get('summary')
  getSummary(
    @CurrentUser('id') userId: string,
    @Param('accountId') accountId: string,
  ) {
    return this.contributionsService.getContributionSummary(userId, accountId);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') userId: string,
    @Param('accountId') accountId: string,
    @Param('id') id: string,
  ) {
    return this.contributionsService.remove(userId, accountId, id);
  }
}
```

### Investments Controller

```typescript
// apps/api/src/modules/savings/investments/investments.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from '../dto/create-investment.dto';
import { UpdateInvestmentDto } from '../dto/update-investment.dto';
import { InvestmentType } from '@prisma/client';

@Controller('investments')
@UseGuards(JwtAuthGuard)
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateInvestmentDto) {
    return this.investmentsService.create(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.investmentsService.findAll(userId, includeInactive === 'true');
  }

  @Get('portfolio')
  getPortfolioSummary(@CurrentUser('id') userId: string) {
    return this.investmentsService.getPortfolioSummary(userId);
  }

  @Get('upcoming-maturities')
  getUpcomingMaturities(
    @CurrentUser('id') userId: string,
    @Query('days') days?: number,
  ) {
    return this.investmentsService.getUpcomingMaturities(userId, days);
  }

  @Get('type/:type')
  findByType(
    @CurrentUser('id') userId: string,
    @Param('type') type: InvestmentType,
  ) {
    return this.investmentsService.findByType(userId, type);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.investmentsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvestmentDto,
  ) {
    return this.investmentsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.investmentsService.remove(userId, id);
  }
}
```

---

## Module Definition

```typescript
// apps/api/src/modules/savings/savings.module.ts

import { Module } from '@nestjs/common';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { ContributionsController } from './contributions/contributions.controller';
import { ContributionsService } from './contributions/contributions.service';
import { InvestmentsController } from './investments/investments.controller';
import { InvestmentsService } from './investments/investments.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    SavingsController,
    ContributionsController,
    InvestmentsController,
  ],
  providers: [SavingsService, ContributionsService, InvestmentsService],
  exports: [SavingsService, ContributionsService, InvestmentsService],
})
export class SavingsModule {}
```

---

## API Endpoints

### Savings Account Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/savings` | Create savings account |
| GET | `/savings` | List all savings accounts |
| GET | `/savings/summary` | Get total savings summary |
| GET | `/savings/emergency-fund` | Get emergency fund status |
| GET | `/savings/ajo-susu` | Get ajo/susu accounts |
| GET | `/savings/type/:type` | Get accounts by type |
| GET | `/savings/:id` | Get single account |
| PATCH | `/savings/:id` | Update account |
| DELETE | `/savings/:id` | Delete account |

### Contribution Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/savings/:accountId/contributions` | Add contribution |
| GET | `/savings/:accountId/contributions` | List contributions |
| GET | `/savings/:accountId/contributions/summary` | Contribution summary |
| DELETE | `/savings/:accountId/contributions/:id` | Delete contribution |

### Investment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/investments` | Create investment |
| GET | `/investments` | List all investments |
| GET | `/investments/portfolio` | Get portfolio summary |
| GET | `/investments/upcoming-maturities` | Investments maturing soon |
| GET | `/investments/type/:type` | Get investments by type |
| GET | `/investments/:id` | Get single investment |
| PATCH | `/investments/:id` | Update investment |
| DELETE | `/investments/:id` | Delete investment |

---

## UI Components

### Savings Account Card

```tsx
// Mobile: apps/mobile/src/components/savings/SavingsAccountCard.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SavingsAccount } from '../../types';
import { formatCurrency } from '../../utils/format';

const TYPE_CONFIG = {
  BANK_ACCOUNT: { icon: 'building', color: '#3B82F6' },
  MOBILE_MONEY: { icon: 'smartphone', color: '#10B981' },
  CASH: { icon: 'wallet', color: '#F59E0B' },
  AJO_SUSU: { icon: 'users', color: '#8B5CF6' },
  INVESTMENT: { icon: 'trending-up', color: '#EC4899' },
  PENSION: { icon: 'shield', color: '#6366F1' },
  EMERGENCY_FUND: { icon: 'life-buoy', color: '#EF4444' },
};

interface SavingsAccountCardProps {
  account: SavingsAccount;
  onPress: () => void;
}

export function SavingsAccountCard({ account, onPress }: SavingsAccountCardProps) {
  const config = TYPE_CONFIG[account.type];
  const hasTarget = account.targetAmount && Number(account.targetAmount) > 0;
  const progress = hasTarget
    ? (Number(account.balance) / Number(account.targetAmount)) * 100
    : 0;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
          <Text style={styles.iconText}>{config.icon[0].toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{account.name}</Text>
          <Text style={styles.type}>
            {account.type.replace('_', ' ')} {account.institution && `• ${account.institution}`}
          </Text>
        </View>
      </View>

      <Text style={styles.balance}>
        {formatCurrency(Number(account.balance), account.currency)}
      </Text>

      {hasTarget && (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progress, 100)}%`,
                  backgroundColor: config.color,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress)}% of {formatCurrency(Number(account.targetAmount), account.currency)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  type: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  balance: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'JetBrains Mono',
  },
  progressSection: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
});
```

### Investment Summary Card

```tsx
// Mobile: apps/mobile/src/components/savings/InvestmentSummaryCard.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency, formatPercentage } from '../../utils/format';

interface InvestmentSummaryProps {
  totalValue: number;
  totalGainLoss: number;
  returnPercentage: number;
  currency: string;
}

export function InvestmentSummaryCard({
  totalValue,
  totalGainLoss,
  returnPercentage,
  currency,
}: InvestmentSummaryProps) {
  const isPositive = totalGainLoss >= 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Investment Portfolio</Text>
      <Text style={styles.value}>{formatCurrency(totalValue, currency)}</Text>

      <View style={styles.returnRow}>
        <Text
          style={[
            styles.gainLoss,
            { color: isPositive ? '#10B981' : '#EF4444' },
          ]}
        >
          {isPositive ? '+' : ''}
          {formatCurrency(totalGainLoss, currency)}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: isPositive ? '#D1FAE5' : '#FEE2E2' },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: isPositive ? '#059669' : '#DC2626' },
            ]}
          >
            {isPositive ? '+' : ''}
            {formatPercentage(returnPercentage)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    fontFamily: 'JetBrains Mono',
  },
  returnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  gainLoss: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
```

---

## Key Capabilities

1. **Multi-Type Savings**: Bank accounts, mobile money, cash, ajo/susu, emergency funds
2. **Contribution Tracking**: Deposits, withdrawals, interest, bonuses with automatic balance updates
3. **Investment Portfolio**: Track stocks, bonds, mutual funds, T-bills, crypto
4. **Progress Tracking**: Visual progress toward savings goals
5. **Emergency Fund Status**: Dedicated emergency fund monitoring
6. **Portfolio Analytics**: Returns, allocation by type and platform
7. **Maturity Alerts**: Track upcoming investment maturities
8. **Africa-Specific**: Native support for ajo/susu rotating savings

---

## Africa-Specific Features

### Ajo/Susu (Rotating Savings)

Ajo (Nigeria) and Susu (Ghana) are traditional rotating savings and credit associations (ROSCAs) where members contribute fixed amounts regularly, and each member takes turns receiving the pool.

```typescript
// Enhanced Ajo/Susu tracking
interface AjoSusuDetails {
  groupName: string;
  memberCount: number;
  contributionAmount: number;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  myPosition: number; // When I receive the pot
  nextPayoutDate: Date;
  organizer?: string;
}
```

### Mobile Money Integration

Support for popular African mobile money platforms:
- **Nigeria**: OPay, PalmPay, Moniepoint
- **Kenya**: M-Pesa, Airtel Money
- **Ghana**: MTN MoMo, AirtelTigo Money
- **South Africa**: FNB eWallet, Standard Bank Instant Money

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Core NestJS decorators |
| `class-validator` | DTO validation |
| `@prisma/client` | Database ORM |

---

## Next Steps

After savings & assets, proceed to:
1. [08-debt-management.md](./08-debt-management.md) - Debt tracking
