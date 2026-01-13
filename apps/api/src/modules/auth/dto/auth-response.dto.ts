import { ApiProperty } from '@nestjs/swagger';
import { User, Country, Currency, EmploymentType } from '@prisma/client';

/**
 * User Response DTO
 *
 * Sanitized user data returned in API responses.
 * Excludes sensitive fields like passwordHash.
 */
export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Chidi Okonkwo' })
  name!: string;

  @ApiProperty({ enum: Country, example: 'NIGERIA' })
  country!: Country;

  @ApiProperty({ enum: Currency, example: 'NGN' })
  currency!: Currency;

  @ApiProperty({ example: 'Africa/Lagos' })
  timezone!: string;

  @ApiProperty({ required: false, enum: EmploymentType })
  employmentType?: EmploymentType | null;

  @ApiProperty({ example: false })
  onboardingCompleted!: boolean;

  @ApiProperty({ example: true })
  notificationsEnabled!: boolean;

  @ApiProperty({ example: true })
  weeklyReportEnabled!: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt!: Date;
}

/**
 * Auth Response DTO
 *
 * Response returned after successful authentication
 * (login, register, or OAuth)
 */
export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({
    description: 'JWT access token (15 minute expiry)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token (7 day expiry)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;
}

/**
 * Token Pair DTO
 *
 * Response returned after token refresh
 */
export class TokenPairDto {
  @ApiProperty({
    description: 'New JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'New refresh token (rotation)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;
}

/**
 * JWT Payload Interface
 *
 * Structure of the JWT token payload
 */
export interface JwtPayload {
  /** User ID (subject) */
  sub: string;
  /** User email */
  email: string;
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
}

/**
 * Sanitized User Type
 *
 * User type without sensitive fields
 */
export type SanitizedUser = Omit<
  User,
  'passwordHash' | 'passwordResetToken' | 'passwordResetExpires'
>;
