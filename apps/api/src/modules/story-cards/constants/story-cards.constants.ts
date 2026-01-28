/**
 * Story Cards Constants
 *
 * Configuration values for the Story Cards viral sharing system.
 */

import { StoryCardType, SharePlatform } from '@prisma/client';

// ==========================================
// PLATFORM DIMENSIONS
// ==========================================

/**
 * Platform dimensions for optimal card display
 * Frontend uses these to render appropriately sized cards
 */
export const PLATFORM_DIMENSIONS = {
  TWITTER: { width: 1200, height: 675 },
  LINKEDIN: { width: 1200, height: 627 },
  INSTAGRAM: { width: 1080, height: 1080 },
  WHATSAPP: { width: 800, height: 418 },
} as const;

// ==========================================
// GRADIENTS BY TYPE
// ==========================================

/**
 * Beautiful gradient colors for each card type
 * Format: [start color, end color]
 */
export const GRADIENTS_BY_TYPE: Record<StoryCardType, [string, string][]> = {
  FUTURE_SELF: [
    ['#667EEA', '#764BA2'],  // Purple gradient
    ['#6B73FF', '#000DFF'],  // Blue-purple
    ['#A855F7', '#6366F1'],  // Violet to indigo
  ],
  COMMITMENT: [
    ['#F093FB', '#F5576C'],  // Pink gradient
    ['#FF6B6B', '#FFA07A'],  // Coral gradient
    ['#FF416C', '#FF4B2B'],  // Red-pink
  ],
  MILESTONE: [
    ['#FA709A', '#FEE140'],  // Gold gradient
    ['#F2994A', '#F2C94C'],  // Orange-gold
    ['#FFD93D', '#FF9500'],  // Bright gold
  ],
  RECOVERY: [
    ['#43E97B', '#38F9D7'],  // Green gradient
    ['#11998E', '#38EF7D'],  // Teal-green
    ['#00D2FF', '#3A7BD5'],  // Blue-teal
  ],
} as const;

// ==========================================
// HASHTAGS BY TYPE
// ==========================================

/**
 * Suggested hashtags for each card type
 */
export const HASHTAGS_BY_TYPE: Record<StoryCardType, readonly string[]> = {
  FUTURE_SELF: [
    '#FutureMe',
    '#FinancialJourney',
    '#IKPA',
    '#WealthBuilding',
    '#LetterFromFuture',
  ],
  COMMITMENT: [
    '#Committed',
    '#GoalSetter',
    '#IKPA',
    '#FinancialGoals',
    '#Accountability',
  ],
  MILESTONE: [
    '#GoalCrusher',
    '#MilestoneAchieved',
    '#IKPA',
    '#FinancialWins',
    '#MoneyGoals',
  ],
  RECOVERY: [
    '#BackOnTrack',
    '#FinancialResilience',
    '#IKPA',
    '#MoneyMindset',
    '#BounceBack',
  ],
} as const;

// ==========================================
// AVAILABLE PLATFORMS BY TYPE
// ==========================================

/**
 * Platforms available for each card type
 */
export const PLATFORMS_BY_TYPE: Record<StoryCardType, SharePlatform[]> = {
  FUTURE_SELF: [
    SharePlatform.TWITTER,
    SharePlatform.LINKEDIN,
    SharePlatform.WHATSAPP,
  ],
  COMMITMENT: [
    SharePlatform.TWITTER,
    SharePlatform.LINKEDIN,
    SharePlatform.WHATSAPP,
    SharePlatform.INSTAGRAM,
  ],
  MILESTONE: [
    SharePlatform.TWITTER,
    SharePlatform.LINKEDIN,
    SharePlatform.WHATSAPP,
    SharePlatform.INSTAGRAM,
  ],
  RECOVERY: [
    SharePlatform.TWITTER,
    SharePlatform.LINKEDIN,
    SharePlatform.WHATSAPP,
  ],
} as const;

// ==========================================
// RATE LIMITS
// ==========================================

/**
 * Rate limits for story cards operations
 */
export const STORY_CARD_RATE_LIMITS = {
  GENERATE: { ttl: 60000, limit: 5 },       // 5 per minute
  SHARE_TRACK: { ttl: 60000, limit: 30 },   // 30 per minute
  PUBLIC_VIEW: { ttl: 60000, limit: 100 },  // 100 per minute
  PREVIEW: { ttl: 60000, limit: 10 },       // 10 per minute (stricter - read-only)
  BULK_DELETE: { ttl: 60000, limit: 5 },    // 5 per minute
  BULK_GENERATE: { ttl: 60000, limit: 2 },  // 2 per minute (batch operation)
} as const;

// ==========================================
// GENERATION LIMITS
// ==========================================

/**
 * Limits for card generation
 */
export const STORY_CARD_LIMITS = {
  MAX_CARDS_PER_USER: 100,
  MAX_CARDS_PER_DAY: 10,
  MAX_QUOTE_LENGTH: 500,
  REFERRAL_CODE_LENGTH: 8,
  SHARE_URL_CODE_LENGTH: 12,
} as const;

// ==========================================
// PRIVACY DEFAULTS
// ==========================================

/**
 * Default privacy settings for card generation
 */
export const DEFAULT_PRIVACY_SETTINGS = {
  anonymizeAmounts: true,
  revealActualNumbers: false,
  includePersonalData: false,
  requirePreview: true,
} as const;

// ==========================================
// CACHE SETTINGS
// ==========================================

/**
 * Redis cache TTLs
 */
export const STORY_CARD_CACHE = {
  CARD_TTL_SEC: 3600,        // 1 hour
  PUBLIC_CARD_TTL_SEC: 300,  // 5 minutes
  METRICS_TTL_SEC: 600,      // 10 minutes
  /** Lock TTL in milliseconds for cache stampede prevention */
  LOCK_TTL_MS: 5000,         // 5 seconds
  /** Wait time in milliseconds when lock is held by another request */
  LOCK_WAIT_MS: 100,         // 100ms
  /** Maximum retries when waiting for lock */
  LOCK_MAX_RETRIES: 3,
} as const;

// ==========================================
// CACHE KEYS
// ==========================================

/**
 * Cache key generators
 */
export const STORY_CARD_CACHE_KEYS = {
  CARD: (cardId: string) => `story_card:${cardId}`,
  USER_CARDS: (userId: string) => `story_cards:user:${userId}`,
  PUBLIC_CARD: (shareCode: string) => `story_card:public:${shareCode}`,
  VIRAL_METRICS: (userId: string) => `story_cards:metrics:${userId}`,
  /** Lock keys for cache stampede prevention */
  CARD_LOCK: (cardId: string) => `story_card:lock:${cardId}`,
  PUBLIC_CARD_LOCK: (shareCode: string) => `story_card:lock:public:${shareCode}`,
  VIRAL_METRICS_LOCK: (userId: string) => `story_cards:lock:metrics:${userId}`,
} as const;

// ==========================================
// TRACE NAMES
// ==========================================

/**
 * Opik trace names for distributed tracing
 */
export const STORY_CARD_TRACE_NAMES = {
  GENERATE: 'story_card_generate',
  GET: 'story_card_get',
  GET_USER_CARDS: 'story_card_get_user_cards',
  TRACK_SHARE: 'story_card_track_share',
  PUBLIC_VIEW: 'story_card_public_view',
  GET_METRICS: 'story_card_get_metrics',
  DELETE: 'story_card_delete',
  UPDATE: 'story_card_update',
  PREVIEW: 'story_card_preview',
  BULK_DELETE: 'story_card_bulk_delete',
  BULK_GENERATE: 'story_card_bulk_generate',
} as const;

// ==========================================
// VIEW TRACKING
// ==========================================

/**
 * View tracking settings for abuse detection
 *
 * Prevents view count inflation by tracking IP+cardId combinations
 * in Redis with a TTL. Same IP viewing the same card within the TTL
 * window will not increment the view count.
 */
export const VIEW_TRACKING = {
  /** TTL for IP tracking in seconds (1 hour) */
  IP_TTL_SEC: 3600,
  /** Redis key prefix for view tracking */
  IP_KEY_PREFIX: 'story_card:view:',
} as const;

// ==========================================
// BASE URL
// ==========================================

/**
 * Base URL for share links (should be configured via environment)
 */
export const SHARE_BASE_URL = process.env.SHARE_BASE_URL || 'https://ikpa.app/share';
