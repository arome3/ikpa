import { Module } from '@nestjs/common';
import { UserService } from './user.service';

/**
 * User Module
 *
 * Provides user-related services to other modules.
 * The UserService is exported for use by AuthModule and others.
 */
@Module({
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
