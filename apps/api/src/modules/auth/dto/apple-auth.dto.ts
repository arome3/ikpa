/**
 * Apple Authentication DTOs
 *
 * DTOs for Apple Sign-In (Sign in with Apple).
 * Handles both initial sign-in and account linking.
 *
 * @module AppleAuthDto
 */

import { IsString, IsOptional, IsEnum, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Country } from '@prisma/client';

/**
 * Apple Sign-In DTO
 *
 * Validates Apple Sign-In request.
 * Apple returns the identity token (JWT) and optionally user info
 * (only on first sign-in).
 */
export class AppleSignInDto {
  @ApiProperty({
    description: 'Apple identity token (JWT)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Identity token is required' })
  identityToken!: string;

  @ApiPropertyOptional({
    description: 'Authorization code (optional, for server-to-server validation)',
    example: 'c1234567890abcdef...',
  })
  @IsOptional()
  @IsString()
  authorizationCode?: string;

  @ApiPropertyOptional({
    description: "User's email (only provided on first sign-in)",
    example: 'user@privaterelay.appleid.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiPropertyOptional({
    description: "User's full name (only provided on first sign-in)",
    example: 'Chidi Okonkwo',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: Country,
    description: 'Country of residence (for new accounts)',
    example: 'NIGERIA',
  })
  @IsOptional()
  @IsEnum(Country, { message: 'Please select a valid country' })
  country?: Country;
}

/**
 * Apple Token Payload
 *
 * Decoded payload from Apple identity token.
 * Used internally after JWT verification.
 */
export interface AppleTokenPayload {
  /** Token issuer (should be https://appleid.apple.com) */
  iss: string;
  /** Audience (your app's client ID) */
  aud: string;
  /** Token expiration timestamp */
  exp: number;
  /** Token issued at timestamp */
  iat: number;
  /** Unique Apple user identifier */
  sub: string;
  /** User's email (if shared) */
  email?: string;
  /** Whether email is verified */
  email_verified?: boolean | string;
  /** Whether email is a private relay address */
  is_private_email?: boolean | string;
  /** Real user indicator (0 = unsupported, 1 = unknown, 2 = likely real) */
  real_user_status?: number;
  /** Nonce for replay protection */
  nonce?: string;
  /** Nonce supported flag */
  nonce_supported?: boolean;
}
