/**
 * Session Management DTOs
 *
 * DTOs for session and device management endpoints.
 * Allows users to view and manage active sessions.
 *
 * @module SessionDto
 */

import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Session Info Response DTO
 *
 * Represents a single active session/device.
 */
export class SessionInfoDto {
  @ApiProperty({
    description: 'Session ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Device name (parsed from user agent)',
    example: 'iPhone 14 Pro',
    nullable: true,
  })
  deviceName!: string | null;

  @ApiProperty({
    description: 'Device type',
    example: 'mobile',
    nullable: true,
  })
  deviceType!: string | null;

  @ApiProperty({
    description: 'Browser name',
    example: 'Safari',
    nullable: true,
  })
  browser!: string | null;

  @ApiProperty({
    description: 'Operating system',
    example: 'iOS 17.2',
    nullable: true,
  })
  os!: string | null;

  @ApiProperty({
    description: 'IP address of the session',
    example: '102.89.23.45',
  })
  ipAddress!: string;

  @ApiProperty({
    description: 'Approximate location based on IP',
    example: 'Lagos, Nigeria',
    nullable: true,
  })
  location!: string | null;

  @ApiProperty({
    description: 'When the session was last active',
    example: '2024-01-15T10:30:00Z',
  })
  lastActiveAt!: Date;

  @ApiProperty({
    description: 'When the session was created',
    example: '2024-01-10T08:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Whether this is the current session',
    example: true,
  })
  isCurrent!: boolean;
}

/**
 * Sessions List Response DTO
 *
 * List of all active sessions for a user.
 */
export class SessionsListResponseDto {
  @ApiProperty({
    description: 'List of active sessions',
    type: [SessionInfoDto],
  })
  sessions!: SessionInfoDto[];

  @ApiProperty({
    description: 'Total number of active sessions',
    example: 3,
  })
  totalSessions!: number;
}

/**
 * Revoke Session DTO
 *
 * Validates request to revoke a specific session.
 */
export class RevokeSessionDto {
  @ApiProperty({
    description: 'Session ID to revoke',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsUUID('4', { message: 'Invalid session ID format' })
  sessionId!: string;
}

/**
 * Session Revoked Response DTO
 *
 * Response after successfully revoking a session.
 */
export class SessionRevokedResponseDto {
  @ApiProperty({
    description: 'Whether the session was successfully revoked',
    example: true,
  })
  revoked!: boolean;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'Session revoked successfully',
  })
  message!: string;
}

/**
 * All Sessions Revoked Response DTO
 *
 * Response after revoking all sessions except current.
 */
export class AllSessionsRevokedResponseDto {
  @ApiProperty({
    description: 'Number of sessions that were revoked',
    example: 4,
  })
  revokedCount!: number;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'All other sessions have been revoked',
  })
  message!: string;
}
