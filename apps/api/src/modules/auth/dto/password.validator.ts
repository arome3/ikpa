/**
 * Password Complexity Validator
 *
 * Custom class-validator decorator that enforces password complexity
 * requirements from AuthConfig. Includes common password detection
 * to prevent easily guessable passwords.
 *
 * @module PasswordValidator
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { AuthConfig } from '../auth.config';

/**
 * Top 100 most common passwords to block
 *
 * Sourced from various password breach analyses.
 * These are frequently used in credential stuffing attacks.
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'abc123',
  'monkey',
  'letmein',
  'dragon',
  'master',
  'sunshine',
  'princess',
  'football',
  'welcome',
  'shadow',
  'superman',
  'michael',
  'ninja',
  'mustang',
  'password1!',
  'iloveyou',
  'trustno1',
  'baseball',
  'access',
  'hello',
  'charlie',
  'donald',
  'passw0rd',
  'admin',
  'admin123',
  'root',
  'toor',
  'test',
  'test123',
  'guest',
  'login',
  '111111',
  '000000',
  '654321',
  '666666',
  '121212',
  '123123',
  '696969',
  'qazwsx',
  'qwertyuiop',
  'asdfgh',
  'asdfghjkl',
  'zxcvbn',
  'zxcvbnm',
  'jesus',
  'hockey',
  'killer',
  'george',
  'money',
  'freedom',
  'whatever',
  'ginger',
  'joshua',
  'pepper',
  'summer',
  'starwars',
  'harley',
  'batman',
  'andrew',
  'thunder',
  'tigger',
  'jennifer',
  'hunter',
  'buster',
  'soccer',
  'jordan',
  'maggie',
  'ashley',
  'nicole',
  'chelsea',
  'matthew',
  'cheese',
  'martin',
  'banana',
  'chicago',
  'biteme',
  'coffee',
  'orange',
  'lakers',
  'guitar',
  'angel',
  'secret',
  'computer',
  'internet',
  'samsung',
  'apple',
  'google',
  'africa',
  'nigeria',
  'naija',
]);

/**
 * Result of password complexity validation
 */
interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password complexity against configuration
 *
 * @param password - Password to validate
 * @returns Validation result with any errors
 */
export function validatePasswordComplexity(
  password: string,
): PasswordValidationResult {
  const { password: config } = AuthConfig;
  const errors: string[] = [];

  // Check length
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters`);
  }

  if (password.length > config.maxLength) {
    errors.push(`Password must not exceed ${config.maxLength} characters`);
  }

  // Check character requirements
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common passwords
  if (config.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      errors.push('This password is too common. Please choose a stronger one');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Password complexity validator constraint
 *
 * Implements ValidatorConstraintInterface for class-validator integration.
 */
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint
  implements ValidatorConstraintInterface
{
  private lastErrors: string[] = [];

  validate(password: string, _args: ValidationArguments): boolean {
    if (typeof password !== 'string') {
      this.lastErrors = ['Password must be a string'];
      return false;
    }

    const result = validatePasswordComplexity(password);
    this.lastErrors = result.errors;
    return result.isValid;
  }

  defaultMessage(_args: ValidationArguments): string {
    // Return the first error for simplicity, or a combined message
    return this.lastErrors.length > 0
      ? this.lastErrors[0]
      : 'Password does not meet complexity requirements';
  }
}

/**
 * Strong password validation decorator
 *
 * Use this decorator on password fields to enforce complexity requirements
 * defined in AuthConfig.
 *
 * @example
 * ```typescript
 * class RegisterDto {
 *   @IsStrongPassword()
 *   password: string;
 * }
 * ```
 */
export function IsStrongPassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}

/**
 * Get human-readable password requirements
 *
 * Useful for displaying requirements to users in the UI.
 *
 * @returns Array of requirement descriptions
 */
export function getPasswordRequirements(): string[] {
  const { password: config } = AuthConfig;
  const requirements: string[] = [];

  requirements.push(`At least ${config.minLength} characters`);

  if (config.requireUppercase) {
    requirements.push('At least one uppercase letter (A-Z)');
  }

  if (config.requireLowercase) {
    requirements.push('At least one lowercase letter (a-z)');
  }

  if (config.requireNumber) {
    requirements.push('At least one number (0-9)');
  }

  if (config.requireSpecial) {
    requirements.push('At least one special character (!@#$%^&*...)');
  }

  if (config.preventCommonPasswords) {
    requirements.push('Cannot be a commonly used password');
  }

  return requirements;
}
