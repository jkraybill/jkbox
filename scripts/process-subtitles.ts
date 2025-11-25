#!/usr/bin/env node
/**
 * Automated Subtitle Download Script
 *
 * Processes videos in ~/jkbox/assets/needs-subtitles/
 * - Downloads English subtitles from OpenSubtitles.com
 * - Moves successful videos (with .srt) to ~/jkbox/assets/
 * - Moves failed videos to ~/jkbox/assets/failed/
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { downloadSubtitles } from '../packages/cinema-pippin/src/subtitle-downloader.js';

// Load .env file from jkbox root
const envPath = path.join(process.env.HOME!, 'jkbox/.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log(`✅ Loaded environment from: ${envPath}\n`);
} else {
  console.warn(`⚠️  No .env file found at: ${envPath}`);
  console.warn(`   Will use environment variables if set\n`);
}

const NEEDS_SUBTITLES_DIR = path.join(process.env.HOME!, 'jkbox/assets/needs-subtitles');
const ASSETS_DIR = path.join(process.env.HOME!, 'jkbox/assets');
const FAILED_DIR = path.join(process.env.HOME!, 'jkbox/assets/failed');

// OpenSubtitles.com credentials (free account required)
// Get API key at: https://www.opensubtitles.com/en/consumers
const API_KEY = process.env.OPENSUBTITLES_API_KEY;
const USERNAME = process.env.OPENSUBTITLES_USERNAME;
const PASSWORD = process.env.OPENSUBTITLES_PASSWORD;

if (!API_KEY || !USERNAME || !PASSWORD) {
  console.error('❌ ERROR: Missing OpenSubtitles credentials!');
  console.error('');
  console.error('Required in ~/jkbox/.env:');
  console.error('  OPENSUBTITLES_API_KEY="your_api_key"');
  console.error('  OPENSUBTITLES_USERNAME="your_username"');
  console.error('  OPENSUBTITLES_PASSWORD="your_password"');
  console.error('');
  console.error('Setup:');
  console.error('  1. Create account: https://www.opensubtitles.com/en/users/sign_up');
  console.error('  2. Get API key: https://www.opensubtitles.com/en/consumers');
  console.error('  3. Add all three to ~/jkbox/.env');
  process.exit(1);
}

interface ProcessingStats {
  total: number;
  succeeded: number;
  failed: number;
  rateLimited: boolean;
}

/**
 * Get all video files in a directory
 */
function getVideoFiles(dir: string): string[] {
  const files = fs.readdirSync(dir);
  return files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(ext);
  });
}

/**
 * Move file and its subtitle (if exists) to target directory
 */
function moveFiles(videoPath: string, targetDir: string): void {
  const videoFile = path.basename(videoPath);
  const srtPath = videoPath.replace(/\.[^.]+$/, '.srt');

  try {
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Move video
    const targetVideoPath = path.join(targetDir, videoFile);

    // Check if source exists
    if (!fs.existsSync(videoPath)) {
      console.error(`   ❌ Source file not found: ${videoPath}`);
      return;
    }

    // Use fs.renameSync (same filesystem) or copy+delete if cross-filesystem
    try {
      fs.renameSync(videoPath, targetVideoPath);
    } catch (renameError: any) {
      // If rename fails (e.g., cross-filesystem), copy and delete
      console.log(`   ⚠️  Rename failed, using copy instead...`);
      fs.copyFileSync(videoPath, targetVideoPath);
      fs.unlinkSync(videoPath);
    }
    console.log(`   📦 Moved video to: ${path.relative(process.env.HOME!, targetVideoPath)}`);

    // Move subtitle if it exists
    if (fs.existsSync(srtPath)) {
      const srtFile = path.basename(srtPath);
      const targetSrtPath = path.join(targetDir, srtFile);
      try {
        fs.renameSync(srtPath, targetSrtPath);
      } catch (renameError: any) {
        fs.copyFileSync(srtPath, targetSrtPath);
        fs.unlinkSync(srtPath);
      }
      console.log(`   📦 Moved subtitle to: ${path.relative(process.env.HOME!, targetSrtPath)}`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error moving files: ${error.message}`);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Process a single video file
 */
async function processVideo(videoPath: string): Promise<boolean> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📹 Processing: ${path.basename(videoPath)}`);
  console.log(`${'='.repeat(80)}`);

  try {
    const result = await downloadSubtitles(videoPath, API_KEY, USERNAME, PASSWORD, 'en');

    if (result.found) {
      // Success! Move to assets directory
      console.log(`\n✅ SUCCESS - Moving to assets/`);
      moveFiles(videoPath, ASSETS_DIR);
      return true;
    } else {
      // Check if quota exceeded (various error formats)
      // OpenSubtitles uses HTTP 406 when download quota exceeded
      const errorMsg = (result.error || '').toLowerCase();
      if (
        errorMsg.includes('406') ||
        errorMsg.includes('429') ||
        errorMsg.includes('quota_exceeded') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('download limit')
      ) {
        console.log(`\n⏸️  DAILY QUOTA EXCEEDED - Stopping processing`);
        console.log(`   ❌ ${result.error}`);
        console.log(`   📁 This video will remain in needs-subtitles/ for next run`);
        console.log(`   📊 Free accounts: 20 downloads/day`);
        console.log(`   ⏰ Reset time: Midnight UTC (4 PM PST / 7 PM EST)`);
        console.log(`   💡 Tip: Run this script again after quota resets`);
        console.log(`   🔗 Upgrade: https://www.opensubtitles.com/en/consumers`);
        return false; // Signal to stop processing (file NOT moved)
      }

      // Failed - move to failed directory
      console.log(`\n❌ FAILED - Moving to failed/`);
      console.log(`   Reason: ${result.error}`);
      moveFiles(videoPath, FAILED_DIR);
      return true;
    }
  } catch (error: any) {
    console.error(`\n❌ UNEXPECTED ERROR: ${error.message}`);
    console.log(`   Moving to failed/`);
    moveFiles(videoPath, FAILED_DIR);
    return true;
  }
}

/**
 * Main processing loop
 */
async function main() {
  console.log('🎬 Cinema Pippin - Subtitle Downloader');
  console.log('=====================================\n');

  // Ensure directories exist
  if (!fs.existsSync(NEEDS_SUBTITLES_DIR)) {
    console.error(`❌ Directory not found: ${NEEDS_SUBTITLES_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(FAILED_DIR)) {
    fs.mkdirSync(FAILED_DIR, { recursive: true });
  }

  // Get all video files
  const videoFiles = getVideoFiles(NEEDS_SUBTITLES_DIR);

  if (videoFiles.length === 0) {
    console.log('✅ No videos to process!');
    console.log(`   Directory: ${NEEDS_SUBTITLES_DIR}`);
    return;
  }

  console.log(`Found ${videoFiles.length} video(s) to process\n`);

  const stats: ProcessingStats = {
    total: videoFiles.length,
    succeeded: 0,
    failed: 0,
    rateLimited: false,
  };

  // Process each video
  for (const videoFile of videoFiles) {
    const videoPath = path.join(NEEDS_SUBTITLES_DIR, videoFile);
    const continueProcessing = await processVideo(videoPath);

    if (!continueProcessing) {
      // Rate limited - stop processing
      stats.rateLimited = true;
      break;
    }

    // Check if file was moved (it should no longer be in needs-subtitles)
    const stillInSource = fs.existsSync(videoPath);
    const inAssets = fs.existsSync(path.join(ASSETS_DIR, videoFile));
    const inFailed = fs.existsSync(path.join(FAILED_DIR, videoFile));

    if (!stillInSource) {
      if (inAssets) {
        stats.succeeded++;
      } else if (inFailed) {
        stats.failed++;
      } else {
        console.error(`   ⚠️  WARNING: File disappeared but not in assets or failed!`);
      }
    } else {
      console.error(`   ⚠️  WARNING: File still in source directory after processing!`);
      stats.failed++;
    }

    // Small delay between requests to be nice to the API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 PROCESSING COMPLETE');
  console.log(`${'='.repeat(80)}`);
  console.log(`Total videos:     ${stats.total}`);
  console.log(`✅ Succeeded:     ${stats.succeeded}`);
  console.log(`❌ Failed:        ${stats.failed}`);

  if (stats.rateLimited) {
    console.log(`\n⚠️  DAILY QUOTA EXCEEDED - Processing stopped`);
    console.log(`   Processed: ${stats.succeeded + stats.failed}/${stats.total} videos`);
    console.log(`   Remaining: ${stats.total - stats.succeeded - stats.failed} videos`);
    console.log(`   ⏰ Quota resets: Midnight UTC (4 PM PST / 7 PM EST)`);
    console.log(`   💡 Run this script again after quota resets to continue!`);
  }

  const remaining = getVideoFiles(NEEDS_SUBTITLES_DIR).length;
  if (remaining > 0) {
    console.log(`\n📁 Files remaining in needs-subtitles/: ${remaining}`);
  }

  console.log(`\n✅ Success directory: ${ASSETS_DIR}`);
  console.log(`❌ Failed directory:  ${FAILED_DIR}`);
}

// Run the script
main().catch((error) => {
  console.error(`\n💥 FATAL ERROR: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
