/**
 * Supported countries in IKPA
 */
export enum Country {
  NIGERIA = 'NIGERIA',
  GHANA = 'GHANA',
  KENYA = 'KENYA',
  SOUTH_AFRICA = 'SOUTH_AFRICA',
  RWANDA = 'RWANDA',
  UGANDA = 'UGANDA',
  TANZANIA = 'TANZANIA',
  EGYPT = 'EGYPT',
  OTHER = 'OTHER',
}

/**
 * Supported currencies
 */
export enum Currency {
  NGN = 'NGN', // Nigerian Naira
  GHS = 'GHS', // Ghanaian Cedi
  KES = 'KES', // Kenyan Shilling
  ZAR = 'ZAR', // South African Rand
  RWF = 'RWF', // Rwandan Franc
  UGX = 'UGX', // Ugandan Shilling
  TZS = 'TZS', // Tanzanian Shilling
  EGP = 'EGP', // Egyptian Pound
  USD = 'USD', // US Dollar
  GBP = 'GBP', // British Pound
  EUR = 'EUR', // Euro
}

/**
 * Employment types
 */
export enum EmploymentType {
  EMPLOYED_FULL_TIME = 'EMPLOYED_FULL_TIME',
  EMPLOYED_PART_TIME = 'EMPLOYED_PART_TIME',
  SELF_EMPLOYED = 'SELF_EMPLOYED',
  FREELANCER = 'FREELANCER',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  STUDENT = 'STUDENT',
  UNEMPLOYED = 'UNEMPLOYED',
  RETIRED = 'RETIRED',
}

/**
 * User profile interface
 */
export interface User {
  id: string;
  email: string;
  name: string;
  country: Country;
  currency: Currency;
  timezone: string;
  employmentType?: EmploymentType;
  dateOfBirth?: string;
  onboardingCompleted: boolean;
  notificationsEnabled: boolean;
  weeklyReportEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/**
 * User settings that can be updated
 */
export interface UserSettings {
  notificationsEnabled?: boolean;
  weeklyReportEnabled?: boolean;
}

/**
 * User profile updates
 */
export interface UpdateUserDto {
  name?: string;
  country?: Country;
  currency?: Currency;
  timezone?: string;
  dateOfBirth?: string;
  employmentType?: EmploymentType;
}
