import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Thrown when a family support record is not found
 */
export class FamilySupportNotFoundException extends ApiException {
  constructor(supportId?: string) {
    super(
      ErrorCodes.UBUNTU_FAMILY_SUPPORT_NOT_FOUND,
      supportId
        ? `Family support record with id '${supportId}' not found`
        : 'Family support record not found',
      HttpStatus.NOT_FOUND,
      supportId ? { supportId } : undefined,
    );
  }
}

/**
 * Thrown when a family emergency is not found
 */
export class EmergencyNotFoundException extends ApiException {
  constructor(emergencyId?: string) {
    super(
      ErrorCodes.UBUNTU_EMERGENCY_NOT_FOUND,
      emergencyId
        ? `Family emergency with id '${emergencyId}' not found`
        : 'Family emergency not found',
      HttpStatus.NOT_FOUND,
      emergencyId ? { emergencyId } : undefined,
    );
  }
}

/**
 * Thrown when an invalid adjustment type is provided
 */
export class InvalidAdjustmentException extends ApiException {
  constructor(adjustmentType: string, validTypes: string[]) {
    super(
      ErrorCodes.UBUNTU_INVALID_ADJUSTMENT,
      `Invalid adjustment type '${adjustmentType}'. Valid types are: ${validTypes.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      { adjustmentType, validTypes },
    );
  }
}

/**
 * Thrown when emergency fund is insufficient for the requested tap
 */
export class InsufficientEmergencyFundException extends ApiException {
  constructor(available: number, required: number, currency: string) {
    super(
      ErrorCodes.UBUNTU_INSUFFICIENT_EMERGENCY_FUND,
      `Insufficient emergency fund. Available: ${currency} ${available.toLocaleString()}, ` +
        `Required: ${currency} ${required.toLocaleString()}. ` +
        `Consider using a different adjustment option.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { available, required, currency },
    );
  }
}

/**
 * Thrown when trying to adjust an emergency that doesn't have PENDING status
 */
export class NoActiveEmergencyException extends ApiException {
  constructor(emergencyId: string, currentStatus: string) {
    super(
      ErrorCodes.UBUNTU_NO_ACTIVE_EMERGENCY,
      `Cannot adjust emergency '${emergencyId}'. Current status: ${currentStatus}. ` +
        `Only emergencies with PENDING status can be adjusted.`,
      HttpStatus.BAD_REQUEST,
      { emergencyId, currentStatus },
    );
  }
}

/**
 * Thrown when trying to modify an already resolved emergency
 */
export class EmergencyAlreadyResolvedException extends ApiException {
  constructor(emergencyId: string) {
    super(
      ErrorCodes.UBUNTU_EMERGENCY_ALREADY_RESOLVED,
      `Emergency '${emergencyId}' has already been resolved. ` +
        `No further adjustments can be made.`,
      HttpStatus.CONFLICT,
      { emergencyId },
    );
  }
}

/**
 * Thrown when user already has a pending emergency
 */
export class PendingEmergencyExistsException extends ApiException {
  constructor(existingEmergencyId: string) {
    super(
      ErrorCodes.UBUNTU_PENDING_EMERGENCY_EXISTS,
      'You already have a pending emergency. Please resolve it first before reporting a new one.',
      HttpStatus.CONFLICT,
      { existingEmergencyId },
    );
  }
}
