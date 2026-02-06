import { PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './create-expense.dto';

/**
 * DTO for updating an expense
 * All fields are optional
 */
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
