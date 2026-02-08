import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  streakDays: number;
  longestStreak: number;
  isCurrentUser: boolean;
}

const CACHE_KEY = 'leaderboard:top20';
const CACHE_TTL_SEC = 300; // 5 minutes

@Injectable()
export class LeaderboardService {
  // @ts-expect-error Logger used in future expansion
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get top users by longest streak (only users who opted in)
   */
  async getLeaderboard(
    userId: string,
    limit = 20,
  ): Promise<{ entries: LeaderboardEntry[]; userRank: number | null }> {
    // Try cache first
    try {
      const cached = await this.redis.get<LeaderboardEntry[]>(CACHE_KEY);
      if (cached) {
        return this.annotateForUser(cached, userId, limit);
      }
    } catch {}

    // Query DB for opted-in users with active commitments
    const topUsers = await this.prisma.futureSelfCommitment.findMany({
      where: {
        status: 'ACTIVE',
        user: { leaderboardOptIn: true },
      },
      select: {
        userId: true,
        streakDays: true,
        longestStreak: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { longestStreak: 'desc' },
      take: 50, // Fetch more for rank calculation
    });

    // Deduplicate by user (take their best commitment)
    const byUser = new Map<string, typeof topUsers[0]>();
    for (const entry of topUsers) {
      const existing = byUser.get(entry.userId);
      if (!existing || entry.longestStreak > existing.longestStreak) {
        byUser.set(entry.userId, entry);
      }
    }

    const entries: LeaderboardEntry[] = Array.from(byUser.values())
      .sort((a, b) => b.longestStreak - a.longestStreak)
      .map((entry, index) => ({
        rank: index + 1,
        displayName: this.anonymizeName(entry.user.name),
        streakDays: entry.streakDays,
        longestStreak: entry.longestStreak,
        isCurrentUser: entry.userId === userId,
      }));

    // Cache the raw entries (without user annotation)
    try {
      const cacheEntries = entries.map((e) => ({ ...e, isCurrentUser: false }));
      await this.redis.set(CACHE_KEY, JSON.stringify(cacheEntries), CACHE_TTL_SEC);
    } catch {}

    return this.annotateForUser(entries, userId, limit);
  }

  private annotateForUser(
    entries: LeaderboardEntry[],
    _userId: string,
    limit: number,
  ): { entries: LeaderboardEntry[]; userRank: number | null } {
    // Cached entries have isCurrentUser: false; fresh entries have it set correctly.
    // For cached entries, user rank is fetched separately via getUserRank().
    const limited = entries.slice(0, limit);
    const userEntry = entries.find((e) => e.isCurrentUser);
    return {
      entries: limited,
      userRank: userEntry?.rank ?? null,
    };
  }

  /**
   * Get current user's rank among opted-in users
   */
  async getUserRank(userId: string): Promise<{
    rank: number | null;
    streakDays: number;
    longestStreak: number;
    optedIn: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { leaderboardOptIn: true },
    });

    if (!user?.leaderboardOptIn) {
      return { rank: null, streakDays: 0, longestStreak: 0, optedIn: false };
    }

    const commitment = await this.prisma.futureSelfCommitment.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { longestStreak: 'desc' },
    });

    if (!commitment) {
      return { rank: null, streakDays: 0, longestStreak: 0, optedIn: true };
    }

    // Count users with higher longest streak
    const higherCount = await this.prisma.futureSelfCommitment.groupBy({
      by: ['userId'],
      where: {
        status: 'ACTIVE',
        user: { leaderboardOptIn: true },
        longestStreak: { gt: commitment.longestStreak },
      },
    });

    return {
      rank: higherCount.length + 1,
      streakDays: commitment.streakDays,
      longestStreak: commitment.longestStreak,
      optedIn: true,
    };
  }

  /**
   * Opt user in/out of leaderboard
   */
  async optIn(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { leaderboardOptIn: true },
    });
    this.invalidateCache();
  }

  async optOut(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { leaderboardOptIn: false },
    });
    this.invalidateCache();
  }

  private invalidateCache(): void {
    this.redis.del(CACHE_KEY).catch(() => {});
  }

  /**
   * Show first name + last initial for privacy
   * e.g., "Adaeze O." or "James M."
   */
  private anonymizeName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  }
}
