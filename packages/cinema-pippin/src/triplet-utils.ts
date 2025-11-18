export interface SRTEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
  rawText: string[];
}

export function transformToKeyword(text: string): string {
  // Remove all non-alphabetic characters and convert to lowercase
  return text.replace(/[^a-zA-Z]/g, '').toLowerCase();
}

export function endsWithPunctuation(text: string): boolean {
  const lastChar = text.trim().slice(-1);
  return ['.', '!', '?', '-', ';', ','].includes(lastChar);
}

export function endsWithStrongPunctuation(text: string): boolean {
  // Strong punctuation for T3 F3: only period, exclamation, question mark
  const lastChar = text.trim().slice(-1);
  return ['.', '!', '?'].includes(lastChar);
}

export function endsWithPunctuationOrBracket(text: string): boolean {
  const lastChar = text.trim().slice(-1);
  return ['.', '!', '?', '-', ';', ')', ']'].includes(lastChar);
}

export function endsWithQuestionMark(text: string): boolean {
  return text.trim().endsWith('?');
}

function timeToSeconds(timestamp: string): number {
  // Parse HH:MM:SS,mmm format
  const [time, ms] = timestamp.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const milliseconds = parseInt(ms || '0', 10);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export function getDurationSeconds(firstEntry: SRTEntry, thirdEntry: SRTEntry): number {
  const start = timeToSeconds(firstEntry.startTime);
  const end = timeToSeconds(thirdEntry.endTime);
  return Math.floor(end - start);
}

/**
 * Check if a triplet overlaps in time with any previously selected triplets
 * @param candidate - The triplet to check
 * @param existing - Array of previously selected triplets
 * @returns true if there is any time overlap, false otherwise
 */
export function hasTimeOverlap(candidate: SRTEntry[], existing: SRTEntry[][]): boolean {
  // Get time range for candidate triplet (first frame start to last frame end)
  const candidateStart = timeToSeconds(candidate[0].startTime);
  const candidateEnd = timeToSeconds(candidate[candidate.length - 1].endTime);

  // Check against all existing triplets
  for (const existingTriplet of existing) {
    const existingStart = timeToSeconds(existingTriplet[0].startTime);
    const existingEnd = timeToSeconds(existingTriplet[existingTriplet.length - 1].endTime);

    // Check for overlap: ranges overlap if one starts before the other ends
    if (candidateStart < existingEnd && candidateEnd > existingStart) {
      return true;
    }
  }

  return false;
}

export function isSingleWordWithPunctuation(text: string): boolean {
  // Must be exactly one word followed by one punctuation mark
  // Word can contain letters and apostrophes
  // Valid punctuation: . ! ? - ; " '
  const trimmed = text.trim();
  const match = trimmed.match(/^[a-zA-Z']+[.!?\-;"']$/);
  return match !== null;
}

export function extractWordFromSingleWord(text: string): string {
  // Extract the word part (without punctuation) and lowercase it
  const trimmed = text.trim();
  const word = trimmed.replace(/[.!?\-;]$/, '');
  return word.toLowerCase();
}

export function containsWordAsStandalone(text: string, word: string): boolean {
  // Check if text contains word as a standalone word (with word boundaries)
  // Case-insensitive matching
  const lowerText = text.trim().toLowerCase();
  const lowerWord = word.trim().toLowerCase();

  // Use word boundary regex
  const regex = new RegExp(`\\b${escapeRegExp(lowerWord)}\\b`);
  return regex.test(lowerText);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countWords(text: string): number {
  // Split by whitespace and count non-empty words
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

export function extractFirstWord(text: string): string {
  // Extract the first word from multi-word text, removing punctuation and lowercasing
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return '';

  const firstWord = words[0];
  // Remove trailing punctuation and lowercase
  const cleaned = firstWord.replace(/[.!?\-;,]+$/, '');
  return cleaned.toLowerCase();
}

const EXCLUDED_WORDS = new Set([
  'the', 'yes', 'no', 'why', 'how', 'when', 'where', 'me', 'i', 'you',
  'good', 'bad', 'yep', 'yeah', 'nah', 'nope', 'one', 'two', 'three', 'none', 'nada', 'nothing'
]);

export function isExcludedWord(word: string): boolean {
  return EXCLUDED_WORDS.has(word.toLowerCase());
}

export function extractLastWord(text: string): string {
  // Extract the last word from text, removing punctuation and lowercasing
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return '';

  const lastWord = words[words.length - 1];
  // Remove trailing punctuation and lowercase
  const cleaned = lastWord.replace(/[.!?\-;,]+$/, '');
  return cleaned.toLowerCase();
}

export function hasNonAlphaBeforeLastWord(text: string): boolean {
  // Check if there's at least one (non-whitespace AND non-alphabetic AND non-comma) character
  // between the second-last ALPHABETIC word and the last ALPHABETIC word
  // Returns false for single-word text (which is valid via other path)
  // IMPORTANT: Also returns false if there's no whitespace in the text (treated as single sequence)

  const trimmed = text.trim();

  // If there's no whitespace, treat as single "word" regardless of punctuation
  if (!/\s/.test(trimmed)) {
    return false;
  }

  // Extract all alphabetic words (sequences of letters and apostrophes)
  const wordMatches = Array.from(trimmed.matchAll(/[a-zA-Z']+/g));

  if (wordMatches.length < 2) return false; // Need at least 2 alphabetic words

  // Get positions of last two alphabetic words
  const secondLastMatch = wordMatches[wordMatches.length - 2];
  const lastMatch = wordMatches[wordMatches.length - 1];

  if (!secondLastMatch || !lastMatch) return false;

  // Position where second-last alphabetic word ends
  const secondLastEnd = secondLastMatch.index! + secondLastMatch[0].length;
  // Position where last alphabetic word starts
  const lastStart = lastMatch.index!;

  // Extract text between them
  const between = trimmed.slice(secondLastEnd, lastStart);

  // Check if there's at least one character that is:
  // - NOT whitespace
  // - NOT alphabetic
  // - NOT comma
  for (const char of between) {
    if (char !== ' ' &&
        char !== '\t' &&
        char !== '\n' &&
        char !== '\r' &&
        !/[a-zA-Z]/.test(char) &&
        char !== ',') {
      return true;
    }
  }

  return false;
}

export function isValidT1Frame3(text: string): boolean {
  // T1 F3 must have at least one word (no minimum character requirement)
  const trimmed = text.trim();

  // Must have at least one word (any non-empty text after trimming)
  if (trimmed.length === 0) {
    return false;
  }

  // Cannot end with "," (incomplete sentence for punchline)
  if (trimmed.endsWith(',')) {
    return false;
  }

  // Extract words (sequences of non-whitespace characters)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);

  // Must have at least one word
  return words.length >= 1;
}
