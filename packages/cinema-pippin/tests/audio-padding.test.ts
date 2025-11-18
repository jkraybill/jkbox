import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

/**
 * Test that video extraction properly silences audio in padding regions
 *
 * IMPORTANT: This test requires ffmpeg to be installed
 */
describe('Audio Padding Silence', () => {
  const testVideoPath = '/home/jk/jkbox/generated/clips/kaka-sebastiane720p/1/kaka-sebastiane720p-1-question.mp4';

  // Skip if test video doesn't exist
  const skipIfNoVideo = !existsSync(testVideoPath);

  it.skipIf(skipIfNoVideo)('should have silent audio in first 1 second (padding region)', () => {
    // Extract volume stats from first second
    const output = execSync(
      `ffmpeg -i "${testVideoPath}" -af "volumedetect,atrim=start=0:end=1" -f null - 2>&1`,
      { encoding: 'utf-8' }
    );

    // Extract mean_volume value
    const meanMatch = output.match(/mean_volume:\s*(-?\d+\.?\d*)\s*dB/);
    const maxMatch = output.match(/max_volume:\s*(-?\d+\.?\d*)\s*dB/);

    expect(meanMatch, 'Should find mean_volume in ffmpeg output').not.toBeNull();
    expect(maxMatch, 'Should find max_volume in ffmpeg output').not.toBeNull();

    const meanVolume = parseFloat(meanMatch![1]);
    const maxVolume = parseFloat(maxMatch![1]);

    // Silent audio should be -inf dB or very close to it (< -90 dB)
    // Note: ffmpeg volumedetect reports -91.0 dB for silent audio (not truly -inf)
    expect(meanVolume).toBeLessThan(-90, 'First second should be silent (mean volume < -90 dB)');
    expect(maxVolume).toBeLessThan(-90, 'First second should be silent (max volume < -90 dB)');
  });

  it.skipIf(skipIfNoVideo)('should have silent audio in last 1 second (padding region)', () => {
    // Get video duration
    const durationOutput = execSync(
      `ffprobe -i "${testVideoPath}" -show_entries format=duration -v quiet -of csv="p=0"`,
      { encoding: 'utf-8' }
    );
    const duration = parseFloat(durationOutput.trim());

    // Extract volume stats from last second
    const lastSecondStart = duration - 1.0;
    const output = execSync(
      `ffmpeg -i "${testVideoPath}" -af "volumedetect,atrim=start=${lastSecondStart}:end=${duration}" -f null - 2>&1`,
      { encoding: 'utf-8' }
    );

    // Extract volume values
    const meanMatch = output.match(/mean_volume:\s*(-?\d+\.?\d*)\s*dB/);
    const maxMatch = output.match(/max_volume:\s*(-?\d+\.?\d*)\s*dB/);

    expect(meanMatch, 'Should find mean_volume in ffmpeg output').not.toBeNull();
    expect(maxMatch, 'Should find max_volume in ffmpeg output').not.toBeNull();

    const meanVolume = parseFloat(meanMatch![1]);
    const maxVolume = parseFloat(maxMatch![1]);

    // Silent audio should be < -90 dB
    expect(meanVolume).toBeLessThan(-90, 'Last second should be silent (mean volume < -90 dB)');
    expect(maxVolume).toBeLessThan(-90, 'Last second should be silent (max volume < -90 dB)');
  });

  it.skipIf(skipIfNoVideo)('should have normal audio in middle section (non-padding region)', () => {
    // Extract volume stats from middle (seconds 5-6)
    const output = execSync(
      `ffmpeg -i "${testVideoPath}" -af "volumedetect,atrim=start=5:end=6" -f null - 2>&1`,
      { encoding: 'utf-8' }
    );

    // Extract volume values
    const meanMatch = output.match(/mean_volume:\s*(-?\d+\.?\d*)\s*dB/);
    const maxMatch = output.match(/max_volume:\s*(-?\d+\.?\d*)\s*dB/);

    expect(meanMatch, 'Should find mean_volume in ffmpeg output').not.toBeNull();
    expect(maxMatch, 'Should find max_volume in ffmpeg output').not.toBeNull();

    const meanVolume = parseFloat(meanMatch![1]);
    const maxVolume = parseFloat(maxMatch![1]);

    // Normal audio should be > -90 dB (audible)
    expect(meanVolume).toBeGreaterThan(-90, 'Middle section should have audible audio (mean volume > -90 dB)');
    expect(maxVolume).toBeGreaterThan(-90, 'Middle section should have audible audio (max volume > -90 dB)');
  });
});
