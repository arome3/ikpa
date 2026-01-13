import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Google Auth DTO
 *
 * Validates Google OAuth ID token from client
 */
export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google ID token received from Google Sign-In',
  })
  @IsString({ message: 'Google ID token is required' })
  idToken!: string;
}
