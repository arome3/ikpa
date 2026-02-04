/**
 * Import Module
 *
 * Provides data import functionality for IKPA:
 * - Bank statement upload (PDF/CSV)
 * - Screenshot OCR upload
 * - Email forwarding
 *
 * Integrates with Shark Auditor for subscription detection.
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

// Database
import { PrismaModule } from '../../prisma';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    MulterModule.register({
      storage: memoryStorage(), // Use memory storage for processing
    }),
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
