import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_EMAIL_VERIFICATION_KEY } from '../decorators/skip-email-verification.decorator';

/**
 * JWT Authentication Guard
 *
 * Global guard that protects all routes by default.
 * Routes marked with @Public() decorator bypass authentication.
 *
 * Note: This guard requires the JwtStrategy to be configured in the AuthModule.
 * Until the AuthModule is implemented, this guard will allow all requests
 * to pass through (for development purposes).
 *
 * @example
 * ```typescript
 * // Protected route (requires authentication)
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 *
 * // Public route (no authentication required)
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Delegate to Passport's JWT strategy for authentication
    const isAuthenticated = await super.canActivate(context);

    if (!isAuthenticated) {
      return false;
    }

    // Check if email verification should be skipped for this route
    const skipEmailVerification = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipEmailVerification) {
      return true;
    }

    // Enforce email verification
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && !user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email address to access this resource. ' +
          'Check your inbox or request a new verification email.',
      );
    }

    return true;
  }

  /**
   * Handle authentication errors
   * Called by Passport when authentication fails
   */
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    info: Error | undefined,
  ): TUser {
    // Handle specific JWT errors
    if (info) {
      if (info.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (info.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
    }

    // If there's an error or no user, throw unauthorized
    if (err || !user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
