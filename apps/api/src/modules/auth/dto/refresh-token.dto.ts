import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Refresh Token DTO
 *
 * Validates refresh token for token rotation
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token received during login',
  })
  @IsString({ message: 'Refresh token is required' })
  refreshToken!: string;
}
