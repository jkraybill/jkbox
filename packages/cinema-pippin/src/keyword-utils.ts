/**
 * Shared utilities for keyword manipulation in triplets
 */

/**
 * Extract the last word from text (strips punctuation)
 */
export function extractLastWordFromText(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return '';
  const lastWord = words[words.length - 1];
  // Remove all punctuation and convert to lowercase
  return lastWord.replace(/[^a-zA-Z-]/g, '').toLowerCase();
}

/**
 * Replace keyword in text with blank, preserving any trailing punctuation
 */
export function replaceKeywordWithBlank(text: string, keyword: string): string {
  // Match keyword followed by optional punctuation (case-insensitive)
  // Preserve punctuation that's directly attached (no space between keyword and punctuation)
  const keywordRegex = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([.!?]*)(?=\\s|$)`,
    'gi'
  );
  return text.replace(keywordRegex, (match, punctuation) => {
    // Replace keyword with _____ but preserve any punctuation that was directly after it
    return '_____' + punctuation;
  });
}

/**
 * Replace keyword in text with literal "[keyword]", preserving punctuation
 */
export function replaceKeywordWithBrackets(text: string, keyword: string): string {
  // Match keyword followed by optional punctuation (case-insensitive)
  // Replace with literal "[keyword]" (not the actual keyword value)
  const keywordRegex = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([.!?]*)\\b`,
    'gi'
  );
  return text.replace(keywordRegex, '[keyword]$1');
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
 * Replace keyword in text with word, preserving the casing of each occurrence
 * Example: "I like BANANAS and bananas" + keyword="bananas" + word="apples"
 *          => "I like APPLES and apples"
 */
export function replaceKeywordWithWord(
  text: string,
  keyword: string,
  replacementWord: string
): string {
  const keywordRegex = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'gi'
  );

  return text.replace(keywordRegex, (match) => {
    return applyCasing(match, replacementWord);
  });
}
