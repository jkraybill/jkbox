# Final OCR Status

## Script Status
✅ **Script created and working:** `/home/jk/jkbox/scripts/ocr-subtitles.sh`

## What Works
- ✅ MKV files with dvd_subtitle → Extract with mkvextract → OCR with vobsub2srt
- ✅ Successfully processed: belle-de-jour-1967.mkv (4,782 lines of subtitles)
- ✅ MP4 remux approach verified working in manual test

## Current Results  
- **Total processed:** 69 files across 2 runs
- **Successful:** 1 file (belle-de-jour-1967.mkv)
- **Failed:** 7 files (2 PGS format, 5 MP4 remux failures)
- **Skipped:** 61 files (no bitmap subtitles)

## Files
- **In assets:** 26 SRT files, 1 video (belle-de-jour)
- **In needs-subtitles:** 69 videos remaining

## Known Issues
1. **PGS format unsupported:** vobsub2srt doesn't handle hdmv_pgs_subtitle (2 files)
2. **MP4 remux failures:** Needs investigation (5 files failed during testing, but manual test worked)

## Script Location
`~/jkbox/scripts/ocr-subtitles.sh`

## Usage
```bash
~/jkbox/scripts/ocr-subtitles.sh
```

Scans `~/jkbox/assets/needs-subtitles/` for videos with bitmap subtitles, OCRs them, creates SRT files, and moves both video + SRT to `~/jkbox/assets/` on success.

