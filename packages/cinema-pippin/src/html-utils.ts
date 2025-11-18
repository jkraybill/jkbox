/**
 * Strip all HTML tags from text
 *
 * Removes all HTML tags including:
 * - Simple tags: <b>, <i>, <u>
 * - Tags with attributes: <font face="sans-serif" size="71">
 * - Self-closing tags: <br/>
 * - Nested tags
 *
 * @param text - Text that may contain HTML tags
 * @returns Text with all HTML tags removed
 *
 * @example
 * stripHtmlTags('<b>Hello</b>') // Returns 'Hello'
 * stripHtmlTags('<font face="Arial" size="12">Text</font>') // Returns 'Text'
 */
export function stripHtmlTags(text: string): string {
  // Replace all HTML tags (opening, closing, self-closing) with empty string
  // Pattern matches: < followed by anything except >, followed by >
  // This handles tags with attributes like <font face="sans-serif" size="71">
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Strip HTML tags from all text lines in an SRT frame
 * Preserves frame index (line 0) and timestamp (line 1), only strips from text lines (2+)
 *
 * @param frame - A single SRT frame (multi-line string with index, timestamp, and text)
 * @returns Frame with HTML tags stripped from text lines
 *
 * @example
 * const frame = `1
 * 00:00:01,000 --> 00:00:03,000
 * <font face="Arial">Hello</font>`;
 *
 * stripHtmlFromFrame(frame)
 * // Returns:
 * // `1
 * // 00:00:01,000 --> 00:00:03,000
 * // Hello`
 */
export function stripHtmlFromFrame(frame: string): string {
  const lines = frame.split('\n');
  return lines.map((line, idx) => {
    // Only strip HTML from text lines (index 2+)
    // Leave frame index (0) and timestamp (1) unchanged
    return idx >= 2 ? stripHtmlTags(line) : line;
  }).join('\n');
}

/**
 * Strip HTML tags from all frames in an SRT file content
 *
 * @param srtContent - Full SRT file content (frames separated by double newlines)
 * @returns SRT content with HTML tags stripped from all text lines
 *
 * @example
 * const srt = `1
 * 00:00:01,000 --> 00:00:03,000
 * <b>First line</b>
 *
 * 2
 * 00:00:03,000 --> 00:00:05,000
 * <i>Second line</i>`;
 *
 * stripHtmlFromSrt(srt)
 * // Returns SRT with all HTML tags removed
 */
export function stripHtmlFromSrt(srtContent: string): string {
  const frames = srtContent.split('\n\n');
  return frames.map(stripHtmlFromFrame).join('\n\n');
}
