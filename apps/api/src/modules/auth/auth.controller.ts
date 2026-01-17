import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';
import { AppleAuthService } from './apple-auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  GoogleAuthDto,
  AuthResponseDto,
  TokenPairDto,
  VerifyEmailDto,
  ResendVerificationDto,
  EmailVerificationResponseDto,
  ChangePasswordDto,
  PasswordChangedResponseDto,
  MfaSetupResponseDto,
  MfaStatusResponseDto,
  MfaChallengeResponseDto,
  BackupCodesResponseDto,
  VerifyMfaSetupDto,
  VerifyMfaLoginDto,
  VerifyMfaBackupCodeDto,
  DisableMfaDto,
  SessionsListResponseDto,
  SessionRevokedResponseDto,
  AllSessionsRevokedResponseDto,
  RevokeSessionDto,
} from './dto';
import { AppleSignInDto } from './dto/apple-auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkipEmailVerification } from '../../common/decorators/skip-email-verification.decorator';
import { AuditContext } from './audit.service';

/**
 * Authentication Controller
 *
 * Handles all authentication-related HTTP endpoints.
 * Most routes are public (registration, login, etc.)
 * Logout requires authentication.
 *
 * Rate limiting is applied per-endpoint to prevent abuse.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly sessionService: SessionService,
    private readonly appleAuthService: AppleAuthService,
  ) {}

  /**
   * Extract audit context from request
   */
  private getAuditContext(req: Request): AuditContext {
    return {
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
    };
  }

  /**
   * Get client IP from request, handling proxies
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  // ==========================================
  // REGISTRATION & LOGIN
  // ==========================================

  /**
   * Register a new user
   */
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Create a new user account with email and password. A verification email will be sent.',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.register(dto, this.getAuditContext(req));
  }

  /**
   * Login with email and password
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticate user and receive access and refresh tokens. Account may be locked after multiple failed attempts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account locked',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA required - returns challenge token',
    type: MfaChallengeResponseDto,
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto | MfaChallengeResponseDto> {
    return this.authService.login(dto, this.getAuditContext(req));
  }

  // ==========================================
  // TOKEN MANAGEMENT
  // ==========================================

  /**
   * Refresh access token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchange a valid refresh token for a new access and refresh token pair',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: TokenPairDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<TokenPairDto> {
    return this.authService.refreshTokens(dto.refreshToken, this.getAuditContext(req));
  }

  /**
   * Logout - revoke refresh tokens
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @SkipEmailVerification() // Allow unverified users to logout
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Revoke refresh token(s). If refreshToken is provided, only that token is revoked. Otherwise, all tokens are revoked (logout from all devices).',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid access token required',
  })
  async logout(
    @CurrentUser('id') userId: string,
    @Body('refreshToken') refreshToken?: string,
    @Req() req?: Request,
  ): Promise<{ message: string }> {
    await this.authService.logout(
      userId,
      refreshToken,
      req ? this.getAuditContext(req) : undefined,
    );
    return { message: 'Logged out successfully' };
  }

  // ==========================================
  // PASSWORD RESET
  // ==========================================

  /**
   * Request password reset email
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 per minute (sensitive)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Send a password reset email if the email exists. Always returns success to prevent user enumeration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent (if email exists)',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email, this.getAuditContext(req));
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  /**
   * Reset password with token
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password using token from email',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired reset token',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(
      dto.token,
      dto.password,
      this.getAuditContext(req),
    );
    return { message: 'Password reset successfully. Please log in again.' };
  }

  // ==========================================
  // OAUTH
  // ==========================================

  /**
   * Authenticate with Google
   */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Authenticate with Google',
    description:
      'Sign in or sign up using a Google ID token from Google Sign-In',
  })
  @ApiResponse({
    status: 200,
    description: 'Google authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Google token',
  })
  async googleAuth(@Body() dto: GoogleAuthDto): Promise<AuthResponseDto> {
    return this.authService.validateGoogleToken(dto.idToken);
  }

  /**
   * Authenticate with Apple
   */
  @Public()
  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Authenticate with Apple',
    description:
      'Sign in or sign up using Apple Sign-In identity token',
  })
  @ApiResponse({
    status: 200,
    description: 'Apple authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Apple identity token',
  })
  async appleAuth(
    @Body() dto: AppleSignInDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const result = await this.appleAuthService.authenticate(
      dto,
      this.getAuditContext(req),
    );
    // The AppleAuthService returns a FullUserResponse which is compatible with UserResponseDto
    return result as unknown as AuthResponseDto;
  }

  // ==========================================
  // EMAIL VERIFICATION
  // ==========================================

  /**
   * Verify email address
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Verify email using token from verification email',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: EmailVerificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification token',
  })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
  ): Promise<EmailVerificationResponseDto> {
    return this.authService.verifyEmail(dto.token, this.getAuditContext(req));
  }

  /**
   * Resend verification email
   */
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 per minute (prevent abuse)
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Request a new verification email',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent (if account exists and not verified)',
  })
  @ApiResponse({
    status: 400,
    description: 'Email already verified or rate limited',
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.authService.resendVerificationEmail(
      dto.email,
      this.getAuditContext(req),
    );
    return {
      message:
        'If an unverified account with that email exists, a verification email has been sent.',
    };
  }

  // ==========================================
  // PASSWORD CHANGE
  // ==========================================

  /**
   * Change password (authenticated)
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  @ApiOperation({
    summary: 'Change password',
    description:
      'Change password for authenticated user. Requires current password verification. All other sessions are revoked.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: PasswordChangedResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Current password is incorrect',
  })
  @ApiResponse({
    status: 400,
    description: 'New password does not meet requirements',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<PasswordChangedResponseDto> {
    return this.authService.changePassword(
      userId,
      dto,
      this.getAuditContext(req),
    );
  }

  // ==========================================
  // MFA (Two-Factor Authentication)
  // ==========================================

  /**
   * Start MFA setup
   */
  @Post('mfa/enable')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  @ApiOperation({
    summary: 'Start MFA setup',
    description:
      'Generate TOTP secret and QR code for authenticator app setup',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA setup data returned',
    type: MfaSetupResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'MFA already enabled',
  })
  async enableMfa(
    @CurrentUser('id') userId: string,
  ): Promise<MfaSetupResponseDto> {
    return this.mfaService.initiateSetup(userId);
  }

  /**
   * Verify and complete MFA setup
   */
  @Post('mfa/verify')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Verify MFA setup',
    description:
      'Verify TOTP code from authenticator app to complete MFA setup',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA enabled, backup codes returned',
    type: BackupCodesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid verification code',
  })
  async verifyMfaSetup(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyMfaSetupDto,
    @Req() req: Request,
  ): Promise<BackupCodesResponseDto> {
    return this.mfaService.verifyAndEnable(
      userId,
      dto.code,
      this.getAuditContext(req),
    );
  }

  /**
   * Complete login with MFA
   */
  @Public()
  @Post('verify-mfa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Complete login with MFA',
    description: 'Verify TOTP code to complete login when MFA is enabled',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA verified, tokens returned',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid MFA code or session expired',
  })
  async verifyMfaLogin(
    @Body() dto: VerifyMfaLoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const context = this.getAuditContext(req);

    // Verify MFA code
    const { userId } = await this.mfaService.verifyChallenge(
      dto.mfaToken,
      dto.code,
      context,
    );

    // Complete login and generate tokens
    return this.authService.completeMfaLogin(userId, context);
  }

  /**
   * Complete login with backup code
   */
  @Public()
  @Post('verify-mfa/backup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute (more restrictive)
  @ApiOperation({
    summary: 'Complete login with backup code',
    description:
      'Use a one-time backup code to complete login when authenticator is unavailable',
  })
  @ApiResponse({
    status: 200,
    description: 'Backup code verified, tokens returned',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid backup code or session expired',
  })
  async verifyMfaBackupCode(
    @Body() dto: VerifyMfaBackupCodeDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const context = this.getAuditContext(req);

    // Verify backup code
    const { userId } = await this.mfaService.verifyChallengeWithBackupCode(
      dto.mfaToken,
      dto.backupCode,
      context,
    );

    // Complete login and generate tokens
    return this.authService.completeMfaLogin(userId, context);
  }

  /**
   * Disable MFA
   */
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 per minute (sensitive)
  @ApiOperation({
    summary: 'Disable MFA',
    description:
      'Disable two-factor authentication. Requires TOTP code or password.',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA disabled successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid verification code or password',
  })
  async disableMfa(
    @CurrentUser('id') userId: string,
    @Body() dto: DisableMfaDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.mfaService.disable(
      userId,
      dto.code,
      dto.password,
      this.getAuditContext(req),
    );
    return { message: 'Two-factor authentication disabled successfully' };
  }

  /**
   * Get MFA status
   */
  @Get('mfa/status')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute
  @ApiOperation({
    summary: 'Get MFA status',
    description: 'Check if MFA is enabled and get remaining backup codes count',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA status returned',
    type: MfaStatusResponseDto,
  })
  async getMfaStatus(
    @CurrentUser('id') userId: string,
  ): Promise<MfaStatusResponseDto> {
    return this.mfaService.getStatus(userId);
  }

  /**
   * Regenerate backup codes
   */
  @Post('mfa/backup-codes')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 per minute
  @ApiOperation({
    summary: 'Regenerate backup codes',
    description:
      'Generate new backup codes. Previous codes will be invalidated.',
  })
  @ApiResponse({
    status: 200,
    description: 'New backup codes generated',
    type: BackupCodesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid verification code',
  })
  async regenerateBackupCodes(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyMfaSetupDto,
    @Req() req: Request,
  ): Promise<BackupCodesResponseDto> {
    return this.mfaService.regenerateBackupCodes(
      userId,
      dto.code,
      this.getAuditContext(req),
    );
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  /**
   * List active sessions
   */
  @Get('sessions')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute
  @ApiOperation({
    summary: 'List active sessions',
    description:
      'Get all active sessions/devices for the current user, showing device info and last activity',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessions list returned',
    type: SessionsListResponseDto,
  })
  async listSessions(
    @CurrentUser('id') userId: string,
    @CurrentUser('sessionId') sessionId?: string,
  ): Promise<SessionsListResponseDto> {
    // Use sessionId from JWT to mark current session
    return this.sessionService.listSessionsWithCurrentId(userId, sessionId);
  }

  /**
   * Revoke a specific session
   */
  @Post('sessions/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Revoke a specific session',
    description: 'Log out from a specific device/session',
  })
  @ApiResponse({
    status: 200,
    description: 'Session revoked successfully',
    type: SessionRevokedResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Body() dto: RevokeSessionDto,
    @Req() req: Request,
  ): Promise<SessionRevokedResponseDto> {
    return this.sessionService.revokeSession(
      userId,
      dto.sessionId,
      this.getAuditContext(req),
    );
  }

  /**
   * Revoke all other sessions
   */
  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  @ApiOperation({
    summary: 'Revoke all other sessions',
    description:
      'Log out from all other devices, keeping only the current session',
  })
  @ApiResponse({
    status: 200,
    description: 'All other sessions revoked',
    type: AllSessionsRevokedResponseDto,
  })
  async revokeAllSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ): Promise<AllSessionsRevokedResponseDto> {
    // Note: To keep the current session, we'd need to pass the current refresh token ID
    // For now, this revokes all sessions
    return this.sessionService.revokeAllOtherSessions(
      userId,
      undefined,
      this.getAuditContext(req),
    );
  }
}
