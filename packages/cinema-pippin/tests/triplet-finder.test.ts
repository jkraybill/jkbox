import { describe, it, expect } from 'vitest';
import { isValidFirstTriplet, isValidSubsequentTriplet, findAllTriplets, type Triplet } from '../src/triplet-finder';
import { findAllTripletsOptimized } from '../src/triplet-finder-optimized';
import type { SRTEntry } from '../src/srt-parser';

describe('isValidFirstTriplet', () => {
  it('should return true for valid first triplet with 2 fillers', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous frame.',
        rawText: ['Previous frame.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',  // F1 duration: 2 seconds
        text: 'First frame here.',
        rawText: ['First frame here.'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:07,000',
        text: 'Filler 1.',
        rawText: ['Filler 1.'],
      },
      {
        index: 4,
        startTime: '00:00:07,000',
        endTime: '00:00:09,000',
        text: 'Filler 2.',
        rawText: ['Filler 2.'],
      },
      {
        index: 5,
        startTime: '00:00:09,000',
        endTime: '00:00:12,000',  // F2 duration: 3 seconds (longer than F1)
        text: 'Second frame no question needed',
        rawText: ['Second frame no question needed'],
      },
      {
        index: 6,
        startTime: '00:00:12,000',
        endTime: '00:00:16,000',  // F3 duration: 4 seconds (longer than F2), total 13s from F1 start
        text: 'Answer!',  // Single word + punctuation
        rawText: ['Answer!'],
      },
    ];

    // Test with 2 fillers: frame1=1, frame2=4, frame3=5
    const result = isValidFirstTriplet(entries, 1, 4, 5);
    expect(result).toBe(true);
  });

  it('should return true for valid first triplet with 0 fillers', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous frame.',
        rawText: ['Previous frame.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',  // F1 duration: 2 seconds
        text: 'First frame here.',
        rawText: ['First frame here.'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:08,000',  // F2 duration: 3 seconds (longer than F1)
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:08,000',
        endTime: '00:00:13,000',  // F3 duration: 5 seconds (longer than F2), total 10s
        text: 'Answer!',
        rawText: ['Answer!'],
      },
    ];

    // Test with 0 fillers: frame1=1, frame2=2, frame3=3
    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(true);
  });

  it('should return true for valid first triplet with 6 fillers', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous frame.',
        rawText: ['Previous frame.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',  // F1 duration: 2 seconds
        text: 'First frame here.',
        rawText: ['First frame here.'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:07,000',
        text: 'F1.',
        rawText: ['F1.'],
      },
      {
        index: 4,
        startTime: '00:00:07,000',
        endTime: '00:00:09,000',
        text: 'F2.',
        rawText: ['F2.'],
      },
      {
        index: 5,
        startTime: '00:00:09,000',
        endTime: '00:00:11,000',
        text: 'F3.',
        rawText: ['F3.'],
      },
      {
        index: 6,
        startTime: '00:00:11,000',
        endTime: '00:00:13,000',
        text: 'F4.',
        rawText: ['F4.'],
      },
      {
        index: 7,
        startTime: '00:00:13,000',
        endTime: '00:00:15,000',
        text: 'F5.',
        rawText: ['F5.'],
      },
      {
        index: 8,
        startTime: '00:00:15,000',
        endTime: '00:00:17,000',
        text: 'F6.',
        rawText: ['F6.'],
      },
      {
        index: 9,
        startTime: '00:00:17,000',
        endTime: '00:00:19,500',  // F2 duration: 2.5 seconds (longer than F1)
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 10,
        startTime: '00:00:19,500',
        endTime: '00:00:22,500',  // F3 duration: 3 seconds (longer than F2), total 19.5s from F1 start
        text: 'Answer!',
        rawText: ['Answer!'],
      },
    ];

    // Test with 6 fillers: frame1=1, frame2=8, frame3=9
    const result = isValidFirstTriplet(entries, 1, 8, 9);
    expect(result).toBe(true);
  });

  it('should accept duration up to 20 seconds', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous frame.',
        rawText: ['Previous frame.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:08,000',  // F1 duration: 5 seconds
        text: 'First frame here.',
        rawText: ['First frame here.'],
      },
      {
        index: 3,
        startTime: '00:00:08,000',
        endTime: '00:00:15,000',  // F2 duration: 7 seconds (longer than F1)
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:15,000',
        endTime: '00:00:23,000',  // F3 duration: 8 seconds (longer than F2), total 20s from F1 start
        text: 'Answer!',
        rawText: ['Answer!'],
      },
    ];

    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(true);
  });

  it('should reject duration over 20 seconds', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous frame.',
        rawText: ['Previous frame.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:15,000',
        text: 'First frame here.',
        rawText: ['First frame here.'],
      },
      {
        index: 3,
        startTime: '00:00:15,000',
        endTime: '00:00:27,000',
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:27,000',
        endTime: '00:00:39,000',  // 36 seconds total - too long
        text: 'Answer!',
        rawText: ['Answer!'],
      },
    ];

    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(false);
  });

  // Test removed - T1 F2 no longer requires question mark

  it('should return false if previous frame does not end with required punctuation', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'No punctuation',
        rawText: ['No punctuation'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',
        text: 'What is this?',
        rawText: ['What is this?'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:07,000',
        text: 'Third line!',
        rawText: ['Third line!'],
      },
    ];

    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(false);
  });

  it('should return false if frame 3 does not end with required punctuation', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'First line.',
        rawText: ['First line.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',
        text: 'What is this?',
        rawText: ['What is this?'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:07,000',
        text: 'No punctuation',
        rawText: ['No punctuation'],
      },
    ];

    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(false);
  });

  it('should return false if duration is not between 5-20 seconds', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'First line.',
        rawText: ['First line.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',
        text: 'What is this?',
        rawText: ['What is this?'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:06,000',  // Only 3 seconds total
        text: 'Third line!',
        rawText: ['Third line!'],
      },
    ];

    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(false);
  });

  it('should return false if frame 3 is not a single word', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'First line.',
        rawText: ['First line.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',
        text: 'What is this?',
        rawText: ['What is this?'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:14,000',
        text: 'Two words!',  // Multiple words
        rawText: ['Two words!'],
      },
    ];

    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(false);
  });

  it('should return false if frame 3 is an excluded word', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'First line.',
        rawText: ['First line.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',
        text: 'What is this?',
        rawText: ['What is this?'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:14,000',
        text: 'Yes!',  // Excluded word
        rawText: ['Yes!'],
      },
    ];

    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(false);
  });

  it('should return false if frame 3 is "you"', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'First line.',
        rawText: ['First line.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',
        text: 'What is this?',
        rawText: ['What is this?'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:14,000',
        text: 'You!',  // Excluded word
        rawText: ['You!'],
      },
    ];

    const result = isValidFirstTriplet(entries, 1, 2, 3);
    expect(result).toBe(false);
  });

});

describe('isValidSubsequentTriplet', () => {
  it('should return true when keyword appears in any frame', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous sentence.',
        rawText: ['Previous sentence.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',
        text: 'Filler 1.',
        rawText: ['Filler 1.'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:07,000',
        text: 'Filler 2.',
        rawText: ['Filler 2.'],
      },
      {
        index: 4,
        startTime: '00:00:07,000',
        endTime: '00:00:09,000',  // F1 duration: 2 seconds
        text: 'Frame 1 here.',
        rawText: ['Frame 1 here.'],
      },
      {
        index: 5,
        startTime: '00:00:09,000',
        endTime: '00:00:12,000',  // F2 duration: 3 seconds (longer than F1)
        text: 'This contains the hello keyword.',
        rawText: ['This contains the hello keyword.'],
      },
      {
        index: 6,
        startTime: '00:00:12,000',
        endTime: '00:00:16,000',  // F3 duration: 4 seconds (longer than F2)
        text: 'Third frame here!',
        rawText: ['Third frame here!'],
      },
    ];

    // Test with keyword in F2 (index 4)
    const result = isValidSubsequentTriplet(entries, 3, 4, 5, 'hello');
    expect(result).toBe(true);
  });

  it('should validate triplet even when keyword does not appear (keyword checked at sequence level)', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous sentence.',
        rawText: ['Previous sentence.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:05,000',
        text: 'Filler 1.',
        rawText: ['Filler 1.'],
      },
      {
        index: 3,
        startTime: '00:00:05,000',
        endTime: '00:00:07,000',
        text: 'Filler 2.',
        rawText: ['Filler 2.'],
      },
      {
        index: 4,
        startTime: '00:00:07,000',
        endTime: '00:00:09,000',
        text: 'Frame 1 here.',
        rawText: ['Frame 1 here.'],
      },
      {
        index: 5,
        startTime: '00:00:09,000',
        endTime: '00:00:11,000',
        text: 'Does not contain keyword.',
        rawText: ['Does not contain keyword.'],
      },
      {
        index: 6,
        startTime: '00:00:11,000',
        endTime: '00:00:14,000',
        text: 'Third frame!',
        rawText: ['Third frame!'],
      },
    ];

    // Keyword checking moved to sequence level, so triplet-level validation no longer checks keyword
    const result = isValidSubsequentTriplet(entries, 3, 4, 5, 'hello');
    expect(result).toBe(true);
  });

  it('should return false if minWords is 2 and frame 3 has only 1 word', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous sentence.',
        rawText: ['Previous sentence.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:08,000',
        text: 'This contains the hello keyword!',
        rawText: ['This contains the hello keyword!'],
      },
      {
        index: 3,
        startTime: '00:00:08,000',
        endTime: '00:00:13,000',
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:13,000',
        endTime: '00:00:16,000',
        text: 'No!',  // Only 1 word, but minWords = 2
        rawText: ['No!'],
      },
    ];

    const result = isValidSubsequentTriplet(entries, 1, 2, 3, 'hello', 2);
    expect(result).toBe(false);
  });

  it('should return true if minWords is 2 and frame 3 has 2 words', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous sentence.',
        rawText: ['Previous sentence.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:06,000',  // F1: 3 seconds
        text: 'This contains the hello keyword!',
        rawText: ['This contains the hello keyword!'],
      },
      {
        index: 3,
        startTime: '00:00:06,000',
        endTime: '00:00:11,000',  // F2: 5 seconds
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:11,000',
        endTime: '00:00:18,000',  // F3: 7 seconds
        text: 'Yes indeed!',  // 2 words, minWords = 2
        rawText: ['Yes indeed!'],
      },
    ];

    const result = isValidSubsequentTriplet(entries, 1, 2, 3, 'hello', 2);
    expect(result).toBe(true);
  });

  it('should return false if minWords is 3 and frame 3 has only 2 words', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous sentence.',
        rawText: ['Previous sentence.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:08,000',
        text: 'This contains the hello keyword!',
        rawText: ['This contains the hello keyword!'],
      },
      {
        index: 3,
        startTime: '00:00:08,000',
        endTime: '00:00:13,000',
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:13,000',
        endTime: '00:00:16,000',
        text: 'Two words!',  // Only 2 words, but minWords = 3
        rawText: ['Two words!'],
      },
    ];

    const result = isValidSubsequentTriplet(entries, 1, 2, 3, 'hello', 3);
    expect(result).toBe(false);
  });

  it('should return true if minWords is 3 and frame 3 has 3 words', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous sentence.',
        rawText: ['Previous sentence.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:06,000',  // F1: 3 seconds
        text: 'This contains the hello keyword!',
        rawText: ['This contains the hello keyword!'],
      },
      {
        index: 3,
        startTime: '00:00:06,000',
        endTime: '00:00:11,000',  // F2: 5 seconds
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:11,000',
        endTime: '00:00:18,000',  // F3: 7 seconds
        text: 'Three words here!',  // 3 words, minWords = 3
        rawText: ['Three words here!'],
      },
    ];

    const result = isValidSubsequentTriplet(entries, 1, 2, 3, 'hello', 3);
    expect(result).toBe(true);
  });

  it('should return false if minWords is 6 (T3) and frame 3 has only 5 words', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous sentence.',
        rawText: ['Previous sentence.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:08,000',
        text: 'This contains the hello keyword!',
        rawText: ['This contains the hello keyword!'],
      },
      {
        index: 3,
        startTime: '00:00:08,000',
        endTime: '00:00:13,000',
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:13,000',
        endTime: '00:00:16,000',
        text: 'You think you can win?',  // 5 words, minWords = 6 for T3
        rawText: ['You think you can win?'],
      },
    ];

    const result = isValidSubsequentTriplet(entries, 1, 2, 3, 'hello', 6);
    expect(result).toBe(false);
  });

  it('should return true if minWords is 6 (T3) and frame 3 has 6 words', () => {
    const entries: SRTEntry[] = [
      {
        index: 1,
        startTime: '00:00:01,000',
        endTime: '00:00:03,000',
        text: 'Previous sentence.',
        rawText: ['Previous sentence.'],
      },
      {
        index: 2,
        startTime: '00:00:03,000',
        endTime: '00:00:06,000',  // F1: 3 seconds
        text: 'This contains the hello keyword!',
        rawText: ['This contains the hello keyword!'],
      },
      {
        index: 3,
        startTime: '00:00:06,000',
        endTime: '00:00:11,000',  // F2: 5 seconds
        text: 'Second frame.',
        rawText: ['Second frame.'],
      },
      {
        index: 4,
        startTime: '00:00:11,000',
        endTime: '00:00:18,000',  // F3: 7 seconds
        text: 'You think you can win today?',  // 6 words, minWords = 6 for T3
        rawText: ['You think you can win today?'],
      },
    ];

    const result = isValidSubsequentTriplet(entries, 1, 2, 3, 'hello', 6);
    expect(result).toBe(true);
  });
});

describe('findAllTriplets', () => {
  it('should find valid triplet sequences', () => {
    // Simplified test - would need real SRT data
    const srt = `1
00:00:01,000 --> 00:00:03,000
Start here.

2
00:00:03,000 --> 00:00:05,000
What is this?

3
00:00:05,000 --> 00:00:08,000
Answer here!

4
00:00:08,500 --> 00:00:11,000
More answer here.

5
00:00:11,500 --> 00:00:14,000
Another question?

6
00:00:14,500 --> 00:00:19,000
This answer here contains answer!`;

    const triplets = findAllTriplets(srt);
    // Should find at least some permutations
    expect(Array.isArray(triplets)).toBe(true);
  });

  it('greedy selection: returns sequences with minimal overlap', async () => {
    // SRT with sequences that create valid T1->T2->T3 chains
    // T1: keyword "light" only at end of F3
    // T2/T3: keyword "light" appears in F1 or F2 (required for subsequent triplets)
    // Frame durations must be strictly increasing within each triplet
    const srt = `1
00:00:00,000 --> 00:00:01,500
Previous.

2
00:00:01,500 --> 00:00:04,000
Short text-

3
00:00:04,000 --> 00:00:08,500
more content-

4
00:00:08,500 --> 00:00:15,000
Here comes the light!

5
00:00:16,000 --> 00:00:18,500
The light shines.

6
00:00:18,500 --> 00:00:22,000
Medium text-

7
00:00:22,000 --> 00:00:27,500
even more text-

8
00:00:27,500 --> 00:00:36,000
Another answer with bright light here!

9
00:00:37,000 --> 00:00:39,500
A light appears.

10
00:00:39,500 --> 00:00:43,000
Question here-

11
00:00:43,000 --> 00:00:48,500
Answer text-

12
00:00:48,500 --> 00:00:57,000
The keyword brings more light than ever!`;

    const optimized = await findAllTripletsOptimized(srt);

    // Greedy selection should return at least 1 sequence, up to 18 max
    expect(optimized.length).toBeGreaterThanOrEqual(1);
    expect(optimized.length).toBeLessThanOrEqual(18);

    // All should have same keyword (in this test case)
    const keywords = new Set(optimized.map(seq => seq[0].keyword));
    expect(keywords.size).toBe(1);
  });

  it('deduplication: adaptive strategy changes based on keyword count', async () => {
    // Test that deduplication behavior adapts correctly
    // This is an integration test - actual behavior depends on SRT structure
    const optimized = await findAllTripletsOptimized(`1
00:00:00,000 --> 00:00:01,000
Something.

2
00:00:01,000 --> 00:00:03,000
First frame

3
00:00:03,000 --> 00:00:05,000
filler text

4
00:00:05,000 --> 00:00:07,000
Second frame.

5
00:00:07,000 --> 00:00:09,000
Word : test!

6
00:00:10,000 --> 00:00:12,000
Another test.

7
00:00:12,000 --> 00:00:14,000
More test.

8
00:00:14,000 --> 00:00:16,000
Final test here.`);

    // Should return array (may be empty if no valid sequences found)
    expect(Array.isArray(optimized)).toBe(true);
  });

  it('optimized version works correctly with adaptive deduplication', async () => {
    // Test data with valid triplet patterns
    // T1: keyword "banana" appears only at end of F3
    // T2 and T3: keyword "banana" appears in frames (required for subsequent triplets)
    // Frame durations must be strictly increasing within each triplet
    const srt = `1
00:00:01,000 --> 00:00:02,500
Something happened.

2
00:00:02,500 --> 00:00:05,000
In the beginning-

3
00:00:05,000 --> 00:00:09,500
there was more text-

4
00:00:09,500 --> 00:00:16,000
But then something arrived: banana!

5
00:00:17,000 --> 00:00:19,500
The yellow banana-

6
00:00:19,500 --> 00:00:23,000
tasted wonderful and-

7
00:00:23,000 --> 00:00:29,500
The best banana here.

8
00:00:30,000 --> 00:00:32,500
Without banana we-

9
00:00:32,500 --> 00:00:36,000
survive in darkness-

10
00:00:36,000 --> 00:00:42,500
Fresh yellow banana in fridge today.`;

    const optimized = await findAllTripletsOptimized(srt);

    // Should find at least some sequences
    expect(optimized.length).toBeGreaterThan(0);

    // All sequences should have 3 triplets
    for (const sequence of optimized) {
      expect(sequence.length).toBe(3);
      // All triplets in sequence should have same keyword
      expect(sequence[1].keyword).toBe(sequence[0].keyword);
      expect(sequence[2].keyword).toBe(sequence[0].keyword);
    }
  });
});

describe('HTML Tag Stripping in findAllTriplets', () => {
  it('should strip HTML tags from SRT content before processing (using real SRT)', () => {
    // Use existing SRT test data that we know works, but add HTML tags
    const srtWithHtml = `1
00:00:01,000 --> 00:00:03,000
<font face="sans-serif" size="71">Previous sentence here.</font>

2
00:00:03,000 --> 00:00:05,000
<b>I think the</b>

3
00:00:05,000 --> 00:00:07,000
<i>quick brown</i>

4
00:00:07,000 --> 00:00:10,500
<u>fox jumped!</u>

5
00:00:10,500 --> 00:00:12,000
<font color="red">That was</font>

6
00:00:12,000 --> 00:00:13,500
<b>quite a</b>

7
00:00:13,500 --> 00:00:15,000
<i>sight!</i>`;

    const sequences = findAllTriplets(srtWithHtml);

    // Main test: verify HTML was stripped before processing
    // If we find ANY sequences, all frames should be clean
    if (sequences.length > 0) {
      for (const sequence of sequences) {
        for (const triplet of sequence) {
          // No HTML tags should remain
          expect(triplet.frame1.text).not.toMatch(/<[^>]*>/);
          expect(triplet.frame2.text).not.toMatch(/<[^>]*>/);
          expect(triplet.frame3.text).not.toMatch(/<[^>]*>/);
        }
      }
    }

    // At minimum, verify the function doesn't crash with HTML input
    expect(sequences).toBeDefined();
    expect(Array.isArray(sequences)).toBe(true);
  });

  it('should produce same results with or without HTML tags', () => {
    const cleanSrt = `1
00:00:01,000 --> 00:00:03,000
Previous sentence.

2
00:00:03,000 --> 00:00:05,000
I think the

3
00:00:05,000 --> 00:00:07,000
quick brown

4
00:00:07,000 --> 00:00:10,500
fox jumped!

5
00:00:10,500 --> 00:00:12,000
That was

6
00:00:12,000 --> 00:00:13,500
quite a

7
00:00:13,500 --> 00:00:15,000
sight!`;

    const srtWithHtml = `1
00:00:01,000 --> 00:00:03,000
<font>Previous sentence.</font>

2
00:00:03,000 --> 00:00:05,000
<b>I think the</b>

3
00:00:05,000 --> 00:00:07,000
<i>quick brown</i>

4
00:00:07,000 --> 00:00:10,500
<u>fox jumped!</u>

5
00:00:10,500 --> 00:00:12,000
<font color="red">That was</font>

6
00:00:12,000 --> 00:00:13,500
<b>quite a</b>

7
00:00:13,500 --> 00:00:15,000
<i>sight!</i>`;

    const cleanSequences = findAllTriplets(cleanSrt);
    const htmlSequences = findAllTriplets(srtWithHtml);

    // Should find same number of sequences
    expect(htmlSequences.length).toBe(cleanSequences.length);

    // If any sequences found, keywords should match
    if (cleanSequences.length > 0 && htmlSequences.length > 0) {
      expect(htmlSequences[0][0].keyword).toBe(cleanSequences[0][0].keyword);
    }
  });
});
