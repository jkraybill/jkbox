import { describe, it, expect } from 'vitest';
import {
  extractLastWordFromText,
  replaceKeywordWithBlank,
  replaceKeywordWithWord,
  replaceKeywordWithBrackets,
} from '../src/keyword-utils.js';

describe('Possessive Keyword Integration (End-to-End)', () => {
  it('should handle possessive keyword extraction and replacement flow', () => {
    // Simulating T1 Frame 3 ending with possessive
    const t1Frame3Text = 'It was your father\'s.';

    // STEP 1: Extract keyword from T1 F3
    const keyword = extractLastWordFromText(t1Frame3Text);
    expect(keyword).toBe('father');

    // STEP 2: Create T1 question (blank the keyword but preserve possessive)
    const t1Question = replaceKeywordWithBlank(t1Frame3Text, keyword);
    expect(t1Question).toBe('It was your _____\'s.');

    // STEP 3: User provides replacement word
    const userAnswer = 'poopy';

    // STEP 4: In T2/T3, replace keyword with user's word (both regular and possessive forms)
    const t2Text = 'My father said it. I heard it from father\'s room.';
    const t2WithReplacement = replaceKeywordWithWord(t2Text, keyword, userAnswer);
    expect(t2WithReplacement).toBe('My poopy said it. I heard it from poopy\'s room.');

    // Test with capitalization preservation
    const t3Text = 'Father was here. Father\'s car is outside.';
    const t3WithReplacement = replaceKeywordWithWord(t3Text, keyword, userAnswer);
    expect(t3WithReplacement).toBe('Poopy was here. Poopy\'s car is outside.');

    // Test [keyword] replacement preserves possessives too
    const t2QuestionText = 'My father is here. From father\'s perspective.';
    const t2Question = replaceKeywordWithBrackets(t2QuestionText, keyword);
    expect(t2Question).toBe('My [keyword] is here. From [keyword]\'s perspective.');
  });

  it('should handle edge case: possessive at end with punctuation', () => {
    const text = 'Above my Father\'s!';
    const keyword = extractLastWordFromText(text);
    expect(keyword).toBe('father');

    const blanked = replaceKeywordWithBlank(text, keyword);
    expect(blanked).toBe('Above my _____\'s!');

    const replaced = replaceKeywordWithWord(text, keyword, 'mother');
    expect(replaced).toBe('Above my Mother\'s!');
  });

  it('should handle mixed case possessives throughout scenes', () => {
    const keyword = 'dog';
    const replacement = 'cat';

    const scene = 'The dog ran. DOG\'s tail wagged. This is dog\'s bone.';
    const result = replaceKeywordWithWord(scene, keyword, replacement);
    expect(result).toBe('The cat ran. CAT\'s tail wagged. This is cat\'s bone.');
  });
});
