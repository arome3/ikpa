import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for skipping email verification
 */
export const SKIP_EMAIL_VERIFICATION_KEY = 'skipEmailVerification';

/**
 * Skip Email Verification Decorator
 *
 * Mark routes where email verification is not required.
 * Use this for routes like resend-verification where unverified
 * users need access.
 *
 * Note: The route still requires authentication (valid JWT).
 * This only skips the email verification check.
 *
 * @example
 * ```typescript
 * @SkipEmailVerification()
 * @Post('resend-verification')
 * resendVerification(@CurrentUser() user: User) {
 *   // User is authenticated but may not have verified email
 * }
 * ```
 */
export const SkipEmailVerification = () =>
  SetMetadata(SKIP_EMAIL_VERIFICATION_KEY, true);
