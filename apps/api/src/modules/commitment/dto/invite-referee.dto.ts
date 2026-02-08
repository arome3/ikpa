/**
 * Invite Referee DTO
 *
 * Input for inviting a new referee.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsEnum } from 'class-validator';
import { RefereeRelationship } from '@prisma/client';

export class InviteRefereeDto {
  @ApiProperty({
    example: 'friend@example.com',
    description: 'Email address of the referee to invite',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email!: string;

  @ApiProperty({
    example: 'Chidi',
    description: 'Name of the referee',
  })
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @ApiProperty({
    enum: RefereeRelationship,
    example: 'FRIEND',
    description: 'Your relationship with the referee',
  })
  @IsEnum(RefereeRelationship, {
    message: 'relationship must be one of: FRIEND, FAMILY, COLLEAGUE, COACH',
  })
  @IsNotEmpty({ message: 'relationship is required' })
  relationship!: RefereeRelationship;
}

/**
 * Invite referee response
 */
export class InviteRefereeResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'referee-123-abc' })
  refereeId!: string;

  @ApiProperty({ example: 'friend@example.com' })
  email!: string;

  @ApiProperty({ example: 'Chidi' })
  name!: string;

  @ApiProperty({
    example: 'Invitation sent successfully. Chidi will receive an email shortly.',
  })
  message!: string;

  @ApiProperty({
    example: '2026-01-22T10:30:00.000Z',
    description: 'When the invitation expires',
  })
  inviteExpires!: Date;

  @ApiPropertyOptional({
    example: 'https://wa.me/?text=Hi%20Chidi!...',
    description: 'WhatsApp deep link for sharing the referee invitation',
  })
  whatsappLink?: string;
}
