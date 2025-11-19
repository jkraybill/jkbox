#!/usr/bin/env node

/**
 * Video File Organizer
 *
 * Scans video files recursively, checks for subtitle streams,
 * renames and organizes them based on subtitle availability.
 */

import { readdir, stat, rename, rmdir, copyFile, unlink } from 'fs/promises';
import { join, dirname, extname, basename } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const SOURCE_DIR = '/mnt/c/Users/jerem/AppData/Roaming/Kodi/userdata/addon_data/plugin.video.fenlight/Movies Downloads';
const DEST_WITH_SUBS = '/home/jk/jkbox/assets';
const DEST_WITHOUT_SUBS = '/home/jk/jkbox/assets/needs-subtitles';

// Video file extensions to process
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];

interface VideoInfo {
  path: string;
  hasSubtitles: boolean;
  error?: string;
}

/**
 * Check if a file has TEXT-BASED subtitle streams (not bitmap) using ffprobe
 *
 * Text-based formats that can be extracted to SRT:
 * - subrip (SRT)
 * - ass / ssa (Advanced SubStation Alpha)
 * - mov_text (MP4 subtitles)
 * - webvtt (WebVTT)
 * - text (generic text)
 *
 * Bitmap formats that need OCR (REJECTED):
 * - dvd_subtitle (VobSub)
 * - hdmv_pgs_subtitle (Blu-ray PGS)
 * - dvb_subtitle (DVB subtitles)
 */
async function hasSubtitleStream(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams s -show_entries stream=codec_name -of csv=p=0 "${filePath}"`
    );

    const codecNames = stdout.trim().split('\n').filter(line => line.length > 0);

    if (codecNames.length === 0) {
      return false;
    }

    // Text-based subtitle codecs that can be extracted to SRT
    const textCodecs = ['subrip', 'ass', 'ssa', 'mov_text', 'webvtt', 'text', 'srt'];

    // Check if any subtitle stream is text-based
    const hasTextSubtitle = codecNames.some(codec => textCodecs.includes(codec));

    if (!hasTextSubtitle) {
      console.log(`  ⚠️  Found subtitle streams but they are bitmap-based (${codecNames.join(', ')}) - need OCR`);
    }

    return hasTextSubtitle;
  } catch (error) {
    console.error(`  ⚠️  Error checking subtitles for ${basename(filePath)}:`, error);
    return false;
  }
}

/**
 * Sanitize filename: lowercase, replace spaces/dots with hyphens, remove non-alphanumeric
 * If sanitization results in empty filename, keep original name
 */
function sanitizeFilename(filename: string): string {
  const ext = extname(filename);
  const nameWithoutExt = basename(filename, ext);

  // Lowercase
  let sanitized = nameWithoutExt.toLowerCase();

  // Replace spaces with hyphens
  sanitized = sanitized.replace(/\s+/g, '-');

  // Replace dots with hyphens
  sanitized = sanitized.replace(/\./g, '-');

  // Remove all characters except a-z, 0-9, and hyphens
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '');

  // Remove multiple consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // If sanitization removed everything, keep original name
  if (sanitized.length === 0) {
    return filename;
  }

  return sanitized + ext.toLowerCase();
}

/**
 * Get all video files recursively
 */
async function getVideoFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await getVideoFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}

/**
 * Try to delete directory if it's empty
 */
async function deleteIfEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await readdir(dirPath);
    if (entries.length === 0) {
      await rmdir(dirPath);
      console.log(`  🗑️  Deleted empty directory: ${dirPath}`);
      return true;
    }
  } catch (error) {
    // Directory might not exist or not be empty - that's okay
  }
  return false;
}

/**
 * Process a single video file
 */
async function processVideoFile(filePath: string, dryRun: boolean = false): Promise<void> {
  const filename = basename(filePath);
  const parentDir = dirname(filePath);

  console.log(`\n📹 Processing: ${filename}`);

  // Check for subtitles
  console.log('  🔍 Checking for subtitle streams...');
  const hasSubs = await hasSubtitleStream(filePath);

  if (hasSubs) {
    console.log('  ✅ Has subtitle stream (SRT or similar)');
  } else {
    console.log('  ❌ No subtitle stream found');
  }

  // Generate sanitized filename
  const newFilename = sanitizeFilename(filename);
  console.log(`  📝 Sanitized filename: ${filename} → ${newFilename}`);

  // Determine destination
  const destDir = hasSubs ? DEST_WITH_SUBS : DEST_WITHOUT_SUBS;
  const destPath = join(destDir, newFilename);

  console.log(`  📂 Destination: ${destDir}/`);

  if (dryRun) {
    console.log('  🔄 [DRY RUN] Would move file');
  } else {
    // Move file (using copy+delete for cross-filesystem compatibility)
    try {
      // Try rename first (fast if same filesystem)
      try {
        await rename(filePath, destPath);
        console.log(`  ✅ Moved successfully (rename)`);
      } catch (renameError: any) {
        // If rename fails due to cross-device link, use copy+delete
        if (renameError.code === 'EXDEV') {
          console.log('  🔄 Cross-filesystem move detected, using copy+delete...');
          await copyFile(filePath, destPath);
          await unlink(filePath);
          console.log(`  ✅ Moved successfully (copy+delete)`);
        } else {
          throw renameError;
        }
      }

      // Try to delete parent directory if empty
      await deleteIfEmpty(parentDir);

      // Try to delete parent's parent if it's also empty (for nested structures)
      const grandparentDir = dirname(parentDir);
      if (grandparentDir !== SOURCE_DIR) {
        await deleteIfEmpty(grandparentDir);
      }
    } catch (error) {
      console.error(`  ❌ Error moving file:`, error);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🎬 Video File Organizer');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📁 Source: ${SOURCE_DIR}`);
  console.log(`📁 Destination (with subs): ${DEST_WITH_SUBS}`);
  console.log(`📁 Destination (no subs): ${DEST_WITHOUT_SUBS}`);
  if (dryRun) {
    console.log('🔄 DRY RUN MODE - No files will be moved');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check if source directory exists
  try {
    await stat(SOURCE_DIR);
  } catch (error) {
    console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
    console.error('Make sure the path is correct for WSL (use /mnt/c/... for Windows paths)');
    process.exit(1);
  }

  // Get all video files
  console.log('🔍 Scanning for video files...\n');
  const videoFiles = await getVideoFiles(SOURCE_DIR);

  if (videoFiles.length === 0) {
    console.log('No video files found.');
    return;
  }

  console.log(`Found ${videoFiles.length} video file(s)\n`);

  // Process each file
  for (let i = 0; i < videoFiles.length; i++) {
    console.log(`\n[${ i + 1}/${videoFiles.length}]`);
    await processVideoFile(videoFiles[i], dryRun);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Processing complete!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
