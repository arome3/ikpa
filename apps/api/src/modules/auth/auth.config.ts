/**
 * Authentication Configuration
 *
 * Centralized configuration for auth-related settings.
 * These values follow security best practices and the IKPA spec.
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
} as const;
