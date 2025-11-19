#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { execSync } from 'child_process';
import {
  extractLastWordFromText,
  replaceKeywordWithBlank,
  replaceKeywordWithBrackets,
} from './keyword-utils.js';
import { condenseAndBlank } from './blanking-utils.js';

interface SRTSegment {
  tripletNumber: number;
  content: string;
  startTime: string; // First entry's start time (HH:MM:SS,mmm)
  endTime: string;   // Last entry's end time (HH:MM:SS,mmm)
}

/**
 * Parse a triplet .txt file (3 SRT segments separated by "---")
 */
function parseTripletFile(filePath: string): SRTSegment[] {
  const content = readFileSync(filePath, 'utf-8');
  const segments = content.split(/\n---\n/).map(s => s.trim()).filter(s => s.length > 0);

  if (segments.length !== 3) {
    throw new Error(`Expected 3 triplets, found ${segments.length} in ${filePath}`);
  }

  return segments.map((segment, idx) => {
    // Extract first timestamp (start time)
    const firstTimeMatch = segment.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    if (!firstTimeMatch) {
      throw new Error(`Could not find timestamps in triplet ${idx + 1}`);
    }

    // Extract last timestamp (end time) - find all timestamp ranges, take the last one
    const allTimeMatches = segment.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g);
    const matchArray = Array.from(allTimeMatches);
    const lastTimeMatch = matchArray[matchArray.length - 1];

    if (!lastTimeMatch) {
      throw new Error(`Could not find end timestamp in triplet ${idx + 1}`);
    }

    return {
      tripletNumber: idx + 1,
      content: segment,
      startTime: firstTimeMatch[1],
      endTime: lastTimeMatch[2],
    };
  });
}

/**
 * Convert SRT timestamp (HH:MM:SS,mmm) to seconds
 */
function srtTimeToSeconds(timestamp: string): number {
  const [time, ms] = timestamp.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + parseInt(ms) / 1000;
}

/**
 * Convert seconds to SRT timestamp (HH:MM:SS,mmm)
 */
function secondsToSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Rebase SRT timestamps to start at 00:00:00,000 and renumber indices starting at 1
 */
function rebaseSrtTimestamps(
  srtContent: string,
  originalStartTime: string,
  tripletNumber: number,
  keyword?: string
): string {
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
      lines[1] = lines[1].replace(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/, (match, start, end) => {
        const newStart = srtTimeToSeconds(start) - offsetSeconds;
        const newEnd = srtTimeToSeconds(end) - offsetSeconds;
        return `${secondsToSrtTime(newStart)} --> ${secondsToSrtTime(newEnd)}`;
      });
    }

    // Process text lines (lines after index and timestamp)
    const textLines = lines.slice(2);

    // For triplet 2 and 3, blank out the last frame entirely
    const isLastFrame = idx === entries.length - 1;
    if (tripletNumber >= 2 && isLastFrame) {
      // Condense multi-line text and blank with max 8 "words"
      const blankedText = condenseAndBlank(textLines);
      textLines.length = 0;
      textLines.push(blankedText);
    } else if (keyword) {
      // Apply keyword replacement to text lines
      for (let i = 0; i < textLines.length; i++) {
        if (tripletNumber === 1) {
          // Triplet 1: Replace keyword with "_____"
          textLines[i] = replaceKeywordWithBlank(textLines[i], keyword);
        } else {
          // Triplet 2 & 3: Replace keyword with "[keyword]"
          textLines[i] = replaceKeywordWithBrackets(textLines[i], keyword);
        }
      }
    }

    return [lines[0], lines[1], ...textLines].join('\n');
  });

  return renumberedEntries.join('\n\n') + '\n';
}

/**
 * Extract video segment using ffmpeg and embed subtitles
 */
function extractVideoSegment(
  inputVideo: string,
  startTime: string,
  endTime: string,
  outputVideo: string,
  srtFile?: string
): void {
  const startSeconds = srtTimeToSeconds(startTime);
  const endSeconds = srtTimeToSeconds(endTime);
  const duration = endSeconds - startSeconds;

  console.log(`  Extracting video segment: ${startTime} -> ${endTime} (${duration.toFixed(1)}s)`);

  // Use ffmpeg to extract the segment with frame-accurate cutting
  // Two-pass approach for accurate seeking and timestamp reset:
  // Pass 1: Fast seek to near the start point using input seeking
  // Pass 2: Precise cut with output seeking and timestamp reset
  // -map 0: copy all streams (video, audio, subtitles)
  // -c:v and -c:a: re-encode to ensure accurate cut and timestamp reset
  // If SRT file provided, embed it as a subtitle track
  let ffmpegCmd: string;

  if (srtFile) {
    // Embed subtitles: add SRT as input, map video/audio from first input and subtitles from second
    // -c:s srt: subtitle codec (SRT format)
    // -metadata:s:s:0 language=eng: mark subtitle track as English
    // -disposition:s:0 default: make subtitle track default (auto-enabled)
    ffmpegCmd = `ffmpeg -y -ss ${startSeconds} -i "${inputVideo}" -i "${srtFile}" -t ${duration} -map 0:v -map 0:a -map 1:0 -c:v libx264 -c:a aac -c:s srt -metadata:s:s:0 language=eng -disposition:s:0 default -avoid_negative_ts make_zero "${outputVideo}"`;
  } else {
    ffmpegCmd = `ffmpeg -y -ss ${startSeconds} -i "${inputVideo}" -t ${duration} -map 0 -c:v libx264 -c:a aac -avoid_negative_ts make_zero "${outputVideo}"`;
  }

  console.log(`  Running: ${ffmpegCmd}`);

  try {
    execSync(ffmpegCmd, { stdio: 'pipe' });
    console.log(`  ✓ Created ${basename(outputVideo)}`);
  } catch (error) {
    throw new Error(`ffmpeg failed: ${error}`);
  }
}

/**
 * Main CLI
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error('Usage: extract-triplets <triplet.txt> <video.mkv>');
    console.error('');
    console.error('Extract 3 video segments + SRT files from a triplet .txt file');
    console.error('');
    console.error('Arguments:');
    console.error('  triplet.txt   Path to triplet file (3 SRT segments separated by "---")');
    console.error('  video.mkv     Path to source video file (mkv, mp4, etc.)');
    console.error('');
    console.error('Example:');
    console.error('  extract-triplets test2.srt.1.txt test2.mkv');
    process.exit(1);
  }

  const tripletFile = args[0];
  const videoFile = args[1];

  console.log(`\nExtracting triplets from ${basename(tripletFile)}...`);
  console.log(`Source video: ${basename(videoFile)}\n`);

  // Parse triplet file
  const segments = parseTripletFile(tripletFile);

  console.log(`Found ${segments.length} triplets:\n`);
  segments.forEach(seg => {
    const duration = srtTimeToSeconds(seg.endTime) - srtTimeToSeconds(seg.startTime);
    console.log(`  Triplet ${seg.tripletNumber}: ${seg.startTime} -> ${seg.endTime} (${duration.toFixed(1)}s)`);
  });
  console.log('');

  // Extract keyword from last word of Triplet 1's last frame
  const triplet1LastFrame = segments[0].content.trim().split(/\n\n+/).pop();
  if (!triplet1LastFrame) {
    throw new Error('Could not extract last frame from Triplet 1');
  }
  const triplet1LastFrameLines = triplet1LastFrame.split('\n');
  const triplet1LastText = triplet1LastFrameLines.slice(2).join(' '); // Text lines after index and timestamp
  const keyword = extractLastWordFromText(triplet1LastText);

  console.log(`Keyword extracted: "${keyword}"\n`);

  // Generate output file names
  const tripletDir = dirname(tripletFile);
  const tripletBasename = basename(tripletFile, extname(tripletFile));
  const videoExt = extname(videoFile);

  // Process each triplet
  segments.forEach(segment => {
    console.log(`Processing Triplet ${segment.tripletNumber}...`);

    const outputVideoName = `${tripletBasename}-triplet${segment.tripletNumber}${videoExt}`;
    const outputSrtName = `${tripletBasename}-triplet${segment.tripletNumber}.srt`;
    const outputVideoPath = join(tripletDir, outputVideoName);
    const outputSrtPath = join(tripletDir, outputSrtName);

    // Rebase and write SRT first (needed for embedding)
    const rebasedSrt = rebaseSrtTimestamps(segment.content, segment.startTime, segment.tripletNumber, keyword);
    writeFileSync(outputSrtPath, rebasedSrt, 'utf-8');
    console.log(`  ✓ Created ${basename(outputSrtPath)}`);

    // Extract video segment and embed subtitles
    extractVideoSegment(videoFile, segment.startTime, segment.endTime, outputVideoPath, outputSrtPath);
    console.log('');
  });

  console.log('✓ Done! Extracted 3 video segments with subtitles.\n');
}

main();
