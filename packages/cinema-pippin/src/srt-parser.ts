export interface SRTEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string; // All lines joined with \n
  rawText: string[]; // Individual lines
}

export function parseSRT(content: string): SRTEntry[] {
  const entries: SRTEntry[] = [];
  // Normalize line endings to \n, then split by one or more blank lines
  const normalized = content.replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue; // Need at least index, timestamp, and text

    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;

    const timestampMatch = lines[1].match(/(\S+)\s+-->\s+(\S+)/);
    if (!timestampMatch) continue;

    const [, startTime, endTime] = timestampMatch;
    const rawText = lines.slice(2); // Rest is text (preserve blank lines within entry)
    const text = rawText.join('\n');

    entries.push({
      index,
      startTime,
      endTime,
      text,
      rawText,
    });
  }

  return entries;
}
