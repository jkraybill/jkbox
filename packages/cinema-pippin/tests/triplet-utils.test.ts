import { describe, it, expect } from 'vitest';
import {
  transformToKeyword,
  endsWithPunctuation,
  endsWithStrongPunctuation,
  endsWithQuestionMark,
  getDurationSeconds,
  isSingleWordWithPunctuation,
  extractWordFromSingleWord,
  containsWordAsStandalone,
  countWords,
  isExcludedWord,
  extractLastWord,
  extractFirstWord,
  hasNonAlphaBeforeLastWord,
  isValidT1Frame3,
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

describe('endsWithStrongPunctuation', () => {
  it('should return true for strong punctuation marks (period, exclamation, question)', () => {
    expect(endsWithStrongPunctuation('Hello.')).toBe(true);
    expect(endsWithStrongPunctuation('Hello!')).toBe(true);
    expect(endsWithStrongPunctuation('Hello?')).toBe(true);
  });

  it('should return false for semicolon, comma, colon, and dash', () => {
    expect(endsWithStrongPunctuation('Hello;')).toBe(false);
    expect(endsWithStrongPunctuation('Hello,')).toBe(false);
    expect(endsWithStrongPunctuation('Hello:')).toBe(false);
    expect(endsWithStrongPunctuation('Hello-')).toBe(false);
  });

  it('should return false for no punctuation', () => {
    expect(endsWithStrongPunctuation('Hello')).toBe(false);
  });

  it('should check last character of multiline text', () => {
    expect(endsWithStrongPunctuation('Line 1\nLine 2.')).toBe(true);
    expect(endsWithStrongPunctuation('Line 1\nLine 2;')).toBe(false);
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

    const duration = getDurationSeconds(entry1, entry3);
    expect(duration).toBe(15); // floor(15.0)
  });

  it('should floor fractional seconds', () => {
    const entry1: SRTEntry = {
      index: 1,
      startTime: '00:00:00,200',
      endTime: '00:00:05,000',
      text: 'Text',
      rawText: ['Text'],
    };

    const entry3: SRTEntry = {
      index: 3,
      startTime: '00:00:10,000',
      endTime: '00:00:15,800',
      text: 'Text',
      rawText: ['Text'],
    };

    const duration = getDurationSeconds(entry1, entry3);
    expect(duration).toBe(15); // floor(15.6)
  });
});

describe('isSingleWordWithPunctuation', () => {
  it('should return true for single word with period', () => {
    expect(isSingleWordWithPunctuation('Hello.')).toBe(true);
  });

  it('should return true for single word with exclamation', () => {
    expect(isSingleWordWithPunctuation('Wow!')).toBe(true);
  });

  it('should return true for single word with question mark', () => {
    expect(isSingleWordWithPunctuation('Really?')).toBe(true);
  });

  it('should return true for single word with hyphen', () => {
    expect(isSingleWordWithPunctuation('Stop-')).toBe(true);
  });

  it('should return true for single word with semicolon', () => {
    expect(isSingleWordWithPunctuation('Wait;')).toBe(true);
  });

  it('should return false for single word without punctuation', () => {
    expect(isSingleWordWithPunctuation('Hello')).toBe(false);
  });

  it('should return false for multiple words', () => {
    expect(isSingleWordWithPunctuation('Hello World.')).toBe(false);
    expect(isSingleWordWithPunctuation('Two words!')).toBe(false);
  });

  it('should return false for word with multiple punctuation marks', () => {
    expect(isSingleWordWithPunctuation('Hello!!')).toBe(false);
    expect(isSingleWordWithPunctuation('What?!')).toBe(false);
  });

  it('should handle apostrophes in words', () => {
    expect(isSingleWordWithPunctuation("Don't.")).toBe(true);
    expect(isSingleWordWithPunctuation("It's!")).toBe(true);
  });
});

describe('extractWordFromSingleWord', () => {
  it('should extract word and lowercase', () => {
    expect(extractWordFromSingleWord('Hello.')).toBe('hello');
    expect(extractWordFromSingleWord('WORLD!')).toBe('world');
  });

  it('should handle all punctuation types', () => {
    expect(extractWordFromSingleWord('Stop.')).toBe('stop');
    expect(extractWordFromSingleWord('Go!')).toBe('go');
    expect(extractWordFromSingleWord('Really?')).toBe('really');
    expect(extractWordFromSingleWord('Wait-')).toBe('wait');
    expect(extractWordFromSingleWord('Okay;')).toBe('okay');
  });

  it('should handle apostrophes', () => {
    expect(extractWordFromSingleWord("Don't.")).toBe("don't");
    expect(extractWordFromSingleWord("It's!")).toBe("it's");
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

  it('should handle empty string', () => {
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

describe('extractLastWord', () => {
  it('should extract last word from single word', () => {
    expect(extractLastWord('Banana.')).toBe('banana');
    expect(extractLastWord('Word!')).toBe('word');
  });

  it('should extract last word from multi-word text', () => {
    expect(extractLastWord('A big banana.')).toBe('banana');
    expect(extractLastWord('What a day!')).toBe('day');
  });

  it('should remove trailing punctuation', () => {
    expect(extractLastWord('...a banana.')).toBe('banana');
    expect(extractLastWord('Go home!')).toBe('home');
    expect(extractLastWord('Really?')).toBe('really');
  });

  it('should lowercase the result', () => {
    expect(extractLastWord('BANANA.')).toBe('banana');
    expect(extractLastWord('Big WORD!')).toBe('word');
  });

  it('should handle empty string', () => {
    expect(extractLastWord('')).toBe('');
  });
});

describe('extractFirstWord', () => {
  it('should extract first word from single word', () => {
    expect(extractFirstWord('Banana.')).toBe('banana');
    expect(extractFirstWord('Word!')).toBe('word');
  });

  it('should extract first word from multi-word text', () => {
    expect(extractFirstWord('A big banana.')).toBe('a');
    expect(extractFirstWord('What a day!')).toBe('what');
  });

  it('should remove trailing punctuation from first word', () => {
    expect(extractFirstWord('Hello, world!')).toBe('hello');
    expect(extractFirstWord('Stop! Go!')).toBe('stop');
  });

  it('should lowercase the result', () => {
    expect(extractFirstWord('BANANA word')).toBe('banana');
    expect(extractFirstWord('BIG word!')).toBe('big');
  });

  it('should handle empty string', () => {
    expect(extractFirstWord('')).toBe('');
  });
});

describe('hasNonAlphaBeforeLastWord', () => {
  it('should return true for dash separator with space', () => {
    expect(hasNonAlphaBeforeLastWord('A -- BANANA')).toBe(true);
    expect(hasNonAlphaBeforeLastWord('word - word')).toBe(true);
  });

  it('should return true for period separator with space', () => {
    expect(hasNonAlphaBeforeLastWord('A ... BANANA')).toBe(true);
    expect(hasNonAlphaBeforeLastWord('word. banana')).toBe(true);
  });

  it('should return true for colon separator', () => {
    expect(hasNonAlphaBeforeLastWord('A: BANANA')).toBe(true);
    expect(hasNonAlphaBeforeLastWord('thing: word')).toBe(true);
  });

  it('should return false for space-only separator', () => {
    expect(hasNonAlphaBeforeLastWord('A BANANA')).toBe(false);
    expect(hasNonAlphaBeforeLastWord('two words')).toBe(false);
  });

  it('should return false for comma separator (excluded)', () => {
    expect(hasNonAlphaBeforeLastWord('A, BANANA')).toBe(false);
    expect(hasNonAlphaBeforeLastWord('word, word')).toBe(false);
  });

  it('should return false for single word (no whitespace)', () => {
    expect(hasNonAlphaBeforeLastWord('BANANA')).toBe(false);
    expect(hasNonAlphaBeforeLastWord('word')).toBe(false);
    expect(hasNonAlphaBeforeLastWord('A--BANANA')).toBe(false); // No whitespace = single "word"
    expect(hasNonAlphaBeforeLastWord('word-word')).toBe(false); // No whitespace = single "word"
  });

  it('should return true for mixed punctuation with space', () => {
    expect(hasNonAlphaBeforeLastWord('A !? BANANA')).toBe(true);
    expect(hasNonAlphaBeforeLastWord('word ... thing')).toBe(true);
  });

  it('should return false when punctuation comes before second-last word', () => {
    expect(hasNonAlphaBeforeLastWord('...A BANANA')).toBe(false); // period before "A", not between "A" and "BANANA"
  });
});

describe('isValidT1Frame3', () => {
  it('should accept any text with at least one word', () => {
    // Single words (with or without punctuation)
    expect(isValidT1Frame3('BANANA.')).toBe(true);
    expect(isValidT1Frame3('BANANA')).toBe(true);
    expect(isValidT1Frame3('BANANA!')).toBe(true);
    expect(isValidT1Frame3('BANANA?')).toBe(true);
    expect(isValidT1Frame3('BANANA"')).toBe(true);
    expect(isValidT1Frame3("BANANA'")).toBe(true);
    expect(isValidT1Frame3('BANANA-')).toBe(true);
    expect(isValidT1Frame3('BANANA;')).toBe(true);
    expect(isValidT1Frame3('BANANA:')).toBe(true);

    // Multiple words (any separators, any punctuation)
    expect(isValidT1Frame3('A BANANA.')).toBe(true);
    expect(isValidT1Frame3('two words.')).toBe(true);
    expect(isValidT1Frame3('A, BANANA.')).toBe(true);
    expect(isValidT1Frame3('A -- BANANA.')).toBe(true);
    expect(isValidT1Frame3('word ... thing.')).toBe(true);
    expect(isValidT1Frame3('A: BANANA!')).toBe(true);
    expect(isValidT1Frame3('the big -- BANANA.')).toBe(true);
    expect(isValidT1Frame3('some ... word!')).toBe(true);
    expect(isValidT1Frame3('...the big BANANA.')).toBe(true);
    expect(isValidT1Frame3('the...big BANANA.')).toBe(true);
    expect(isValidT1Frame3('A -- BANANA"')).toBe(true);
    expect(isValidT1Frame3("word ... thing'")).toBe(true);

    // Single word sequences with no whitespace (still valid)
    expect(isValidT1Frame3('A--BANANA.')).toBe(true);
    expect(isValidT1Frame3('word...thing.')).toBe(true);
  });

  it('should reject empty text', () => {
    expect(isValidT1Frame3('')).toBe(false);
    expect(isValidT1Frame3('   ')).toBe(false); // Only whitespace
    expect(isValidT1Frame3('\t\n')).toBe(false); // Only whitespace
  });
});
