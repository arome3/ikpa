/**
 * Future Self Letter Response DTOs
 */

import { ApiProperty } from '@nestjs/swagger';
import { SimulationResponseDto } from './simulation-response.dto';

/**
 * Response for GET /v1/future-self/letter
 *
 * Personalized letter from the user's future self with simulation data
 */
export class LetterResponseDto {
  @ApiProperty({
    description: 'Unique letter identifier',
    example: 'clxyz123-abc...',
  })
  id!: string;

  @ApiProperty({
    description: 'The personalized letter content from future self',
    example: `Dear Aisha,

I'm writing this from the balcony of our flat in Victoria Island.
Yes, OUR flat—we own it now, mortgage-free.

I know right now you're wondering if the sacrifices are worth it.
You're 28, everyone's going to Dubai, and you're cooking at home
to hit your savings target. I remember that feeling.

Here's what I can tell you from 60:
That ₦20,000 you saved instead of buying those shoes in January 2026?
It became ₦180,000 by the time I'm writing this.

But it's not just about the money. It's about who you become.
The discipline you're building right now? It compounds too.

Keep going. I'm proof it works.

With love from your future,
Aisha (Age 60)`,
  })
  content!: string;

  @ApiProperty({
    description: 'Timestamp when the letter was generated',
    example: '2026-01-22T10:00:00.000Z',
  })
  generatedAt!: Date;

  @ApiProperty({
    description: 'The simulation data used to generate the letter',
    type: SimulationResponseDto,
  })
  simulationData!: SimulationResponseDto;

  @ApiProperty({
    description: "User's current age",
    example: 28,
  })
  userAge!: number;

  @ApiProperty({
    description: 'Age of the "future self" writing the letter',
    example: 60,
  })
  futureAge!: number;
}
