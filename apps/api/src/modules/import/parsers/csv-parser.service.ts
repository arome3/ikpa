/**
 * CSV Parser Service
 *
 * Parses bank statement CSV files using papaparse.
 * Handles various bank export formats.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as Papa from 'papaparse';
import { Currency } from '@prisma/client';
import { RawParsedTransaction, ParseResult } from '../interfaces';
import { ImportCsvParseException } from '../exceptions';
import { SupportedBank } from '../dto';

/**
 * Column mapping for different bank CSV formats
 */
interface ColumnMapping {
  date: string | string[];
  amount: string | string[];
  debit?: string;
  credit?: string;
  description: string | string[];
  reference?: string | string[];
  balance?: string | string[];
}

/**
 * Bank-specific CSV formats
 */
const BANK_FORMATS: Record<string, ColumnMapping> = {
  // GTBank format
  gtbank: {
    date: ['Transaction Date', 'Date', 'VALUE DATE'],
    amount: ['Amount', 'AMOUNT'],
    debit: 'Debit',
    credit: 'Credit',
    description: ['Description', 'NARRATION', 'Narration'],
    reference: ['Reference', 'REFERENCE'],
    balance: ['Balance', 'BALANCE'],
  },
  // Access Bank format
  access: {
    date: ['Date', 'Transaction Date', 'Value Date'],
    amount: ['Amount'],
    debit: 'Debit Amount',
    credit: 'Credit Amount',
    description: ['Description', 'Remarks', 'Narration'],
    reference: ['Reference Number', 'Trans Ref'],
  },
  // First Bank format
  firstbank: {
    date: ['Date', 'Trans Date'],
    amount: ['Amount'],
    debit: 'DR',
    credit: 'CR',
    description: ['Description', 'Particulars'],
    reference: ['Reference'],
  },
  // Zenith Bank format
  zenith: {
    date: ['Post Date', 'Trans Date', 'Date'],
    amount: ['Amount'],
    debit: 'Debit',
    credit: 'Credit',
    description: ['Narration', 'Description'],
    reference: ['Reference'],
  },
  // Kuda Bank format (simplified)
  kuda: {
    date: ['Date', 'Transaction Date'],
    amount: ['Amount'],
    description: ['Description', 'Reference'],
  },
  // Generic fallback
  generic: {
    date: ['date', 'Date', 'DATE', 'Transaction Date', 'Trans Date', 'Value Date', 'Post Date'],
    amount: ['amount', 'Amount', 'AMOUNT', 'Value'],
    debit: 'debit',
    credit: 'credit',
    description: [
      'description',
      'Description',
      'DESCRIPTION',
      'Narration',
      'NARRATION',
      'Remarks',
      'Particulars',
    ],
    reference: ['reference', 'Reference', 'REFERENCE', 'Trans Ref'],
  },
};

@Injectable()
export class CsvParserService {
  private readonly logger = new Logger(CsvParserService.name);

  /**
   * Parse CSV content and extract transactions
   */
  async parse(csvContent: string, bankName?: SupportedBank): Promise<ParseResult> {
    try {
      // Parse CSV with papaparse
      const parseResult = Papa.parse<Record<string, string>>(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
      });

      if (parseResult.errors.length > 0) {
        const errorMessages = parseResult.errors
          .slice(0, 3)
          .map((e) => e.message)
          .join(', ');
        this.logger.warn(`CSV parsing warnings: ${errorMessages}`);
      }

      if (parseResult.data.length === 0) {
        throw new ImportCsvParseException('No data rows found in CSV');
      }

      // Detect column mapping
      const headers = Object.keys(parseResult.data[0]);
      const mapping = this.detectColumnMapping(headers, bankName);

      if (!mapping) {
        throw new ImportCsvParseException(
          'Could not detect column mapping. Required columns: date, amount, description',
        );
      }

      // Extract transactions
      const transactions: RawParsedTransaction[] = [];
      const detectedCurrency = this.detectCurrency(parseResult.data);

      for (const row of parseResult.data) {
        const transaction = this.parseRow(row, mapping);
        if (transaction) {
          transactions.push(transaction);
        }
      }

      this.logger.log(
        `Parsed ${transactions.length} transactions from CSV (${parseResult.data.length} rows)`,
      );

      return {
        transactions,
        bankName: bankName || this.detectBankFromHeaders(headers),
        accountNumber: null,
        currency: detectedCurrency,
      };
    } catch (error) {
      if (error instanceof ImportCsvParseException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ImportCsvParseException(message);
    }
  }

  /**
   * Detect the column mapping based on headers
   */
  private detectColumnMapping(headers: string[], bankName?: SupportedBank): ColumnMapping | null {
    // If bank is specified, try its format first
    if (bankName) {
      const bankKey = this.getBankKey(bankName);
      if (bankKey && BANK_FORMATS[bankKey]) {
        const mapping = BANK_FORMATS[bankKey];
        if (this.validateMapping(headers, mapping)) {
          this.logger.debug(`Using ${bankKey} column mapping`);
          return mapping;
        }
      }
    }

    // Try each bank format
    for (const [bank, mapping] of Object.entries(BANK_FORMATS)) {
      if (this.validateMapping(headers, mapping)) {
        this.logger.debug(`Auto-detected ${bank} column mapping`);
        return mapping;
      }
    }

    // Fallback to generic mapping
    if (this.validateMapping(headers, BANK_FORMATS.generic)) {
      return BANK_FORMATS.generic;
    }

    return null;
  }

  /**
   * Validate that required columns exist
   */
  private validateMapping(headers: string[], mapping: ColumnMapping): boolean {
    const normalizedHeaders = headers.map((h) => h.toLowerCase());

    // Check date column
    const dateColumns = Array.isArray(mapping.date) ? mapping.date : [mapping.date];
    const hasDate = dateColumns.some(
      (col) => normalizedHeaders.includes(col.toLowerCase()) || headers.includes(col),
    );

    // Check amount or debit/credit columns
    const amountColumns = Array.isArray(mapping.amount) ? mapping.amount : [mapping.amount];
    const hasAmount = amountColumns.some(
      (col) => normalizedHeaders.includes(col.toLowerCase()) || headers.includes(col),
    );
    const hasDebitCredit =
      mapping.debit &&
      mapping.credit &&
      (normalizedHeaders.includes(mapping.debit.toLowerCase()) ||
        headers.includes(mapping.debit)) &&
      (normalizedHeaders.includes(mapping.credit.toLowerCase()) ||
        headers.includes(mapping.credit));

    // Check description column
    const descColumns = Array.isArray(mapping.description)
      ? mapping.description
      : [mapping.description];
    const hasDescription = descColumns.some(
      (col) => normalizedHeaders.includes(col.toLowerCase()) || headers.includes(col),
    );

    return hasDate && (hasAmount || Boolean(hasDebitCredit)) && hasDescription;
  }

  /**
   * Get bank key from SupportedBank enum
   */
  private getBankKey(bank: SupportedBank): string | null {
    const mapping: Record<SupportedBank, string> = {
      [SupportedBank.GTBANK]: 'gtbank',
      [SupportedBank.ACCESS_BANK]: 'access',
      [SupportedBank.FIRST_BANK]: 'firstbank',
      [SupportedBank.ZENITH_BANK]: 'zenith',
      [SupportedBank.UBA]: 'generic',
      [SupportedBank.KUDA]: 'kuda',
      [SupportedBank.OPAY]: 'generic',
      [SupportedBank.MONIEPOINT]: 'generic',
      [SupportedBank.OTHER]: 'generic',
    };
    return mapping[bank] || null;
  }

  /**
   * Parse a single row into a transaction
   */
  private parseRow(
    row: Record<string, string>,
    mapping: ColumnMapping,
  ): RawParsedTransaction | null {
    try {
      // Get date
      const dateValue = this.getColumnValue(row, mapping.date);
      if (!dateValue) return null;
      const date = this.parseDate(dateValue);
      if (!date) return null;

      // Get amount
      let amount: number;
      const amountValue = this.getColumnValue(row, mapping.amount);

      if (amountValue) {
        amount = this.parseAmount(amountValue);
      } else if (mapping.debit && mapping.credit) {
        // Separate debit/credit columns
        const debitValue = row[mapping.debit] || this.getColumnValue(row, [mapping.debit]);
        const creditValue = row[mapping.credit] || this.getColumnValue(row, [mapping.credit]);

        const debit = debitValue ? this.parseAmount(debitValue) : 0;
        const credit = creditValue ? this.parseAmount(creditValue) : 0;

        if (debit > 0) {
          amount = -Math.abs(debit); // Debits are negative
        } else if (credit > 0) {
          amount = Math.abs(credit); // Credits are positive
        } else {
          return null; // No amount
        }
      } else {
        return null;
      }

      // Skip zero amounts
      if (amount === 0) return null;

      // Get description
      const description = this.getColumnValue(row, mapping.description) || '';

      return {
        date,
        amount,
        description,
        merchant: this.extractMerchant(description),
        isRecurring: this.detectRecurring(description),
        type: amount < 0 ? 'debit' : 'credit',
      };
    } catch (error) {
      this.logger.debug(`Failed to parse row: ${JSON.stringify(row)}`);
      return null;
    }
  }

  /**
   * Get column value with fallback names
   */
  private getColumnValue(
    row: Record<string, string>,
    columnNames: string | string[],
  ): string | null {
    const names = Array.isArray(columnNames) ? columnNames : [columnNames];

    for (const name of names) {
      if (row[name] !== undefined && row[name] !== '') {
        return row[name];
      }
      // Try case-insensitive match
      const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== '') {
        return row[key];
      }
    }
    return null;
  }

  /**
   * Parse date string to YYYY-MM-DD format
   */
  private parseDate(dateStr: string): string | null {
    // Common date formats in banks
    const formats = [
      // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // DD-MM-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // DD MMM YYYY (e.g., "15 Jan 2025")
      /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/,
      // MMM DD, YYYY (e.g., "Jan 15, 2025")
      /^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/,
    ];

    const months: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    };

    const cleanDate = dateStr.trim();

    // Try DD/MM/YYYY or MM/DD/YYYY (auto-detect by checking if values exceed 12)
    let match = cleanDate.match(formats[0]) || cleanDate.match(formats[1]);
    if (match) {
      const [, first, second, year] = match;
      const n1 = parseInt(first, 10);
      const n2 = parseInt(second, 10);

      let day: string, month: string;
      if (n2 > 12 && n1 <= 12) {
        // Second number can't be a month → first is month (MM/DD/YYYY)
        month = first;
        day = second;
      } else if (n1 > 12 && n2 <= 12) {
        // First number can't be a month → first is day (DD/MM/YYYY)
        day = first;
        month = second;
      } else {
        // Ambiguous — default to MM/DD/YYYY (US format) since DD/MM banks
        // typically use DD-MMM-YYYY or spelled-out months
        month = first;
        day = second;
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try YYYY-MM-DD
    match = cleanDate.match(formats[2]);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try DD MMM YYYY
    match = cleanDate.match(formats[3]);
    if (match) {
      const [, day, monthStr, year] = match;
      const month = months[monthStr.toLowerCase()];
      if (month) {
        return `${year}-${month.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    // Try MMM DD, YYYY
    match = cleanDate.match(formats[4]);
    if (match) {
      const [, monthStr, day, year] = match;
      const month = months[monthStr.toLowerCase()];
      if (month) {
        return `${year}-${month.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    // Try JavaScript Date parsing as fallback
    try {
      const date = new Date(cleanDate);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Fall through
    }

    return null;
  }

  /**
   * Parse amount string to number
   */
  private parseAmount(amountStr: string): number {
    // Remove currency symbols and commas
    let cleaned = amountStr
      .replace(/[₦NGN$€£¥]/gi, '')
      .replace(/,/g, '')
      .trim();

    // Handle parentheses for negative (accounting format)
    const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isNegative) {
      cleaned = cleaned.slice(1, -1);
    }

    // Handle DR/CR suffixes
    const isDr = /DR/i.test(cleaned);
    cleaned = cleaned.replace(/\s*(DR|CR)\s*/gi, '');

    const amount = parseFloat(cleaned);
    if (isNaN(amount)) return 0;

    return isNegative || isDr ? -Math.abs(amount) : amount;
  }

  /**
   * Extract merchant name from description
   */
  private extractMerchant(description: string): string | null {
    // Nigerian bank description patterns
    const nigerianPatterns = [
      /POS\s+(?:PURCHASE|PAYMENT|TRANSACTION)\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
      /TRANSFER\s+TO\s+(.+?)(?:\s+\d|$)/i,
      /WEB\s+(?:PURCHASE|PAYMENT)\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
      /USSD\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
    ];

    for (const pattern of nigerianPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // US/International bank description patterns
    const intlPatterns = [
      /(?:PURCHASE|PAYMENT)\s+(?:AUTHORIZED|AUTH)\s+(?:ON\s+\d{2}\/\d{2}\s+)?(.+?)(?:\s+CARD\s+\d|$)/i,
      /(?:DEBIT\s+)?CARD\s+PURCHASE\s*[-:]\s*(.+?)(?:\s+\d{5}|\s+[A-Z]{2}\s*$)/i,
      /ACH\s+(?:DEBIT|CREDIT|PAYMENT)\s+(.+?)(?:\s+\d|$)/i,
      /DIRECT\s+DEP(?:OSIT)?\s+(.+?)(?:\s+PAYROLL|\s+SALARY|\s+PAY\s|$)/i,
      /CHECK\s+CARD\s+(?:PURCHASE\s+)?(.+?)(?:\s+\d{4,}|\s+[A-Z]{2}\s*$)/i,
    ];

    for (const pattern of intlPatterns) {
      const match = description.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        return match[1].trim();
      }
    }

    // Fallback: use the description itself, stripped of common prefixes and trailing location/numbers
    const cleaned = description
      .replace(/^(?:POS|DEBIT|CREDIT|ACH|CHECK CARD|PURCHASE|PAYMENT)\s*/i, '')
      .replace(/\s+#?\d{4,}.*$/i, '')
      .replace(/\s+[A-Z]{2}\s*\d{5}.*$/i, '')
      .replace(/\s+[A-Z]{2}\s*$/i, '')
      .trim();

    return cleaned.length >= 3 ? cleaned : null;
  }

  /**
   * Detect if transaction appears to be recurring
   */
  private detectRecurring(description: string): boolean {
    const recurringPatterns = [
      /netflix/i,
      /spotify/i,
      /apple/i,
      /google/i,
      /subscription/i,
      /recurring/i,
      /monthly/i,
      /dstv/i,
      /gotv/i,
      /startimes/i,
      /icloud/i,
      /amazon prime/i,
    ];

    return recurringPatterns.some((pattern) => pattern.test(description));
  }

  /**
   * Detect currency from data
   */
  private detectCurrency(data: Record<string, string>[]): Currency {
    // Check for currency indicators in the data
    const allValues = data.flatMap((row) => Object.values(row)).join(' ');

    if (/₦|NGN|naira/i.test(allValues)) return 'NGN';
    if (/GH₵|GHS|cedi/i.test(allValues)) return 'USD';
    if (/KSh|KES|shilling/i.test(allValues)) return 'USD';
    if (/R\s*\d|ZAR|rand/i.test(allValues)) return 'USD';
    if (/E£|EGP|pound/i.test(allValues)) return 'USD';

    // Default to NGN for Nigerian banks
    return 'NGN';
  }

  /**
   * Try to detect bank from CSV headers
   */
  private detectBankFromHeaders(headers: string[]): string | null {
    const headerStr = headers.join(' ').toLowerCase();

    if (headerStr.includes('gtbank') || headerStr.includes('guaranty')) {
      return 'GTBank';
    }
    if (headerStr.includes('access')) {
      return 'Access Bank';
    }
    if (headerStr.includes('first bank') || headerStr.includes('firstbank')) {
      return 'First Bank';
    }
    if (headerStr.includes('zenith')) {
      return 'Zenith Bank';
    }

    return null;
  }
}
