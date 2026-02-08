import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartConversationDto {
  @ApiProperty({ description: 'The letter ID to base the conversation on' })
  @IsString()
  @IsNotEmpty()
  letterId!: string;

  @ApiProperty({ description: 'The user message' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message!: string;
}

export class ConversationMessageDto {
  @ApiProperty({ enum: ['user', 'future_self'] })
  role!: 'user' | 'future_self';

  @ApiProperty()
  content!: string;

  @ApiProperty()
  createdAt!: string;
}

export class ConversationResponseDto {
  @ApiProperty()
  conversationId!: string;

  @ApiProperty({ type: ConversationMessageDto })
  response!: ConversationMessageDto;

  @ApiProperty({ type: [ConversationMessageDto] })
  messages!: ConversationMessageDto[];
}
