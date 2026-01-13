import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule provides database access throughout the application.
 *
 * The @Global() decorator makes PrismaService available in all modules
 * without needing to import PrismaModule in each feature module.
 *
 * Simply import PrismaModule once in AppModule, then inject PrismaService
 * anywhere in the application.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
