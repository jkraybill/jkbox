import { describe, it, expect } from 'vitest';
import {
  transformToKeyword,
  endsWithPunctuation,
  endsWithQuestionMark,
  getDurationSeconds,
  isSingleWordWithPunctuation,
  extractWordFromSingleWord,
  containsWordAsStandalone,
  countWords,
  isExcludedWord,
  type SRTEntry,
} from '../src/triplet-utils';

describe('transformToKeyword', () => {
  it('should strip non-alpha and lowercase', () => {
    expect(transformToKeyword('No, don\'t stop.\nGo on working.')).toBe('nodontstopgoonworking');
  });

  it('should remove all punctuation and spaces', () => {
    expect(transformToKeyword('Hello, World! 123')).toBe('helloworld');
  });

  it('should handle special characters', () => {
    expect(transformToKeyword('It�s so cold.')).toBe('itssocold');
  });

  it('should handle empty string', () => {
    expect(transformToKeyword('')).toBe('');
  });

  it('should handle only punctuation', () => {
    expect(transformToKeyword('!!!')).toBe('');
  });
});

describe('endsWithPunctuation', () => {
  it('should return true for period', () => {
    expect(endsWithPunctuation('Hello.')).toBe(true);
  });

  it('should return true for exclamation', () => {
    expect(endsWithPunctuation('Hello!')).toBe(true);
  });

  it('should return true for question mark', () => {
    expect(endsWithPunctuation('Hello?')).toBe(true);
  });

  it('should return true for hyphen', () => {
    expect(endsWithPunctuation('Hello-')).toBe(true);
  });

  it('should return true for semicolon', () => {
    expect(endsWithPunctuation('Hello;')).toBe(true);
  });

  it('should return false for no punctuation', () => {
    expect(endsWithPunctuation('Hello')).toBe(false);
  });

  it('should check last character of multiline text', () => {
    expect(endsWithPunctuation('Line 1\nLine 2.')).toBe(true);
    expect(endsWithPunctuation('Line 1\nLine 2')).toBe(false);
  });
});

describe('endsWithQuestionMark', () => {
  it('should return true for question mark', () => {
    expect(endsWithQuestionMark('What?')).toBe(true);
  });

  it('should return false for other punctuation', () => {
    expect(endsWithQuestionMark('Hello.')).toBe(false);
    expect(endsWithQuestionMark('Hello!')).toBe(false);
  });

  it('should check last character of multiline text', () => {
    expect(endsWithQuestionMark('Line 1\nLine 2?')).toBe(true);
  });
});

describe('getDurationSeconds', () => {
  it('should calculate duration correctly', () => {
    const entry1: SRTEntry = {
      index: 1,
      startTime: '00:00:00,000',
      endTime: '00:00:05,000',
      text: 'Text',
      rawText: ['Text'],
    };

    const entry3: SRTEntry = {
      index: 3,
      startTime: '00:00:10,000',
      endTime: '00:00:15,000',
      text: 'Text',
      rawText: ['Text'],
    };

    expect(getDurationSeconds(entry1, entry3)).toBe(15); // 0 to 15
  });

  it('should handle milliseconds', () => {
    const entry1: SRTEntry = {
      index: 1,
      startTime: '00:00:00,500',
      endTime: '00:00:05,500',
      text: 'Text',
      rawText: ['Text'],
    };

    const entry3: SRTEntry = {
      index: 3,
      startTime: '00:00:10,500',
      endTime: '00:00:14,500',
      text: 'Text',
      rawText: ['Text'],
    };

    expect(getDurationSeconds(entry1, entry3)).toBe(14); // 0.5 to 14.5 = 14 seconds
  });

  it('should handle hours and minutes', () => {
    const entry1: SRTEntry = {
      index: 1,
      startTime: '01:02:03,000',
      endTime: '01:02:08,000',
      text: 'Text',
      rawText: ['Text'],
    };

    const entry3: SRTEntry = {
      index: 3,
      startTime: '01:02:13,000',
      endTime: '01:02:18,000',
      text: 'Text',
      rawText: ['Text'],
    };

    expect(getDurationSeconds(entry1, entry3)).toBe(15); // 3s to 18s = 15 seconds
  });
});

describe('isSingleWordWithPunctuation', () => {
  it('should return true for single word with punctuation', () => {
    expect(isSingleWordWithPunctuation('You.')).toBe(true);
    expect(isSingleWordWithPunctuation('Stop!')).toBe(true);
    expect(isSingleWordWithPunctuation('Go?')).toBe(true);
    expect(isSingleWordWithPunctuation('Wait-')).toBe(true);
    expect(isSingleWordWithPunctuation('Okay;')).toBe(true);
  });

  it('should return true for words with apostrophes', () => {
    expect(isSingleWordWithPunctuation("Don't!")).toBe(true);
    expect(isSingleWordWithPunctuation("You're?")).toBe(true);
    expect(isSingleWordWithPunctuation("It's.")).toBe(true);
  });

  it('should return false for multiple words', () => {
    expect(isSingleWordWithPunctuation('Two words.')).toBe(false);
    expect(isSingleWordWithPunctuation('You are here!')).toBe(false);
  });

  it('should return false for no punctuation', () => {
    expect(isSingleWordWithPunctuation('Word')).toBe(false);
    expect(isSingleWordWithPunctuation('Okay')).toBe(false);
  });

  it('should return false for multiple punctuation marks', () => {
    expect(isSingleWordWithPunctuation('Word!!')).toBe(false);
    expect(isSingleWordWithPunctuation('What!?')).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(isSingleWordWithPunctuation('  You.  ')).toBe(true);
    expect(isSingleWordWithPunctuation(' Stop! ')).toBe(true);
  });
});

describe('extractWordFromSingleWord', () => {
  it('should extract word without punctuation', () => {
    expect(extractWordFromSingleWord('You.')).toBe('you');
    expect(extractWordFromSingleWord('Stop!')).toBe('stop');
    expect(extractWordFromSingleWord('Go?')).toBe('go');
  });

  it('should preserve apostrophes and lowercase', () => {
    expect(extractWordFromSingleWord("Don't!")).toBe("don't");
    expect(extractWordFromSingleWord("You're?")).toBe("you're");
  });

  it('should handle whitespace', () => {
    expect(extractWordFromSingleWord('  Word.  ')).toBe('word');
  });
});

describe('containsWordAsStandalone', () => {
  it('should match word as standalone', () => {
    expect(containsWordAsStandalone('You are terrible', 'you')).toBe(true);
    expect(containsWordAsStandalone('Me or you?', 'you')).toBe(true);
    expect(containsWordAsStandalone('You.', 'you')).toBe(true);
  });

  it('should not match word as substring', () => {
    expect(containsWordAsStandalone('Yours!', 'you')).toBe(false);
    expect(containsWordAsStandalone('Youth', 'you')).toBe(false);
    expect(containsWordAsStandalone('Bayou', 'you')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(containsWordAsStandalone('YOU are here', 'you')).toBe(true);
    expect(containsWordAsStandalone('you are here', 'YOU')).toBe(true);
  });

  it('should handle apostrophes in words', () => {
    expect(containsWordAsStandalone("Don't do that", "don't")).toBe(true);
    expect(containsWordAsStandalone("You're right", "you're")).toBe(true);
  });

  it('should match at word boundaries with punctuation', () => {
    expect(containsWordAsStandalone('Stop! Go!', 'stop')).toBe(true);
    expect(containsWordAsStandalone('Stop! Go!', 'go')).toBe(true);
  });
});

describe('countWords', () => {
  it('should count words correctly', () => {
    expect(countWords('One word')).toBe(2);
    expect(countWords('Three word phrase')).toBe(3);
    expect(countWords('It\'s okay.')).toBe(2);
  });

  it('should handle single word', () => {
    expect(countWords('Word')).toBe(1);
    expect(countWords('Word.')).toBe(1);
  });

  it('should handle multiple spaces', () => {
    expect(countWords('Two   words')).toBe(2);
    expect(countWords('Multiple    spaces    here')).toBe(3);
  });

  it('should handle leading/trailing whitespace', () => {
    expect(countWords('  Two words  ')).toBe(2);
    expect(countWords('\n\tThree word phrase\t\n')).toBe(3);
  });

  it('should return 0 for empty string', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });
});

describe('isExcludedWord', () => {
  it('should return true for excluded words', () => {
    expect(isExcludedWord('the')).toBe(true);
    expect(isExcludedWord('yes')).toBe(true);
    expect(isExcludedWord('no')).toBe(true);
    expect(isExcludedWord('why')).toBe(true);
    expect(isExcludedWord('how')).toBe(true);
    expect(isExcludedWord('when')).toBe(true);
    expect(isExcludedWord('where')).toBe(true);
    expect(isExcludedWord('me')).toBe(true);
    expect(isExcludedWord('i')).toBe(true);
    expect(isExcludedWord('you')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isExcludedWord('THE')).toBe(true);
    expect(isExcludedWord('Yes')).toBe(true);
    expect(isExcludedWord('NO')).toBe(true);
    expect(isExcludedWord('Why')).toBe(true);
  });

  it('should return false for non-excluded words', () => {
    expect(isExcludedWord('hello')).toBe(false);
    expect(isExcludedWord('world')).toBe(false);
    expect(isExcludedWord('sada')).toBe(false);
    expect(isExcludedWord('answer')).toBe(false);
  });
});
