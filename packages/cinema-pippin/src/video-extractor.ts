/**
 * Video extraction utilities for triplet sequences
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

/**
 * Convert SRT timestamp (HH:MM:SS,mmm) to seconds
 */
export function srtTimeToSeconds(timestamp: string): number {
  const [time, ms] = timestamp.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + parseInt(ms) / 1000;
}

/**
 * Convert seconds to SRT timestamp (HH:MM:SS,mmm)
 */
export function secondsToSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Extract start and end timestamps from an SRT file
 */
export function extractTimestampRange(srtContent: string): { startTime: string; endTime: string } {
  const timestampMatches = Array.from(
    srtContent.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g)
  );

  if (timestampMatches.length === 0) {
    throw new Error('No timestamps found in SRT content');
  }

  const firstMatch = timestampMatches[0];
  const lastMatch = timestampMatches[timestampMatches.length - 1];

  return {
    startTime: firstMatch[1],
    endTime: lastMatch[2]
  };
}

/**
 * Rebase SRT timestamps to start at 00:00:00,000 and renumber indices
 */
export function rebaseSrtTimestamps(srtContent: string, originalStartTime: string): string {
  const offsetSeconds = srtTimeToSeconds(originalStartTime);

  // Split into individual subtitle entries
  const entries = srtContent.trim().split(/\n\n+/);

  // Process each entry: renumber index and rebase timestamps
  const renumberedEntries = entries.map((entry, idx) => {
    const lines = entry.split('\n');

    // First line is the index - replace with new sequential number
    lines[0] = (idx + 1).toString();

    // Second line should be the timestamp - rebase it
    if (lines[1] && lines[1].includes('-->')) {
      lines[1] = lines[1].replace(
        /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/,
        (match, start, end) => {
          const newStart = srtTimeToSeconds(start) - offsetSeconds;
          const newEnd = srtTimeToSeconds(end) - offsetSeconds;
          return `${secondsToSrtTime(newStart)} --> ${secondsToSrtTime(newEnd)}`;
        }
      );
    }

    return lines.join('\n');
  });

  return renumberedEntries.join('\n\n') + '\n';
}

/**
 * Extract video segment using ffmpeg and embed subtitles
 */
export function extractVideoSegment(
  inputVideo: string,
  startTime: string,
  endTime: string,
  outputVideo: string,
  srtFile: string
): void {
  const startSeconds = srtTimeToSeconds(startTime);
  const endSeconds = srtTimeToSeconds(endTime);
  const duration = endSeconds - startSeconds;

  console.log(`    Extracting video: ${startTime} -> ${endTime} (${duration.toFixed(1)}s)`);

  // Use ffmpeg to extract the segment with embedded subtitles
  // -ss: start time, -t: duration
  // -map 0:v -map 0:a -map 1:0: include video, audio from input 0, subtitles from input 1
  // -c:v libx264 -c:a aac: re-encode video and audio
  // -c:s mov_text: subtitle codec (mov_text is required for MP4 container)
  // -metadata:s:s:0 language=eng: mark subtitle track as English
  // -disposition:s:0 default: make subtitle track default (auto-enabled)
  const ffmpegCmd = `ffmpeg -y -ss ${startSeconds} -i "${inputVideo}" -i "${srtFile}" -t ${duration} -map 0:v -map 0:a -map 1:0 -c:v libx264 -c:a aac -c:s mov_text -metadata:s:s:0 language=eng -disposition:s:0 default -avoid_negative_ts make_zero "${outputVideo}" 2>&1`;

  try {
    const output = execSync(ffmpegCmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`    ✓ Created ${basename(outputVideo)}`);
  } catch (error: any) {
    const stderr = error.stderr || error.stdout || error.message || 'Unknown error';
    throw new Error(`ffmpeg failed for ${basename(outputVideo)}:\n${stderr}`);
  }
}

/**
 * Extract videos for all 3 scenes in a sequence directory
 */
export function extractVideosForSequence(
  sequenceDir: string,
  sourceVideo: string,
  srtBasename: string,
  timestampRanges: Array<{ startTime: string; endTime: string }>
): void {
  console.log(`\n  🎬 Extracting videos for ${basename(sequenceDir)}/`);

  for (let sceneNum = 1; sceneNum <= 3; sceneNum++) {
    console.log(`\n    Scene ${sceneNum}:`);

    const questionSrtPath = join(sequenceDir, `${srtBasename}-${sceneNum}-question.srt`);

    if (!existsSync(questionSrtPath)) {
      console.log(`    ⚠ Skipping scene ${sceneNum} (question SRT not found)`);
      continue;
    }

    // Read the already-rebased question SRT
    const questionSrt = readFileSync(questionSrtPath, 'utf-8');

    // Get the original timestamp range for this scene
    const { startTime, endTime } = timestampRanges[sceneNum - 1];

    // Extract video segment (question SRT is already rebased to 00:00:00,000)
    const outputVideoPath = join(sequenceDir, `${srtBasename}-${sceneNum}-question.mp4`);
    extractVideoSegment(sourceVideo, startTime, endTime, outputVideoPath, questionSrtPath);
  }
}
