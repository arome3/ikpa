/**
 * Story Cards Events
 *
 * Event definitions for the Story Cards module lifecycle.
 * Used for decoupled communication with other modules (e.g., notifications, analytics).
 *
 * Events:
 * - CREATED: When a new story card is generated
 * - SHARED: When a card is shared on a platform
 * - DELETED: When a card is soft/hard deleted
 * - VIEW_MILESTONE: When a card reaches a view milestone (100, 500, 1000, etc.)
 */

/**
 * Story Card event names
 */
export const STORY_CARD_EVENTS = {
  CREATED: 'story_card.created',
  SHARED: 'story_card.shared',
  DELETED: 'story_card.deleted',
  VIEW_MILESTONE: 'story_card.view_milestone',
} as const;

/**
 * View milestones to track
 */
export const VIEW_MILESTONES = [100, 500, 1000, 5000, 10000] as const;

/**
 * Event payload when a story card is created
 */
export interface StoryCardCreatedEvent {
  cardId: string;
  userId: string;
  type: string;
  referralCode: string;
}

/**
 * Event payload when a story card is shared
 */
export interface StoryCardSharedEvent {
  cardId: string;
  userId: string;
  platform: string;
  referralCode: string;
}

/**
 * Event payload when a story card is deleted
 */
export interface StoryCardDeletedEvent {
  cardId: string;
  userId: string;
  hardDelete: boolean;
}

/**
 * Event payload when a story card reaches a view milestone
 */
export interface StoryCardViewMilestoneEvent {
  cardId: string;
  userId: string;
  milestone: number; // 100, 500, 1000, etc.
  viewCount: number;
}
