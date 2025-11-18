# OCR Subtitle Extraction Results

## Summary

**Total files processed:** 70  
**Successful:** 1 (belle-de-jour-1967.mkv)  
**Failed:** 8  
**Skipped:** 61 (no bitmap subtitles)

## Successfully Processed

1. belle-de-jour-1967.mkv → belle-de-jour-1967.srt (4,782 lines)
   - Format: dvd_subtitle
   - Method: mkvextract → vobsub2srt
   - ✅ Moved to ~/jkbox/assets/

## Failure Analysis

### Category 1: MP4 Extraction Failures (6 files)
**Issue:** ffmpeg cannot extract dvd_subtitle to VobSub format (.idx/.sub)  
**Error:** `Unable to choose an output format for '*.idx'`  
**Solution needed:** Alternative extraction method for MP4 containers

### Category 2: PGS Format Unsupported (2 files)  
**Issue:** vobsub2srt doesn't support hdmv_pgs_subtitle format  
**Solution needed:** Different OCR tool (e.g., SubtitleEdit, pgsrip)

## Files Still in needs-subtitles

- 69 video files remaining
- Most lack bitmap subtitles entirely
- 8 have bitmap subtitles but failed extraction/OCR

## Script Status

✅ Works: MKV files with dvd_subtitle  
❌ Doesn't work: MP4 with dvd_subtitle, PGS format  
⏭️ Skipped: Files without bitmap subtitles

## Next Steps

1. Implement MP4 subtitle extraction (need different tool/approach)
2. Add PGS subtitle support (SubtitleEdit CLI or pgsrip)
3. Re-run script on remaining files

