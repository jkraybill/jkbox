import { describe, it, expect } from 'vitest';
import {
  extractLastWordFromText,
  replaceKeywordWithBlank,
  replaceKeywordWithBrackets,
  applyCasing,
  replaceKeywordWithWord,
} from '../src/keyword-utils.js';

describe('Keyword Utils', () => {
  describe('extractLastWordFromText', () => {
    it('should extract last word from simple text', () => {
      expect(extractLastWordFromText('I love bananas')).toBe('bananas');
    });

    it('should strip punctuation from last word', () => {
      expect(extractLastWordFromText('I love bananas.')).toBe('bananas');
      expect(extractLastWordFromText('I love bananas!')).toBe('bananas');
      expect(extractLastWordFromText('I love bananas?')).toBe('bananas');
    });

    it('should convert to lowercase', () => {
      expect(extractLastWordFromText('I love BANANAS')).toBe('bananas');
    });

    it('should handle empty string', () => {
      expect(extractLastWordFromText('')).toBe('');
    });

    it('should preserve hyphens', () => {
      expect(extractLastWordFromText('self-aware')).toBe('self-aware');
    });
  });

  describe('replaceKeywordWithBlank', () => {
    it('should replace keyword with _____', () => {
      expect(replaceKeywordWithBlank('I love bananas', 'bananas')).toBe('I love _____');
    });

    it('should replace keyword while preserving trailing punctuation', () => {
      expect(replaceKeywordWithBlank('I love bananas.', 'bananas')).toBe('I love _____.');
      expect(replaceKeywordWithBlank('I love bananas!', 'bananas')).toBe('I love _____!');
    });

    it('should be case-insensitive', () => {
      expect(replaceKeywordWithBlank('I love BANANAS', 'bananas')).toBe('I love _____');
      expect(replaceKeywordWithBlank('I love Bananas', 'bananas')).toBe('I love _____');
    });

    it('should only replace whole words', () => {
      expect(replaceKeywordWithBlank('I love bananas and banana bread', 'banana')).toBe(
        'I love bananas and _____ bread'
      );
    });

    it('should replace all occurrences', () => {
      expect(replaceKeywordWithBlank('Bananas are great. I love bananas.', 'bananas')).toBe(
        '_____ are great. I love _____.'
      );
    });
  });

  describe('replaceKeywordWithBrackets', () => {
    it('should replace keyword with [keyword]', () => {
      expect(replaceKeywordWithBrackets('I love bananas', 'bananas')).toBe('I love [keyword]');
    });

    it('should preserve trailing punctuation', () => {
      expect(replaceKeywordWithBrackets('I love bananas.', 'bananas')).toBe('I love [keyword].');
      expect(replaceKeywordWithBrackets('I love bananas!', 'bananas')).toBe('I love [keyword]!');
    });

    it('should be case-insensitive', () => {
      expect(replaceKeywordWithBrackets('I love BANANAS', 'bananas')).toBe('I love [keyword]');
    });

    it('should only replace whole words', () => {
      expect(replaceKeywordWithBrackets('I love bananas and banana bread', 'banana')).toBe(
        'I love bananas and [keyword] bread'
      );
    });

    it('should replace all occurrences', () => {
      expect(replaceKeywordWithBrackets('Bananas are great. I love bananas.', 'bananas')).toBe(
        '[keyword] are great. I love [keyword].'
      );
    });
  });

  describe('applyCasing', () => {
    it('should convert to all uppercase when source is all uppercase', () => {
      expect(applyCasing('MENDOZA', 'poop')).toBe('POOP');
    });

    it('should convert to title case when source is title case', () => {
      expect(applyCasing('Mendoza', 'poop')).toBe('Poop');
    });

    it('should convert to lowercase when source is lowercase', () => {
      expect(applyCasing('mendoza', 'poop')).toBe('poop');
    });

    it('should handle empty strings', () => {
      expect(applyCasing('', 'poop')).toBe('poop');
      expect(applyCasing('Test', '')).toBe('');
    });
  });

  describe('replaceKeywordWithWord', () => {
    it('should replace keyword preserving all uppercase', () => {
      expect(replaceKeywordWithWord('I like BANANAS!', 'bananas', 'apples')).toBe(
        'I like APPLES!'
      );
    });

    it('should replace keyword preserving title case', () => {
      expect(replaceKeywordWithWord('I like Bananas!', 'bananas', 'apples')).toBe(
        'I like Apples!'
      );
    });

    it('should replace keyword preserving lowercase', () => {
      expect(replaceKeywordWithWord('I like bananas!', 'bananas', 'apples')).toBe(
        'I like apples!'
      );
    });

    it('should replace multiple occurrences with different casings', () => {
      expect(
        replaceKeywordWithWord('I like BANANAS and bananas and Bananas', 'bananas', 'apples')
      ).toBe('I like APPLES and apples and Apples');
    });

    it('should only replace whole words', () => {
      expect(replaceKeywordWithWord('I love bananas and banana bread', 'banana', 'apple')).toBe(
        'I love bananas and apple bread'
      );
    });
  });
});
