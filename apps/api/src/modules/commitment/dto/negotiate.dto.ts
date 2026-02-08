/**
 * Commitment Coach Negotiation DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class StartNegotiationDto {
  @ApiProperty({ description: 'Goal ID to negotiate a commitment for' })
  @IsUUID()
  @IsNotEmpty()
  goalId!: string;
}

export class ContinueNegotiationDto {
  @ApiProperty({ description: 'Negotiation session ID from startNegotiation' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ description: 'User message to the AI coach' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class NegotiationResponseDto {
  @ApiProperty({ description: 'Session ID for continuing the negotiation' })
  sessionId!: string;

  @ApiProperty({ description: 'AI coach message to the user' })
  message!: string;

  @ApiPropertyOptional({
    description: 'Stake recommendation from the AI coach',
  })
  recommendation?: {
    stakeType: string;
    stakeAmount: number;
    reasoning: string;
  };

  @ApiProperty({ description: 'Whether the negotiation is complete' })
  isComplete!: boolean;
}
