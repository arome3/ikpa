/**
 * String Utilities
 *
 * Provides string manipulation and fuzzy matching utilities.
 */

/**
 * Calculate Levenshtein distance between two strings
 * Used for "Did you mean?" suggestions
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[s1.length][s2.length];
}

/**
 * Calculate similarity ratio between two strings (0 to 1)
 */
export function stringSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

/**
 * Check if a string contains another string (case-insensitive)
 */
export function containsIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Find the best matching strings from a list
 *
 * @param input - The input string to match
 * @param candidates - List of candidate strings
 * @param options - Configuration options
 * @returns Array of matches sorted by relevance
 */
export function findBestMatches(
  input: string,
  candidates: Array<{ id: string; name: string }>,
  options: {
    maxResults?: number;
    minSimilarity?: number;
  } = {},
): Array<{ id: string; name: string; similarity: number; isExactMatch: boolean }> {
  const { maxResults = 5, minSimilarity = 0.3 } = options;
  const inputLower = input.toLowerCase();

  const matches = candidates.map((candidate) => {
    const nameLower = candidate.name.toLowerCase();
    const idLower = candidate.id.toLowerCase();

    // Check for exact matches first
    const isExactNameMatch = nameLower === inputLower;
    const isExactIdMatch = idLower === inputLower;
    const isExactMatch = isExactNameMatch || isExactIdMatch;

    // Check for partial matches (input is part of name or vice versa)
    const containsName = containsIgnoreCase(candidate.name, input);
    const containsId = containsIgnoreCase(candidate.id, input);
    const inputContainsName = containsIgnoreCase(input, candidate.name);
    const inputContainsId = containsIgnoreCase(input, candidate.id);

    // Calculate similarity scores
    const nameSimilarity = stringSimilarity(input, candidate.name);
    const idSimilarity = stringSimilarity(input, candidate.id);

    // Boost score for partial matches
    let similarity = Math.max(nameSimilarity, idSimilarity);
    if (containsName || containsId || inputContainsName || inputContainsId) {
      similarity = Math.max(similarity, 0.6);
    }
    if (isExactMatch) {
      similarity = 1;
    }

    return {
      id: candidate.id,
      name: candidate.name,
      similarity,
      isExactMatch,
    };
  });

  // Filter by minimum similarity and sort by relevance
  return matches
    .filter((m) => m.similarity >= minSimilarity)
    .sort((a, b) => {
      // Exact matches first
      if (a.isExactMatch && !b.isExactMatch) return -1;
      if (!a.isExactMatch && b.isExactMatch) return 1;
      // Then by similarity
      return b.similarity - a.similarity;
    })
    .slice(0, maxResults);
}

/**
 * Generate a "Did you mean?" suggestion string
 *
 * @param input - The invalid input
 * @param suggestions - Array of suggested values
 * @returns Formatted suggestion string
 */
export function generateDidYouMeanMessage(
  input: string,
  suggestions: Array<{ id: string; name: string }>,
): string | null {
  if (suggestions.length === 0) return null;

  const topSuggestion = suggestions[0];
  const otherSuggestions = suggestions.slice(1, 4);

  let message = `Category '${input}' not found. Did you mean "${topSuggestion.name}"?`;

  if (otherSuggestions.length > 0) {
    const others = otherSuggestions.map((s) => `"${s.name}"`).join(', ');
    message += ` Other options: ${others}`;
  }

  return message;
}
