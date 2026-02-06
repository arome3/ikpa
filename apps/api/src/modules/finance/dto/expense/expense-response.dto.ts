import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Frequency } from '@prisma/client';

/**
 * Category information embedded in expense response
 */
export class ExpenseCategoryDto {
  @ApiProperty({ description: 'Category ID' })
  id!: string;

  @ApiProperty({ description: 'Category name', example: 'Food & Dining' })
  name!: string;

  @ApiProperty({ description: 'Category icon emoji', example: '🍔' })
  icon!: string;

  @ApiProperty({ description: 'Category color hex', example: '#FF6B6B' })
  color!: string;
}

/**
 * Response DTO for a single expense
 */
export class ExpenseResponseDto {
  @ApiProperty({ description: 'Expense ID' })
  id!: string;

  @ApiProperty({ description: 'Category ID' })
  categoryId!: string;

  @ApiPropertyOptional({ description: 'Category details', type: ExpenseCategoryDto })
  category?: ExpenseCategoryDto;

  @ApiProperty({ description: 'Expense amount', example: 5000 })
  amount!: number;

  @ApiProperty({ description: 'Currency code', example: 'NGN' })
  currency!: string;

  @ApiProperty({ description: 'Date of expense' })
  date!: Date;

  @ApiPropertyOptional({ description: 'Description of the expense' })
  description?: string;

  @ApiPropertyOptional({ description: 'Merchant or vendor name' })
  merchant?: string;

  @ApiProperty({ description: 'Whether this is a recurring expense' })
  isRecurring!: boolean;

  @ApiPropertyOptional({ description: 'Frequency for recurring expenses', enum: Frequency })
  frequency?: Frequency;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt!: Date;
}

/**
 * Category spending summary
 */
export class CategorySpendingDto {
  @ApiProperty({ description: 'Category ID' })
  categoryId!: string;

  @ApiProperty({ description: 'Category name' })
  categoryName!: string;

  @ApiProperty({ description: 'Total spent in this category' })
  total!: number;

  @ApiProperty({ description: 'Number of expenses in this category' })
  count!: number;
}

/**
 * Response DTO for expense list
 */
export class ExpenseListResponseDto {
  @ApiProperty({ description: 'List of expenses', type: [ExpenseResponseDto] })
  items!: ExpenseResponseDto[];

  @ApiProperty({ description: 'Total number of expenses' })
  count!: number;

  @ApiProperty({ description: 'Total amount spent' })
  totalAmount!: number;

  @ApiProperty({ description: 'Spending breakdown by category', type: [CategorySpendingDto] })
  byCategory!: CategorySpendingDto[];
}
