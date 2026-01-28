/**
 * Story Cards Event Listener
 *
 * Listens for Story Cards lifecycle events and handles them appropriately.
 * This enables decoupled processing of card milestones, analytics tracking,
 * and future integrations (e.g., badges, achievements, notifications).
 *
 * Events handled:
 * - story_card.created: Log card creation for analytics
 * - story_card.shared: Log share events for viral tracking
 * - story_card.deleted: Clean up related resources
 * - story_card.view_milestone: Trigger milestone celebrations/notifications
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  STORY_CARD_EVENTS,
  StoryCardCreatedEvent,
  StoryCardSharedEvent,
  StoryCardDeletedEvent,
  StoryCardViewMilestoneEvent,
} from './story-cards.events';

@Injectable()
export class StoryCardsEventListener {
  private readonly logger = new Logger(StoryCardsEventListener.name);

  /**
   * Handle card creation event
   *
   * Future uses:
   * - Track analytics
   * - Award "First Card" badge
   * - Send push notification confirming card creation
   */
  @OnEvent(STORY_CARD_EVENTS.CREATED)
  handleCardCreated(event: StoryCardCreatedEvent): void {
    this.logger.debug(
      `[handleCardCreated] Card created: ${event.cardId} (type: ${event.type}, user: ${event.userId})`,
    );
    // Future: Analytics tracking, badge awards, etc.
  }

  /**
   * Handle card shared event
   *
   * Future uses:
   * - Track viral analytics in detail
   * - Award "Social Butterfly" badge after N shares
   * - Trigger gamification rewards
   */
  @OnEvent(STORY_CARD_EVENTS.SHARED)
  handleCardShared(event: StoryCardSharedEvent): void {
    this.logger.debug(
      `[handleCardShared] Card ${event.cardId} shared on ${event.platform} (user: ${event.userId})`,
    );
    // Future: Deep analytics, gamification, badge awards
  }

  /**
   * Handle card deleted event
   *
   * Future uses:
   * - Clean up cached data
   * - Update user statistics
   * - Remove from public indexes
   */
  @OnEvent(STORY_CARD_EVENTS.DELETED)
  handleCardDeleted(event: StoryCardDeletedEvent): void {
    this.logger.debug(
      `[handleCardDeleted] Card ${event.cardId} deleted (hard: ${event.hardDelete}, user: ${event.userId})`,
    );
    // Future: Cache cleanup, statistics update
  }

  /**
   * Handle view milestone event
   *
   * Triggered when a card crosses a significant view threshold.
   * Milestones: 100, 500, 1000, 5000, 10000 views
   *
   * Future uses:
   * - Send congratulatory push notification
   * - Award "Viral" badge at 1000+ views
   * - Display milestone celebration in app
   */
  @OnEvent(STORY_CARD_EVENTS.VIEW_MILESTONE)
  handleViewMilestone(event: StoryCardViewMilestoneEvent): void {
    this.logger.log(
      `[handleViewMilestone] Card ${event.cardId} reached ${event.milestone} views milestone! ` +
        `(current: ${event.viewCount}, user: ${event.userId})`,
    );
    // Future: Send notification to user, badge award, celebration UI trigger
  }
}
