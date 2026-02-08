/**
 * Import Notification Event Interfaces
 *
 * Event payloads emitted during the email import pipeline
 * for downstream notification handling.
 */

/**
 * Emitted when an email-forwarded transaction is auto-confirmed
 * and an expense is created without user intervention.
 */
export interface EmailAutoConfirmedEvent {
  userId: string;
  jobId: string;
  expenseId: string;
  amount: number;
  currency: string;
  merchant: string | null;
  categoryId: string;
  date: Date;
  description: string | null;
  fromEmail: string;
}

/**
 * Emitted when a new import email address is created for a user.
 * Triggers a welcome/onboarding email.
 */
export interface ImportEmailCreatedEvent {
  userId: string;
  emailAddress: string;
}

/**
 * Event name constants for the import notification system.
 */
export const IMPORT_EVENTS = {
  EMAIL_AUTO_CONFIRMED: 'import.email.auto_confirmed',
  IMPORT_EMAIL_CREATED: 'import.email.created',
} as const;
