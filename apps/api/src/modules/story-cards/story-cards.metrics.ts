/**
 * Story Cards Metrics
 *
 * Simple Prometheus-style metrics collection for the Story Cards system.
 * Uses a lightweight in-memory approach that can be exported via /metrics endpoint.
 *
 * Metrics tracked:
 * - story_cards_generated_total: Total cards generated (by type, success)
 * - story_cards_shares_total: Total share events (by platform)
 * - story_cards_cache_hits_total: Cache hits
 * - story_cards_cache_misses_total: Cache misses
 * - story_cards_views_total: Total card views
 *
 * Note: These metrics are in-memory and reset on service restart.
 * For production, integrate with @willsoto/nestjs-prometheus or prom-client.
 */

import { Injectable } from '@nestjs/common';
import { StoryCardType, SharePlatform } from '@prisma/client';

/**
 * Metric labels for story card generation
 */
export interface GenerationLabels {
  type: StoryCardType;
  success: boolean;
}

/**
 * Metric labels for share events
 */
export interface ShareLabels {
  platform: SharePlatform;
}

/**
 * Structure for exporting metrics in Prometheus format
 */
export interface MetricsSnapshot {
  story_cards_generated_total: Record<string, number>;
  story_cards_shares_total: Record<SharePlatform, number>;
  story_cards_cache_hits_total: number;
  story_cards_cache_misses_total: number;
  story_cards_views_total: number;
  story_cards_health_check_total: number;
  timestamp: Date;
}

@Injectable()
export class StoryCardsMetrics {
  // Counters for card generation by type and success
  private generatedCounters: Map<string, number> = new Map();

  // Counters for shares by platform
  private sharesCounters: Map<SharePlatform, number> = new Map([
    ['TWITTER', 0],
    ['LINKEDIN', 0],
    ['WHATSAPP', 0],
    ['INSTAGRAM', 0],
  ]);

  // Cache metrics
  private cacheHits = 0;
  private cacheMisses = 0;

  // View counter
  private viewsTotal = 0;

  // Health check counter
  private healthCheckTotal = 0;

  /**
   * Increment the generated cards counter
   *
   * @param labels - Type and success status
   */
  incCardsGenerated(labels: GenerationLabels): void {
    const key = `${labels.type}:${labels.success}`;
    const current = this.generatedCounters.get(key) || 0;
    this.generatedCounters.set(key, current + 1);
  }

  /**
   * Increment the shares counter
   *
   * @param labels - Platform where share occurred
   */
  incShares(labels: ShareLabels): void {
    const current = this.sharesCounters.get(labels.platform) || 0;
    this.sharesCounters.set(labels.platform, current + 1);
  }

  /**
   * Increment cache hit counter
   */
  incCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Increment cache miss counter
   */
  incCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Increment view counter
   */
  incViews(): void {
    this.viewsTotal++;
  }

  /**
   * Increment health check counter
   */
  incHealthCheck(): void {
    this.healthCheckTotal++;
  }

  /**
   * Get current metrics snapshot
   *
   * @returns Snapshot of all metrics
   */
  getSnapshot(): MetricsSnapshot {
    const generatedByLabel: Record<string, number> = {};
    this.generatedCounters.forEach((value, key) => {
      generatedByLabel[key] = value;
    });

    const sharesByPlatform: Record<SharePlatform, number> = {
      TWITTER: this.sharesCounters.get('TWITTER') || 0,
      LINKEDIN: this.sharesCounters.get('LINKEDIN') || 0,
      WHATSAPP: this.sharesCounters.get('WHATSAPP') || 0,
      INSTAGRAM: this.sharesCounters.get('INSTAGRAM') || 0,
    };

    return {
      story_cards_generated_total: generatedByLabel,
      story_cards_shares_total: sharesByPlatform,
      story_cards_cache_hits_total: this.cacheHits,
      story_cards_cache_misses_total: this.cacheMisses,
      story_cards_views_total: this.viewsTotal,
      story_cards_health_check_total: this.healthCheckTotal,
      timestamp: new Date(),
    };
  }

  /**
   * Export metrics in Prometheus text format
   *
   * @returns Prometheus-compatible metrics string
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    // Generated cards
    lines.push('# HELP story_cards_generated_total Total number of story cards generated');
    lines.push('# TYPE story_cards_generated_total counter');
    this.generatedCounters.forEach((value, key) => {
      const [type, success] = key.split(':');
      lines.push(`story_cards_generated_total{type="${type}",success="${success}"} ${value}`);
    });

    // Shares
    lines.push('# HELP story_cards_shares_total Total number of share events');
    lines.push('# TYPE story_cards_shares_total counter');
    this.sharesCounters.forEach((value, platform) => {
      lines.push(`story_cards_shares_total{platform="${platform}"} ${value}`);
    });

    // Cache hits
    lines.push('# HELP story_cards_cache_hits_total Total number of cache hits');
    lines.push('# TYPE story_cards_cache_hits_total counter');
    lines.push(`story_cards_cache_hits_total ${this.cacheHits}`);

    // Cache misses
    lines.push('# HELP story_cards_cache_misses_total Total number of cache misses');
    lines.push('# TYPE story_cards_cache_misses_total counter');
    lines.push(`story_cards_cache_misses_total ${this.cacheMisses}`);

    // Views
    lines.push('# HELP story_cards_views_total Total number of card views');
    lines.push('# TYPE story_cards_views_total counter');
    lines.push(`story_cards_views_total ${this.viewsTotal}`);

    // Health checks
    lines.push('# HELP story_cards_health_check_total Total number of health check requests');
    lines.push('# TYPE story_cards_health_check_total counter');
    lines.push(`story_cards_health_check_total ${this.healthCheckTotal}`);

    return lines.join('\n');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.generatedCounters.clear();
    this.sharesCounters = new Map([
      ['TWITTER', 0],
      ['LINKEDIN', 0],
      ['WHATSAPP', 0],
      ['INSTAGRAM', 0],
    ]);
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.viewsTotal = 0;
    this.healthCheckTotal = 0;
  }
}
