/**
 * Helper function to blank out text while preserving spaces
 * Replaces all non-space characters (excluding newlines) with underscores
 *
 * @param text - The text to blank
 * @returns The blanked text with spaces preserved
 *
 * @example
 * blankWithSpaces("I'll be back!") // Returns "____ __ _____"
 * blankWithSpaces("Hello world")   // Returns "_____ _____"
 */
export function blankWithSpaces(text: string): string {
  return text.replace(/\S/g, '_');
}

/**
 * Helper function to replace blanked text with new text
 * Handles both old format ("_____") and new format ("____ __ _____")
 *
 * @param sceneText - The scene containing blanked text
 * @param replacement - The text to insert in place of the blanks
 * @returns The scene with blanks replaced
 *
 * @example
 * replaceBlankedText("Frame: _____", "Hello")         // "Frame: Hello"
 * replaceBlankedText("Frame: ____ __ _____", "I am") // "Frame: I am"
 */
export function replaceBlankedText(sceneText: string, replacement: string): string {
  // Match any sequence of underscores with optional spaces between them
  // This pattern matches both:
  // - "_____" (old format)
  // - "____ __ _____" (new format with preserved spaces)
  const blankPattern = /(?:_+\s*)+_+/g;

  return sceneText.replace(blankPattern, replacement);
}
