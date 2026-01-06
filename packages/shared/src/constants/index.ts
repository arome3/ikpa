import { Currency, Country } from '../types/user';

/**
 * API version
 */
export const API_VERSION = 'v1';

/**
 * Currency symbols for display
 */
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.NGN]: '₦',
  [Currency.GHS]: 'GH₵',
  [Currency.KES]: 'KSh',
  [Currency.ZAR]: 'R',
  [Currency.RWF]: 'RF',
  [Currency.UGX]: 'USh',
  [Currency.TZS]: 'TSh',
  [Currency.EGP]: 'E£',
  [Currency.USD]: '$',
  [Currency.GBP]: '£',
  [Currency.EUR]: '€',
};

/**
 * Currency names
 */
export const CURRENCY_NAMES: Record<Currency, string> = {
  [Currency.NGN]: 'Nigerian Naira',
  [Currency.GHS]: 'Ghanaian Cedi',
  [Currency.KES]: 'Kenyan Shilling',
  [Currency.ZAR]: 'South African Rand',
  [Currency.RWF]: 'Rwandan Franc',
  [Currency.UGX]: 'Ugandan Shilling',
  [Currency.TZS]: 'Tanzanian Shilling',
  [Currency.EGP]: 'Egyptian Pound',
  [Currency.USD]: 'US Dollar',
  [Currency.GBP]: 'British Pound',
  [Currency.EUR]: 'Euro',
};

/**
 * Default currency for each country
 */
export const COUNTRY_DEFAULT_CURRENCY: Record<Country, Currency> = {
  [Country.NIGERIA]: Currency.NGN,
  [Country.GHANA]: Currency.GHS,
  [Country.KENYA]: Currency.KES,
  [Country.SOUTH_AFRICA]: Currency.ZAR,
  [Country.RWANDA]: Currency.RWF,
  [Country.UGANDA]: Currency.UGX,
  [Country.TANZANIA]: Currency.TZS,
  [Country.EGYPT]: Currency.EGP,
  [Country.OTHER]: Currency.USD,
};

/**
 * Default timezone for each country
 */
export const COUNTRY_DEFAULT_TIMEZONE: Record<Country, string> = {
  [Country.NIGERIA]: 'Africa/Lagos',
  [Country.GHANA]: 'Africa/Accra',
  [Country.KENYA]: 'Africa/Nairobi',
  [Country.SOUTH_AFRICA]: 'Africa/Johannesburg',
  [Country.RWANDA]: 'Africa/Kigali',
  [Country.UGANDA]: 'Africa/Kampala',
  [Country.TANZANIA]: 'Africa/Dar_es_Salaam',
  [Country.EGYPT]: 'Africa/Cairo',
  [Country.OTHER]: 'UTC',
};

/**
 * Country display names
 */
export const COUNTRY_NAMES: Record<Country, string> = {
  [Country.NIGERIA]: 'Nigeria',
  [Country.GHANA]: 'Ghana',
  [Country.KENYA]: 'Kenya',
  [Country.SOUTH_AFRICA]: 'South Africa',
  [Country.RWANDA]: 'Rwanda',
  [Country.UGANDA]: 'Uganda',
  [Country.TANZANIA]: 'Tanzania',
  [Country.EGYPT]: 'Egypt',
  [Country.OTHER]: 'Other',
};

/**
 * Default pagination settings
 */
export const DEFAULT_PAGINATION = {
  limit: 20,
  maxLimit: 100,
} as const;

/**
 * Financial health score thresholds
 */
export const FINANCIAL_HEALTH_THRESHOLDS = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 20,
} as const;

/**
 * Recommended runway (emergency fund) in months
 */
export const RECOMMENDED_RUNWAY_MONTHS = 3;

/**
 * Recommended savings rate percentage
 */
export const RECOMMENDED_SAVINGS_RATE = 20;
