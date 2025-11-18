/**
 * Shared utilities for keyword manipulation in triplets
 */

/**
 * Extract the last word from text (strips punctuation and possessives)
 * Examples:
 * - "I love bananas." → "bananas"
 * - "It was your father's." → "father"
 * - "Above my Father's" → "father"
 */
export function extractLastWordFromText(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return '';
  let lastWord = words[words.length - 1];

  // First, check if it contains 's followed by punctuation or end of string
  // This handles: "father's", "father's.", "father's!", etc.
  const possessiveMatch = lastWord.match(/'s([.!?]*)$/i);
  if (possessiveMatch) {
    // Remove the 's but keep any trailing punctuation for next step
    lastWord = lastWord.slice(0, -2) + (possessiveMatch[1] || '');
  }

  // Then remove all remaining punctuation and convert to lowercase
  return lastWord.replace(/[^a-zA-Z-]/g, '').toLowerCase();
}

/**
 * Replace keyword in text with blank, preserving any trailing punctuation and possessives
 */
export function replaceKeywordWithBlank(text: string, keyword: string): string {
  // Match keyword followed by optional possessive ('s) and punctuation (case-insensitive)
  // Preserve both possessive and punctuation that's directly attached
  const keywordRegex = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}('s)?([.!?]*)(?=\\s|$)`,
    'gi'
  );
  return text.replace(keywordRegex, (match, possessive, punctuation) => {
    // Replace keyword with _____ but preserve possessive ('s) and punctuation
    return '_____' + (possessive || '') + (punctuation || '');
  });
}

/**
 * Replace keyword in text with literal "[keyword]", preserving punctuation and possessives
 */
export function replaceKeywordWithBrackets(text: string, keyword: string): string {
  // Match keyword followed by optional possessive ('s) and punctuation (case-insensitive)
  // Replace with literal "[keyword]" (not the actual keyword value), preserving possessive and punctuation
  const keywordRegex = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}('s)?([.!?]*)(?=\\s|$)`,
    'gi'
  );
  return text.replace(keywordRegex, (match, possessive, punctuation) => {
    return '[keyword]' + (possessive || '') + (punctuation || '');
  });
}

/**
 * Apply the casing pattern from sourceWord to targetWord
 * Examples:
 * - applyCasing("MENDOZA", "poop") => "POOP"
 * - applyCasing("Mendoza", "poop") => "Poop"
 * - applyCasing("mendoza", "poop") => "poop"
 */
export function applyCasing(sourceWord: string, targetWord: string): string {
  if (!sourceWord || !targetWord) return targetWord;

  // Check if source is all uppercase
  if (sourceWord === sourceWord.toUpperCase() && sourceWord !== sourceWord.toLowerCase()) {
    return targetWord.toUpperCase();
  }

  // Check if source is title case (first letter uppercase, rest lowercase)
  if (sourceWord[0] === sourceWord[0].toUpperCase() &&
      sourceWord.slice(1) === sourceWord.slice(1).toLowerCase()) {
    return targetWord[0].toUpperCase() + targetWord.slice(1).toLowerCase();
  }

  // Default to lowercase
  return targetWord.toLowerCase();
}

/**
 * Replace blank ("_____") with word, matching the casing of the original keyword
 * Example: If original was "MENDOZA!!" -> "_____!!" and replacement is "poop", result is "POOP!!"
 */
export function replaceBlankWithWord(
  text: string,
  replacementWord: string,
  originalKeyword: string
): string {
  // Match _____ (5 underscores)
  const blankRegex = /_____/g;

  // Track which occurrence we're on to apply different casing if needed
  let occurrenceIndex = 0;

  // First, find all occurrences of the original keyword in the text to get their casing
  const originalKeywordRegex = new RegExp(
    `\\b${originalKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'gi'
  );

  const casings: string[] = [];
  let match;
  const originalText = text.replace(blankRegex, originalKeyword); // Temporarily restore to detect casing
  while ((match = originalKeywordRegex.exec(originalText)) !== null) {
    casings.push(match[0]);
  }

  // Now replace each blank with the word, applying the appropriate casing
  return text.replace(blankRegex, () => {
    const casing = casings[occurrenceIndex] || originalKeyword;
    occurrenceIndex++;
    return applyCasing(casing, replacementWord);
  });
}

/**
 * Replace keyword in text with word, preserving the casing of each occurrence and possessives
 * Example: "I like BANANAS and bananas" + keyword="bananas" + word="apples"
 *          => "I like APPLES and apples"
 * Example: "My father's house" + keyword="father" + word="mother"
 *          => "My mother's house"
 */
export function replaceKeywordWithWord(
  text: string,
  keyword: string,
  replacementWord: string
): string {
  const keywordRegex = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}('s)?\\b`,
    'gi'
  );

  return text.replace(keywordRegex, (match, possessive) => {
    // Extract the keyword part without the possessive
    const keywordPart = possessive ? match.slice(0, -2) : match;
    return applyCasing(keywordPart, replacementWord) + (possessive || '');
  });
}
