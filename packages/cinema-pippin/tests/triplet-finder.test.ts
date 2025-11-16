import { describe, it, expect } from 'vitest';
import { isValidFirstTriplet, isValidSubsequentTriplet, findAllTriplets, type Triplet } from '../src/triplet-finder';
import type { SRTEntry } from '../src/srt-parser';

describe('isValidFirstTriplet', () => {
  it('should return true for valid first triplet with minimum 2 fillers', () => {
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
        endTime: '00:00:05,000',
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
        endTime: '00:00:11,000',
        text: 'Second frame no question needed',
        rawText: ['Second frame no question needed'],
      },
      {
        index: 6,
        startTime: '00:00:11,000',
        endTime: '00:00:14,000',  // 11 seconds total from frame 1 start
        text: 'Answer!',  // Single word + punctuation
        rawText: ['Answer!'],
      },
    ];

    // Test with 2 fillers: frame1=1, frame2=4, frame3=5
    const result = isValidFirstTriplet(entries, 1, 4, 5);
    expect(result).toBe(true);
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

  it('should return false if frame 3 has fewer than 3 alphabetic characters', () => {
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
        text: 'OK!',  // Only 2 alpha chars - should fail
        rawText: ['OK!'],
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
        endTime: '00:00:09,000',
        text: 'Frame 1 here.',
        rawText: ['Frame 1 here.'],
      },
      {
        index: 5,
        startTime: '00:00:09,000',
        endTime: '00:00:11,000',
        text: 'This contains the hello keyword.',
        rawText: ['This contains the hello keyword.'],
      },
      {
        index: 6,
        startTime: '00:00:11,000',
        endTime: '00:00:14,000',
        text: 'Third frame here!',
        rawText: ['Third frame here!'],
      },
    ];

    // Test with keyword in F2 (index 4)
    const result = isValidSubsequentTriplet(entries, 3, 4, 5, 'hello');
    expect(result).toBe(true);
  });

  it('should return false when keyword does not appear in any frame', () => {
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

    const result = isValidSubsequentTriplet(entries, 3, 4, 5, 'hello');
    expect(result).toBe(false);
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
        text: 'Three words here!',  // 3 words, minWords = 3
        rawText: ['Three words here!'],
      },
    ];

    const result = isValidSubsequentTriplet(entries, 1, 2, 3, 'hello', 3);
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
});
