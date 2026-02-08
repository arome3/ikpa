import { Injectable } from '@nestjs/common';
import {
  TimeMachineFrequency,
  TimeMachineResponseDto,
  TimeMachineProjectionDto,
} from '../dto/time-machine.dto';

@Injectable()
export class TimeMachineService {
  /** Default annual return rate — ~10% Nigerian money market average */
  private readonly DEFAULT_RETURN_RATE = 0.10;
  private readonly DEFAULT_YEARS = 20;

  /**
   * Calculate the compound-interest opportunity cost of recurring spending.
   *
   * Shows: "If you spent ₦X/day for Y years → total ₦Z.
   *         If you invested instead → ₦W."
   *
   * Uses future-value-of-annuity: FV = PMT × ((1 + r)^n - 1) / r
   * where r is monthly rate, n is total months, PMT is monthly contribution.
   */
  calculateImpact(
    amount: number,
    frequency: TimeMachineFrequency,
    years?: number,
    returnRate?: number,
  ): TimeMachineResponseDto {
    const projectionYears = years ?? this.DEFAULT_YEARS;
    const annualRate = returnRate ?? this.DEFAULT_RETURN_RATE;
    const monthlyRate = annualRate / 12;

    // Convert to monthly amount based on frequency
    const monthlyAmount = this.toMonthly(amount, frequency);

    const projections: TimeMachineProjectionDto[] = [];

    for (let year = 1; year <= projectionYears; year++) {
      const months = year * 12;
      const totalSpent = monthlyAmount * months;

      // Future value of annuity: PMT × ((1 + r)^n - 1) / r
      let investedValue: number;
      if (monthlyRate === 0) {
        investedValue = totalSpent;
      } else {
        investedValue =
          monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
      }

      projections.push({
        year,
        spent: Math.round(totalSpent * 100) / 100,
        invested: Math.round(investedValue * 100) / 100,
      });
    }

    const last = projections[projections.length - 1];

    return {
      totalSpent: last.spent,
      investedValue: last.invested,
      difference: Math.round((last.invested - last.spent) * 100) / 100,
      projections,
    };
  }

  private toMonthly(amount: number, frequency: TimeMachineFrequency): number {
    switch (frequency) {
      case TimeMachineFrequency.DAILY:
        return amount * 30; // ~30 days per month
      case TimeMachineFrequency.WEEKLY:
        return amount * (52 / 12); // ~4.33 weeks per month
      case TimeMachineFrequency.MONTHLY:
        return amount;
    }
  }
}
