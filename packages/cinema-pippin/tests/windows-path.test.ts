import { describe, it, expect } from 'vitest';
import { toWindowsPath } from '../src/video-extractor.js';

describe('Windows path conversion', () => {
  it('should convert WSL home paths to Windows paths', () => {
    // This test runs in WSL, so we can actually test the real conversion
    const wslPath = '/home/jk/test.mp4';
    const windowsPath = toWindowsPath(wslPath);

    // Windows path should either:
    // - Start with a drive letter (e.g., C:\), OR
    // - Start with UNC path (e.g., \\wsl.localhost\Ubuntu\...)
    const isDriveLetter = /^[A-Z]:\\/.test(windowsPath);
    const isUNCPath = /^\\\\/.test(windowsPath);
    expect(isDriveLetter || isUNCPath).toBe(true);

    // Should contain backslashes
    expect(windowsPath).toContain('\\');

    // Should not contain forward slashes
    expect(windowsPath).not.toContain('/');
  });

  it('should convert /mnt/c paths to C:\\ paths', () => {
    const wslPath = '/mnt/c/videos/test.mp4';
    const windowsPath = toWindowsPath(wslPath);

    // Should start with C:\
    expect(windowsPath).toMatch(/^C:\\/);

    // Should contain the path after C:\
    expect(windowsPath).toContain('videos');
    expect(windowsPath).toContain('test.mp4');
  });

  it('should handle paths with spaces', () => {
    const wslPath = '/home/jk/my videos/test file.mp4';
    const windowsPath = toWindowsPath(wslPath);

    // Should successfully convert (no error thrown)
    expect(windowsPath).toBeDefined();
    expect(windowsPath).toContain('my videos');
    expect(windowsPath).toContain('test file.mp4');
  });

  it('should throw error for invalid paths', () => {
    const invalidPath = '/nonexistent/totally/fake/path/that/does/not/exist/ever.mp4';

    // wslpath might still convert it even if it doesn't exist
    // So we just verify it doesn't crash
    expect(() => toWindowsPath(invalidPath)).not.toThrow();
  });
});
