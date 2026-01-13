import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService extends PrismaClient and integrates with NestJS lifecycle.
 *
 * This service:
 * - Connects to the database on module initialization
 * - Disconnects cleanly on module destruction
 * - Can be injected into any service or controller
 *
 * Usage:
 * ```typescript
 * constructor(private prisma: PrismaService) {}
 *
 * async getUsers() {
 *   return this.prisma.user.findMany();
 * }
 * ```
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
