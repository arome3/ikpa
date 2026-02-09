/**
 * Subscription Patterns Constants
 *
 * Defines regex patterns for detecting subscription services
 * from merchant names in expense records. Includes both
 * international and regional services.
 */

import { SubscriptionCategory, Currency } from '@prisma/client';
import {
  SubscriptionPattern,
  CurrencyFormat,
  ContextComparison,
} from '../interfaces';

/**
 * Subscription detection patterns
 *
 * These regex patterns match merchant names from expense records
 * to identify subscription services. Patterns are case-insensitive
 * and designed to match common variations in merchant names.
 */
/**
 * Subscription detection patterns
 *
 * IMPORTANT: Pattern order matters! More specific patterns should come before
 * generic ones. For example, "adobe" should match SOFTWARE before "cloud"
 * matches CLOUD_STORAGE (for "Adobe Creative Cloud").
 */
export const SUBSCRIPTION_PATTERNS: SubscriptionPattern[] = [
  // Software & Productivity (MUST come before Cloud Storage due to "Creative Cloud")
  {
    pattern:
      /adobe|microsoft\s*365|office\s*365|canva|figma|notion|slack|zoom|atlassian|jetbrains|github|gitlab|vercel|netlify|aws|azure|gcp/i,
    category: SubscriptionCategory.SOFTWARE,
    displayName: 'Software',
  },
  // Streaming Services
  {
    pattern:
      /netflix|spotify|amazon\s*prime|youtube\s*premium|apple\s*music|disney\+?|hulu|hbo\s*max|paramount\+?|peacock|tidal|deezer|audiomack/i,
    category: SubscriptionCategory.STREAMING,
    displayName: 'Streaming',
  },
  // TV/Cable (Regional)
  {
    pattern:
      /dstv|gotv|showmax|multichoice|startimes|canal\+?|kwese|azam\s*tv/i,
    category: SubscriptionCategory.TV_CABLE,
    displayName: 'TV/Cable',
  },
  // Fitness & Wellness
  {
    pattern:
      /gym|fitness|wellness|planet\s*fitness|equinox|orangetheory|peloton|classpass|crossfit|yoga|pilates/i,
    category: SubscriptionCategory.FITNESS,
    displayName: 'Fitness',
  },
  // VPN Services (before Cloud Storage - some VPNs mention "cloud")
  {
    pattern:
      /vpn|nordvpn|expressvpn|surfshark|protonvpn|tunnelbear|cyberghost|private\s*internet|mullvad/i,
    category: SubscriptionCategory.VPN,
    displayName: 'VPN',
  },
  // Learning Platforms
  {
    pattern:
      /coursera|udemy|skillshare|linkedin\s*learning|masterclass|duolingo|brilliant|codecademy|pluralsight|udacity|edx|khan\s*academy/i,
    category: SubscriptionCategory.LEARNING,
    displayName: 'Learning',
  },
  // Telecom & Mobile (phone, internet, mobile carriers)
  {
    pattern:
      /at&?t|t-?mobile|verizon|sprint|comcast|xfinity|spectrum|cox|centurylink|frontier|mint\s*mobile|visible|cricket|metro\s*pcs|boost\s*mobile|google\s*fi|us\s*cellular|mtn|glo\s*mobile|airtel|9mobile|safaricom|vodacom/i,
    category: SubscriptionCategory.TELECOM,
    displayName: 'Telecom',
  },
  // Utilities (energy, water, gas)
  {
    pattern:
      /energy|electric|power|utility|utilities|gas\s*company|water\s*bill|sewage|austin\s*energy|pg&?e|duke\s*energy|con\s*edison|national\s*grid|ecotricity|bulb\s*energy|octopus\s*energy|ikeja\s*electric|eko\s*electric|enugu\s*electric/i,
    category: SubscriptionCategory.UTILITIES,
    displayName: 'Utilities',
  },
  // Insurance (health, car, life, renters)
  {
    pattern:
      /insurance|geico|allstate|progressive|state\s*farm|liberty\s*mutual|usaa|lemonade|metlife|prudential|aetna|cigna|humana|united\s*health|kaiser|leadway|axa\s*mansard|custodian|aiico/i,
    category: SubscriptionCategory.INSURANCE,
    displayName: 'Insurance',
  },
  // Gaming (game subscriptions, platforms)
  {
    pattern:
      /xbox\s*game\s*pass|playstation\s*plus|ps\s*plus|nintendo\s*online|ea\s*play|ubisoft\+?|epic\s*games|steam|twitch|game\s*pass|humble\s*bundle|geforce\s*now|stadia/i,
    category: SubscriptionCategory.GAMING,
    displayName: 'Gaming',
  },
  // Cloud Storage (last - generic terms like "cloud", "storage", "backup")
  {
    pattern:
      /dropbox|icloud|google\s*one|onedrive|box\.com|pcloud|mega\.nz|cloud\s*storage|backup\s*service/i,
    category: SubscriptionCategory.CLOUD_STORAGE,
    displayName: 'Cloud Storage',
  },
];

/**
 * Zombie detection threshold in days
 *
 * Subscriptions with no usage in this period are considered "zombies" -
 * services the user is paying for but not actively using.
 */
export const ZOMBIE_THRESHOLD_DAYS = 90;

/**
 * Minimum number of charges to confirm a subscription
 *
 * We require at least 2 charges from the same merchant to identify
 * it as a recurring subscription (not a one-time purchase).
 */
export const MIN_CHARGES_FOR_SUBSCRIPTION = 2;

/**
 * Minimum confidence threshold for pattern matching
 *
 * Matches below this threshold are rejected to prevent false positives.
 * For example, "Zoom Pizza Restaurant" would have low confidence for
 * the VPN pattern (only "zoom" matches, not the full merchant name).
 *
 * Threshold values:
 * - 1.0: Match covers >80% of merchant name (exact or near-exact)
 * - 0.9: Match covers >50% of merchant name (strong match)
 * - 0.8: Match covers >30% of merchant name (moderate match)
 * - 0.7: Partial match (weak, often false positive)
 *
 * Setting to 0.75 filters out most false positives while keeping
 * legitimate matches like "netflix.com" or "spotify subscription".
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Maximum age of expenses to consider for subscription detection (months)
 */
export const MAX_EXPENSE_AGE_MONTHS = 12;

/**
 * Currency format configurations for supported currencies
 */
export const CURRENCY_FORMATS: Record<Currency, CurrencyFormat> = {
  [Currency.USD]: { symbol: '$', locale: 'en-US', symbolPosition: 'before' },
  [Currency.NGN]: { symbol: '₦', locale: 'en-NG', symbolPosition: 'before' },
};

/**
 * Context comparisons by currency
 *
 * These provide relatable comparisons for different cost ranges,
 * helping users understand the true impact of their subscriptions.
 * Templates use {amount} placeholder for the formatted annual cost.
 */
export const CONTEXT_COMPARISONS: Record<Currency, ContextComparison[]> = {
  [Currency.USD]: [
    { threshold: 5000, template: "That's equivalent to a month's rent in many US cities" },
    { threshold: 2000, template: "That's a weekend getaway" },
    { threshold: 1000, template: "That's 2 months of groceries" },
    { threshold: 200, template: "That's several nice dinners out" },
    { threshold: 0, template: "That's money that could be growing in savings" },
  ],
  [Currency.NGN]: [
    { threshold: 1000000, template: "That's a significant investment in your future" },
    { threshold: 500000, template: "That's equivalent to a month's rent in many cities" },
    { threshold: 200000, template: "That's a weekend getaway to Calabar" },
    { threshold: 100000, template: "That's 2 months of groceries for a small household" },
    { threshold: 50000, template: "That's several nice dinners out" },
    { threshold: 0, template: "That's money that could be growing in savings" },
  ],
};

/**
 * Default subscription display names when pattern match fails
 */
export const DEFAULT_CATEGORY_NAMES: Record<SubscriptionCategory, string> = {
  [SubscriptionCategory.STREAMING]: 'Streaming Service',
  [SubscriptionCategory.TV_CABLE]: 'TV/Cable Service',
  [SubscriptionCategory.FITNESS]: 'Fitness & Wellness',
  [SubscriptionCategory.CLOUD_STORAGE]: 'Cloud Storage',
  [SubscriptionCategory.SOFTWARE]: 'Software & Tools',
  [SubscriptionCategory.VPN]: 'VPN Service',
  [SubscriptionCategory.LEARNING]: 'Learning Platform',
  [SubscriptionCategory.TELECOM]: 'Telecom & Mobile',
  [SubscriptionCategory.UTILITIES]: 'Utility Service',
  [SubscriptionCategory.INSURANCE]: 'Insurance',
  [SubscriptionCategory.GAMING]: 'Gaming Service',
  [SubscriptionCategory.OTHER]: 'Subscription Service',
};
