#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { basename, join } from 'path';
import { execSync } from 'child_process';
import { findAllTriplets, type Triplet } from './triplet-finder.js';
import { findAllTripletsOptimized } from './triplet-finder-optimized.js';
import { parseSRT } from './srt-parser.js';
import { isValidFirstTriplet } from './triplet-finder.js';
import { transformToKeyword } from './triplet-utils.js';
import { judgeAllTriplets, exportTopTriplets } from './triplet-judger.js';

const OUTPUT_DIR = '/home/jk/jkbox/generated';

/**
 * Extract SRT subtitles from a video file using ffmpeg
 * Looks for English subtitle track
 */
function extractSrtFromVideo(videoPath: string, outputSrtPath: string): void {
  console.log(`\n🎬 Attempting to extract English subtitles from video...`);

  // First, probe the video to find subtitle streams
  let probeOutput: string;
  try {
    probeOutput = execSync(
      `ffmpeg -i "${videoPath}" 2>&1 | grep "Stream.*Subtitle"`,
      { encoding: 'utf-8' }
    );
  } catch (error: any) {
    // If grep returns no matches, it exits with code 1
    const stderr = error.stdout || '';

    console.error('\n❌ SRT EXTRACTION FAILED - DIAGNOSTICS:');
    console.error('================================================================================');
    console.error('No subtitle streams found in video file.');
    console.error('');
    console.error('Video file:', videoPath);
    console.error('');
    console.error('FFmpeg output:');
    console.error(stderr);
    console.error('================================================================================');
    console.error('');
    console.error('TROUBLESHOOTING:');
    console.error('1. Verify the video file contains embedded subtitles');
    console.error('2. Check subtitle format (should be SRT-compatible)');
    console.error('3. Try manually: ffmpeg -i "video.mkv" -map 0:s:0 output.srt');
    console.error('================================================================================\n');

    throw new Error('No subtitle streams found in video file');
  }

  console.log('\nFound subtitle stream(s):');
  console.log(probeOutput);

  // Parse probe output to find English subtitle stream
  // Example: "Stream #0:2(eng): Subtitle: subrip (default)"
  const lines = probeOutput.split('\n').filter(line => line.trim());
  let englishStreamIndex: string | null = null;

  for (const line of lines) {
    // Look for (eng) or english language indicator
    if (line.includes('(eng)') || line.toLowerCase().includes('english')) {
      // Extract stream index (e.g., "0:2" from "Stream #0:2(eng)")
      const match = line.match(/Stream #(\d+:\d+)/);
      if (match) {
        englishStreamIndex = match[1];
        console.log(`\n✓ Found English subtitle stream: ${englishStreamIndex}`);
        break;
      }
    }
  }

  // If no English stream found, try the first subtitle stream
  if (!englishStreamIndex && lines.length > 0) {
    const match = lines[0].match(/Stream #(\d+:\d+)/);
    if (match) {
      englishStreamIndex = match[1];
      console.log(`\n⚠ No English stream found, using first subtitle stream: ${englishStreamIndex}`);
    }
  }

  if (!englishStreamIndex) {
    console.error('\n❌ SRT EXTRACTION FAILED - DIAGNOSTICS:');
    console.error('================================================================================');
    console.error('Could not identify subtitle stream index.');
    console.error('');
    console.error('FFmpeg probe output:');
    console.error(probeOutput);
    console.error('================================================================================\n');

    throw new Error('Could not identify subtitle stream index');
  }

  // Extract the subtitle stream
  console.log(`\nExtracting subtitle stream ${englishStreamIndex} to ${basename(outputSrtPath)}...`);

  try {
    execSync(
      `ffmpeg -y -i "${videoPath}" -map ${englishStreamIndex} "${outputSrtPath}" 2>&1`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    console.log(`✓ Successfully extracted SRT to ${outputSrtPath}\n`);
  } catch (error: any) {
    const stderr = error.stdout || error.stderr || error.message || 'Unknown error';

    console.error('\n❌ SRT EXTRACTION FAILED - DIAGNOSTICS:');
    console.error('================================================================================');
    console.error('FFmpeg extraction command failed.');
    console.error('');
    console.error('Command:', `ffmpeg -y -i "${videoPath}" -map ${englishStreamIndex} "${outputSrtPath}"`);
    console.error('');
    console.error('FFmpeg output:');
    console.error(stderr);
    console.error('================================================================================');
    console.error('');
    console.error('TROUBLESHOOTING:');
    console.error('1. Subtitle stream may not be in SRT format');
    console.error('2. Try converting: ffmpeg -i "video.mkv" -map 0:s:0 -c:s srt output.srt');
    console.error('3. Check if subtitles are bitmap-based (VobSub/PGS) - these need OCR');
    console.error('================================================================================\n');

    throw new Error(`FFmpeg extraction failed: ${stderr}`);
  }
}

function formatTriplet(triplet: Triplet): string {
  return triplet.allEntries
    .map((entry) => {
      return `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}`;
    })
    .join('\n\n');
}

function formatTripletSequence(triplets: Triplet[]): string {
  return triplets.map(formatTriplet).join('\n\n---\n\n');
}

const program = new Command();

program
  .name('cinema-pippin')
  .description('Find and judge triplet patterns in SRT subtitle files')
  .version('0.1.0');

// Default command: find triplets
program
  .command('find', { isDefault: true })
  .description('Find triplet patterns in SRT subtitle files')
  .argument('<srt-file>', 'Path to SRT subtitle file')
  .option('-v, --verbose', 'Show diagnostic information')
  .option('-m, --max-sequences <number>', 'Maximum number of triplet sequences to output', '18')
  .action(async (srtFile: string, options: { verbose?: boolean; maxSequences?: string }) => {
    try {
      console.log(`Reading ${srtFile}...`);
      const content = readFileSync(srtFile, 'utf-8');

      const entries = parseSRT(content);
      console.log(`Parsed ${entries.length} SRT entries`);

      if (options.verbose) {
        console.log('\nChecking for valid first triplets...');
        let validFirstCount = 0;
        for (let i = 1; i < entries.length; i++) {
          // Try 0, 1, 2 fillers
          for (let fillers = 0; fillers <= 2; fillers++) {
            const frame2Idx = i + 1 + fillers;
            const frame3Idx = frame2Idx + 1;
            if (frame3Idx >= entries.length) break;

            if (isValidFirstTriplet(entries, i, frame2Idx, frame3Idx)) {
              validFirstCount++;
              const keyword = transformToKeyword(entries[frame3Idx].text);
              console.log(`  Found valid first triplet at index ${i} with ${fillers} filler(s) (frames ${entries[i].index}, ${entries[frame2Idx].index}, ${entries[frame3Idx].index}), keyword: "${keyword}"`);
              if (validFirstCount >= 5) {
                console.log(`  ... (showing first 5 only)`);
                break;
              }
            }
          }
          if (validFirstCount >= 5) break;
        }
        console.log(`Total valid first triplets: ${validFirstCount}`);
      }

      console.log('\nFinding triplet sequences (3 triplets each)...');
      const tripletSequences = await findAllTripletsOptimized(content);

      console.log(`Found ${tripletSequences.length} complete triplet sequence(s)`);

      if (tripletSequences.length === 0) {
        console.log('\nNo valid triplet sequences found.');
        if (!options.verbose) {
          console.log('Run with --verbose to see diagnostic information');
        }
        return;
      }

      // Limit to max sequences
      const maxSeq = parseInt(options.maxSequences || '18', 10);
      const sequencesToExport = tripletSequences.slice(0, maxSeq);

      if (sequencesToExport.length < tripletSequences.length) {
        console.log(`Limiting output to ${maxSeq} sequence(s) (found ${tripletSequences.length} total)`);
      }

      const baseFilename = basename(srtFile);

      sequencesToExport.forEach((sequence, index) => {
        const outputFilename = join(OUTPUT_DIR, `${baseFilename}.${index + 1}.txt`);
        const outputContent = formatTripletSequence(sequence);

        writeFileSync(outputFilename, outputContent, 'utf-8');
        console.log(`Wrote ${outputFilename}`);
      });

      console.log('\nDone!');
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Unknown error occurred');
      }
      process.exit(1);
    }
  });

// Judge triplets command
program
  .command('judge')
  .description('Judge triplets using Ollama/Qwen to find the 6 best')
  .argument('<srt-file>', 'Path to original SRT file (e.g., test4.srt)')
  .action(async (srtFile: string) => {
    try {
      const judgments = await judgeAllTriplets(srtFile);

      console.log('\n' + '='.repeat(80));
      console.log('📊 JUDGING COMPLETE - SUMMARY');
      console.log('='.repeat(80));
      console.log(`\nJudged ${judgments.length} triplet(s):\n`);

      judgments.forEach((j, idx) => {
        console.log(
          `${idx + 1}. ${basename(j.tripletFile)} - Keyword: "${j.keyword}" - Winners: "${j.bestWord}", "${j.bestPhrase}", "${j.bestPhraseT3}" - Score: ${j.qualityScore}/10`
        );
      });

      console.log('\n✅ All judgments complete!\n');

      // Export the top sequences
      await exportTopTriplets(srtFile, judgments);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Unknown error occurred');
      }
      process.exit(1);
    }
  });

// Process command: full end-to-end pipeline
program
  .command('process')
  .description('Run full pipeline: find triplets, judge them, and export with videos')
  .argument('<filename-no-ext>', 'Filename without extension (e.g., "test4")')
  .argument('[max-N]', 'Maximum number of triplet sequences to find (default: 18)', '18')
  .action(async (filenameNoExt: string, maxNStr: string) => {
    try {
      const maxN = parseInt(maxNStr, 10);
      const assetsDir = '/home/jk/jkbox/assets';
      const generatedDir = '/home/jk/jkbox/generated';

      console.log('='.repeat(80));
      console.log('🎬 CINEMA PIPPIN - FULL PIPELINE');
      console.log('='.repeat(80));
      console.log(`\nFilename: ${filenameNoExt}`);
      console.log(`Max sequences: ${maxN}\n`);

      // Step 1: Validate files exist (and extract SRT if needed)
      console.log('Step 1: Validating input files...\n');

      // Check for video file first (.mkv, .mp4, or .avi)
      let videoPath: string | null = null;
      const mkvPath = join(assetsDir, `${filenameNoExt}.mkv`);
      const mp4Path = join(assetsDir, `${filenameNoExt}.mp4`);
      const aviPath = join(assetsDir, `${filenameNoExt}.avi`);

      if (existsSync(mkvPath)) {
        videoPath = mkvPath;
      } else if (existsSync(mp4Path)) {
        videoPath = mp4Path;
      } else if (existsSync(aviPath)) {
        videoPath = aviPath;
      }

      if (!videoPath) {
        throw new Error(`Video file not found: ${mkvPath}, ${mp4Path}, or ${aviPath}`);
      }
      console.log(`  ✓ Found video: ${basename(videoPath)}`);

      // Check for SRT file
      const srtPath = join(assetsDir, `${filenameNoExt}.srt`);

      if (!existsSync(srtPath)) {
        console.log(`  ⚠ SRT file not found: ${basename(srtPath)}`);
        console.log(`  → Attempting to extract SRT from video file...`);

        try {
          extractSrtFromVideo(videoPath, srtPath);
        } catch (error) {
          // Error already logged with detailed diagnostics in extractSrtFromVideo
          process.exit(1);
        }
      } else {
        console.log(`  ✓ Found SRT: ${basename(srtPath)}`);
      }

      console.log('');

      // Step 2: Find triplets
      console.log('='.repeat(80));
      console.log('Step 2: Finding triplet sequences...');
      console.log('='.repeat(80));
      console.log('');

      const content = readFileSync(srtPath, 'utf-8');
      const entries = parseSRT(content);
      console.log(`Parsed ${entries.length} SRT entries`);

      console.log('\nFinding triplet sequences (3 triplets each)...');
      const tripletSequences = await findAllTripletsOptimized(content);

      console.log(`Found ${tripletSequences.length} complete triplet sequence(s)`);

      if (tripletSequences.length === 0) {
        console.log('\nNo valid triplet sequences found.');
        return;
      }

      // Limit to max sequences
      const sequencesToExport = tripletSequences.slice(0, maxN);

      if (sequencesToExport.length < tripletSequences.length) {
        console.log(`Limiting output to ${maxN} sequence(s) (found ${tripletSequences.length} total)`);
      }

      const baseFilename = basename(srtPath);

      sequencesToExport.forEach((sequence, index) => {
        const outputFilename = join(generatedDir, `${baseFilename}.${index + 1}.txt`);
        const outputContent = formatTripletSequence(sequence);

        writeFileSync(outputFilename, outputContent, 'utf-8');
        console.log(`Wrote ${basename(outputFilename)}`);
      });

      console.log('\n✅ Triplet finding complete!\n');

      // Step 3: Judge triplets
      console.log('='.repeat(80));
      console.log('Step 3: Judging triplets with Ollama/Qwen...');
      console.log('='.repeat(80));
      console.log('');

      const judgments = await judgeAllTriplets(srtPath);

      console.log('\n' + '='.repeat(80));
      console.log('📊 JUDGING COMPLETE - SUMMARY');
      console.log('='.repeat(80));
      console.log(`\nJudged ${judgments.length} triplet(s):\n`);

      judgments.forEach((j, idx) => {
        console.log(
          `${idx + 1}. ${basename(j.tripletFile)} - Keyword: "${j.keyword}" - Winners: "${j.bestWord}", "${j.bestPhrase}", "${j.bestPhraseT3}" - Score: ${j.qualityScore}/10`
        );
      });

      console.log('\n✅ All judgments complete!\n');

      // Step 4: Export with video extraction
      console.log('='.repeat(80));
      console.log('Step 4: Exporting top sequences with videos...');
      console.log('='.repeat(80));

      await exportTopTriplets(srtPath, judgments, videoPath);

      console.log('='.repeat(80));
      console.log('✨ PIPELINE COMPLETE!');
      console.log('='.repeat(80));
      console.log('');
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Unknown error occurred');
      }
      process.exit(1);
    }
  });

program.parse();
