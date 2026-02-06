/**
 * Chat Message DTOs
 *
 * Request and response types for the conversational subscription review.
 */

import { IsArray, ValidateNested, IsEnum, IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ChatMessageItemDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  @IsEnum(['user', 'assistant'] as const)
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'I used it last week' })
  @IsString()
  content!: string;
}

class SessionContextDto {
  @ApiProperty({ description: 'Names of cancelled subscriptions this session', type: [String] })
  @IsArray()
  @IsString({ each: true })
  cancelledNames!: string[];

  @ApiProperty({ description: 'Total annual savings from cancellations this session' })
  @IsNumber()
  cancelledTotal!: number;

  @ApiProperty({ description: 'Names of kept subscriptions this session', type: [String] })
  @IsArray()
  @IsString({ each: true })
  keptNames!: string[];

  @ApiProperty({ description: 'Remaining subscriptions to review' })
  @IsNumber()
  remainingCount!: number;
}

/**
 * Request DTO for subscription chat
 */
export class ChatMessageDto {
  @ApiProperty({
    description: 'Full conversation history. Send empty array to get AI opening message.',
    type: [ChatMessageItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageItemDto)
  messages!: ChatMessageItemDto[];

  @ApiPropertyOptional({
    description: 'AI personality mode',
    enum: ['advisor', 'roast', 'supportive'],
    default: 'advisor',
  })
  @IsOptional()
  @IsEnum(['advisor', 'roast', 'supportive'] as const)
  mode?: 'advisor' | 'roast' | 'supportive';

  @ApiPropertyOptional({
    description: 'Session context for building review momentum',
    type: SessionContextDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SessionContextDto)
  sessionContext?: SessionContextDto;
}

/**
 * Response DTO for subscription chat
 */
export class ChatResponseDto {
  @ApiProperty({ description: 'AI reply text (markdown supported)' })
  reply!: string;

  @ApiPropertyOptional({
    description: 'Suggested quick reply chips (max 3)',
    type: [String],
  })
  quickReplies?: string[];

  @ApiProperty({ description: 'True when AI is ready for keep/cancel decision' })
  isDecisionPoint!: boolean;

  @ApiPropertyOptional({
    description: "AI's recommendation",
    enum: ['KEEP', 'CANCEL'],
  })
  recommendation?: 'KEEP' | 'CANCEL' | null;
}
