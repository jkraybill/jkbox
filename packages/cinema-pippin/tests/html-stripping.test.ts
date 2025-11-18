import { describe, it, expect } from 'vitest';
import { stripHtmlTags, stripHtmlFromFrame, stripHtmlFromSrt } from '../src/html-utils.js';

describe('HTML Tag Stripping', () => {
  describe('stripHtmlTags', () => {
    it('should remove simple HTML tags', () => {
      expect(stripHtmlTags('<b>Hello</b>')).toBe('Hello');
    });

    it('should remove tags with attributes', () => {
      const input = '<font face="sans-serif" size="71">Perhaps I should tell you</font>';
      expect(stripHtmlTags(input)).toBe('Perhaps I should tell you');
    });

    it('should remove multiple tags from multi-line text', () => {
      const input = `<font face="sans-serif" size="71">Perhaps I should tell you
a bit about myself.</font>`;
      const expected = `Perhaps I should tell you
a bit about myself.`;
      expect(stripHtmlTags(input)).toBe(expected);
    });

    it('should handle self-closing tags', () => {
      expect(stripHtmlTags('Line 1<br/>Line 2')).toBe('Line 1Line 2');
    });

    it('should handle multiple different tags', () => {
      const input = '<b>Bold</b> and <i>italic</i> and <u>underline</u>';
      expect(stripHtmlTags(input)).toBe('Bold and italic and underline');
    });

    it('should handle nested tags', () => {
      const input = '<div><span><b>Nested</b></span></div>';
      expect(stripHtmlTags(input)).toBe('Nested');
    });

    it('should handle tags with single quotes in attributes', () => {
      const input = "<font face='Arial' size='12'>Text</font>";
      expect(stripHtmlTags(input)).toBe('Text');
    });

    it('should handle tags with mixed quotes in attributes', () => {
      const input = '<font face="Arial" size=\'12\'>Text</font>';
      expect(stripHtmlTags(input)).toBe('Text');
    });

    it('should handle text with no HTML tags', () => {
      expect(stripHtmlTags('Plain text')).toBe('Plain text');
    });

    it('should handle empty string', () => {
      expect(stripHtmlTags('')).toBe('');
    });

    it('should handle incomplete/malformed tags (conservative)', () => {
      // Just remove what looks like tags, leave the rest
      expect(stripHtmlTags('Text <incomplete')).toBe('Text <incomplete');
      expect(stripHtmlTags('Text <b>bold</b> <')).toBe('Text bold <');
    });

    it('should preserve spacing after tag removal', () => {
      const input = 'Before <b>bold</b> after';
      expect(stripHtmlTags(input)).toBe('Before bold after');
    });

    it('should handle common SRT formatting tags', () => {
      const input = '<b>Bold</b> <i>Italic</i> <u>Underline</u> <font color="red">Red</font>';
      expect(stripHtmlTags(input)).toBe('Bold Italic Underline Red');
    });
  });

  describe('Real-world SRT examples', () => {
    it('should handle typical font tag with size and face using stripHtmlFromFrame', () => {
      const frame = `1
00:00:01,000 --> 00:00:03,000
<font face="sans-serif" size="71">Perhaps I should tell you
a bit about myself.</font>`;

      const result = stripHtmlFromFrame(frame);

      expect(result).toBe(`1
00:00:01,000 --> 00:00:03,000
Perhaps I should tell you
a bit about myself.`);
    });

    it('should handle multiple frames with different HTML tags using stripHtmlFromSrt', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
<font face="sans-serif" size="71">First line</font>

2
00:00:03,000 --> 00:00:05,000
<b>Bold text</b>
<i>Italic text</i>`;

      const result = stripHtmlFromSrt(srt);

      expect(result).toBe(`1
00:00:01,000 --> 00:00:03,000
First line

2
00:00:03,000 --> 00:00:05,000
Bold text
Italic text`);
    });

    it('should handle SRT with mixed HTML and plain text', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Plain text

2
00:00:03,000 --> 00:00:05,000
<b>Bold</b> and plain

3
00:00:05,000 --> 00:00:07,000
<font color="red">Colored</font>
<i>Multi-line italic</i>`;

      const result = stripHtmlFromSrt(srt);

      expect(result).toBe(`1
00:00:01,000 --> 00:00:03,000
Plain text

2
00:00:03,000 --> 00:00:05,000
Bold and plain

3
00:00:05,000 --> 00:00:07,000
Colored
Multi-line italic`);
    });
  });
});
