/**
 * Merchant-to-Category Mapping
 *
 * Maps normalized merchant names to expense category IDs.
 * Used by ExpenseCreatorService to auto-categorize imported transactions
 * when the user selects "auto" or "other" as the category.
 *
 * Specific patterns (e.g., "amazon prime") are checked before general ones
 * (e.g., "amazon") to avoid mis-categorization.
 */

/**
 * Specific merchant patterns checked first (order matters — most specific first).
 * Each entry: [pattern, categoryId]
 */
const SPECIFIC_PATTERNS: [string, string][] = [
  // Entertainment — streaming subscriptions (before general merchant matches)
  ['amazon prime', 'entertainment'],
  ['prime video', 'entertainment'],
  ['disney plus', 'entertainment'],
  ['disney+', 'entertainment'],
  ['hbo max', 'entertainment'],
  ['paramount plus', 'entertainment'],
  ['paramount+', 'entertainment'],
  ['apple tv', 'entertainment'],
  ['peacock', 'entertainment'],
  ['hulu', 'entertainment'],
  ['youtube premium', 'entertainment'],

  // Food — grocery chains with location keywords
  ['whole foods', 'food-dining'],
  ['trader joes', 'food-dining'],
  ['trader joe', 'food-dining'],

  // Healthcare — pharmacy/fitness (before shopping catch-all)
  ['planet fitness', 'healthcare'],
  ['equinox', 'healthcare'],
  ['orangetheory', 'healthcare'],
  ['gympass', 'healthcare'],
  ['anytime fitness', 'healthcare'],

  // Utilities — telecom + energy
  ['at&t wireless', 'utilities'],
  ['att wireless', 'utilities'],
  ['at&t', 'utilities'],
  ['att', 'utilities'],
  ['austin energy', 'utilities'],
  ['t-mobile', 'utilities'],
  ['verizon', 'utilities'],
  ['comcast', 'utilities'],
  ['xfinity', 'utilities'],
  ['spectrum', 'utilities'],
  ['mtn', 'utilities'],
  ['glo', 'utilities'],
  ['airtel', 'utilities'],
  ['9mobile', 'utilities'],
];

/**
 * General merchant-to-category mapping.
 * Keys are normalized merchant names (lowercase, stripped of special chars).
 */
export const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  // ── Food & Dining ──────────────────────────────
  'whole foods': 'food-dining',
  'trader joes': 'food-dining',
  kroger: 'food-dining',
  publix: 'food-dining',
  'h-e-b': 'food-dining',
  heb: 'food-dining',
  costco: 'food-dining',
  aldi: 'food-dining',
  safeway: 'food-dining',
  chipotle: 'food-dining',
  'chick-fil-a': 'food-dining',
  chickfila: 'food-dining',
  mcdonalds: 'food-dining',
  starbucks: 'food-dining',
  'taco bell': 'food-dining',
  'panda express': 'food-dining',
  wendys: 'food-dining',
  subway: 'food-dining',
  'five guys': 'food-dining',
  'in-n-out': 'food-dining',
  'whataburger': 'food-dining',
  torchys: 'food-dining',
  "torchy's": 'food-dining',
  uchi: 'food-dining',
  flemings: 'food-dining',
  "fleming's": 'food-dining',
  jeffreys: 'food-dining',
  "jeffrey's": 'food-dining',
  'atlas coffee': 'food-dining',
  'doordash': 'food-dining',
  'grubhub': 'food-dining',
  'uber eats': 'food-dining',
  'ubereats': 'food-dining',
  instacart: 'food-dining',
  postmates: 'food-dining',
  chowdeck: 'food-dining',
  glovo: 'food-dining',
  'jumia food': 'food-dining',
  shoprite: 'food-dining',
  spar: 'food-dining',
  "buc-ee's": 'food-dining',
  'bucees': 'food-dining',

  // ── Transportation ─────────────────────────────
  shell: 'transportation',
  'shell oil': 'transportation',
  chevron: 'transportation',
  exxon: 'transportation',
  bp: 'transportation',
  uber: 'transportation',
  lyft: 'transportation',
  bolt: 'transportation',
  'citgo': 'transportation',
  'marathon': 'transportation',
  'valero': 'transportation',

  // ── Entertainment ──────────────────────────────
  netflix: 'entertainment',
  spotify: 'entertainment',
  'apple music': 'entertainment',
  'disney plus': 'entertainment',
  'amazon prime': 'entertainment',
  'hbo max': 'entertainment',
  hulu: 'entertainment',
  'paramount plus': 'entertainment',
  'apple tv': 'entertainment',
  peacock: 'entertainment',
  youtube: 'entertainment',
  'amc theaters': 'entertainment',
  amc: 'entertainment',
  'alamo drafthouse': 'entertainment',
  regal: 'entertainment',
  dstv: 'entertainment',
  gotv: 'entertainment',
  startimes: 'entertainment',

  // ── Utilities ──────────────────────────────────
  'austin energy': 'utilities',
  'att wireless': 'utilities',
  'at&t': 'utilities',
  't-mobile': 'utilities',
  verizon: 'utilities',
  comcast: 'utilities',
  xfinity: 'utilities',
  spectrum: 'utilities',
  'texas gas': 'utilities',
  mtn: 'utilities',
  glo: 'utilities',
  airtel: 'utilities',
  '9mobile': 'utilities',

  // ── Shopping ───────────────────────────────────
  amazon: 'shopping',
  'apple store': 'shopping',
  apple: 'shopping',
  'best buy': 'shopping',
  target: 'shopping',
  walmart: 'shopping',
  walgreens: 'shopping',
  'cvs pharmacy': 'shopping',
  cvs: 'shopping',
  'home depot': 'shopping',
  lowes: 'shopping',
  ikea: 'shopping',
  nordstrom: 'shopping',
  macys: 'shopping',
  jumia: 'shopping',
  'game stores': 'shopping',

  // ── Healthcare ─────────────────────────────────
  'planet fitness': 'healthcare',
  equinox: 'healthcare',
  orangetheory: 'healthcare',
  gympass: 'healthcare',
  'anytime fitness': 'healthcare',
  headspace: 'healthcare',
  calm: 'healthcare',
  strava: 'healthcare',
};

/**
 * Look up the category for a merchant name.
 *
 * Resolution order:
 * 1. Specific patterns (longest/most-specific first)
 * 2. Exact match in MERCHANT_CATEGORY_MAP
 * 3. Substring match in MERCHANT_CATEGORY_MAP
 *
 * @returns category ID or null if no match found
 */
export function getCategoryForMerchant(
  merchant: string | null,
  normalizedMerchant: string | null,
): string | null {
  if (!merchant && !normalizedMerchant) return null;

  const candidates = [
    normalizedMerchant?.toLowerCase().trim(),
    merchant?.toLowerCase().trim(),
  ].filter(Boolean) as string[];

  for (const name of candidates) {
    // 1. Check specific patterns first (most-specific wins)
    for (const [pattern, categoryId] of SPECIFIC_PATTERNS) {
      if (name.includes(pattern)) {
        return categoryId;
      }
    }

    // 2. Exact match
    if (MERCHANT_CATEGORY_MAP[name]) {
      return MERCHANT_CATEGORY_MAP[name];
    }

    // 3. Substring match — check if any known merchant is contained in the name
    for (const [key, categoryId] of Object.entries(MERCHANT_CATEGORY_MAP)) {
      if (name.includes(key) || key.includes(name)) {
        return categoryId;
      }
    }
  }

  return null;
}
