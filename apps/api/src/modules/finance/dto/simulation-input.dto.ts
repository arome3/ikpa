import {
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
  IsPositive,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsString,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Individual goal for simulation
 */
export class SimulationGoalDto {
  @ApiPropertyOptional({
    description: 'Unique identifier for the goal',
    example: 'goal-1',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({
    description: 'Goal name for display',
    example: 'Emergency Fund',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Target goal amount',
    example: 1000000,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive({ message: 'Goal amount must be positive' })
  @Type(() => Number)
  amount!: number;

  @ApiProperty({
    description: 'Target date to achieve the goal (ISO 8601)',
    example: '2027-12-31',
  })
  @IsDateString({}, { message: 'Goal deadline must be a valid ISO date string' })
  deadline!: string;

  @ApiPropertyOptional({
    description: 'Priority (1 = highest)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  priority?: number;
}

/**
 * Request DTO for custom simulation parameters
 *
 * All monetary values should be in the user's local currency.
 * Rates are expressed as decimals (e.g., 0.08 = 8%).
 */
export class SimulationInputDto {
  @ApiProperty({
    description: 'Current savings rate as a decimal (0.0 - 1.0)',
    example: 0.08,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0, { message: 'Savings rate cannot be negative' })
  @Max(1, { message: 'Savings rate cannot exceed 100%' })
  @Type(() => Number)
  currentSavingsRate!: number;

  @ApiProperty({
    description: 'Monthly income in local currency',
    example: 400000,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive({ message: 'Monthly income must be positive' })
  @Type(() => Number)
  monthlyIncome!: number;

  @ApiProperty({
    description: 'Current net worth (assets minus liabilities)',
    example: 500000,
  })
  @IsNumber()
  @Type(() => Number)
  currentNetWorth!: number;

  @ApiProperty({
    description: 'Target goal amount to achieve',
    example: 2000000,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive({ message: 'Goal amount must be positive' })
  @Type(() => Number)
  goalAmount!: number;

  @ApiProperty({
    description: 'Target date to achieve the goal (ISO 8601)',
    example: '2026-12-31',
  })
  @IsDateString({}, { message: 'Goal deadline must be a valid ISO date string' })
  goalDeadline!: string;

  @ApiPropertyOptional({
    description: 'Expected annual investment return rate (default: 0.07 = 7%)',
    example: 0.07,
    minimum: 0,
    maximum: 0.5,
    default: 0.07,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Expected return rate cannot be negative' })
  @Max(0.5, { message: 'Expected return rate cannot exceed 50%' })
  @Type(() => Number)
  expectedReturnRate?: number;

  @ApiPropertyOptional({
    description: 'Annual inflation rate (default varies by country)',
    example: 0.05,
    minimum: 0,
    maximum: 0.5,
    default: 0.05,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Inflation rate cannot be negative' })
  @Max(0.5, { message: 'Inflation rate cannot exceed 50%' })
  @Type(() => Number)
  inflationRate?: number;

  @ApiPropertyOptional({
    description: 'Annual income growth rate (default varies by country, typically 3-5%)',
    example: 0.03,
    minimum: 0,
    maximum: 0.2,
    default: 0.03,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Income growth rate cannot be negative' })
  @Max(0.2, { message: 'Income growth rate cannot exceed 20%' })
  @Type(() => Number)
  incomeGrowthRate?: number;

  @ApiPropertyOptional({
    description: 'Monthly expenses in local currency (for expense growth modeling)',
    example: 200000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Monthly expenses cannot be negative' })
  @Type(() => Number)
  monthlyExpenses?: number;

  @ApiPropertyOptional({
    description: 'Annual expense growth rate (default: equals inflation rate)',
    example: 0.05,
    minimum: 0,
    maximum: 0.3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Expense growth rate cannot be negative' })
  @Max(0.3, { message: 'Expense growth rate cannot exceed 30%' })
  @Type(() => Number)
  expenseGrowthRate?: number;

  @ApiPropertyOptional({
    description: 'Tax rate on investment returns (default: 0 = no tax)',
    example: 0.1,
    minimum: 0,
    maximum: 0.5,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Tax rate cannot be negative' })
  @Max(0.5, { message: 'Tax rate cannot exceed 50%' })
  @Type(() => Number)
  taxRateOnReturns?: number;

  @ApiPropertyOptional({
    description: 'Enable market regime modeling (bull/bear cycles for more realistic volatility)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enableMarketRegimes?: boolean;

  @ApiPropertyOptional({
    description: 'Monthly withdrawal amount after goal achievement (for retirement modeling)',
    example: 100000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Monthly withdrawal cannot be negative' })
  @Type(() => Number)
  monthlyWithdrawal?: number;

  @ApiPropertyOptional({
    description: 'Multiple goals with priorities (overrides goalAmount/goalDeadline if provided)',
    type: [SimulationGoalDto],
    maxItems: 5,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Maximum 5 goals allowed' })
  @ValidateNested({ each: true })
  @Type(() => SimulationGoalDto)
  goals?: SimulationGoalDto[];

  @ApiPropertyOptional({
    description: 'Random seed for reproducible simulations (for testing)',
    example: 12345,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  randomSeed?: number;
}
