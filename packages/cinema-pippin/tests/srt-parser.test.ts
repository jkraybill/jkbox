import { describe, it, expect } from 'vitest';
import { parseSRT, type SRTEntry } from '../src/srt-parser';

describe('SRT Parser', () => {
  it('should parse a single SRT entry', () => {
    const srt = `1
00:00:52,217 --> 00:00:56,745
In THE REALM OF THE SENSES`;

    const entries = parseSRT(srt);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      index: 1,
      startTime: '00:00:52,217',
      endTime: '00:00:56,745',
      text: 'In THE REALM OF THE SENSES',
      rawText: ['In THE REALM OF THE SENSES']
    });
  });

  it('should parse multiple SRT entries', () => {
    const srt = `1
00:00:52,217 --> 00:00:56,745
In THE REALM OF THE SENSES

2
00:01:02,060 --> 00:01:09,557
Written and Directed by
NAGISA OSHIMA`;

    const entries = parseSRT(srt);

    expect(entries).toHaveLength(2);
    expect(entries[1].text).toBe('Written and Directed by NAGISA OSHIMA');
    expect(entries[1].rawText).toEqual(['Written and Directed by', 'NAGISA OSHIMA']);
  });

  it('should parse multiline text correctly', () => {
    const srt = `3
00:01:22,213 --> 00:01:23,908
Awake already?

4
00:01:24,082 --> 00:01:25,606
It�s so cold.`;

    const entries = parseSRT(srt);

    expect(entries[0].text).toBe('Awake already?');
    expect(entries[1].text).toBe('It�s so cold.');
  });

  it('should handle entries separated by blank lines', () => {
    const srt = `1
00:00:52,217 --> 00:00:56,745
First line

2
00:01:00,000 --> 00:01:03,000
Second line`;

    const entries = parseSRT(srt);

    expect(entries).toHaveLength(2);
    expect(entries[0].rawText).toEqual(['First line']);
    expect(entries[1].rawText).toEqual(['Second line']);
  });

  it('should collapse multiline text with spaces for comparison', () => {
    const srt = `1
00:00:52,217 --> 00:00:56,745
THEN SHE
SAID

2
00:01:00,000 --> 00:01:03,000
WHY?
Because
she said...`;

    const entries = parseSRT(srt);

    expect(entries).toHaveLength(2);
    expect(entries[0].text).toBe('THEN SHE SAID');
    expect(entries[0].rawText).toEqual(['THEN SHE', 'SAID']);
    expect(entries[1].text).toBe('WHY? Because she said...');
    expect(entries[1].rawText).toEqual(['WHY?', 'Because', 'she said...']);
  });
});
