import { describe, it, expect } from 'vitest';

describe('JSON Parsing Utilities', () => {
  describe('Flat JSON detection and fix', () => {
    it('should detect flat JSON (missing outer brackets) for T1 responses', () => {
      // Simulates the bug: LLM returns flat list instead of array of arrays
      const flatJson = '["The letter \'E\'", "Elephant"], ["Numeric", "420"], ["Quotes", "infinity"], ["People we know", "John"], ["Punny", "goalie"], ["Pippin\'s word", "bones"]';

      // Pattern to detect flat JSON: starts with [ followed by quoted text, then ],  [
      const isFlatJson = /^\[(?:"[^"]*"|'[^']*')\s*,\s*(?:"[^"]*"|'[^']*')\s*\]\s*,\s*\[/.test(flatJson);

      expect(isFlatJson).toBe(true);

      // Fix by wrapping in outer brackets
      const fixedJson = '[' + flatJson + ']';

      // Should now parse correctly
      const parsed = JSON.parse(fixedJson);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(6);
      expect(parsed[0]).toEqual(["The letter 'E'", "Elephant"]);
    });

    it('should NOT detect properly nested JSON as flat', () => {
      const nestedJson = '[["The letter \'E\'", "Elephant"], ["Numeric", "420"]]';

      // Pattern should NOT match nested JSON
      const isFlatJson = /^\[(?:"[^"]*"|'[^']*')\s*,\s*(?:"[^"]*"|'[^']*')\s*\]\s*,\s*\[/.test(nestedJson);

      expect(isFlatJson).toBe(false);

      // Should parse correctly without modification
      const parsed = JSON.parse(nestedJson);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('should handle flat JSON with single quotes', () => {
      const flatJson = "['constraint 1', 'word1'], ['constraint 2', 'word2']";

      const isFlatJson = /^\[(?:"[^"]*"|'[^']*')\s*,\s*(?:"[^"]*"|'[^']*')\s*\]\s*,\s*\[/.test(flatJson);

      expect(isFlatJson).toBe(true);
    });

    it('should detect flat JSON for quality judging responses (with booleans)', () => {
      const flatJson = '["1. question", true], ["2. question", false], ["3. question", true]';

      // Pattern for quality judging: ends with boolean instead of string
      const isFlatJson = /^\[(?:"[^"]*"|'[^']*')\s*,\s*(?:true|false)\s*\]\s*,\s*\[/.test(flatJson);

      expect(isFlatJson).toBe(true);

      // Fix by wrapping in outer brackets
      const fixedJson = '[' + flatJson + ']';

      // Should now parse correctly
      const parsed = JSON.parse(fixedJson);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);
      expect(parsed[0]).toEqual(["1. question", true]);
      expect(parsed[1]).toEqual(["2. question", false]);
    });
  });
});
