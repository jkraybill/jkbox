import { parseSRT, type SRTEntry } from './srt-parser.js';
import {
  endsWithPunctuation,
  endsWithPunctuationOrBracket,
  endsWithQuestionMark,
  getDurationSeconds,
  isSingleWordWithPunctuation,
  extractWordFromSingleWord,
  containsWordAsStandalone,
  countWords,
  isExcludedWord,
} from './triplet-utils.js';

export interface Triplet {
  allEntries: SRTEntry[]; // All frames including fillers (5-8 frames: 3 official + 2-5 fillers)
  frame1: SRTEntry;       // Official Frame 1
  frame2: SRTEntry;       // Official Frame 2
  frame3: SRTEntry;       // Official Frame 3
  keyword: string;
}

function hasMinimumAlphaChars(text: string, min: number = 2): boolean {
  const alphaOnly = text.replace(/[^a-zA-Z]/g, '');
  return alphaOnly.length >= min;
}

export function isValidFirstTriplet(
  entries: SRTEntry[],
  frame1Idx: number,
  frame2Idx: number,
  frame3Idx: number
): boolean {
  // frame1Idx, frame2Idx, frame3Idx are the indices for the official frames
  // frame2Idx can be frame1Idx + 3, +4, +5, or +6 (2, 3, 4, or 5 fillers)
  // frame3Idx is always frame2Idx + 1

  if (frame1Idx < 1 || frame3Idx >= entries.length) {
    return false; // Need previous frame and all triplet frames
  }

  const prevEntry = entries[frame1Idx - 1];
  const frame1 = entries[frame1Idx];
  const frame2 = entries[frame2Idx];
  const frame3 = entries[frame3Idx];

  // Check minimum alpha characters for official frames (2 chars minimum)
  if (!hasMinimumAlphaChars(frame1.text) ||
      !hasMinimumAlphaChars(frame2.text) ||
      !hasMinimumAlphaChars(frame3.text)) {
    return false;
  }

  // Frame 3 must be a single word with punctuation
  if (!isSingleWordWithPunctuation(frame3.text)) {
    return false;
  }

  // Frame 3 must have at least 3 alphabetic characters
  if (!hasMinimumAlphaChars(frame3.text, 3)) {
    return false;
  }

  // Frame 3 word cannot be in the excluded set
  const word = extractWordFromSingleWord(frame3.text);
  if (isExcludedWord(word)) {
    return false;
  }

  // Previous frame must end with . ! ? - ; ( ) [ ]
  if (!endsWithPunctuationOrBracket(prevEntry.text)) {
    return false;
  }

  // Frame 2 no longer requires question mark - any text is valid

  // Duration must be 5-20 seconds
  const duration = getDurationSeconds(frame1, frame3);
  if (duration < 5 || duration > 20) {
    return false;
  }

  return true;
}

export function isValidSubsequentTriplet(
  entries: SRTEntry[],
  frame1Idx: number,
  frame2Idx: number,
  frame3Idx: number,
  keyword: string,
  minWords: number = 2
): boolean {
  if (frame1Idx < 1 || frame3Idx >= entries.length) {
    return false;
  }

  const prevEntry = entries[frame1Idx - 1];
  const frame1 = entries[frame1Idx];
  const frame2 = entries[frame2Idx];
  const frame3 = entries[frame3Idx];

  // Check minimum alpha characters for official frames (2 chars minimum)
  if (!hasMinimumAlphaChars(frame1.text) ||
      !hasMinimumAlphaChars(frame2.text) ||
      !hasMinimumAlphaChars(frame3.text)) {
    return false;
  }

  // Keyword must appear in at least one frame (F1, F2, or F3)
  const keywordInF1 = containsWordAsStandalone(frame1.text, keyword);
  const keywordInF2 = containsWordAsStandalone(frame2.text, keyword);
  const keywordInF3 = containsWordAsStandalone(frame3.text, keyword);

  if (!keywordInF1 && !keywordInF2 && !keywordInF3) {
    return false;
  }

  // Frame 3 must have at least minWords words
  if (countWords(frame3.text) < minWords) {
    return false;
  }

  // Previous frame must end with . ! ? - ; ( ) [ ]
  if (!endsWithPunctuationOrBracket(prevEntry.text)) {
    return false;
  }

  // Frame 2 must end with . ! ? - ;
  if (!endsWithPunctuation(frame2.text)) {
    return false;
  }

  // Frame 3 must end with . ! ? - ;
  if (!endsWithPunctuation(frame3.text)) {
    return false;
  }

  // Duration must be 5-20 seconds
  const duration = getDurationSeconds(frame1, frame3);
  if (duration < 5 || duration > 20) {
    return false;
  }

  return true;
}

function findTripletsInternal(srtContent: string): Triplet[][] {
  const entries = parseSRT(srtContent);
  const results: Triplet[][] = [];

  // Try all combinations of filler counts (2, 3, 4, 5) for each triplet
  // Start from index 1 to allow for "previous" frame
  for (let f1Start = 1; f1Start < entries.length; f1Start++) {
    // Try 2, 3, 4, 5 fillers between Frame 1 and Frame 2 of first triplet
    for (let f1Fillers = 2; f1Fillers <= 5; f1Fillers++) {
      const f1Frame2Idx = f1Start + 1 + f1Fillers;
      const f1Frame3Idx = f1Frame2Idx + 1;

      if (f1Frame3Idx >= entries.length) continue;

      if (!isValidFirstTriplet(entries, f1Start, f1Frame2Idx, f1Frame3Idx)) {
        continue;
      }

      const firstKeyword = extractWordFromSingleWord(entries[f1Frame3Idx].text);

      // Find second triplets (start after first triplet ends)
      for (let f2Start = f1Frame3Idx + 1; f2Start < entries.length; f2Start++) {
        for (let f2Fillers = 2; f2Fillers <= 5; f2Fillers++) {
          const f2Frame2Idx = f2Start + 1 + f2Fillers;
          const f2Frame3Idx = f2Frame2Idx + 1;

          if (f2Frame3Idx >= entries.length) continue;

          if (!isValidSubsequentTriplet(entries, f2Start, f2Frame2Idx, f2Frame3Idx, firstKeyword, 2)) {
            continue;
          }

          // Find third triplets (start after second triplet ends)
          for (let f3Start = f2Frame3Idx + 1; f3Start < entries.length; f3Start++) {
            for (let f3Fillers = 2; f3Fillers <= 5; f3Fillers++) {
              const f3Frame2Idx = f3Start + 1 + f3Fillers;
              const f3Frame3Idx = f3Frame2Idx + 1;

              if (f3Frame3Idx >= entries.length) continue;

              if (!isValidSubsequentTriplet(entries, f3Start, f3Frame2Idx, f3Frame3Idx, firstKeyword, 3)) {
                continue;
              }

              // Found a valid sequence of 3 triplets!
              const triplet1: Triplet = {
                allEntries: entries.slice(f1Start, f1Frame3Idx + 1),
                frame1: entries[f1Start],
                frame2: entries[f1Frame2Idx],
                frame3: entries[f1Frame3Idx],
                keyword: firstKeyword,
              };

              const triplet2: Triplet = {
                allEntries: entries.slice(f2Start, f2Frame3Idx + 1),
                frame1: entries[f2Start],
                frame2: entries[f2Frame2Idx],
                frame3: entries[f2Frame3Idx],
                keyword: firstKeyword,
              };

              const triplet3: Triplet = {
                allEntries: entries.slice(f3Start, f3Frame3Idx + 1),
                frame1: entries[f3Start],
                frame2: entries[f3Frame2Idx],
                frame3: entries[f3Frame3Idx],
                keyword: firstKeyword,
              };

              results.push([triplet1, triplet2, triplet3]);
            }
          }
        }
      }
    }
  }

  return results;
}

function getAlphaCharCount(text: string): number {
  return text.replace(/[^a-zA-Z]/g, '').length;
}

function getTotalAlphaCharCount(sequence: Triplet[]): number {
  return sequence.reduce((total, triplet) => {
    return total +
           getAlphaCharCount(triplet.frame1.text) +
           getAlphaCharCount(triplet.frame2.text) +
           getAlphaCharCount(triplet.frame3.text);
  }, 0);
}

function getLastWordLower(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return '';
  const lastWord = words[words.length - 1];
  // Remove punctuation from the last word
  return lastWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
}

function deduplicateByFirstTripletFrame3LastWord(sequences: Triplet[][]): Triplet[][] {
  // Group sequences by the last word of Triplet 1's Frame 3
  const grouped = new Map<string, Triplet[][]>();

  for (const sequence of sequences) {
    const triplet1 = sequence[0];
    const lastWord = getLastWordLower(triplet1.frame3.text);

    if (!grouped.has(lastWord)) {
      grouped.set(lastWord, []);
    }
    grouped.get(lastWord)!.push(sequence);
  }

  // For each group, keep only the one with highest total alphabetic char count
  const deduplicated: Triplet[][] = [];
  for (const group of grouped.values()) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      // Find the sequence with the highest total alpha char count
      let best = group[0];
      let bestCount = getTotalAlphaCharCount(group[0]);

      for (let i = 1; i < group.length; i++) {
        const count = getTotalAlphaCharCount(group[i]);
        if (count > bestCount) {
          best = group[i];
          bestCount = count;
        }
      }

      deduplicated.push(best);
    }
  }

  return deduplicated;
}

export function findAllTriplets(srtContent: string): Triplet[][] {
  // Find all valid triplet sequences
  const results = findTripletsInternal(srtContent);

  // Deduplicate based on Triplet 1's Frame 3 last word, keeping highest total alpha char count
  return deduplicateByFirstTripletFrame3LastWord(results);
}
