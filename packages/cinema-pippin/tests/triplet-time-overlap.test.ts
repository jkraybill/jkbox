import { describe, it, expect } from 'vitest';
import { findAllTriplets } from '../src/triplet-finder.js';
import { findAllTripletsOptimized } from '../src/triplet-finder-optimized.js';
import { parseSRT } from '../src/srt-parser.js';

/**
 * Helper function to parse timestamp to seconds
 */
function timeToSeconds(timestamp: string): number {
  const [time, ms] = timestamp.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const milliseconds = parseInt(ms || '0', 10);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Check if two time ranges overlap
 */
function rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Validate that a triplet sequence has no time overlap between T1, T2, and T3
 */
function validateNoOverlap(tripletSequence: any[]): { hasOverlap: boolean; details: string } {
  if (tripletSequence.length !== 3) {
    return { hasOverlap: false, details: 'Not a 3-triplet sequence' };
  }

  const [t1, t2, t3] = tripletSequence;

  // Get time ranges for each triplet (from first frame start to last frame end)
  const t1Start = timeToSeconds(t1.allEntries[0].startTime);
  const t1End = timeToSeconds(t1.allEntries[t1.allEntries.length - 1].endTime);

  const t2Start = timeToSeconds(t2.allEntries[0].startTime);
  const t2End = timeToSeconds(t2.allEntries[t2.allEntries.length - 1].endTime);

  const t3Start = timeToSeconds(t3.allEntries[0].startTime);
  const t3End = timeToSeconds(t3.allEntries[t3.allEntries.length - 1].endTime);

  // Check for overlaps
  if (rangesOverlap(t1Start, t1End, t2Start, t2End)) {
    return {
      hasOverlap: true,
      details: `T1 [${t1.allEntries[0].startTime} - ${t1.allEntries[t1.allEntries.length - 1].endTime}] overlaps with T2 [${t2.allEntries[0].startTime} - ${t2.allEntries[t2.allEntries.length - 1].endTime}]`
    };
  }

  if (rangesOverlap(t1Start, t1End, t3Start, t3End)) {
    return {
      hasOverlap: true,
      details: `T1 [${t1.allEntries[0].startTime} - ${t1.allEntries[t1.allEntries.length - 1].endTime}] overlaps with T3 [${t3.allEntries[0].startTime} - ${t3.allEntries[t3.allEntries.length - 1].endTime}]`
    };
  }

  if (rangesOverlap(t2Start, t2End, t3Start, t3End)) {
    return {
      hasOverlap: true,
      details: `T2 [${t2.allEntries[0].startTime} - ${t2.allEntries[t2.allEntries.length - 1].endTime}] overlaps with T3 [${t3.allEntries[0].startTime} - ${t3.allEntries[t3.allEntries.length - 1].endTime}]`
    };
  }

  return { hasOverlap: false, details: 'No overlap detected' };
}

describe('Triplet Time Overlap Prevention', () => {
  describe('findAllTriplets (standard)', () => {
    it('should not produce overlapping triplets in sequence', () => {
      // Create SRT content with frames that could potentially overlap
      const srt = `1
00:00:01,000 --> 00:00:03,000
This is frame one.

2
00:00:03,000 --> 00:00:05,000
What about bananas?

3
00:00:05,000 --> 00:00:07,000
I love bananas.

4
00:00:08,000 --> 00:00:10,000
bananas are yellow.

5
00:00:10,000 --> 00:00:12,000
They are tasty.

6
00:00:12,000 --> 00:00:14,000
Do you like bananas?

7
00:00:15,000 --> 00:00:17,000
bananas are great.

8
00:00:17,000 --> 00:00:19,000
I eat them daily.

9
00:00:19,000 --> 00:00:21,000
What a wonderful fruit!`;

      const results = findAllTriplets(srt);

      // Check each triplet sequence
      for (const sequence of results) {
        const validation = validateNoOverlap(sequence);
        expect(validation.hasOverlap).toBe(false);
        if (validation.hasOverlap) {
          console.error('Overlap detected:', validation.details);
        }
      }
    });

    it('should handle edge case where frame indices are adjacent but times overlap', () => {
      // Create a scenario where frame N+1 starts before frame N ends
      const srt = `1
00:00:01,000 --> 00:00:05,000
Previous context here.

2
00:00:03,000 --> 00:00:06,000
What is this?

3
00:00:06,000 --> 00:00:08,000
This is great stuff.

4
00:00:07,000 --> 00:00:10,000
stuff is amazing.

5
00:00:10,000 --> 00:00:12,000
I really think so.

6
00:00:12,000 --> 00:00:14,000
Do you like stuff?

7
00:00:13,000 --> 00:00:16,000
stuff is wonderful.

8
00:00:16,000 --> 00:00:18,000
I agree completely.

9
00:00:18,000 --> 00:00:20,000
This is truly amazing!`;

      const results = findAllTriplets(srt);

      // Validate no overlap
      for (const sequence of results) {
        const validation = validateNoOverlap(sequence);
        expect(validation.hasOverlap).toBe(false);
        if (validation.hasOverlap) {
          console.error('Overlap detected in edge case:', validation.details);
        }
      }
    });
  });

  describe('findAllTripletsOptimized', () => {
    it('should not produce overlapping triplets in optimized search', async () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
This is a test.

2
00:00:03,000 --> 00:00:05,000
What about bananas?

3
00:00:05,000 --> 00:00:07,000
I love bananas.

4
00:00:08,000 --> 00:00:10,000
bananas are yellow.

5
00:00:10,000 --> 00:00:12,000
They are very tasty.

6
00:00:12,000 --> 00:00:14,000
Do you like bananas?

7
00:00:15,000 --> 00:00:17,000
bananas are quite great.

8
00:00:17,000 --> 00:00:19,000
I eat them every day.

9
00:00:19,000 --> 00:00:21,000
What a wonderful fruit!`;

      const results = await findAllTripletsOptimized(srt);

      // Check each triplet sequence
      for (const sequence of results) {
        const validation = validateNoOverlap(sequence);
        expect(validation.hasOverlap).toBe(false);
        if (validation.hasOverlap) {
          console.error('Overlap detected in optimized:', validation.details);
        }
      }
    });

    it('should handle time overlap edge cases in optimized search', async () => {
      const srt = `1
00:00:01,000 --> 00:00:05,000
Previous context here.

2
00:00:03,000 --> 00:00:06,000
What is this word?

3
00:00:06,000 --> 00:00:08,000
This is great stuff.

4
00:00:07,000 --> 00:00:10,000
stuff is really amazing.

5
00:00:10,000 --> 00:00:12,000
I really think so now.

6
00:00:12,000 --> 00:00:14,000
Do you like stuff?

7
00:00:13,000 --> 00:00:16,000
stuff is truly wonderful.

8
00:00:16,000 --> 00:00:18,000
I agree with that completely.

9
00:00:18,000 --> 00:00:20,000
This is truly very amazing!`;

      const results = await findAllTripletsOptimized(srt);

      // Validate no overlap
      for (const sequence of results) {
        const validation = validateNoOverlap(sequence);
        expect(validation.hasOverlap).toBe(false);
        if (validation.hasOverlap) {
          console.error('Overlap in optimized edge case:', validation.details);
        }
      }
    });
  });

  describe('Time overlap detection helper', () => {
    it('should detect overlapping ranges', () => {
      expect(rangesOverlap(0, 5, 3, 8)).toBe(true);   // Overlap at 3-5
      expect(rangesOverlap(0, 5, 5, 10)).toBe(false); // Adjacent, no overlap
      expect(rangesOverlap(0, 5, 0, 5)).toBe(true);   // Complete overlap
      expect(rangesOverlap(0, 10, 2, 8)).toBe(true);  // Contained
      expect(rangesOverlap(5, 10, 0, 4)).toBe(false); // No overlap
    });
  });
});
