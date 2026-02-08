/**
 * Import Service
 *
 * Main service for handling data imports (bank statements, screenshots, emails).
 * Coordinates the import pipeline: upload → parse → normalize → dedupe → store.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ImportSource, ImportJobStatus, ParsedTransactionStatus } from '@prisma/client';
import { Resend } from 'resend';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma';
import { OpikService } from '../ai/opik/opik.service';
import { IMPORT_EVENTS } from './notifications/import-events';

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

// DTOs and Interfaces
import { SupportedBank } from './dto';
import {
  ImportJobWithTransactions,
  ParseResult,
  ResendEmailContent,
} from './interfaces';
import {
  ImportJobNotFoundException,
  ImportFileTooLargeException,
  ImportInvalidFileTypeException,
} from './exceptions';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_SCREENSHOT_SIZE_BYTES,
  MAX_SCREENSHOTS_PER_UPLOAD,
  ALLOWED_STATEMENT_MIMES,
  ALLOWED_IMAGE_MIMES,
  IMPORT_EMAIL_DOMAIN,
  EMAIL_REGENERATE_LIMIT_PER_DAY,
} from './constants';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly resend: Resend | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly opikService: OpikService,
    private readonly eventEmitter: EventEmitter2,
    private readonly csvParser: CsvParserService,
    private readonly pdfParser: PdfParserService,
    private readonly visionParser: VisionParserService,
    private readonly emailParser: EmailParserService,
    private readonly normalizer: TransactionNormalizerService,
    private readonly deduplication: DeduplicationService,
    private readonly expenseCreator: ExpenseCreatorService,
    private readonly storage: LocalStorageAdapter,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn('RESEND_API_KEY not configured — email content fetch will be unavailable');
    }
  }

  // ==========================================
  // STATEMENT UPLOAD (PDF/CSV)
  // ==========================================

  /**
   * Upload and process a bank statement (PDF or CSV)
   */
  async uploadStatement(
    userId: string,
    file: Express.Multer.File,
    bankName?: SupportedBank,
  ): Promise<{ jobId: string; status: ImportJobStatus }> {
    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ImportFileTooLargeException(MAX_FILE_SIZE_BYTES, file.size);
    }

    // Validate file type
    if (!ALLOWED_STATEMENT_MIMES.includes(file.mimetype)) {
      throw new ImportInvalidFileTypeException(file.mimetype, ALLOWED_STATEMENT_MIMES);
    }

    // Determine source type
    const source = file.mimetype === 'application/pdf'
      ? ImportSource.BANK_STATEMENT_PDF
      : ImportSource.BANK_STATEMENT_CSV;

    // Store file
    const storedFile = await this.storage.store(
      userId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Create import job
    const job = await this.prisma.importJob.create({
      data: {
        userId,
        source,
        status: ImportJobStatus.PROCESSING,
        fileName: file.originalname,
        fileSize: file.size,
        storagePath: storedFile.path,
        bankName: bankName || null,
      },
    });

    // Process asynchronously (fire and forget)
    this.processStatementAsync(job.id, file.buffer, file.mimetype, bankName).catch(
      (error) => {
        this.logger.error(`Async processing failed for job ${job.id}: ${error.message}`);
      },
    );

    return {
      jobId: job.id,
      status: job.status,
    };
  }

  /**
   * Process statement asynchronously
   */
  private async processStatementAsync(
    jobId: string,
    buffer: Buffer,
    mimeType: string,
    bankName?: SupportedBank,
  ): Promise<void> {
    // Get job to find userId for tracing
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    const trace = job
      ? this.opikService.createAgentTrace({
          agentName: 'import_processor',
          userId: job.userId,
          input: { jobId, mimeType, bankName },
        })
      : null;

    try {
      // Parse based on file type
      let parseResult: ParseResult;

      if (mimeType === 'application/pdf') {
        parseResult = await this.pdfParser.parse(buffer, bankName);
      } else {
        const csvContent = buffer.toString('utf-8');
        parseResult = await this.csvParser.parse(csvContent, bankName);
      }

      if (parseResult.transactions.length === 0) {
        await this.updateJobStatus(jobId, ImportJobStatus.FAILED, 'No transactions found in file');
        return;
      }

      // Process transactions
      await this.processAndStoreTransactions(jobId, parseResult);

      if (trace) {
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'ImportSuccess',
          value: 1,
        });
        this.opikService.endTrace(trace, {
          success: true,
          result: { jobId, mimeType },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.updateJobStatus(jobId, ImportJobStatus.FAILED, message);

      if (trace) {
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'ImportSuccess',
          value: 0,
        });
        this.opikService.endTrace(trace, {
          success: false,
          error: message,
        });
      }

      this.logger.error(`Statement processing failed: ${message}`);
    } finally {
      await this.opikService.flush();
    }
  }

  // ==========================================
  // SCREENSHOT UPLOAD (OCR)
  // ==========================================

  /**
   * Upload and process banking screenshots
   */
  async uploadScreenshots(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<{ jobId: string; status: ImportJobStatus; imageCount: number }> {
    // Validate file count
    if (files.length > MAX_SCREENSHOTS_PER_UPLOAD) {
      throw new ImportInvalidFileTypeException(
        `${files.length} files`,
        [`Maximum ${MAX_SCREENSHOTS_PER_UPLOAD} images per upload`],
      );
    }

    // Validate each file
    let totalSize = 0;
    for (const file of files) {
      if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
        throw new ImportInvalidFileTypeException(file.mimetype, ALLOWED_IMAGE_MIMES);
      }
      if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
        throw new ImportFileTooLargeException(MAX_SCREENSHOT_SIZE_BYTES, file.size);
      }
      totalSize += file.size;
    }

    // Create import job
    const job = await this.prisma.importJob.create({
      data: {
        userId,
        source: ImportSource.SCREENSHOT,
        status: ImportJobStatus.PROCESSING,
        fileName: `${files.length} screenshots`,
        fileSize: totalSize,
      },
    });

    // Process asynchronously
    this.processScreenshotsAsync(job.id, files).catch((error) => {
      this.logger.error(`Screenshot processing failed for job ${job.id}: ${error.message}`);
    });

    return {
      jobId: job.id,
      status: job.status,
      imageCount: files.length,
    };
  }

  /**
   * Process screenshots asynchronously
   */
  private async processScreenshotsAsync(
    jobId: string,
    files: Express.Multer.File[],
  ): Promise<void> {
    try {
      // Prepare images for Vision API
      const images = files.map((file) => ({
        buffer: file.buffer,
        mimeType: file.mimetype,
      }));

      // Parse with Vision
      const parseResult = await this.visionParser.parse(images);

      if (parseResult.transactions.length === 0) {
        await this.updateJobStatus(jobId, ImportJobStatus.FAILED, 'No transactions found in screenshots');
        return;
      }

      // Process transactions
      await this.processAndStoreTransactions(jobId, parseResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.updateJobStatus(jobId, ImportJobStatus.FAILED, message);
      this.logger.error(`Screenshot processing failed: ${message}`);
    }
  }

  // ==========================================
  // EMAIL IMPORT
  // ==========================================

  /**
   * Fetch full email content from Resend's inbound API.
   *
   * Resend webhooks only contain metadata (from, to, subject, email_id).
   * The actual body must be fetched via `emails.receiving.get(emailId)`.
   */
  async fetchEmailContent(
    emailId: string,
    from: string,
    to: string[],
    subject: string,
  ): Promise<ResendEmailContent> {
    if (!this.resend) {
      this.logger.warn('Resend client not configured — returning empty email content');
      return { from, to, subject, text: '', html: '', attachments: [] };
    }

    try {
      const { data, error } = await this.resend.emails.receiving.get(emailId);

      if (error || !data) {
        this.logger.warn(
          `Failed to fetch email ${emailId} from Resend: ${error?.message || 'No data returned'}`,
        );
        return { from, to, subject, text: '', html: '', attachments: [] };
      }

      return {
        from: data.from || from,
        to: data.to || to,
        subject: data.subject || subject,
        text: data.text || '',
        html: data.html || '',
        attachments: [], // Attachments require separate API calls if needed
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Resend API error fetching email ${emailId}: ${message}`);
      return { from, to, subject, text: '', html: '', attachments: [] };
    }
  }

  /**
   * Process incoming email from webhook
   */
  async processEmailWebhook(
    emailAddress: string,
    emailContent: ResendEmailContent,
  ): Promise<{ jobId: string | null; processed: boolean }> {
    // Find user by import email
    const importEmail = await this.prisma.importEmailAddress.findUnique({
      where: { emailAddress },
    });

    if (!importEmail || !importEmail.isActive) {
      this.logger.warn(`Email received for unknown/inactive address: ${emailAddress}`);
      return { jobId: null, processed: false };
    }

    // Update last used
    await this.prisma.importEmailAddress.update({
      where: { id: importEmail.id },
      data: { lastUsedAt: new Date() },
    });

    // Create job
    const job = await this.prisma.importJob.create({
      data: {
        userId: importEmail.userId,
        source: ImportSource.EMAIL_FORWARD,
        status: ImportJobStatus.PROCESSING,
        fileName: emailContent.subject,
        rawContent: emailContent.text || emailContent.html,
      },
    });

    // Process asynchronously
    this.processEmailAsync(job.id, emailContent).catch((error) => {
      this.logger.error(`Email processing failed for job ${job.id}: ${error.message}`);
    });

    return { jobId: job.id, processed: true };
  }

  /**
   * Process email asynchronously
   */
  private async processEmailAsync(
    jobId: string,
    emailContent: ResendEmailContent,
  ): Promise<void> {
    try {
      const parseResult = await this.emailParser.parse(emailContent);

      if (parseResult.transactions.length === 0) {
        await this.updateJobStatus(
          jobId,
          ImportJobStatus.FAILED,
          'No transactions found in email',
        );
        return;
      }

      await this.processAndStoreTransactions(jobId, parseResult);

      // Auto-confirm single high-confidence debit transactions from email forwards
      await this.tryAutoConfirmEmail(jobId, emailContent.from);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.updateJobStatus(jobId, ImportJobStatus.FAILED, message);
      this.logger.error(`Email processing failed: ${message}`);
    }
  }

  /**
   * Auto-confirm single-transaction email imports.
   *
   * Conditions:
   * - Job source is EMAIL_FORWARD
   * - Exactly 1 non-duplicate debit transaction
   * - Confidence >= 0.7
   *
   * If met, creates expense automatically and emits confirmation event.
   */
  private async tryAutoConfirmEmail(
    jobId: string,
    fromEmail: string,
  ): Promise<void> {
    try {
      const job = await this.prisma.importJob.findUnique({
        where: { id: jobId },
        select: { userId: true, source: true },
      });

      if (!job || job.source !== ImportSource.EMAIL_FORWARD) return;

      // Get stored transactions for this job
      const transactions = await this.prisma.parsedTransaction.findMany({
        where: { jobId },
      });

      // Filter to non-duplicate debit transactions
      const debitTxns = transactions.filter(
        (t) =>
          t.status === ParsedTransactionStatus.PENDING &&
          Number(t.amount) < 0,
      );

      // Only auto-confirm if exactly 1 eligible transaction with high confidence
      if (debitTxns.length !== 1) return;

      const txn = debitTxns[0];
      const confidence = txn.confidence ? Number(txn.confidence) : 0;
      if (confidence < 0.7) return;

      this.logger.log(
        `Auto-confirming email import: job ${jobId}, txn ${txn.id} (confidence: ${confidence})`,
      );

      // Create expense with auto-categorization
      const result = await this.expenseCreator.createExpenses(
        job.userId,
        jobId,
        [txn.id],
        'auto',
      );

      if (result.expensesCreated > 0 && result.expenseIds.length > 0) {
        // Look up the created expense for the event payload
        const expense = await this.prisma.expense.findUnique({
          where: { id: result.expenseIds[0] },
          select: {
            id: true,
            amount: true,
            currency: true,
            merchant: true,
            categoryId: true,
            date: true,
            description: true,
          },
        });

        if (expense) {
          this.eventEmitter.emit(IMPORT_EVENTS.EMAIL_AUTO_CONFIRMED, {
            userId: job.userId,
            jobId,
            expenseId: expense.id,
            amount: Number(expense.amount),
            currency: expense.currency,
            merchant: expense.merchant,
            categoryId: expense.categoryId,
            date: expense.date,
            description: expense.description,
            fromEmail,
          });
        }
      }
    } catch (error) {
      // Don't let auto-confirm failure break the pipeline
      this.logger.warn(
        `Auto-confirm failed for job ${jobId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // ==========================================
  // EMAIL ADDRESS MANAGEMENT
  // ==========================================

  /**
   * Get or create user's import email address
   */
  async getImportEmail(userId: string): Promise<{
    emailAddress: string;
    isActive: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> {
    let importEmail = await this.prisma.importEmailAddress.findUnique({
      where: { userId },
    });

    if (!importEmail) {
      // Generate new import email
      const hash = this.generateEmailHash(userId);
      const emailAddress = `ikpa-${hash}@${IMPORT_EMAIL_DOMAIN}`;
      const secretToken = crypto.randomBytes(32).toString('hex');

      importEmail = await this.prisma.importEmailAddress.create({
        data: {
          userId,
          emailAddress,
          secretToken,
        },
      });

      // Emit event to trigger welcome email
      this.eventEmitter.emit(IMPORT_EVENTS.IMPORT_EMAIL_CREATED, {
        userId,
        emailAddress,
      });
    }

    return {
      emailAddress: importEmail.emailAddress,
      isActive: importEmail.isActive,
      createdAt: importEmail.createdAt,
      lastUsedAt: importEmail.lastUsedAt,
    };
  }

  /**
   * Regenerate user's import email address
   */
  async regenerateImportEmail(userId: string): Promise<{
    emailAddress: string;
    remainingToday: number;
  }> {
    // Check rate limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Note: In production, track regeneration count in a separate table
    // For now, we'll just regenerate

    // Deactivate old email
    await this.prisma.importEmailAddress.deleteMany({
      where: { userId },
    });

    // Generate new email
    const hash = this.generateEmailHash(userId);
    const emailAddress = `ikpa-${hash}@${IMPORT_EMAIL_DOMAIN}`;
    const secretToken = crypto.randomBytes(32).toString('hex');

    await this.prisma.importEmailAddress.create({
      data: {
        userId,
        emailAddress,
        secretToken,
      },
    });

    return {
      emailAddress,
      remainingToday: EMAIL_REGENERATE_LIMIT_PER_DAY - 1,
    };
  }

  /**
   * Generate unique email hash
   */
  private generateEmailHash(userId: string): string {
    const timestamp = Date.now().toString();
    const data = `${userId}-${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  }

  // ==========================================
  // JOB MANAGEMENT
  // ==========================================

  /**
   * Get import job by ID
   */
  async getJob(userId: string, jobId: string): Promise<ImportJobWithTransactions> {
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, userId },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!job) {
      throw new ImportJobNotFoundException(jobId);
    }

    return {
      id: job.id,
      userId: job.userId,
      source: job.source,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      bankName: job.bankName,
      totalParsed: job.totalParsed,
      created: job.created,
      duplicates: job.duplicates,
      rejected: job.rejected,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      transactions: job.transactions.map((txn) => ({
        id: txn.id,
        amount: Number(txn.amount),
        currency: txn.currency,
        date: txn.date,
        description: txn.description,
        merchant: txn.merchant,
        normalizedMerchant: txn.normalizedMerchant,
        isRecurringGuess: txn.isRecurringGuess,
        status: txn.status,
        duplicateOfId: txn.duplicateOfId,
        confidence: txn.confidence ? Number(txn.confidence) : null,
      })),
    };
  }

  /**
   * List import jobs for user
   */
  async listJobs(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ jobs: ImportJobWithTransactions[]; total: number }> {
    const [jobs, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          transactions: {
            select: { status: true },
          },
        },
      }),
      this.prisma.importJob.count({ where: { userId } }),
    ]);

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        userId: job.userId,
        source: job.source,
        status: job.status,
        fileName: job.fileName,
        fileSize: job.fileSize,
        bankName: job.bankName,
        totalParsed: job.totalParsed,
        created: job.created,
        duplicates: job.duplicates,
        rejected: job.rejected,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        transactions: [],
      })),
      total,
    };
  }

  /**
   * Confirm transactions and create expenses
   */
  async confirmTransactions(
    userId: string,
    jobId: string,
    transactionIds: string[],
    categoryId: string,
  ): Promise<{ expensesCreated: number; skipped: number; expenseIds: string[] }> {
    // Verify job belongs to user
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new ImportJobNotFoundException(jobId);
    }

    return this.expenseCreator.createExpenses(userId, jobId, transactionIds, categoryId);
  }

  /**
   * Update transaction status (confirm/reject single transaction)
   */
  async updateTransaction(
    userId: string,
    transactionId: string,
    updates: {
      status?: 'CONFIRMED' | 'REJECTED';
      merchant?: string;
      isRecurring?: boolean;
    },
  ): Promise<void> {
    const transaction = await this.prisma.parsedTransaction.findFirst({
      where: {
        id: transactionId,
        job: { userId },
      },
    });

    if (!transaction) {
      throw new ImportJobNotFoundException(transactionId);
    }

    const updateData: Record<string, unknown> = {};

    if (updates.status) {
      updateData.status =
        updates.status === 'CONFIRMED'
          ? ParsedTransactionStatus.CONFIRMED
          : ParsedTransactionStatus.REJECTED;
    }

    if (updates.merchant !== undefined) {
      updateData.merchant = updates.merchant;
      updateData.normalizedMerchant = this.normalizer.normalizeMerchant(updates.merchant);
    }

    if (updates.isRecurring !== undefined) {
      updateData.isRecurringGuess = updates.isRecurring;
    }

    await this.prisma.parsedTransaction.update({
      where: { id: transactionId },
      data: updateData,
    });
  }

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================

  /**
   * Process parsed transactions and store in database
   */
  private async processAndStoreTransactions(
    jobId: string,
    parseResult: ParseResult,
  ): Promise<void> {
    // Get job to find userId and currency
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    if (!job) {
      throw new ImportJobNotFoundException(jobId);
    }

    // Normalize transactions
    const normalized = this.normalizer.normalize(
      parseResult.transactions,
      parseResult.currency,
    );

    // Check for duplicates
    const deduplicationResults = await this.deduplication.checkBatch(
      job.userId,
      jobId,
      normalized,
    );

    // Store transactions
    let duplicateCount = 0;

    for (const result of deduplicationResults) {
      const status = result.isDuplicate
        ? ParsedTransactionStatus.DUPLICATE
        : ParsedTransactionStatus.PENDING;

      if (result.isDuplicate) {
        duplicateCount++;
      }

      await this.prisma.parsedTransaction.create({
        data: {
          jobId,
          amount: result.transaction.amount,
          currency: result.transaction.currency,
          date: result.transaction.date,
          description: result.transaction.description,
          merchant: result.transaction.merchant,
          normalizedMerchant: result.transaction.normalizedMerchant,
          isRecurringGuess: result.transaction.isRecurringGuess,
          deduplicationHash: result.transaction.deduplicationHash,
          status,
          duplicateOfId: result.duplicateOfId,
          confidence: result.transaction.confidence,
        },
      });
    }

    // Update job status
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.AWAITING_REVIEW,
        totalParsed: normalized.length,
        duplicates: duplicateCount,
        bankName: parseResult.bankName,
      },
    });

    this.logger.log(
      `Job ${jobId}: ${normalized.length} transactions stored, ${duplicateCount} duplicates`,
    );
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string,
    status: ImportJobStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status,
        errorMessage: errorMessage || null,
      },
    });
  }
}
