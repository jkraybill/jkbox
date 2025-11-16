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
  return ['.', '!', '?', '-', ';'].includes(lastChar);
}

export function endsWithPunctuationOrBracket(text: string): boolean {
  const lastChar = text.trim().slice(-1);
  return ['.', '!', '?', '-', ';', '(', ')', '[', ']'].includes(lastChar);
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

export function isSingleWordWithPunctuation(text: string): boolean {
  // Must be exactly one word followed by one punctuation mark
  // Word can contain letters and apostrophes
  const trimmed = text.trim();
  const match = trimmed.match(/^[a-zA-Z']+[.!?\-;]$/);
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
  const lowerText = text.toLowerCase();
  const lowerWord = word.toLowerCase();

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
