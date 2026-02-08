/**
 * Import Controller
 *
 * REST API endpoints for data import functionality.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public, SkipEmailVerification } from '../../common/decorators';
import { ImportService } from './import.service';
import {
  UploadStatementDto,
  UploadStatementResponseDto,
  UploadScreenshotDto,
  UploadScreenshotResponseDto,
  EmailWebhookDto,
  EmailWebhookResponseDto,
  ImportJobDetailsDto,
  ImportJobListResponseDto,
  ImportJobSummaryDto,
  ConfirmJobDto,
  ConfirmJobResponseDto,
  UpdateTransactionDto,
  ImportEmailResponseDto,
  RegenerateEmailResponseDto,
} from './dto';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_SCREENSHOTS_PER_UPLOAD,
  STATEMENT_UPLOAD_LIMIT_PER_HOUR,
  SCREENSHOT_UPLOAD_LIMIT_PER_HOUR,
  IMPORT_EMAIL_DOMAIN,
} from './constants';
import { ImportEmailWebhookInvalidException } from './exceptions';

@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipEmailVerification()
@Controller('import')
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly configService: ConfigService,
  ) {}

  // ==========================================
  // STATEMENT UPLOAD (PDF/CSV)
  // ==========================================

  @Post('statement')
  @ApiOperation({
    summary: 'Upload bank statement',
    description: 'Upload a PDF or CSV bank statement for transaction extraction',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF or CSV bank statement file',
        },
        bankName: {
          type: 'string',
          enum: ['GTBank', 'Access Bank', 'First Bank', 'Zenith Bank', 'UBA', 'Kuda', 'Opay', 'Moniepoint', 'Other'],
          description: 'Bank name for optimized parsing',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Statement uploaded successfully',
    type: UploadStatementResponseDto,
  })
  @Throttle({ default: { limit: STATEMENT_UPLOAD_LIMIT_PER_HOUR, ttl: 3600000 } })
  @UseInterceptors(FileInterceptor('file'))
  async uploadStatement(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE_BYTES }),
          new FileTypeValidator({ fileType: /(pdf|csv|vnd\.ms-excel)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadStatementDto,
  ): Promise<UploadStatementResponseDto> {
    const result = await this.importService.uploadStatement(userId, file, dto.bankName);

    return {
      jobId: result.jobId,
      status: result.status,
      fileName: file.originalname,
      fileSize: file.size,
      message: 'File uploaded successfully. Processing will complete shortly.',
    };
  }

  // ==========================================
  // SCREENSHOT UPLOAD (OCR)
  // ==========================================

  @Post('screenshot')
  @ApiOperation({
    summary: 'Upload banking screenshots',
    description: 'Upload mobile banking screenshots for OCR transaction extraction',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Up to ${MAX_SCREENSHOTS_PER_UPLOAD} image files (PNG, JPEG, WebP)`,
        },
        description: {
          type: 'string',
          description: 'Description of what the screenshots contain',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Screenshots uploaded successfully',
    type: UploadScreenshotResponseDto,
  })
  @Throttle({ default: { limit: SCREENSHOT_UPLOAD_LIMIT_PER_HOUR, ttl: 3600000 } })
  @UseInterceptors(FilesInterceptor('files', MAX_SCREENSHOTS_PER_UPLOAD))
  async uploadScreenshots(
    @CurrentUser('id') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() _dto: UploadScreenshotDto,
  ): Promise<UploadScreenshotResponseDto> {
    const result = await this.importService.uploadScreenshots(userId, files);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return {
      jobId: result.jobId,
      status: result.status,
      imageCount: result.imageCount,
      totalSize,
      message: `${result.imageCount} screenshot${result.imageCount > 1 ? 's' : ''} uploaded. OCR processing will complete shortly.`,
    };
  }

  // ==========================================
  // EMAIL FORWARDING
  // ==========================================

  @Get('email')
  @ApiOperation({
    summary: 'Get import email address',
    description: "Get the user's dedicated email address for forwarding bank alerts",
  })
  @ApiResponse({
    status: 200,
    description: 'Import email address retrieved',
    type: ImportEmailResponseDto,
  })
  async getImportEmail(
    @CurrentUser('id') userId: string,
  ): Promise<ImportEmailResponseDto> {
    const result = await this.importService.getImportEmail(userId);

    return {
      ...result,
      instructions: 'Forward your bank alerts to this email address to automatically import transactions.',
    };
  }

  @Post('email/regenerate')
  @ApiOperation({
    summary: 'Regenerate import email address',
    description: 'Generate a new import email address (old address will stop working)',
  })
  @ApiResponse({
    status: 201,
    description: 'New import email address generated',
    type: RegenerateEmailResponseDto,
  })
  @Throttle({ default: { limit: 3, ttl: 86400000 } }) // 3 per day
  async regenerateImportEmail(
    @CurrentUser('id') userId: string,
  ): Promise<RegenerateEmailResponseDto> {
    const result = await this.importService.regenerateImportEmail(userId);

    return {
      emailAddress: result.emailAddress,
      message: 'New import email address generated. The old address will no longer receive emails.',
      remainingToday: result.remainingToday,
    };
  }

  @Post('webhook/email')
  @Public()
  @ApiOperation({
    summary: 'Email webhook endpoint',
    description: 'Receives inbound emails from Resend (public endpoint)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed',
    type: EmailWebhookResponseDto,
  })
  async handleEmailWebhook(
    @Body() dto: EmailWebhookDto,
    @Headers('resend-signature') signature: string,
  ): Promise<EmailWebhookResponseDto> {
    // Verify webhook signature
    const secret = this.configService.get<string>('RESEND_WEBHOOK_SECRET');
    if (secret && !this.verifyWebhookSignature(dto, signature, secret)) {
      throw new ImportEmailWebhookInvalidException('Invalid webhook signature');
    }

    // Only process email.received events
    if (dto.type !== 'email.received') {
      return {
        success: true,
        message: `Ignored event type: ${dto.type}`,
      };
    }

    // Find recipient import email
    const recipientEmail = dto.data.to.find((email) =>
      email.endsWith(`@${IMPORT_EMAIL_DOMAIN}`),
    );

    if (!recipientEmail) {
      return {
        success: false,
        message: 'No valid import email address found in recipients',
      };
    }

    // Fetch full email content from Resend's inbound API
    const emailContent = await this.importService.fetchEmailContent(
      dto.data.email_id,
      dto.data.from,
      dto.data.to,
      dto.data.subject,
    );

    const result = await this.importService.processEmailWebhook(
      recipientEmail,
      emailContent,
    );

    return {
      success: result.processed,
      jobId: result.jobId || undefined,
      message: result.processed
        ? 'Email received and processing started'
        : 'Email could not be processed',
    };
  }

  // ==========================================
  // JOB MANAGEMENT
  // ==========================================

  @Get('jobs')
  @ApiOperation({
    summary: 'List import jobs',
    description: "Get all import jobs for the current user",
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'List of import jobs',
    type: ImportJobListResponseDto,
  })
  async listJobs(
    @CurrentUser('id') userId: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ): Promise<ImportJobListResponseDto> {
    const result = await this.importService.listJobs(userId, limit, offset);

    return {
      jobs: result.jobs.map((job) => this.mapToJobSummary(job)),
      total: result.total,
    };
  }

  @Get('jobs/:id')
  @ApiOperation({
    summary: 'Get import job details',
    description: 'Get detailed information about an import job including parsed transactions',
  })
  @ApiParam({ name: 'id', description: 'Import job ID' })
  @ApiResponse({
    status: 200,
    description: 'Import job details',
    type: ImportJobDetailsDto,
  })
  async getJob(
    @CurrentUser('id') userId: string,
    @Param('id') jobId: string,
  ): Promise<ImportJobDetailsDto> {
    const job = await this.importService.getJob(userId, jobId);

    return {
      ...this.mapToJobSummary(job),
      errorMessage: job.errorMessage,
      transactions: job.transactions.map((txn) => ({
        id: txn.id,
        amount: txn.amount,
        currency: txn.currency,
        date: txn.date,
        description: txn.description,
        merchant: txn.merchant,
        normalizedMerchant: txn.normalizedMerchant,
        isRecurringGuess: txn.isRecurringGuess,
        status: txn.status,
        duplicateOfId: txn.duplicateOfId,
        confidence: txn.confidence,
      })),
    };
  }

  @Post('jobs/:id/confirm')
  @ApiOperation({
    summary: 'Confirm transactions and create expenses',
    description: 'Confirm selected transactions from an import job and create expenses',
  })
  @ApiParam({ name: 'id', description: 'Import job ID' })
  @ApiResponse({
    status: 201,
    description: 'Expenses created successfully',
    type: ConfirmJobResponseDto,
  })
  async confirmJob(
    @CurrentUser('id') userId: string,
    @Param('id') jobId: string,
    @Body() dto: ConfirmJobDto,
  ): Promise<ConfirmJobResponseDto> {
    const result = await this.importService.confirmTransactions(
      userId,
      jobId,
      dto.transactionIds,
      dto.categoryId,
    );

    return {
      expensesCreated: result.expensesCreated,
      skipped: result.skipped,
      expenseIds: result.expenseIds,
      message: `${result.expensesCreated} expense${result.expensesCreated !== 1 ? 's' : ''} created successfully`,
    };
  }

  @Patch('transactions/:id')
  @ApiOperation({
    summary: 'Update parsed transaction',
    description: 'Update a parsed transaction (change status, merchant, or recurring flag)',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction updated',
  })
  async updateTransaction(
    @CurrentUser('id') userId: string,
    @Param('id') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<{ message: string }> {
    await this.importService.updateTransaction(userId, transactionId, {
      status: dto.status,
      merchant: dto.merchant,
      isRecurring: dto.isRecurring,
    });

    return { message: 'Transaction updated successfully' };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  /**
   * Map import job to summary DTO
   */
  private mapToJobSummary(job: {
    id: string;
    source: string;
    status: string;
    fileName: string | null;
    bankName: string | null;
    totalParsed: number;
    created: number;
    duplicates: number;
    rejected: number;
    createdAt: Date;
  }): ImportJobSummaryDto {
    return {
      id: job.id,
      source: job.source as any,
      status: job.status as any,
      fileName: job.fileName,
      bankName: job.bankName,
      totalParsed: job.totalParsed,
      pendingReview: job.totalParsed - job.created - job.duplicates - job.rejected,
      created: job.created,
      duplicates: job.duplicates,
      createdAt: job.createdAt,
    };
  }

  /**
   * Verify Resend webhook signature
   */
  private verifyWebhookSignature(
    payload: unknown,
    signature: string,
    secret: string,
  ): boolean {
    if (!signature) return false;

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch {
      return false;
    }
  }
}
