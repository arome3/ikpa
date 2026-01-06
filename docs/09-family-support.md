# Family Support

## Overview

This document covers Ikpa's family support tracking system, a crucial feature designed for African cultural contexts where extended family financial obligations are common and often expected. The system helps users track, plan, and manage financial support to family members without judgment while providing visibility into the impact on personal finances.

---

## Cultural Context

In many African societies, supporting extended family is not optional—it's a deeply ingrained cultural expectation. This can include:

- **Parents**: Supporting aging parents, especially when there's no pension system
- **Siblings**: Funding younger siblings' education or helping with emergencies
- **Extended Family**: Uncles, aunts, cousins requesting help
- **In-Laws**: Post-marriage obligations to spouse's family
- **Community**: Contributions to weddings, funerals, ceremonies

Ikpa approaches this without judgment, helping users:
1. Track what they're already giving
2. Understand the impact on their finances
3. Plan and budget for obligations
4. Set healthy boundaries where needed

---

## Technical Specifications

### Prisma Schema

```prisma
// Already defined in schema.prisma

enum Relationship {
  PARENT
  SIBLING
  CHILD
  SPOUSE
  IN_LAW
  EXTENDED_FAMILY
  FRIEND
  COMMUNITY
  OTHER
}

enum SupportType {
  REGULAR        // Monthly/recurring support
  EDUCATION      // School fees, supplies
  MEDICAL        // Healthcare expenses
  HOUSING        // Rent, building project
  BUSINESS       // Capital, stock
  EMERGENCY      // Unexpected needs
  CEREMONY       // Weddings, funerals, naming ceremonies
  GENERAL        // Unspecified "send me money"
}

enum SupportStatus {
  ACTIVE         // Currently ongoing
  PAUSED         // Temporarily stopped
  COMPLETED      // Finished commitment
  PENDING        // Planned but not started
}

model FamilySupport {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipientName String
  relationship  Relationship
  supportType   SupportType
  status        SupportStatus @default(ACTIVE)
  amount        Decimal       @db.Decimal(12, 2)
  currency      Currency      @default(NGN)
  frequency     Frequency     @default(MONTHLY)
  startDate     DateTime
  endDate       DateTime?
  notes         String?
  isFlexible    Boolean       @default(false)  // Can be adjusted based on finances
  priority      Int           @default(5)       // 1-10, 10 being highest priority
  payments      SupportPayment[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([userId, status])
  @@index([userId, relationship])
}

model SupportPayment {
  id              String        @id @default(cuid())
  familySupportId String
  familySupport   FamilySupport @relation(fields: [familySupportId], references: [id], onDelete: Cascade)
  amount          Decimal       @db.Decimal(12, 2)
  date            DateTime
  notes           String?
  createdAt       DateTime      @default(now())

  @@index([familySupportId, date])
}
```

---

## Module Structure

```
apps/api/src/modules/family-support/
├── family-support.module.ts
├── family-support.controller.ts
├── family-support.service.ts
├── payments/
│   ├── payments.controller.ts
│   └── payments.service.ts
├── analytics/
│   └── support-analytics.service.ts
├── dto/
│   ├── create-family-support.dto.ts
│   ├── update-family-support.dto.ts
│   └── create-payment.dto.ts
└── entities/
    ├── family-support.entity.ts
    └── support-payment.entity.ts
```

---

## DTOs

### Create Family Support DTO

```typescript
// apps/api/src/modules/family-support/dto/create-family-support.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import {
  Currency,
  Relationship,
  SupportType,
  SupportStatus,
  Frequency,
} from '@prisma/client';

export class CreateFamilySupportDto {
  @IsString()
  @MaxLength(100)
  recipientName: string;

  @IsEnum(Relationship)
  relationship: Relationship;

  @IsEnum(SupportType)
  supportType: SupportType;

  @IsOptional()
  @IsEnum(SupportStatus)
  status?: SupportStatus;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsEnum(Frequency)
  frequency?: Frequency;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isFlexible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;
}
```

### Update Family Support DTO

```typescript
// apps/api/src/modules/family-support/dto/update-family-support.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreateFamilySupportDto } from './create-family-support.dto';

export class UpdateFamilySupportDto extends PartialType(CreateFamilySupportDto) {}
```

### Create Payment DTO

```typescript
// apps/api/src/modules/family-support/dto/create-payment.dto.ts

import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateSupportPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

---

## Service Implementation

### Family Support Service

```typescript
// apps/api/src/modules/family-support/family-support.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilySupportDto } from './dto/create-family-support.dto';
import { UpdateFamilySupportDto } from './dto/update-family-support.dto';
import { Relationship, SupportStatus, SupportType, Frequency } from '@prisma/client';

@Injectable()
export class FamilySupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFamilySupportDto) {
    return this.prisma.familySupport.create({
      data: {
        userId,
        recipientName: dto.recipientName,
        relationship: dto.relationship,
        supportType: dto.supportType,
        status: dto.status ?? SupportStatus.ACTIVE,
        amount: dto.amount,
        currency: dto.currency,
        frequency: dto.frequency ?? Frequency.MONTHLY,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
        isFlexible: dto.isFlexible ?? false,
        priority: dto.priority ?? 5,
      },
    });
  }

  async findAll(userId: string, status?: SupportStatus) {
    return this.prisma.familySupport.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: [{ priority: 'desc' }, { amount: 'desc' }],
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });
  }

  async findByRelationship(userId: string, relationship: Relationship) {
    return this.prisma.familySupport.findMany({
      where: { userId, relationship, status: SupportStatus.ACTIVE },
      orderBy: { amount: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const support = await this.prisma.familySupport.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!support) {
      throw new NotFoundException('Family support entry not found');
    }

    if (support.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return support;
  }

  async update(userId: string, id: string, dto: UpdateFamilySupportDto) {
    await this.findOne(userId, id);

    return this.prisma.familySupport.update({
      where: { id },
      data: {
        ...(dto.recipientName && { recipientName: dto.recipientName }),
        ...(dto.relationship && { relationship: dto.relationship }),
        ...(dto.supportType && { supportType: dto.supportType }),
        ...(dto.status && { status: dto.status }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.frequency && { frequency: dto.frequency }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isFlexible !== undefined && { isFlexible: dto.isFlexible }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.familySupport.delete({ where: { id } });

    return { message: 'Family support entry deleted successfully' };
  }

  // Summary & Analytics
  async getSupportSummary(userId: string) {
    const supports = await this.prisma.familySupport.findMany({
      where: { userId, status: SupportStatus.ACTIVE },
    });

    const summary = supports.reduce(
      (acc, support) => {
        const monthlyAmount = this.calculateMonthlyAmount(
          Number(support.amount),
          support.frequency,
        );

        acc.totalMonthly += monthlyAmount;
        acc.totalAnnual += monthlyAmount * 12;

        // By relationship
        const rel = support.relationship;
        if (!acc.byRelationship[rel]) {
          acc.byRelationship[rel] = { relationship: rel, monthly: 0, count: 0 };
        }
        acc.byRelationship[rel].monthly += monthlyAmount;
        acc.byRelationship[rel].count += 1;

        // By type
        const type = support.supportType;
        if (!acc.byType[type]) {
          acc.byType[type] = { type, monthly: 0, count: 0 };
        }
        acc.byType[type].monthly += monthlyAmount;
        acc.byType[type].count += 1;

        // Flexible vs fixed
        if (support.isFlexible) {
          acc.flexibleAmount += monthlyAmount;
        } else {
          acc.fixedAmount += monthlyAmount;
        }

        return acc;
      },
      {
        totalMonthly: 0,
        totalAnnual: 0,
        flexibleAmount: 0,
        fixedAmount: 0,
        byRelationship: {} as Record<
          Relationship,
          { relationship: Relationship; monthly: number; count: number }
        >,
        byType: {} as Record<
          SupportType,
          { type: SupportType; monthly: number; count: number }
        >,
      }
    );

    return {
      recipientCount: supports.length,
      totalMonthly: summary.totalMonthly,
      totalAnnual: summary.totalAnnual,
      flexibleAmount: summary.flexibleAmount,
      fixedAmount: summary.fixedAmount,
      flexiblePercentage:
        summary.totalMonthly > 0
          ? (summary.flexibleAmount / summary.totalMonthly) * 100
          : 0,
      byRelationship: Object.values(summary.byRelationship).sort(
        (a, b) => b.monthly - a.monthly,
      ),
      byType: Object.values(summary.byType).sort((a, b) => b.monthly - a.monthly),
    };
  }

  async getDependencyRatio(userId: string, monthlyIncome: number) {
    const summary = await this.getSupportSummary(userId);

    const ratio = monthlyIncome > 0 ? summary.totalMonthly / monthlyIncome : 0;

    let riskLevel: 'healthy' | 'moderate' | 'high' | 'critical';
    let advice: string;

    if (ratio <= 0.1) {
      riskLevel = 'healthy';
      advice = 'Your family support obligations are well within sustainable limits.';
    } else if (ratio <= 0.2) {
      riskLevel = 'moderate';
      advice = 'Family support is noticeable but manageable. Consider building reserves.';
    } else if (ratio <= 0.35) {
      riskLevel = 'high';
      advice = 'Family obligations are impacting your savings capacity. Review flexible commitments.';
    } else {
      riskLevel = 'critical';
      advice = 'Support obligations may be unsustainable. Consider having honest conversations about limits.';
    }

    return {
      monthlyIncome,
      monthlySupportTotal: summary.totalMonthly,
      dependencyRatio: Math.round(ratio * 1000) / 10, // Percentage with 1 decimal
      riskLevel,
      advice,
      flexibleAmount: summary.flexibleAmount,
      potentialSavingsIfReduced: summary.flexibleAmount * 0.5, // If reduced by 50%
    };
  }

  async getUpcomingObligations(userId: string) {
    const today = new Date();
    const supports = await this.prisma.familySupport.findMany({
      where: {
        userId,
        status: SupportStatus.ACTIVE,
      },
      orderBy: { priority: 'desc' },
    });

    return supports.map((support) => ({
      id: support.id,
      recipientName: support.recipientName,
      relationship: support.relationship,
      supportType: support.supportType,
      amount: Number(support.amount),
      frequency: support.frequency,
      priority: support.priority,
      isFlexible: support.isFlexible,
    }));
  }

  // Private Helpers
  private calculateMonthlyAmount(amount: number, frequency: Frequency): number {
    switch (frequency) {
      case Frequency.DAILY:
        return amount * 30;
      case Frequency.WEEKLY:
        return amount * 4.33;
      case Frequency.BIWEEKLY:
        return amount * 2.17;
      case Frequency.MONTHLY:
        return amount;
      case Frequency.QUARTERLY:
        return amount / 3;
      case Frequency.SEMI_ANNUALLY:
        return amount / 6;
      case Frequency.ANNUALLY:
        return amount / 12;
      case Frequency.ONE_TIME:
        return 0; // Don't count one-time in recurring monthly
      default:
        return amount;
    }
  }
}
```

### Support Analytics Service

```typescript
// apps/api/src/modules/family-support/analytics/support-analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupportStatus, SupportType } from '@prisma/client';

interface SupportTrend {
  month: string;
  total: number;
  byType: Record<SupportType, number>;
}

@Injectable()
export class SupportAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getYearlyTrend(userId: string, year: number): Promise<SupportTrend[]> {
    const payments = await this.prisma.supportPayment.findMany({
      where: {
        familySupport: { userId },
        date: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
      include: {
        familySupport: {
          select: { supportType: true },
        },
      },
    });

    const months: SupportTrend[] = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(year, i, 1);
      const monthEnd = new Date(year, i + 1, 0);
      const monthPayments = payments.filter(
        (p) => p.date >= monthStart && p.date <= monthEnd,
      );

      const byType = monthPayments.reduce((acc, p) => {
        const type = p.familySupport.supportType;
        acc[type] = (acc[type] || 0) + Number(p.amount);
        return acc;
      }, {} as Record<SupportType, number>);

      months.push({
        month: monthStart.toISOString().slice(0, 7), // YYYY-MM
        total: monthPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        byType,
      });
    }

    return months;
  }

  async getTopRecipients(userId: string, limit = 5) {
    const supports = await this.prisma.familySupport.findMany({
      where: { userId, status: SupportStatus.ACTIVE },
      include: {
        payments: true,
      },
    });

    const recipientTotals = supports.map((support) => ({
      id: support.id,
      recipientName: support.recipientName,
      relationship: support.relationship,
      totalPaid: support.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      paymentCount: support.payments.length,
      currentAmount: Number(support.amount),
      frequency: support.frequency,
    }));

    return recipientTotals
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, limit);
  }

  async getEducationSpend(userId: string) {
    const educationSupports = await this.prisma.familySupport.findMany({
      where: {
        userId,
        supportType: SupportType.EDUCATION,
        status: SupportStatus.ACTIVE,
      },
      include: {
        payments: true,
      },
    });

    const totalPaid = educationSupports.reduce(
      (sum, s) =>
        sum + s.payments.reduce((pSum, p) => pSum + Number(p.amount), 0),
      0,
    );

    const monthlyCommitment = educationSupports.reduce(
      (sum, s) => sum + Number(s.amount),
      0,
    );

    return {
      recipientCount: educationSupports.length,
      totalPaid,
      monthlyCommitment,
      recipients: educationSupports.map((s) => ({
        name: s.recipientName,
        relationship: s.relationship,
        amount: Number(s.amount),
        frequency: s.frequency,
      })),
    };
  }

  async getEmergencyHistory(userId: string, months = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const emergencyPayments = await this.prisma.supportPayment.findMany({
      where: {
        familySupport: {
          userId,
          supportType: SupportType.EMERGENCY,
        },
        date: { gte: startDate },
      },
      include: {
        familySupport: {
          select: { recipientName: true, relationship: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const total = emergencyPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    return {
      totalEmergencySpend: total,
      averagePerMonth: total / months,
      emergencyCount: emergencyPayments.length,
      payments: emergencyPayments.map((p) => ({
        amount: Number(p.amount),
        date: p.date,
        recipientName: p.familySupport.recipientName,
        relationship: p.familySupport.relationship,
        notes: p.notes,
      })),
    };
  }
}
```

### Payments Service

```typescript
// apps/api/src/modules/family-support/payments/payments.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupportPaymentDto } from '../dto/create-payment.dto';

@Injectable()
export class SupportPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    supportId: string,
    dto: CreateSupportPaymentDto,
  ) {
    await this.validateSupportOwnership(userId, supportId);

    return this.prisma.supportPayment.create({
      data: {
        familySupportId: supportId,
        amount: dto.amount,
        date: new Date(dto.date),
        notes: dto.notes,
      },
    });
  }

  async findAll(userId: string, supportId: string, page = 1, limit = 20) {
    await this.validateSupportOwnership(userId, supportId);

    const [payments, total] = await Promise.all([
      this.prisma.supportPayment.findMany({
        where: { familySupportId: supportId },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportPayment.count({
        where: { familySupportId: supportId },
      }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentSummary(userId: string, supportId: string) {
    await this.validateSupportOwnership(userId, supportId);

    const payments = await this.prisma.supportPayment.findMany({
      where: { familySupportId: supportId },
    });

    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Group by year-month
    const byMonth = payments.reduce((acc, p) => {
      const key = p.date.toISOString().slice(0, 7);
      acc[key] = (acc[key] || 0) + Number(p.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPaid: total,
      paymentCount: payments.length,
      averagePayment: payments.length > 0 ? total / payments.length : 0,
      byMonth: Object.entries(byMonth)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => b.month.localeCompare(a.month)),
    };
  }

  async remove(userId: string, supportId: string, paymentId: string) {
    await this.validateSupportOwnership(userId, supportId);

    const payment = await this.prisma.supportPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.familySupportId !== supportId) {
      throw new NotFoundException('Payment not found');
    }

    await this.prisma.supportPayment.delete({ where: { id: paymentId } });

    return { message: 'Payment deleted successfully' };
  }

  private async validateSupportOwnership(userId: string, supportId: string) {
    const support = await this.prisma.familySupport.findUnique({
      where: { id: supportId },
    });

    if (!support) {
      throw new NotFoundException('Family support entry not found');
    }

    if (support.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return support;
  }
}
```

---

## Controller Implementation

### Family Support Controller

```typescript
// apps/api/src/modules/family-support/family-support.controller.ts

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
import { FamilySupportService } from './family-support.service';
import { SupportAnalyticsService } from './analytics/support-analytics.service';
import { CreateFamilySupportDto } from './dto/create-family-support.dto';
import { UpdateFamilySupportDto } from './dto/update-family-support.dto';
import { Relationship, SupportStatus } from '@prisma/client';

@Controller('family-support')
@UseGuards(JwtAuthGuard)
export class FamilySupportController {
  constructor(
    private readonly familySupportService: FamilySupportService,
    private readonly analyticsService: SupportAnalyticsService,
  ) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFamilySupportDto,
  ) {
    return this.familySupportService.create(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('status') status?: SupportStatus,
  ) {
    return this.familySupportService.findAll(userId, status);
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.familySupportService.getSupportSummary(userId);
  }

  @Get('dependency-ratio')
  getDependencyRatio(
    @CurrentUser('id') userId: string,
    @Query('monthlyIncome') monthlyIncome: number,
  ) {
    return this.familySupportService.getDependencyRatio(userId, monthlyIncome);
  }

  @Get('upcoming')
  getUpcoming(@CurrentUser('id') userId: string) {
    return this.familySupportService.getUpcomingObligations(userId);
  }

  @Get('analytics/trend')
  getYearlyTrend(
    @CurrentUser('id') userId: string,
    @Query('year') year?: number,
  ) {
    return this.analyticsService.getYearlyTrend(
      userId,
      year ?? new Date().getFullYear(),
    );
  }

  @Get('analytics/top-recipients')
  getTopRecipients(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getTopRecipients(userId, limit);
  }

  @Get('analytics/education')
  getEducationSpend(@CurrentUser('id') userId: string) {
    return this.analyticsService.getEducationSpend(userId);
  }

  @Get('analytics/emergencies')
  getEmergencyHistory(
    @CurrentUser('id') userId: string,
    @Query('months') months?: number,
  ) {
    return this.analyticsService.getEmergencyHistory(userId, months);
  }

  @Get('relationship/:relationship')
  findByRelationship(
    @CurrentUser('id') userId: string,
    @Param('relationship') relationship: Relationship,
  ) {
    return this.familySupportService.findByRelationship(userId, relationship);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.familySupportService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFamilySupportDto,
  ) {
    return this.familySupportService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.familySupportService.remove(userId, id);
  }
}
```

---

## API Endpoints

### Family Support Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/family-support` | Create support entry |
| GET | `/family-support` | List all support entries |
| GET | `/family-support/summary` | Get support summary |
| GET | `/family-support/dependency-ratio` | Calculate dependency ratio |
| GET | `/family-support/upcoming` | Get upcoming obligations |
| GET | `/family-support/analytics/trend` | Yearly spending trend |
| GET | `/family-support/analytics/top-recipients` | Top recipients by total |
| GET | `/family-support/analytics/education` | Education spending |
| GET | `/family-support/analytics/emergencies` | Emergency history |
| GET | `/family-support/relationship/:relationship` | Filter by relationship |
| GET | `/family-support/:id` | Get single entry |
| PATCH | `/family-support/:id` | Update entry |
| DELETE | `/family-support/:id` | Delete entry |

### Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/family-support/:supportId/payments` | Record payment |
| GET | `/family-support/:supportId/payments` | List payments |
| GET | `/family-support/:supportId/payments/summary` | Payment summary |
| DELETE | `/family-support/:supportId/payments/:id` | Delete payment |

---

## UI Components

### Family Support Card

```tsx
// Mobile: apps/mobile/src/components/family-support/SupportCard.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FamilySupport } from '../../types';
import { formatCurrency } from '../../utils/format';

const RELATIONSHIP_ICONS = {
  PARENT: { icon: 'heart', color: '#EF4444' },
  SIBLING: { icon: 'users', color: '#3B82F6' },
  CHILD: { icon: 'baby', color: '#10B981' },
  SPOUSE: { icon: 'heart', color: '#EC4899' },
  IN_LAW: { icon: 'home', color: '#8B5CF6' },
  EXTENDED_FAMILY: { icon: 'git-branch', color: '#F59E0B' },
  FRIEND: { icon: 'user', color: '#06B6D4' },
  COMMUNITY: { icon: 'globe', color: '#84CC16' },
  OTHER: { icon: 'help-circle', color: '#6B7280' },
};

interface SupportCardProps {
  support: FamilySupport;
  onPress: () => void;
}

export function SupportCard({ support, onPress }: SupportCardProps) {
  const config = RELATIONSHIP_ICONS[support.relationship];

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
          <Text style={styles.iconText}>{config.icon[0].toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{support.recipientName}</Text>
          <Text style={styles.relationship}>
            {support.relationship.replace('_', ' ')} • {support.supportType.replace('_', ' ')}
          </Text>
        </View>
        {support.isFlexible && (
          <View style={styles.flexibleBadge}>
            <Text style={styles.flexibleText}>Flexible</Text>
          </View>
        )}
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amount}>
          {formatCurrency(Number(support.amount), support.currency)}
        </Text>
        <Text style={styles.frequency}>
          /{support.frequency.toLowerCase()}
        </Text>
      </View>

      <View style={styles.priorityRow}>
        <Text style={styles.priorityLabel}>Priority</Text>
        <View style={styles.priorityBar}>
          {[...Array(10)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.priorityDot,
                {
                  backgroundColor:
                    i < support.priority ? config.color : '#E5E7EB',
                },
              ]}
            />
          ))}
        </View>
      </View>
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
    borderRadius: 22,
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
  relationship: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  flexibleBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  flexibleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'JetBrains Mono',
  },
  frequency: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  priorityLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  priorityBar: {
    flexDirection: 'row',
    gap: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
```

### Dependency Ratio Gauge

```tsx
// Mobile: apps/mobile/src/components/family-support/DependencyGauge.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency, formatPercentage } from '../../utils/format';

interface DependencyGaugeProps {
  ratio: number;
  riskLevel: 'healthy' | 'moderate' | 'high' | 'critical';
  monthlySupport: number;
  monthlyIncome: number;
  currency: string;
  advice: string;
}

const RISK_COLORS = {
  healthy: '#10B981',
  moderate: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

export function DependencyGauge({
  ratio,
  riskLevel,
  monthlySupport,
  monthlyIncome,
  currency,
  advice,
}: DependencyGaugeProps) {
  const color = RISK_COLORS[riskLevel];
  const width = Math.min(ratio, 50) * 2; // Cap visual at 50% = 100% width

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Family Dependency Ratio</Text>

      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeBackground}>
          <View
            style={[
              styles.gaugeFill,
              { width: `${width}%`, backgroundColor: color },
            ]}
          />
        </View>
        <View style={styles.markers}>
          <Text style={styles.marker}>0%</Text>
          <Text style={styles.marker}>10%</Text>
          <Text style={styles.marker}>20%</Text>
          <Text style={styles.marker}>35%</Text>
          <Text style={styles.marker}>50%+</Text>
        </View>
      </View>

      <View style={styles.ratioDisplay}>
        <Text style={[styles.ratioValue, { color }]}>
          {formatPercentage(ratio)}
        </Text>
        <Text style={[styles.riskBadge, { backgroundColor: color }]}>
          {riskLevel.toUpperCase()}
        </Text>
      </View>

      <View style={styles.breakdown}>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>Monthly Support</Text>
          <Text style={styles.breakdownValue}>
            {formatCurrency(monthlySupport, currency)}
          </Text>
        </View>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>Monthly Income</Text>
          <Text style={styles.breakdownValue}>
            {formatCurrency(monthlyIncome, currency)}
          </Text>
        </View>
      </View>

      <View style={styles.adviceBox}>
        <Text style={styles.adviceText}>{advice}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  gaugeContainer: {
    marginBottom: 16,
  },
  gaugeBackground: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 6,
  },
  markers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  marker: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  ratioDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  ratioValue: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
  riskBadge: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  breakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
    fontFamily: 'JetBrains Mono',
  },
  adviceBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  adviceText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
});
```

---

## Key Capabilities

1. **Comprehensive Tracking**: Track all family support with recipient, relationship, type
2. **Dependency Ratio**: Calculate percentage of income going to family support
3. **Priority Management**: Rank obligations by importance (1-10)
4. **Flexible vs Fixed**: Mark obligations that can be adjusted if needed
5. **Analytics**: Trend analysis, top recipients, education spending
6. **Emergency Tracking**: Monitor ad-hoc emergency support requests
7. **Cultural Sensitivity**: Non-judgmental approach to family obligations

---

## Dependency Ratio Guidelines

| Ratio | Risk Level | Interpretation |
|-------|------------|----------------|
| 0-10% | Healthy | Sustainable, allows for savings and personal goals |
| 10-20% | Moderate | Noticeable impact, monitor for increases |
| 20-35% | High | Significantly impacts savings capacity |
| 35%+ | Critical | May lead to personal financial stress |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Core NestJS decorators |
| `class-validator` | DTO validation |
| `@prisma/client` | Database ORM |

---

## Next Steps

After family support, proceed to:
1. [10-financial-metrics.md](./10-financial-metrics.md) - Cash flow score and metrics
