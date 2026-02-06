/**
 * Import Module Constants
 *
 * Configuration values for file upload limits, rate limits,
 * and processing parameters.
 */

// File size limits (in bytes)
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image
export const MAX_SCREENSHOTS_PER_UPLOAD = 5;

// Allowed file types
export const ALLOWED_STATEMENT_MIMES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
];

export const ALLOWED_IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
];

// Rate limits (per user)
export const STATEMENT_UPLOAD_LIMIT_PER_HOUR = 10;
export const SCREENSHOT_UPLOAD_LIMIT_PER_HOUR = 20;
export const EMAIL_REGENERATE_LIMIT_PER_DAY = 3;

// Processing configuration
export const ASYNC_PROCESSING_BATCH_SIZE = 5;
export const DEDUPLICATION_DATE_VARIANCE_DAYS = 1;

// Claude API configuration for parsing
export const PARSING_MAX_TOKENS = 16000;
export const VISION_MAX_TOKENS = 8000;
export const PARSING_TIMEOUT_MS = 120000;

// Email import configuration
export const IMPORT_EMAIL_DOMAIN = 'import.ikpa.app';

// Storage configuration
export const UPLOADS_DIR = './uploads';
