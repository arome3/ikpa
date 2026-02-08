/**
 * Import Module
 *
 * Provides data import functionality for IKPA:
 * - Bank statement upload (PDF/CSV)
 * - Screenshot OCR upload
 * - Email forwarding with auto-confirm + confirmation emails
 *
 * Integrates with Shark Auditor for subscription detection
 * and GPS Re-Router for budget threshold checks.
 */

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

// Core
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { ImportCronService } from './import.cron';

// Parsers
import { CsvParserService } from './parsers/csv-parser.service';
import { PdfParserService } from './parsers/pdf-parser.service';
import { VisionParserService } from './parsers/vision-parser.service';
import { EmailParserService } from './parsers/email-parser.service';

// Processing
import { TransactionNormalizerService } from './processing/transaction-normalizer.service';
import { DeduplicationService } from './processing/deduplication.service';
import { ExpenseCreatorService } from './processing/expense-creator.service';

// Storage
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { FILE_STORAGE } from './storage/file-storage.interface';

// Notifications
import { ImportConfirmationService } from './notifications/import-confirmation.service';
import { ImportConfirmationListener } from './notifications/import-confirmation.listener';
import { WeeklyDigestCronService } from './notifications/weekly-digest.cron';

// Database
import { PrismaModule } from '../../prisma';

// External modules
import { AuthModule } from '../auth/auth.module';
import { GpsModule } from '../gps/gps.module';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    MulterModule.register({
      storage: memoryStorage(), // Use memory storage for processing
    }),
    AuthModule, // For EmailService
    GpsModule, // For BudgetService
  ],
  controllers: [ImportController],
  providers: [
    // Core services
    ImportService,
    ImportCronService,

    // Parsers
    CsvParserService,
    PdfParserService,
    VisionParserService,
    EmailParserService,

    // Processing
    TransactionNormalizerService,
    DeduplicationService,
    ExpenseCreatorService,

    // Notifications
    ImportConfirmationService,
    ImportConfirmationListener,
    WeeklyDigestCronService,

    // Storage
    LocalStorageAdapter,
    {
      provide: FILE_STORAGE,
      useClass: LocalStorageAdapter,
    },
  ],
  exports: [ImportService],
})
export class ImportModule {}
