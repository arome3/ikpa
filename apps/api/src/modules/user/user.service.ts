import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * User Service
 *
 * Provides core user lookup operations used by authentication
 * and other modules throughout the application.
 */
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by their unique ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by their email address
   * Email is normalized to lowercase for consistent lookups
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find a user by their Google OAuth ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  /**
   * Find a user by their Apple OAuth ID
   */
  async findByAppleId(appleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { appleId },
    });
  }

  /**
   * Get all active users (onboarding completed)
   * Used by cron jobs for batch processing financial calculations
   */
  async getAllActiveUsers(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { onboardingCompleted: true },
    });
  }
}
