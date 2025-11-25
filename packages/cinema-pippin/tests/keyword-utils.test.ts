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

    // Unicode/accented character tests (Fix #61)
    it('should extract keyword with French accents (é)', () => {
      expect(extractLastWordFromText('Haydée.')).toBe('haydée');
      expect(extractLastWordFromText('Her name is Haydée')).toBe('haydée');
    });

    it('should extract keyword with French accents (ï)', () => {
      expect(extractLastWordFromText("You think mine is really Anaïs?")).toBe('anaïs');
    });

    it('should extract keyword with Spanish accents (ñ, ó)', () => {
      expect(extractLastWordFromText('Señor.')).toBe('señor');
      expect(extractLastWordFromText('El niño')).toBe('niño');
    });

    it('should extract keyword with German umlauts (ü, ö, ä)', () => {
      expect(extractLastWordFromText('Herr Müller')).toBe('müller');
      expect(extractLastWordFromText('Königsberg')).toBe('königsberg');
    });

    it('should extract keyword with Nordic characters (å, ø)', () => {
      expect(extractLastWordFromText('København')).toBe('københavn');
    });

    it('should strip punctuation from last word', () => {
      expect(extractLastWordFromText('I love bananas.')).toBe('bananas');
      expect(extractLastWordFromText('I love bananas!')).toBe('bananas');
      expect(extractLastWordFromText('I love bananas?')).toBe('bananas');
    });

    it('should convert to lowercase', () => {
      expect(extractLastWordFromText('I love BANANAS')).toBe('bananas');
    });

    it('should throw error for empty string', () => {
      expect(() => extractLastWordFromText('')).toThrow('Cannot extract keyword: last word "" contains no letters');
    });

    it('should throw error for punctuation-only last word', () => {
      expect(() => extractLastWordFromText('test ...')).toThrow('Cannot extract keyword: last word "..." contains no letters');
    });

    it('should preserve hyphens', () => {
      expect(extractLastWordFromText('self-aware')).toBe('self-aware');
    });

    it('should extract keyword from possessive form', () => {
      expect(extractLastWordFromText('It was your father\'s.')).toBe('father');
      expect(extractLastWordFromText('Above my Father\'s')).toBe('father');
      expect(extractLastWordFromText('my mother\'s!')).toBe('mother');
    });

    it('should handle possessive without trailing punctuation', () => {
      expect(extractLastWordFromText('my father\'s')).toBe('father');
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

    it('should replace possessive forms (keyword + \'s)', () => {
      expect(replaceKeywordWithBlank('The apartment above my father\'s.', 'father')).toBe('The apartment above my _____\'s.');
      expect(replaceKeywordWithBlank('My Father\'s house', 'father')).toBe('My _____\'s house');
    });

    it('should replace both possessive and non-possessive occurrences', () => {
      expect(replaceKeywordWithBlank('My father and my father\'s house', 'father')).toBe('My _____ and my _____\'s house');
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

    // Unicode/accented character tests (Fix #61)
    it('should replace keyword with French accents (é)', () => {
      expect(replaceKeywordWithBlank('Her name is Haydée.', 'haydée')).toBe('Her name is _____.');
      expect(replaceKeywordWithBlank('Haydée is here', 'haydée')).toBe('_____ is here');
    });

    it('should replace keyword with French accents (ï)', () => {
      expect(replaceKeywordWithBlank("You think mine is really Anaïs?", 'anaïs')).toBe(
        'You think mine is really _____?'
      );
    });

    it('should replace keyword with Spanish accents', () => {
      expect(replaceKeywordWithBlank('Hola Señor.', 'señor')).toBe('Hola _____.');
      expect(replaceKeywordWithBlank('El niño juega', 'niño')).toBe('El _____ juega');
    });

    it('should replace keyword with German umlauts', () => {
      expect(replaceKeywordWithBlank('Herr Müller kommt', 'müller')).toBe('Herr _____ kommt');
    });

    it('should be case-insensitive with Unicode', () => {
      expect(replaceKeywordWithBlank('HAYDÉE is here', 'haydée')).toBe('_____ is here');
      expect(replaceKeywordWithBlank('Haydée and HAYDÉE', 'haydée')).toBe('_____ and _____');
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

    it('should preserve possessive forms', () => {
      expect(replaceKeywordWithBrackets('My father\'s house', 'father')).toBe('My [keyword]\'s house');
      expect(replaceKeywordWithBrackets('The apartment above my father\'s.', 'father')).toBe('The apartment above my [keyword]\'s.');
    });

    // Unicode/accented character tests (Fix #61)
    it('should replace keyword with French accents', () => {
      expect(replaceKeywordWithBrackets('Her name is Haydée.', 'haydée')).toBe('Her name is [keyword].');
      expect(replaceKeywordWithBrackets('Haydée is here', 'haydée')).toBe('[keyword] is here');
    });

    it('should replace keyword with Spanish accents', () => {
      expect(replaceKeywordWithBrackets('Hola Señor.', 'señor')).toBe('Hola [keyword].');
    });

    it('should be case-insensitive with Unicode', () => {
      expect(replaceKeywordWithBrackets('HAYDÉE and haydée', 'haydée')).toBe('[keyword] and [keyword]');
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

    it('should replace possessive forms (father → father\'s)', () => {
      expect(replaceKeywordWithWord('The apartment above my father\'s.', 'father', 'mother')).toBe(
        'The apartment above my mother\'s.'
      );
    });

    it('should replace possessive forms with case preservation', () => {
      expect(replaceKeywordWithWord('Above my Father\'s house.', 'father', 'mother')).toBe(
        'Above my Mother\'s house.'
      );
    });

    it('should replace possessive forms alongside non-possessive', () => {
      expect(replaceKeywordWithWord('My father and my father\'s house', 'father', 'mother')).toBe(
        'My mother and my mother\'s house'
      );
    });

    // Unicode/accented character tests (Fix #61)
    it('should replace keyword with French accents preserving case', () => {
      expect(replaceKeywordWithWord('Her name is Haydée.', 'haydée', 'marie')).toBe('Her name is Marie.');
      expect(replaceKeywordWithWord('HAYDÉE is here', 'haydée', 'marie')).toBe('MARIE is here');
    });

    it('should replace keyword with Spanish accents', () => {
      expect(replaceKeywordWithWord('Hola Señor García', 'señor', 'doctor')).toBe('Hola Doctor García');
    });
  });
});
