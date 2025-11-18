import type { SRTEntry } from './srt-parser.js';
import { parseSRT } from './srt-parser.js';
import {
  endsWithPunctuation,
  endsWithStrongPunctuation,
  endsWithPunctuationOrBracket,
  getDurationSeconds,
  isValidT1Frame3,
  extractLastWord,
  countWords,
  isExcludedWord,
  hasTimeOverlap,
} from './triplet-utils.js';
import { scoreWordByFrequency } from './word-frequency.js';
import { stripHtmlFromSrt } from './html-utils.js';

export interface Triplet {
  allEntries: SRTEntry[];
  frame1: SRTEntry;
  frame2: SRTEntry;
  frame3: SRTEntry;
  keyword: string;
}

// Target number of triplet sequences to output
const TARGET_N = 18;
const TARGET_N_THIRD = TARGET_N / 3;  // 6 (used in deduplication strategy)

// Overlap minimization weights
const OVERLAP_PENALTY_WEIGHT = 50.0;  // High penalty for overlap (dominant factor)
const QUALITY_WEIGHT = 1.0;            // Baseline quality weight

interface TimeRange {
  startSeconds: number;  // T1 F1 start time
  endSeconds: number;    // T3 F3 end time
  duration: number;      // Total span (endSeconds - startSeconds)
}

interface ValidFirstTriplet {
  f1Start: number;
  f1Frame2: number;
  f1Frame3: number;
  keyword: string;
}

interface KeywordIndex {
  keyword: string;
  regex: RegExp;
  frameIndices: number[];
}

/**
 * Pre-compute all valid first triplets (one-time O(n) scan)
 */
function buildFirstTripletIndex(entries: SRTEntry[]): ValidFirstTriplet[] {
  const validFirstTriplets: ValidFirstTriplet[] = [];

  for (let i = 1; i < entries.length; i++) {
    const prevFrame = entries[i - 1];
    if (!endsWithPunctuationOrBracket(prevFrame.text)) continue;

    // Try 0-6 fillers
    for (let fillers = 0; fillers <= 6; fillers++) {
      const frame2Idx = i + 1 + fillers;
      const frame3Idx = frame2Idx + 1;

      if (frame3Idx >= entries.length) break;

      const frame1 = entries[i];
      const frame2 = entries[frame2Idx];
      const frame3 = entries[frame3Idx];

      // Validate Frame 3
      if (!isValidT1Frame3(frame3.text)) continue;

      // Extract and validate keyword
      const keyword = extractLastWord(frame3.text);
      if (!keyword || isExcludedWord(keyword)) continue;

      // Keyword cannot appear earlier in T1 (F1, F2, or earlier in F3)
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');

      // Check F1 and F2
      if (keywordRegex.test(frame1.text) || keywordRegex.test(frame2.text)) {
        continue;
      }

      // Check F3 (excluding last word)
      const words = frame3.text.trim().split(/\s+/);
      if (words.length > 1) {
        const textWithoutLastWord = words.slice(0, -1).join(' ');
        if (keywordRegex.test(textWithoutLastWord)) {
          continue;
        }
      }

      // Validate duration
      const duration = getDurationSeconds(frame1, frame3);
      if (duration < 5 || duration > 20) continue;

      validFirstTriplets.push({
        f1Start: i,
        f1Frame2: frame2Idx,
        f1Frame3: frame3Idx,
        keyword,
      });
    }
  }

  return validFirstTriplets;
}

/**
 * Build keyword index: keyword -> {regex, frameIndices[]}
 * Pre-compiles regexes and finds all frames containing each keyword
 */
function buildKeywordIndex(entries: SRTEntry[], keywords: Set<string>): Map<string, KeywordIndex> {
  const index = new Map<string, KeywordIndex>();

  // Pre-compile all regexes
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    index.set(keyword, { keyword, regex, frameIndices: [] });
  }

  // Single pass through entries to find all keyword occurrences
  for (let i = 0; i < entries.length; i++) {
    const lowerText = entries[i].text.toLowerCase();

    for (const keywordData of index.values()) {
      if (keywordData.regex.test(lowerText)) {
        keywordData.frameIndices.push(i);
      }
    }
  }

  return index;
}

/**
 * Fast check if keyword appears in ANY frame of triplet using pre-built index
 */
function tripletContainsKeyword(
  keywordData: KeywordIndex,
  tripletStart: number,
  tripletEnd: number
): boolean {
  // Binary search for first frame >= tripletStart
  const indices = keywordData.frameIndices;
  let left = 0;
  let right = indices.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (indices[mid] < tripletStart) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Check if any frames in range contain keyword
  while (left < indices.length && indices[left] <= tripletEnd) {
    return true;
  }

  return false;
}

/**
 * Validate subsequent triplet (T2 or T3) with fast keyword lookup
 */
function isValidSubsequentTriplet(
  entries: SRTEntry[],
  tripletStart: number,
  frame2Idx: number,
  frame3Idx: number,
  keywordData: KeywordIndex,
  minWords: number
): boolean {
  if (tripletStart < 1 || frame3Idx >= entries.length) return false;

  const prevEntry = entries[tripletStart - 1];
  const frame1 = entries[tripletStart];
  const frame2 = entries[frame2Idx];
  const frame3 = entries[frame3Idx];

  // Check minimum word count
  if (countWords(frame3.text) < minWords) return false;

  // Fast keyword check using pre-built index
  if (!tripletContainsKeyword(keywordData, tripletStart, frame3Idx)) {
    return false;
  }

  // Previous frame must end with . ! ? - ; ) ]
  if (!endsWithPunctuationOrBracket(prevEntry.text)) {
    return false;
  }

  // Frame 2 must end with . ! ? - ;
  if (!endsWithPunctuation(frame2.text)) {
    return false;
  }

  // Frame 3 must end with . ! ? - (strong punctuation - no semicolon, comma, or colon)
  if (!endsWithStrongPunctuation(frame3.text)) {
    return false;
  }

  // Duration validation
  const duration = getDurationSeconds(frame1, frame3);
  return duration >= 5 && duration <= 20;
}

/**
 * Optimized triplet finder - O(n) preprocessing + O(n²) search
 */
async function findTripletsOptimized(entries: SRTEntry[]): Promise<Triplet[][]> {
  const results: Triplet[][] = [];

  // Step 1: Pre-compute all valid first triplets (O(n))
  console.log('  Building first triplet index...');
  const validFirstTriplets = buildFirstTripletIndex(entries);
  console.log(`  Found ${validFirstTriplets.length} valid first triplets`);

  if (validFirstTriplets.length === 0) return results;

  // Step 2: Extract unique keywords and build keyword index (O(n))
  console.log('  Building keyword index...');
  const keywords = new Set(validFirstTriplets.map(t => t.keyword));
  const keywordIndex = buildKeywordIndex(entries, keywords);
  console.log(`  Indexed ${keywords.size} unique keywords`);

  // Step 3: Pre-qualify keywords (filter out keywords that can't form complete sequences)
  console.log('  Pre-qualifying keywords (checking for sequential T1→T2→T3 chains)...');
  const qualifiedKeywords = new Set<string>();

  for (const t1 of validFirstTriplets) {
    const keywordData = keywordIndex.get(t1.keyword)!;
    let foundCompleteSequence = false;

    // Search for T2 AFTER this T1
    const searchStart2 = t1.f1Frame3 + 1;
    for (let f2Start = searchStart2; f2Start < entries.length - 2 && !foundCompleteSequence; f2Start++) {
      for (let f2Fillers = 0; f2Fillers <= 6 && !foundCompleteSequence; f2Fillers++) {
        const f2Frame2 = f2Start + 1 + f2Fillers;
        const f2Frame3 = f2Frame2 + 1;
        if (f2Frame3 >= entries.length) break;

        if (!isValidSubsequentTriplet(entries, f2Start, f2Frame2, f2Frame3, keywordData, 2)) {
          continue;
        }

        // Found valid T2! Now search for T3 AFTER this T2
        const searchStart3 = f2Frame3 + 1;
        for (let f3Start = searchStart3; f3Start < entries.length - 2 && !foundCompleteSequence; f3Start++) {
          for (let f3Fillers = 0; f3Fillers <= 6 && !foundCompleteSequence; f3Fillers++) {
            const f3Frame2 = f3Start + 1 + f3Fillers;
            const f3Frame3 = f3Frame2 + 1;
            if (f3Frame3 >= entries.length) break;

            if (isValidSubsequentTriplet(entries, f3Start, f3Frame2, f3Frame3, keywordData, 3)) {
              // Found complete T1→T2→T3 chain!
              foundCompleteSequence = true;
              qualifiedKeywords.add(t1.keyword);
            }
          }
        }
      }
    }
  }

  console.log(`  Qualified keywords: ${qualifiedKeywords.size} of ${keywords.size} can form complete sequences`);

  // Step 3.5: Score all qualified keywords by frequency (for logging and potential filtering)
  console.log('  Scoring keywords by word frequency...');
  const keywordScores: Array<{ keyword: string; frequency: number }> = [];
  for (const keyword of qualifiedKeywords) {
    const frequency = await scoreWordByFrequency(keyword);
    keywordScores.push({ keyword, frequency });
  }

  // Filter out keywords with frequency > 10000 (too common)
  // BUT: Always keep at least TARGET_N keywords to ensure we can reach the target
  const beforeCommonFilter = keywordScores.length;
  let filteredScores = keywordScores.filter(k => k.frequency <= 10000);

  // If we filtered too aggressively and have fewer than TARGET_N keywords,
  // add back the rarest common words until we hit TARGET_N
  if (filteredScores.length < TARGET_N && keywordScores.length >= TARGET_N) {
    // Sort all keywords by frequency (rarest first)
    const sortedAll = [...keywordScores].sort((a, b) => a.frequency - b.frequency);
    // Take the rarest TARGET_N keywords
    filteredScores = sortedAll.slice(0, TARGET_N);
    const added = filteredScores.length - (keywordScores.filter(k => k.frequency <= 10000).length);
    console.log(`  ⚠️  Only ${filteredScores.length - added} keywords with frequency ≤ 10000`);
    console.log(`  📈 Added ${added} less-common keywords to reach TARGET_N (${TARGET_N})`);
  } else if (filteredScores.length < beforeCommonFilter) {
    const removed = beforeCommonFilter - filteredScores.length;
    console.log(`  Filtered out ${removed} common keywords (frequency > 10000)`);
  }

  // Sort by frequency (rarest first) and display
  filteredScores.sort((a, b) => a.frequency - b.frequency);
  console.log(`  Keyword frequencies (${filteredScores.length} total):`);
  for (const { keyword, frequency } of filteredScores) {
    console.log(`    ${keyword}: ${frequency}`);
  }

  // Update qualifiedKeywords to only include filtered keywords
  qualifiedKeywords.clear();
  filteredScores.forEach(k => qualifiedKeywords.add(k.keyword));

  // Early exit if no keywords remain
  if (qualifiedKeywords.size === 0) {
    console.log('  No keywords remain after filtering - all were too common!');
    return [];
  }

  // Step 3.6: If we have more than TARGET_N qualified keywords, prune by frequency
  const maxKeywords = Math.floor(TARGET_N * 1.2); // 18 * 1.2 = 21.6 → 21

  if (qualifiedKeywords.size > maxKeywords) {
    console.log(`\n  Pruning keywords: ${qualifiedKeywords.size} > ${maxKeywords} (TARGET_N * 1.2)`);

    // Remove highest frequency keywords until we're at or below TARGET_N * 1.2
    // Sort by frequency (highest first)
    const sortedByFrequency = [...filteredScores].sort((a, b) => b.frequency - a.frequency);

    // Keep removing the highest frequency keyword until we hit the threshold
    const toKeep = sortedByFrequency.slice(sortedByFrequency.length - maxKeywords);

    console.log(`  Removed ${sortedByFrequency.length - toKeep.length} highest frequency keywords`);

    qualifiedKeywords.clear();
    toKeep.forEach(k => qualifiedKeywords.add(k.keyword));
  } else if (qualifiedKeywords.size > TARGET_N) {
    console.log(`\n  Keywords in acceptable range: ${qualifiedKeywords.size} (between ${TARGET_N} and ${maxKeywords})`);
  }

  // Step 3.7: If still over TARGET_N, randomly remove keywords
  if (qualifiedKeywords.size > TARGET_N) {
    console.log(`  Randomly trimming from ${qualifiedKeywords.size} to ${TARGET_N} keywords`);

    const keywordArray = Array.from(qualifiedKeywords);

    // Fisher-Yates shuffle
    for (let i = keywordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keywordArray[i], keywordArray[j]] = [keywordArray[j], keywordArray[i]];
    }

    // Keep only TARGET_N keywords
    const toKeep = keywordArray.slice(0, TARGET_N);

    qualifiedKeywords.clear();
    toKeep.forEach(k => qualifiedKeywords.add(k));

    console.log(`  Final keyword count: ${qualifiedKeywords.size}`);
  }

  // Step 4: For each valid first triplet with qualified keyword, search for second and third
  console.log('  Searching for triplet sequences...');
  const qualifiedFirstTriplets = validFirstTriplets.filter(t => qualifiedKeywords.has(t.keyword));
  console.log(`  Searching ${qualifiedFirstTriplets.length} of ${validFirstTriplets.length} first triplets (filtered by qualified keywords)`);

  let checked = 0;
  const totalToCheck = qualifiedFirstTriplets.length;

  // Safety limits to prevent OOM
  const MAX_RESULTS_PER_KEYWORD = 100; // Stop after finding this many sequences per keyword
  const MAX_SEARCH_WINDOW = 1000; // Only search this many frames ahead for T2/T3
  const keywordResultCounts = new Map<string, number>();

  for (const t1 of qualifiedFirstTriplets) {
    checked++;
    if (checked % 100 === 0) {
      console.log(`    Progress: ${checked}/${totalToCheck} first triplets checked...`);
    }

    // Skip if we already have enough results for this keyword
    const currentCount = keywordResultCounts.get(t1.keyword) || 0;
    if (currentCount >= MAX_RESULTS_PER_KEYWORD) {
      continue;
    }

    const keywordData = keywordIndex.get(t1.keyword)!;
    const searchStart2 = t1.f1Frame3 + 1;
    const searchEnd2 = Math.min(searchStart2 + MAX_SEARCH_WINDOW, entries.length - 2);

    // Get T1 entries for overlap checking
    const triplet1Entries = entries.slice(t1.f1Start, t1.f1Frame3 + 1);

    // Find second triplets using keyword index
    for (let f2Start = searchStart2; f2Start < searchEnd2; f2Start++) {
      // Quick bounds check: can we fit a minimal second triplet?
      if (f2Start + 2 >= entries.length) break;

      for (let f2Fillers = 0; f2Fillers <= 6; f2Fillers++) {
        const f2Frame2 = f2Start + 1 + f2Fillers;
        const f2Frame3 = f2Frame2 + 1;

        if (f2Frame3 >= entries.length) break;

        if (!isValidSubsequentTriplet(entries, f2Start, f2Frame2, f2Frame3, keywordData, 2)) {
          continue;
        }

        // Check for time overlap with T1
        const triplet2Entries = entries.slice(f2Start, f2Frame3 + 1);
        if (hasTimeOverlap(triplet2Entries, [triplet1Entries])) {
          continue;
        }

        const searchStart3 = f2Frame3 + 1;
        const searchEnd3 = Math.min(searchStart3 + MAX_SEARCH_WINDOW, entries.length - 2);

        // Find third triplets
        for (let f3Start = searchStart3; f3Start < searchEnd3; f3Start++) {
          if (f3Start + 2 >= entries.length) break;

          for (let f3Fillers = 0; f3Fillers <= 6; f3Fillers++) {
            const f3Frame2 = f3Start + 1 + f3Fillers;
            const f3Frame3 = f3Frame2 + 1;

            if (f3Frame3 >= entries.length) break;

            if (!isValidSubsequentTriplet(entries, f3Start, f3Frame2, f3Frame3, keywordData, 3)) {
              continue;
            }

            // Check for time overlap with T1 and T2
            const triplet3Entries = entries.slice(f3Start, f3Frame3 + 1);
            if (hasTimeOverlap(triplet3Entries, [triplet1Entries, triplet2Entries])) {
              continue;
            }

            // Found valid sequence!
            const triplet1: Triplet = {
              allEntries: entries.slice(t1.f1Start, t1.f1Frame3 + 1),
              frame1: entries[t1.f1Start],
              frame2: entries[t1.f1Frame2],
              frame3: entries[t1.f1Frame3],
              keyword: t1.keyword,
            };

            const triplet2: Triplet = {
              allEntries: entries.slice(f2Start, f2Frame3 + 1),
              frame1: entries[f2Start],
              frame2: entries[f2Frame2],
              frame3: entries[f2Frame3],
              keyword: t1.keyword,
            };

            const triplet3: Triplet = {
              allEntries: entries.slice(f3Start, f3Frame3 + 1),
              frame1: entries[f3Start],
              frame2: entries[f3Frame2],
              frame3: entries[f3Frame3],
              keyword: t1.keyword,
            };

            results.push([triplet1, triplet2, triplet3]);

            // Update count and check limit
            keywordResultCounts.set(t1.keyword, (keywordResultCounts.get(t1.keyword) || 0) + 1);
            if (keywordResultCounts.get(t1.keyword)! >= MAX_RESULTS_PER_KEYWORD) {
              break; // Stop searching for this keyword
            }
          }
          if (keywordResultCounts.get(t1.keyword)! >= MAX_RESULTS_PER_KEYWORD) break;
        }
        if (keywordResultCounts.get(t1.keyword)! >= MAX_RESULTS_PER_KEYWORD) break;
      }
      if (keywordResultCounts.get(t1.keyword)! >= MAX_RESULTS_PER_KEYWORD) break;
    }
  }

  console.log(`  Found ${results.length} total sequences before deduplication`);
  return results;
}

// Deduplication helpers
function parseTimeToSeconds(timeStr: string): number {
  // Parse "HH:MM:SS,mmm" format
  const [timePart, millisPart] = timeStr.split(',');
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  const milliseconds = parseInt(millisPart, 10);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function getSequenceTimeDelta(sequence: Triplet[]): number {
  // Time from start of T1 F1 to end of T3 F3
  const t1f1Start = parseTimeToSeconds(sequence[0].frame1.startTime);
  const t3f3End = parseTimeToSeconds(sequence[2].frame3.endTime);

  return t3f3End - t1f1Start;
}

function getLastWordLower(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return '';
  const lastWord = words[words.length - 1];
  return lastWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
}

function findClosestToTarget(sequences: Triplet[][], target: number): Triplet[] {
  let closest = sequences[0];
  let closestDiff = Math.abs(getSequenceTimeDelta(sequences[0]) - target);

  for (const seq of sequences) {
    const diff = Math.abs(getSequenceTimeDelta(seq) - target);
    if (diff < closestDiff) {
      closest = seq;
      closestDiff = diff;
    }
  }

  return closest;
}

function selectRandomOthers(group: Triplet[][], alreadySelected: Set<Triplet[]>, count: number): Triplet[][] {
  // Get sequences not already selected
  const available = group.filter(seq => !alreadySelected.has(seq));

  if (available.length === 0) return [];

  // Shuffle available sequences (Fisher-Yates)
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return up to 'count' random sequences
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get time range for a triplet sequence (T1 F1 start → T3 F3 end)
 */
function getSequenceTimeRange(sequence: Triplet[]): TimeRange {
  const startSeconds = parseTimeToSeconds(sequence[0].frame1.startTime);
  const endSeconds = parseTimeToSeconds(sequence[2].frame3.endTime);

  return {
    startSeconds,
    endSeconds,
    duration: endSeconds - startSeconds
  };
}

/**
 * Calculate temporal overlap between two time ranges
 * Returns percentage overlap relative to the smaller range (0.0 = no overlap, 1.0+ = significant overlap)
 */
function calculateOverlap(range1: TimeRange, range2: TimeRange): number {
  const overlapStart = Math.max(range1.startSeconds, range2.startSeconds);
  const overlapEnd = Math.min(range1.endSeconds, range2.endSeconds);
  const overlapDuration = Math.max(0, overlapEnd - overlapStart);

  // Return overlap as percentage of smaller range
  const minDuration = Math.min(range1.duration, range2.duration);
  return minDuration > 0 ? overlapDuration / minDuration : 0;
}

/**
 * Calculate quality score for a triplet sequence
 * Higher score = better quality (more interesting, appropriate length, more content)
 */
function calculateQualityScore(sequence: Triplet[]): number {
  let score = 0;

  // 1. Duration preference (prefer 8-15 second sequences)
  const duration = getSequenceTimeDelta(sequence);
  const idealDuration = 12; // seconds
  const durationDeviation = Math.abs(duration - idealDuration);
  score += Math.max(0, 10 - durationDeviation); // 0-10 points

  // 2. Keyword rarity (less common = more interesting)
  const keyword = sequence[0].keyword;
  const wordFreq = scoreWordByFrequency(keyword);
  score += (1 - wordFreq) * 5; // 0-5 points (rare words score higher)

  // 3. Dialogue density (more alpha chars = more content)
  const totalAlphaChars = sequence.reduce((sum, triplet) =>
    sum + triplet.allEntries.reduce((s, e) =>
      s + e.text.replace(/[^a-zA-Z]/g, '').length, 0), 0);
  score += Math.min(totalAlphaChars / 100, 5); // 0-5 points (capped)

  return score; // 0-20 range
}

/**
 * Greedy selection algorithm with PRIMARY priority on keyword uniqueness
 * and SECONDARY priority on minimal temporal overlap
 *
 * Guarantees: Each selected sequence has a UNIQUE keyword (no duplicates!)
 * Then: Minimizes temporal overlap among selected sequences
 */
function selectSequencesWithMinimalOverlap(sequences: Triplet[][]): Triplet[][] {
  if (sequences.length === 0) return [];

  console.log(`\n  Greedy selection with keyword uniqueness + overlap minimization:`);
  console.log(`    Input: ${sequences.length} sequences`);

  // Group sequences by keyword
  const keywordGroups = new Map<string, Triplet[][]>();
  for (const seq of sequences) {
    const keyword = getLastWordLower(seq[0].frame3.text);
    if (!keywordGroups.has(keyword)) {
      keywordGroups.set(keyword, []);
    }
    keywordGroups.get(keyword)!.push(seq);
  }

  console.log(`    Unique keywords: ${keywordGroups.size}`);

  // Calculate metadata for all sequences
  const candidatesByKeyword = new Map<string, Array<{
    sequence: Triplet[][];
    timeRange: TimeRange;
    qualityScore: number;
    keyword: string;
  }>>();

  for (const [keyword, seqs] of keywordGroups.entries()) {
    const candidates = seqs.map(seq => ({
      sequence: seq,
      timeRange: getSequenceTimeRange(seq),
      qualityScore: calculateQualityScore(seq),
      keyword
    }));
    // Sort by quality (best first) within each keyword group
    candidates.sort((a, b) => b.qualityScore - a.qualityScore);
    candidatesByKeyword.set(keyword, candidates);
  }

  const selected: Array<{
    sequence: Triplet[][];
    timeRange: TimeRange;
    qualityScore: number;
    keyword: string;
  }> = [];

  // Greedy selection: pick one sequence per keyword
  while (selected.length < TARGET_N && candidatesByKeyword.size > 0) {
    let bestKeyword: string | null = null;
    let bestCandidate: typeof selected[0] | null = null;
    let bestScore = -Infinity;
    let bestOverlap = 0;

    // For each remaining keyword, consider its best sequence
    for (const [keyword, candidates] of candidatesByKeyword.entries()) {
      const candidate = candidates[0]; // Best quality sequence for this keyword

      // Calculate total overlap with all selected sequences
      let totalOverlapPercent = 0;
      for (const selectedSeq of selected) {
        const overlap = calculateOverlap(candidate.timeRange, selectedSeq.timeRange);
        totalOverlapPercent += overlap;
      }

      // Combined score: quality bonus - overlap penalty
      const score = (candidate.qualityScore * QUALITY_WEIGHT)
                    - (totalOverlapPercent * OVERLAP_PENALTY_WEIGHT);

      if (score > bestScore) {
        bestScore = score;
        bestKeyword = keyword;
        bestCandidate = candidate;
        bestOverlap = totalOverlapPercent;
      }
    }

    if (bestCandidate && bestKeyword) {
      selected.push(bestCandidate);
      candidatesByKeyword.delete(bestKeyword); // Remove this keyword group

      const avgOverlap = selected.length > 1 ? (bestOverlap / (selected.length - 1)) * 100 : 0;
      console.log(`    ${selected.length}. "${bestCandidate.keyword}" (quality: ${bestCandidate.qualityScore.toFixed(1)}, duration: ${bestCandidate.timeRange.duration.toFixed(1)}s, avg overlap: ${avgOverlap.toFixed(1)}%)`);
    } else {
      break; // No more keywords available
    }
  }

  console.log(`    Selected ${selected.length} sequences (${selected.length} unique keywords, minimized overlap)`);

  return selected.map(c => c.sequence);
}

function deduplicateByFirstTripletFrame3LastWord(sequences: Triplet[][]): Triplet[][] {
  const grouped = new Map<string, Triplet[][]>();

  // Group by keyword
  for (const sequence of sequences) {
    const triplet1 = sequence[0];
    const lastWord = getLastWordLower(triplet1.frame3.text);

    if (!grouped.has(lastWord)) {
      grouped.set(lastWord, []);
    }
    grouped.get(lastWord)!.push(sequence);
  }

  const numKeywords = grouped.size;
  console.log(`\n  Deduplication strategy for ${numKeywords} keywords:`);

  const selected: Triplet[][] = [];

  if (numKeywords >= TARGET_N) {
    // Strategy 1: Keep MEDIAN time delta for each keyword
    console.log(`    Strategy: Keep MEDIAN time delta for each keyword`);

    for (const [keyword, group] of grouped.entries()) {
      if (group.length === 1) {
        selected.push(group[0]);
      } else {
        const deltas = group.map(getSequenceTimeDelta).sort((a, b) => a - b);
        const median = deltas[Math.floor(deltas.length / 2)];
        const medianSeq = findClosestToTarget(group, median);
        selected.push(medianSeq);
        console.log(`      ${keyword}: ${group.length} sequences → kept median (${getSequenceTimeDelta(medianSeq).toFixed(1)}s)`);
      }
    }
  } else if (numKeywords <= TARGET_N_THIRD) {
    // Strategy 2: Keep MEDIAN time delta + 2 random others for each keyword
    console.log(`    Strategy: Keep MEDIAN + 2 random others for each keyword`);

    for (const [keyword, group] of grouped.entries()) {
      if (group.length === 1) {
        selected.push(group[0]);
      } else {
        const deltas = group.map(getSequenceTimeDelta).sort((a, b) => a - b);
        const median = deltas[Math.floor(deltas.length / 2)];
        const medianSeq = findClosestToTarget(group, median);

        // Start with median
        const selectedForKeyword = new Set<Triplet[]>([medianSeq]);

        // Add 2 random others (if available)
        const randomOthers = selectRandomOthers(group, selectedForKeyword, 2);
        randomOthers.forEach(seq => selectedForKeyword.add(seq));

        selected.push(...selectedForKeyword);
        console.log(`      ${keyword}: ${group.length} sequences → kept ${selectedForKeyword.size} (median + ${randomOthers.length} random)`);
      }
    }
  } else {
    // Strategy 3: Keep MEDIAN + 2 random others for each keyword, then randomly cap at TARGET_N
    console.log(`    Strategy: Keep MEDIAN + 2 random others for each keyword, then cap at ${TARGET_N}`);

    for (const [keyword, group] of grouped.entries()) {
      if (group.length === 1) {
        selected.push(group[0]);
      } else {
        const deltas = group.map(getSequenceTimeDelta).sort((a, b) => a - b);
        const median = deltas[Math.floor(deltas.length / 2)];
        const medianSeq = findClosestToTarget(group, median);

        // Start with median
        const selectedForKeyword = new Set<Triplet[]>([medianSeq]);

        // Add 2 random others (if available)
        const randomOthers = selectRandomOthers(group, selectedForKeyword, 2);
        randomOthers.forEach(seq => selectedForKeyword.add(seq));

        selected.push(...selectedForKeyword);
      }
    }

    // Randomly remove until we have at most TARGET_N
    if (selected.length > TARGET_N) {
      console.log(`    Randomly reducing ${selected.length} sequences to ${TARGET_N}...`);
      while (selected.length > TARGET_N) {
        const randomIndex = Math.floor(Math.random() * selected.length);
        selected.splice(randomIndex, 1);
      }
    }
  }

  console.log(`    Final: ${selected.length} sequences selected`);
  return selected;
}

/**
 * Main entry point - optimized version
 */
export async function findAllTripletsOptimized(srtContent: string): Promise<Triplet[][]> {
  // Strip all HTML tags from the SRT content FIRST
  // This ensures triplet files written later will have clean text
  const cleanSrtContent = stripHtmlFromSrt(srtContent);

  const entries = parseSRT(cleanSrtContent);
  console.log(`Parsed ${entries.length} SRT entries`);

  const results = await findTripletsOptimized(entries);
  console.log(`Found ${results.length} raw triplet sequences`);

  // Use greedy selection with overlap minimization
  const selected = selectSequencesWithMinimalOverlap(results);
  console.log(`After selection: ${selected.length} sequences`);

  return selected;
}
