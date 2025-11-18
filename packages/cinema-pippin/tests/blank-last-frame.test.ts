import { describe, it, expect } from 'vitest';

/**
 * Test for blankLastFrame functionality
 * Since blankLastFrame is not exported, we'll test the behavior through the blanking utils
 */
import { blankWithSpaces } from '../src/blanking-utils.js';

// Simulating the blankLastFrame function for testing
function blankLastFrame(scene: string): string {
  const frames = scene.split(/\n\n+/);
  if (frames.length === 0) {
    return scene;
  }

  const lastFrame = frames[frames.length - 1];
  const lastFrameLines = lastFrame.split('\n');

  if (lastFrameLines.length < 3) {
    return scene;
  }

  // Keep index (line 0) and timestamp (line 1), blank text while preserving spaces
  const originalText = lastFrameLines.slice(2).join('\n');
  const blankedText = blankWithSpaces(originalText);
  const blankedLastFrame = [
    lastFrameLines[0], // Index
    lastFrameLines[1], // Timestamp
    blankedText        // Replace text with space-preserving blanks
  ].join('\n');

  // Reconstruct scene with blanked last frame
  return [
    ...frames.slice(0, -1),
    blankedLastFrame
  ].join('\n\n');
}

describe('blankLastFrame', () => {
  it('should preserve spaces in blanked frame', () => {
    const scene = `1
00:00:01,000 --> 00:00:03,000
First frame.

2
00:00:03,000 --> 00:00:05,000
Second frame here.

3
00:00:05,000 --> 00:00:07,000
I'll be back!`;

    const result = blankLastFrame(scene);

    // Should preserve spaces in last frame: "I'll be back!" -> "____ __ ____"
    expect(result).toContain('____ __ ____');
    expect(result).not.toContain("I'll be back!"); // Should be blanked
    expect(result).toContain('First frame.'); // Earlier frames unchanged
    expect(result).toContain('Second frame here.');
  });

  it('should handle multi-line last frame text', () => {
    const scene = `1
00:00:01,000 --> 00:00:03,000
Setup text.

2
00:00:03,000 --> 00:00:05,000
Line one
Line two`;

    const result = blankLastFrame(scene);

    // Each line should be blanked separately with spaces preserved
    expect(result).toContain('____');
    expect(result).toContain('\n'); // Newline preserved
    expect(result).not.toMatch(/Line one/);
    expect(result).not.toMatch(/Line two/);
  });

  it('should preserve single-word frames correctly', () => {
    const scene = `1
00:00:01,000 --> 00:00:03,000
Hello!`;

    const result = blankLastFrame(scene);

    expect(result).toContain('____'); // "Hello!" -> "____" (condensed)
    expect(result).not.toContain('Hello');
  });

  it('should handle frames with multiple spaces', () => {
    const scene = `1
00:00:01,000 --> 00:00:03,000
Word  with   spaces`;

    const result = blankLastFrame(scene);

    // Should preserve the spacing pattern (with condensing)
    expect(result).toContain('____  ____   ____');
  });

  it('should handle realistic Cinema Pippin frame from persona.srt', () => {
    const scene = `1
00:00:01,000 --> 00:00:03,000
I knew you'd refuse.

2
00:00:04,295 --> 00:00:06,504
You can't know how I feel.

3
00:00:08,132 --> 00:00:10,508
I always thought great artists

4
00:00:10,675 --> 00:00:13,595
felt this great compassion for other people...

5
00:00:14,305 --> 00:00:17,057
that they created out of great compassion

6
00:00:17,182 --> 00:00:19,184
and a need to help.

7
00:00:19,352 --> 00:00:21,353
But that's not it!`;

    const result = blankLastFrame(scene);

    // Should preserve space pattern in "But that's not it!"
    // "But that's not it!" becomes "___ ____ ___ ___" (apostrophe blanked, long words condensed)
    expect(result).toContain('___ ____ ___ ___');
    expect(result).not.toContain("But that's not it!");
    expect(result).toContain('I knew you'); // Earlier frames unchanged
  });

  it('should return scene unchanged if no frames', () => {
    const emptyScene = '';
    expect(blankLastFrame(emptyScene)).toBe('');
  });

  it('should return scene unchanged if last frame has less than 3 lines', () => {
    const invalidScene = `1
00:00:01,000 --> 00:00:03,000`;

    expect(blankLastFrame(invalidScene)).toBe(invalidScene);
  });
});
