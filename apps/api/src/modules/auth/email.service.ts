/**
 * Email Service
 *
 * Handles transactional email delivery using Resend.
 * Provides methods for authentication-related emails including
 * verification, password reset, and security alerts.
 *
 * @module EmailService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Email sending result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Service for sending transactional emails
 *
 * Uses Resend for reliable email delivery with tracking.
 * All emails are sent from a verified sender address.
 *
 * @example
 * ```typescript
 * await emailService.sendVerificationEmail(
 *   'user@example.com',
 *   'Chidi',
 *   'verification-token-123'
 * );
 * ```
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;
  private readonly appName = 'IKPA';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured - emails will be logged only');
    }
    this.resend = new Resend(apiKey);

    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@ikpa.app';
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'IKPA';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.ikpa.app';
  }

  /**
   * Send email verification email
   *
   * @param to - Recipient email address
   * @param name - User's name for personalization
   * @param token - Verification token
   * @returns Send result
   */
  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<EmailResult> {
    const verificationUrl = `${this.frontendUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

    const html = this.generateVerificationEmailHtml(name, verificationUrl);
    const text = this.generateVerificationEmailText(name, verificationUrl);

    return this.sendEmail({
      to,
      subject: `Verify your ${this.appName} email address`,
      html,
      text,
    });
  }

  /**
   * Send password reset email
   *
   * @param to - Recipient email address
   * @param name - User's name for personalization
   * @param token - Password reset token
   * @returns Send result
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<EmailResult> {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    const html = this.generatePasswordResetEmailHtml(name, resetUrl);
    const text = this.generatePasswordResetEmailText(name, resetUrl);

    return this.sendEmail({
      to,
      subject: `Reset your ${this.appName} password`,
      html,
      text,
    });
  }

  /**
   * Send security alert email (new device login, password change, etc.)
   *
   * @param to - Recipient email address
   * @param name - User's name
   * @param alertType - Type of security alert
   * @param details - Alert details (device, location, time)
   * @returns Send result
   */
  async sendSecurityAlertEmail(
    to: string,
    name: string,
    alertType: 'NEW_DEVICE' | 'PASSWORD_CHANGED' | 'MFA_ENABLED' | 'MFA_DISABLED',
    details: Record<string, string>,
  ): Promise<EmailResult> {
    const subjects: Record<string, string> = {
      NEW_DEVICE: `New device sign-in to your ${this.appName} account`,
      PASSWORD_CHANGED: `Your ${this.appName} password was changed`,
      MFA_ENABLED: `Two-factor authentication enabled on your ${this.appName} account`,
      MFA_DISABLED: `Two-factor authentication disabled on your ${this.appName} account`,
    };

    const html = this.generateSecurityAlertEmailHtml(name, alertType, details);
    const text = this.generateSecurityAlertEmailText(name, alertType, details);

    return this.sendEmail({
      to,
      subject: subjects[alertType],
      html,
      text,
    });
  }

  /**
   * Send welcome email after registration
   *
   * @param to - Recipient email address
   * @param name - User's name
   * @returns Send result
   */
  async sendWelcomeEmail(to: string, name: string): Promise<EmailResult> {
    const html = this.generateWelcomeEmailHtml(name);
    const text = this.generateWelcomeEmailText(name);

    return this.sendEmail({
      to,
      subject: `Welcome to ${this.appName}! 🎉`,
      html,
      text,
    });
  }

  /**
   * Internal method to send email via Resend with retry logic
   *
   * Implements exponential backoff for transient failures.
   * Max 3 retries with delays: 1s, 2s, 4s
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<EmailResult> {
    const { to, subject, html, text } = options;

    // Log in development or when API key is missing
    if (!this.configService.get<string>('RESEND_API_KEY')) {
      this.logger.log(`[DEV] Email to ${to}: ${subject}`);
      this.logger.debug(`[DEV] Email body: ${text.substring(0, 200)}...`);
      return { success: true, messageId: 'dev-mode-' + Date.now() };
    }

    const maxRetries = 3;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.resend.emails.send({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [to],
          subject,
          html,
          text,
        });

        if (result.error) {
          // Check if error is retryable (rate limit, temporary failure)
          const isRetryable = this.isRetryableError(result.error.message);

          if (isRetryable && attempt < maxRetries) {
            lastError = result.error.message;
            const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            this.logger.warn(
              `Email to ${to} failed (attempt ${attempt}/${maxRetries}): ${result.error.message}. Retrying in ${delayMs}ms...`,
            );
            await this.delay(delayMs);
            continue;
          }

          this.logger.error(`Failed to send email to ${to}: ${result.error.message}`);
          return { success: false, error: result.error.message };
        }

        if (attempt > 1) {
          this.logger.log(`Email to ${to} succeeded after ${attempt} attempts`);
        } else {
          this.logger.debug(`Email sent to ${to}: ${result.data?.id}`);
        }
        return { success: true, messageId: result.data?.id };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const isRetryable = this.isRetryableError(message);

        if (isRetryable && attempt < maxRetries) {
          lastError = message;
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          this.logger.warn(
            `Email to ${to} failed (attempt ${attempt}/${maxRetries}): ${message}. Retrying in ${delayMs}ms...`,
          );
          await this.delay(delayMs);
          continue;
        }

        this.logger.error(`Failed to send email to ${to}: ${message}`);
        return { success: false, error: message };
      }
    }

    // All retries exhausted
    this.logger.error(
      `Failed to send email to ${to} after ${maxRetries} attempts: ${lastError}`,
    );
    return { success: false, error: lastError || 'Max retries exceeded' };
  }

  /**
   * Check if an error is retryable (transient failure)
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      'rate limit',
      'too many requests',
      'timeout',
      'temporarily unavailable',
      'service unavailable',
      '429',
      '502',
      '503',
      '504',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
    ];

    const lowerMessage = errorMessage.toLowerCase();
    return retryablePatterns.some((pattern) =>
      lowerMessage.includes(pattern.toLowerCase()),
    );
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================
  // Email Templates (HTML)
  // ============================================

  private generateVerificationEmailHtml(name: string, verificationUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${this.appName}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your AI-Powered Finance Co-pilot</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Verify your email address</h2>

    <p>Hi ${this.escapeHtml(name)},</p>

    <p>Welcome to ${this.appName}! Please verify your email address to complete your registration and start your journey to financial freedom.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Verify Email Address
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">This link will expire in 24 hours. If you didn't create an account with ${this.appName}, you can safely ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verificationUrl}" style="color: #667eea;">${verificationUrl}</a>
    </p>
  </div>

  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
    © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
  </p>
</body>
</html>`;
  }

  private generatePasswordResetEmailHtml(name: string, resetUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${this.appName}</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Reset your password</h2>

    <p>Hi ${this.escapeHtml(name)},</p>

    <p>We received a request to reset your password. Click the button below to choose a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Reset Password
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>

    <p style="color: #666; font-size: 14px;">If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #667eea;">${resetUrl}</a>
    </p>
  </div>

  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
    © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
  </p>
</body>
</html>`;
  }

  private generateSecurityAlertEmailHtml(
    name: string,
    alertType: string,
    details: Record<string, string>,
  ): string {
    const messages: Record<string, string> = {
      NEW_DEVICE: 'A new device was used to sign in to your account.',
      PASSWORD_CHANGED: 'Your password was successfully changed.',
      MFA_ENABLED: 'Two-factor authentication has been enabled on your account.',
      MFA_DISABLED: 'Two-factor authentication has been disabled on your account.',
    };

    const detailsHtml = Object.entries(details)
      .map(([key, value]) => `<li><strong>${this.escapeHtml(key)}:</strong> ${this.escapeHtml(value)}</li>`)
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f59e0b; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔔 Security Alert</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p>Hi ${this.escapeHtml(name)},</p>

    <p>${messages[alertType] || 'A security-related change was made to your account.'}</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <ul style="margin: 0; padding-left: 20px;">
        ${detailsHtml}
      </ul>
    </div>

    <p style="color: #666;">If this was you, no action is needed. If you didn't make this change, please secure your account immediately by changing your password and enabling two-factor authentication.</p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; text-align: center;">
      This is an automated security notification from ${this.appName}.
    </p>
  </div>

  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
    © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
  </p>
</body>
</html>`;
  }

  private generateWelcomeEmailHtml(name: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${this.appName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${this.appName}! 🎉</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your journey to financial freedom starts now</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p>Hi ${this.escapeHtml(name)},</p>

    <p>Welcome to ${this.appName}, your AI-powered personal finance co-pilot! We're excited to help you take control of your finances.</p>

    <h3 style="color: #667eea;">Here's what you can do:</h3>
    <ul style="padding-left: 20px;">
      <li>📊 Track your spending patterns with smart insights</li>
      <li>🎯 Set and achieve your savings goals</li>
      <li>🦈 Hunt down subscription "zombies" eating your money</li>
      <li>💡 Get personalized financial advice</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${this.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Go to Dashboard
      </a>
    </div>

    <p>Got questions? We're here to help! Reply to this email or reach out to our support team.</p>

    <p>Let's build wealth together! 💪</p>

    <p style="margin-bottom: 0;">— The ${this.appName} Team</p>
  </div>

  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
    © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
  </p>
</body>
</html>`;
  }

  // ============================================
  // Email Templates (Plain Text)
  // ============================================

  private generateVerificationEmailText(name: string, verificationUrl: string): string {
    return `
${this.appName} - Verify your email address

Hi ${name},

Welcome to ${this.appName}! Please verify your email address to complete your registration.

Click this link to verify: ${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with ${this.appName}, you can safely ignore this email.

---
© ${new Date().getFullYear()} ${this.appName}. All rights reserved.
    `.trim();
  }

  private generatePasswordResetEmailText(name: string, resetUrl: string): string {
    return `
${this.appName} - Reset your password

Hi ${name},

We received a request to reset your password. Click this link to choose a new password:

${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

---
© ${new Date().getFullYear()} ${this.appName}. All rights reserved.
    `.trim();
  }

  private generateSecurityAlertEmailText(
    name: string,
    alertType: string,
    details: Record<string, string>,
  ): string {
    const messages: Record<string, string> = {
      NEW_DEVICE: 'A new device was used to sign in to your account.',
      PASSWORD_CHANGED: 'Your password was successfully changed.',
      MFA_ENABLED: 'Two-factor authentication has been enabled on your account.',
      MFA_DISABLED: 'Two-factor authentication has been disabled on your account.',
    };

    const detailsText = Object.entries(details)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    return `
${this.appName} - Security Alert

Hi ${name},

${messages[alertType] || 'A security-related change was made to your account.'}

Details:
${detailsText}

If this was you, no action is needed. If you didn't make this change, please secure your account immediately.

---
© ${new Date().getFullYear()} ${this.appName}. All rights reserved.
    `.trim();
  }

  private generateWelcomeEmailText(name: string): string {
    return `
Welcome to ${this.appName}! 🎉

Hi ${name},

Welcome to ${this.appName}, your AI-powered personal finance co-pilot! We're excited to help you take control of your finances.

Here's what you can do:
- Track your spending patterns with smart insights
- Set and achieve your savings goals
- Hunt down subscription "zombies" eating your money
- Get personalized financial advice

Get started: ${this.frontendUrl}/dashboard

Got questions? We're here to help!

Let's build wealth together!

— The ${this.appName} Team

---
© ${new Date().getFullYear()} ${this.appName}. All rights reserved.
    `.trim();
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
  }
}
