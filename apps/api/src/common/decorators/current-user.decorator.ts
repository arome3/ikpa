import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User interface for type safety
 * This should match the User type from Prisma
 */
interface RequestUser {
  id: string;
  email: string;
  name: string;
  [key: string]: unknown;
}

/**
 * CurrentUser Decorator
 *
 * Extract the authenticated user from the request.
 * Can optionally extract a specific property of the user.
 *
 * @example
 * ```typescript
 * // Get the entire user object
 * @Get('me')
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 *
 * // Get just the user ID
 * @Get('my-data')
 * getData(@CurrentUser('id') userId: string) {
 *   return this.service.getByUserId(userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
