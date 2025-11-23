import { describe, it, expect } from 'vitest';
import { blankWithSpaces, replaceBlankedText, condenseAndBlank, splitLongLine } from '../src/blanking-utils.js';

describe('Blanking Logic', () => {
  describe('blankWithSpaces', () => {
    it('should replace all non-space characters with underscores', () => {
      expect(blankWithSpaces("I'll be back!")).toBe("____ __ ____");
    });

    it('should handle single words', () => {
      expect(blankWithSpaces("Hello")).toBe("____");
    });

    it('should handle multiple spaces', () => {
      expect(blankWithSpaces("Hello  world")).toBe("____  ____");
    });

    it('should handle punctuation', () => {
      expect(blankWithSpaces("What the hell?!")).toBe("____ ___ ____");
    });

    it('should handle empty strings', () => {
      expect(blankWithSpaces("")).toBe("");
    });

    it('should handle strings with only spaces', () => {
      expect(blankWithSpaces("   ")).toBe("   ");
    });

    it('should blank text across newlines correctly', () => {
      // \S matches non-whitespace, which excludes newlines
      // So "Hello\nWorld" becomes "____\n____" (newline preserved)
      expect(blankWithSpaces("Hello\nWorld")).toBe("____\n____");
    });

    it('should condense underscore sequences longer than 4 down to 4', () => {
      expect(blankWithSpaces("Hello")).toBe("____");  // 5 chars -> 4 underscores
      expect(blankWithSpaces("bananas")).toBe("____");  // 7 chars -> 4 underscores
      expect(blankWithSpaces("extraordinary")).toBe("____");  // 13 chars -> 4 underscores
    });

    it('should preserve sequences of 4 or fewer underscores', () => {
      expect(blankWithSpaces("I")).toBe("_");
      expect(blankWithSpaces("am")).toBe("__");
      expect(blankWithSpaces("the")).toBe("___");
      expect(blankWithSpaces("best")).toBe("____");
    });

    it('should condense within multi-word phrases', () => {
      expect(blankWithSpaces("I love extraordinary bananas")).toBe("_ ____ ____ ____");
    });
  });

  describe('replaceBlankedText', () => {
    it('should replace old-style single underscore block', () => {
      const scene = `1
00:00:00,000 --> 00:00:02,000
Hello there.

2
00:00:02,000 --> 00:00:04,000
_____`;

      const result = replaceBlankedText(scene, "Wonderful!");
      expect(result).toContain("Wonderful!");
      expect(result).not.toContain("_____");
    });

    it('should replace new-style space-preserving blanks', () => {
      const scene = `1
00:00:00,000 --> 00:00:02,000
Hello there.

2
00:00:02,000 --> 00:00:04,000
____ __ ____`;

      const result = replaceBlankedText(scene, "I am great!");
      expect(result).toContain("I am great!");
      expect(result).not.toContain("____");
    });

    it('should handle multi-line blanks', () => {
      const scene = `1
00:00:00,000 --> 00:00:02,000
Hello there.

2
00:00:02,000 --> 00:00:04,000
____ __ _____
___ ____ ____`;

      const result = replaceBlankedText(scene, "First line.\nSecond line.");
      expect(result).toContain("First line.");
      expect(result).toContain("Second line.");
    });

    it('should only replace the first blank occurrence when there are multiple', () => {
      const scene = `1
00:00:00,000 --> 00:00:02,000
_____

2
00:00:02,000 --> 00:00:04,000
____ __ _____`;

      // Should only replace first occurrence (for T2/T3 F3 frame replacement)
      const result = replaceBlankedText(scene, "TEXT");
      const matches = result.match(/TEXT/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBe(1); // Only first occurrence replaced
      expect(result).toContain("_____"); // Second blank still present (in frame 2)
    });

    it('should handle punctuation in replacement text', () => {
      const scene = `Frame:\n____ __ _____`;
      const result = replaceBlankedText(scene, "What the hell?!");
      expect(result).toBe("Frame:\nWhat the hell?!");
    });
  });

  describe('Integration: blank and replace', () => {
    it('should round-trip text through blanking and replacement', () => {
      const originalText = "I'll be back!";
      const blanked = blankWithSpaces(originalText);

      expect(blanked).toBe("____ __ ____");

      const scene = `Frame:\n${blanked}`;
      const replacement = "Yes I will!";
      const result = replaceBlankedText(scene, replacement);

      expect(result).toBe(`Frame:\n${replacement}`);
    });

    it('should handle realistic T2/T3 scenario', () => {
      // Simulate T2 final frame blanking
      const originalFrame = `4
00:00:06,500 --> 00:00:08,000
But I prefer apples.`;

      const lines = originalFrame.split('\n');
      const blankedText = blankWithSpaces(lines[2]); // "But I prefer apples." -> "___ _ ____ ____"
      const blankedFrame = [lines[0], lines[1], blankedText].join('\n');

      expect(blankedFrame).toBe(`4
00:00:06,500 --> 00:00:08,000
___ _ ____ ____`);

      // Now replace with winning phrase
      const scene = `3
00:00:04,000 --> 00:00:06,000
Some context.

${blankedFrame}`;

      const result = replaceBlankedText(scene, "playing with my puppy.");

      expect(result).toContain("playing with my puppy.");
      expect(result).not.toContain("___");
    });
  });

  describe('condenseAndBlank', () => {
    it('should condense single-line text to blanks', () => {
      const result = condenseAndBlank(["Hello world"]);
      expect(result).toBe("____ ____");
    });

    it('should condense multi-line text to single line with blanks', () => {
      const result = condenseAndBlank(["Hello world", "How are you?"]);
      // Hello(5)->____ world(5)->____ How(3)->___ are(3)->___ you?(4)->____
      expect(result).toBe("____ ____ ___ ___ ____");
    });

    it('should truncate to max 8 blank words', () => {
      // 10 words -> truncate to 8
      const result = condenseAndBlank(["One two three four five six seven eight nine ten"]);
      // One(3)->___ two(3)->___ three(5)->____ four(4)->____ five(4)->____ six(3)->___ seven(5)->____ eight(5)->____ (truncated)
      expect(result).toBe("___ ___ ____ ____ ____ ___ ____ ____");
    });

    it('should not truncate if exactly 8 words', () => {
      const result = condenseAndBlank(["One two three four five six seven eight"]);
      // One(3)->___ two(3)->___ three(5)->____ four(4)->____ five(4)->____ six(3)->___ seven(5)->____ eight(5)->____
      expect(result).toBe("___ ___ ____ ____ ____ ___ ____ ____");
    });

    it('should not truncate if less than 8 words', () => {
      const result = condenseAndBlank(["One two three"]);
      // One(3)->___ two(3)->___ three(5)->____
      expect(result).toBe("___ ___ ____");
    });

    it('should handle multi-line with more than 8 words total', () => {
      // Line 1: 5 words, Line 2: 6 words = 11 total -> truncate to 8
      const result = condenseAndBlank([
        "This is line one here",
        "And this is line two also"
      ]);
      // This(4)->____ is(2)->__ line(4)->____ one(3)->___ here(4)->____ And(3)->___ this(4)->____ is(2)->__ (truncated)
      expect(result).toBe("____ __ ____ ___ ____ ___ ____ __");
      const wordCount = result.split(/\s+/).length;
      expect(wordCount).toBe(8);
    });

    it('should handle empty lines', () => {
      const result = condenseAndBlank(["Hello", "", "World"]);
      // "Hello  World" (double space from empty line) -> "____  ____"
      expect(result).toBe("____  ____");
    });

    it('should condense long words correctly', () => {
      // "extraordinary" becomes "____ " (4 underscores)
      const result = condenseAndBlank(["I love extraordinary bananas"]);
      expect(result).toBe("_ ____ ____ ____");
    });

    it('should handle real T3 F3 scenario: 5-word frame', () => {
      // This was the bug case: "This is Miss Elliot's brother." (5 words)
      const result = condenseAndBlank(["This is Miss Elliot's brother."]);
      expect(result).toBe("____ __ ____ ____ ____");
      // Should be 5 blank words (under 8 limit, so not truncated)
      const wordCount = result.split(/\s+/).length;
      expect(wordCount).toBe(5);
    });

    it('should handle real T3 F3 scenario: multi-line with 9 words', () => {
      // Multi-line that exceeds 8 words
      const result = condenseAndBlank([
        "You think you can win?",
        "Think again my friend!"
      ]);
      // You(3)->___ think(5)->____ you(3)->___ can(3)->___ win?(4)->____ Think(5)->____ again(5)->____ my(2)->__ (truncated)
      // 5 words + 4 words = 9 words total -> truncate to 8
      expect(result).toBe("___ ____ ___ ___ ____ ____ ____ __");
      const wordCount = result.split(/\s+/).length;
      expect(wordCount).toBe(8);
    });
  });

  describe('splitLongLine', () => {
    it('should not split lines <= 60 characters', () => {
      const short = "This is a short line that fits easily.";
      expect(splitLongLine(short)).toBe(short);
    });

    it('should split on punctuation near midpoint', () => {
      const text = "This is a longer line with a comma here, and more text after it.";
      const result = splitLongLine(text);
      expect(result).toContain('\n');
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
      // Should split after the comma
      expect(lines[0]).toMatch(/,\s*$/);
    });

    it('should prefer period over other punctuation', () => {
      const text = "This is the first sentence. This is the second sentence that continues!";
      const result = splitLongLine(text);
      expect(result).toContain('\n');
      const lines = result.split('\n');
      // Should split after the period
      expect(lines[0]).toMatch(/\.\s*$/);
    });

    it('should split on question mark if near midpoint', () => {
      const text = "Do you think this will work? I really hope it does work well.";
      const result = splitLongLine(text);
      expect(result).toContain('\n');
      const lines = result.split('\n');
      // Should split after the question mark
      expect(lines[0]).toMatch(/\?\s*$/);
    });

    it('should split on word boundary if no punctuation near midpoint', () => {
      const text = "This is a very long line without any punctuation marks near the middle area";
      const result = splitLongLine(text);
      expect(result).toContain('\n');
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
      // Both lines should be trimmed
      expect(lines[0]).toBe(lines[0].trim());
      expect(lines[1]).toBe(lines[1].trim());
      // Lines should be roughly equal length (within 20 chars)
      expect(Math.abs(lines[0].length - lines[1].length)).toBeLessThan(20);
    });

    it('should create approximately equal line lengths', () => {
      const text = "The quick brown fox jumps over the lazy dog and runs through the forest";
      const result = splitLongLine(text);
      const lines = result.split('\n');
      const diff = Math.abs(lines[0].length - lines[1].length);
      // Lines should be within 15 chars of each other
      expect(diff).toBeLessThan(15);
    });

    it('should integrate with replaceBlankedText for long phrases', () => {
      const scene = `1
00:00:00,000 --> 00:00:02,000
Frame before.

2
00:00:02,000 --> 00:00:04,000
____ __ _____`;

      const longPhrase = "This is a very long phrase that should be split into two lines automatically!";
      const result = replaceBlankedText(scene, longPhrase);

      expect(result).toContain('\n');
      // Should have replaced the blanks with the split phrase
      expect(result).not.toContain('____');
      // Should contain the long phrase content (split)
      expect(result).toContain('This is a very long');
      expect(result).toContain('automatically!');
    });
  });
});
