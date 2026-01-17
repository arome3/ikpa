/**
 * Authentication Configuration
 *
 * Centralized configuration for auth-related settings.
 * These values follow security best practices and the IKPA spec.
 *
 * Security Features:
 * - JWT with short-lived access tokens and rotating refresh tokens
 * - Email verification with hashed tokens
 * - Progressive account lockout with escalation
 * - TOTP-based MFA with backup codes
 * - Password complexity requirements
 * - Session management with device tracking
 * - Audit logging for compliance
 */
export const AuthConfig = {
  jwt: {
    accessToken: {
      /** Access token expiration (short-lived for security) */
      expiresIn: '15m',
    },
    refreshToken: {
      /** Refresh token expiration (balance security and UX) */
      expiresIn: '7d',
      /** Refresh token expiration in milliseconds */
      expiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },

  bcrypt: {
    /** Number of salt rounds for password hashing (industry standard) */
    saltRounds: 12,
  },

  passwordReset: {
    /** Password reset token expiration in milliseconds */
    expiresInMs: 60 * 60 * 1000, // 1 hour
  },

  /**
   * Email Verification Configuration
   *
   * Tokens are SHA256 hashed before storage to prevent
   * database compromise from exposing valid tokens.
   */
  emailVerification: {
    /** Token expiration - 24 hours to accommodate timezone differences */
    expiresInMs: 24 * 60 * 60 * 1000,
    /** Minimum time between resend requests to prevent abuse */
    resendCooldownMs: 60 * 1000, // 1 minute
  },

  /**
   * Account Lockout Configuration
   *
   * Implements progressive lockout to deter brute force attacks
   * while balancing user experience. Lock duration escalates
   * on repeated lockouts within the attempt window.
   */
  accountLockout: {
    /** Failed attempts before account is locked */
    maxAttempts: 5,
    /** Initial lock duration */
    lockDurationMs: 15 * 60 * 1000, // 15 minutes
    /** Lock duration multiplier for repeat offenders */
    escalationMultiplier: 2,
    /** Maximum lock duration cap */
    maxLockDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    /** Time window for counting failed attempts */
    attemptWindowMs: 15 * 60 * 1000, // 15 minutes
  },

  /**
   * Multi-Factor Authentication (MFA) Configuration
   *
   * Uses TOTP (RFC 6238) for time-based one-time passwords.
   * Backup codes provide recovery when primary device is unavailable.
   */
  mfa: {
    /** TOTP time window tolerance (number of 30-second periods) */
    totpWindow: 1, // ±30 seconds to account for clock drift
    /** Number of one-time backup codes to generate */
    backupCodeCount: 10,
    /** Issuer name shown in authenticator apps */
    issuer: 'IKPA',
    /** Backup code length (characters) */
    backupCodeLength: 8,
  },

  /**
   * Password Complexity Requirements
   *
   * Balances security with accessibility for African users
   * who may be on mobile devices or newer to digital finance.
   * Special characters are optional to reduce friction.
   */
  password: {
    /** Minimum password length */
    minLength: 8,
    /** Maximum password length (prevent DoS via long passwords) */
    maxLength: 100,
    /** Require at least one uppercase letter */
    requireUppercase: true,
    /** Require at least one lowercase letter */
    requireLowercase: true,
    /** Require at least one number */
    requireNumber: true,
    /** Require special character (disabled for accessibility) */
    requireSpecial: false,
    /** Block common/leaked passwords */
    preventCommonPasswords: true,
    /**
     * Password expiration in milliseconds (90 days for financial app compliance)
     * Set to 0 or null to disable expiration
     */
    maxAgeMs: 90 * 24 * 60 * 60 * 1000, // 90 days
    /**
     * Grace period before password is considered expired (warning period)
     * During this period, users are warned but not blocked
     */
    expiryWarningMs: 14 * 24 * 60 * 60 * 1000, // 14 days before expiry
  },

  /**
   * Session Management Configuration
   *
   * Tracks active sessions per device for security visibility.
   * Limits concurrent sessions to prevent unlimited device spread.
   */
  session: {
    /** Maximum concurrent active sessions per user */
    maxActiveSessions: 10,
    /** Session expires after this period of inactivity */
    inactivityTimeoutMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  },

  /**
   * Audit Logging Configuration
   *
   * Security events are logged for compliance and forensics.
   * Retention period balances storage costs with audit requirements.
   */
  auditLog: {
    /** Days to retain audit logs before cleanup */
    retentionDays: 90,
  },

  /**
   * Apple OAuth Configuration
   *
   * Apple Sign-In uses JWT tokens for identity verification.
   * Token validation includes audience and issuer checks.
   */
  apple: {
    /** Expected token issuer */
    issuer: 'https://appleid.apple.com',
    /** Token expiration tolerance (seconds) */
    tokenExpiryToleranceSec: 60,
  },
} as const;

/**
 * Type-safe access to auth configuration
 */
export type AuthConfigType = typeof AuthConfig;
