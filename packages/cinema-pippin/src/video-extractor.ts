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
 * Rebase SRT timestamps to start at a specified delay (default 00:00:00,000) and renumber indices
 * @param srtContent - The SRT content to rebase
 * @param originalStartTime - The original start timestamp to subtract (offset)
 * @param delaySeconds - Optional delay in seconds to add to all timestamps (default 0)
 *                       Useful for adding padding before first subtitle appears
 */
export function rebaseSrtTimestamps(srtContent: string, originalStartTime: string, delaySeconds: number = 0): string {
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
          const newStart = srtTimeToSeconds(start) - offsetSeconds + delaySeconds;
          const newEnd = srtTimeToSeconds(end) - offsetSeconds + delaySeconds;
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
 * Adds configurable padding on each side of the video, but subtitles only appear during the original time range
 * @param paddingSeconds - Seconds of padding to add before/after video (default 1.0)
 */
export function extractVideoSegment(
  inputVideo: string,
  startTime: string,
  endTime: string,
  outputVideo: string,
  srtFile: string,
  audioStreamIndex?: number | null,
  paddingSeconds: number = 1.0
): void {
  const startSeconds = srtTimeToSeconds(startTime);
  const endSeconds = srtTimeToSeconds(endTime);
  const originalDuration = endSeconds - startSeconds;

  // Add configurable padding on each side
  // Ensure we don't go below 0 (can't seek before video start)
  const paddedStart = Math.max(0, startSeconds - paddingSeconds);
  const paddedEnd = endSeconds + paddingSeconds;
  const paddedDuration = paddedEnd - paddedStart;

  console.log(`    Extracting video: ${startTime} -> ${endTime} (${originalDuration.toFixed(1)}s)`);
  console.log(`    With padding: ${secondsToSrtTime(paddedStart)} -> ${secondsToSrtTime(paddedEnd)} (${paddedDuration.toFixed(1)}s, ${paddingSeconds}s padding)`);

  // Build audio mapping based on audioStreamIndex
  // If audioStreamIndex is a number, use that specific stream: -map 0:${audioStreamIndex}
  // If audioStreamIndex is null, include all audio streams: -map 0:a
  // If audioStreamIndex is undefined, default to all audio streams: -map 0:a
  const audioMap = (audioStreamIndex !== null && audioStreamIndex !== undefined)
    ? `-map 0:${audioStreamIndex}`
    : `-map 0:a`;

  // Mark selected audio stream as default (ensures it's the primary track in output)
  const audioDisposition = (audioStreamIndex !== null && audioStreamIndex !== undefined)
    ? `-disposition:a:0 default`
    : '';

  // Build audio filter to MUTE (write silent samples) in padding regions
  // volume filter with multiplier of 0 writes actual silent audio samples (not just metadata)
  // First paddingSeconds: multiply by 0 (silent samples)
  // Middle section: multiply by 1.0 (original audio)
  // Last paddingSeconds: multiply by 0 (silent samples)
  const volumeThreshold = paddedDuration - paddingSeconds;
  // Escape for shell: use double quotes around the whole filter, escape the expression single quotes
  const volumeExpr = `if(lt(t,${paddingSeconds}),0,if(gt(t,${volumeThreshold}),0,1.0))`;
  const audioFilter = `-af "volume=${volumeExpr}"`;

  // Use ffmpeg to extract the segment with embedded subtitles
  // Note: SRT file is already rebased with paddingSeconds delay, so subtitles won't appear during padding
  // -ss: start time (with padding), -t: duration (with padding)
  // -map 0:v ${audioMap} -map 1:0: include video, audio (specific or all), subtitles from input 1
  // -af: audio filter to silence first/last paddingSeconds by multiplying audio samples by 0
  // -disposition:a:0 default: mark audio track as default (when specific stream selected)
  // -c:v libx264 -c:a aac: re-encode video and audio
  // -c:s mov_text: subtitle codec (mov_text is required for MP4 container)
  // -metadata:s:s:0 language=eng: mark subtitle track as English
  // -disposition:s:0 default: make subtitle track default (auto-enabled)
  const ffmpegCmd = `ffmpeg -y -ss ${paddedStart} -i "${inputVideo}" -i "${srtFile}" -t ${paddedDuration} -map 0:v ${audioMap} -map 1:0 ${audioFilter} -c:v libx264 -c:a aac ${audioDisposition} -c:s mov_text -metadata:s:s:0 language=eng -disposition:s:0 default -avoid_negative_ts make_zero "${outputVideo}" 2>&1`;

  try {
    const output = execSync(ffmpegCmd, { encoding: 'utf-8', stdio: 'pipe', shell: '/bin/bash' });
    console.log(`    ✓ Created ${basename(outputVideo)} (${paddedDuration.toFixed(1)}s with ${paddingSeconds}s silent padding)`);
  } catch (error: any) {
    const stderr = error.stderr || error.stdout || error.message || 'Unknown error';
    throw new Error(`ffmpeg failed for ${basename(outputVideo)}:\n${stderr}`);
  }
}

/**
 * Extract videos for all 3 scenes in a sequence directory
 * @param paddingSeconds - Seconds of padding to add before/after each video (default 1.0)
 */
export function extractVideosForSequence(
  sequenceDir: string,
  sourceVideo: string,
  srtBasename: string,
  timestampRanges: Array<{ startTime: string; endTime: string }>,
  audioStreamIndex?: number | null,
  paddingSeconds: number = 1.0
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

    // Extract video segment (question SRT is already rebased with padding delay)
    const outputVideoPath = join(sequenceDir, `${srtBasename}-${sceneNum}-question.mp4`);
    extractVideoSegment(sourceVideo, startTime, endTime, outputVideoPath, questionSrtPath, audioStreamIndex, paddingSeconds);
  }
}
