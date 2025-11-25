# Subtitle Downloader - Setup & Usage

Automated subtitle download system for Cinema Pippin videos.

## 🎯 What It Does

Automatically processes videos in `~/jkbox/assets/needs-subtitles/`:
- Downloads English subtitles from OpenSubtitles.com (10M+ database)
- Uses file hash matching for accurate results
- Falls back to filename search if hash fails
- **SUCCESS:** Moves video + .srt to `~/jkbox/assets/`
- **FAILURE:** Moves video to `~/jkbox/assets/failed/`

## 🔑 One-Time Setup (Required)

### 1. Create Free OpenSubtitles Account

Visit: https://www.opensubtitles.com/en/users/sign_up

**Free Account Limits:**
- 20 subtitle downloads per day
- 10 subtitle downloads per 10 seconds
- Sufficient for ~100 films over 5 days

**VIP Account ($12/year):**
- 1000 downloads per day
- Process all films in ~1 day

### 2. Get Your API Key

1. Log in to OpenSubtitles.com
2. Visit: https://www.opensubtitles.com/en/consumers
3. Click "Create new consumer"
4. App name: `Cinema Pippin` (or any name)
5. Copy your API key

### 3. Add Credentials to .env

Add these three lines to `~/jkbox/.env`:

```bash
# Add to your .env file
echo 'OPENSUBTITLES_API_KEY="your_api_key_here"' >> ~/jkbox/.env
echo 'OPENSUBTITLES_USERNAME="your_username"' >> ~/jkbox/.env
echo 'OPENSUBTITLES_PASSWORD="your_password"' >> ~/jkbox/.env
```

**All three are required:**
- `OPENSUBTITLES_API_KEY` - Your consumer API key
- `OPENSUBTITLES_USERNAME` - Your login username
- `OPENSUBTITLES_PASSWORD` - Your login password

The script automatically loads from `~/jkbox/.env` - no need to export anything!

**Option B: Environment Variable**
```bash
# Add to your ~/.bashrc
echo 'export OPENSUBTITLES_API_KEY="your_api_key_here"' >> ~/.bashrc
source ~/.bashrc
```

**Verify it's set:**
```bash
# Check .env file
grep OPENSUBTITLES_API_KEY ~/jkbox/.env

# Or check environment
echo $OPENSUBTITLES_API_KEY
```

## 🚀 Usage

Simply run the script:

```bash
~/jkbox/scripts/download-subtitles.sh
```

The script will:
1. Find all videos in `~/jkbox/assets/needs-subtitles/`
2. Search for each video's subtitles (by hash, then by filename)
3. Download .srt file next to video
4. Move video + subtitle to appropriate directory

## 📊 Example Output

```
🎬 Cinema Pippin - Subtitle Downloader
=====================================

Found 3 video(s) to process

================================================================================
📹 Processing: amarcord-1973-1080p-criterion-bluray-x265-lion.mkv
================================================================================

🔍 Searching subtitles for: amarcord-1973-1080p-criterion-bluray-x265-lion.mkv
   Hash: 8e245d9679d31e12
   Movie: amarcord (1973)
   Searching by hash...
   ✅ Found: Amarcord.1973.1080p.BluRay.x265
   Language: en
   Downloads: 15234
   Requesting download link...
   Downloading...
   ✅ Saved: amarcord-1973-1080p-criterion-bluray-x265-lion.srt

✅ SUCCESS - Moving to assets/
   📦 Moved video to: jkbox/assets/amarcord-1973-1080p-criterion-bluray-x265-lion.mkv
   📦 Moved subtitle to: jkbox/assets/amarcord-1973-1080p-criterion-bluray-x265-lion.srt

================================================================================
📊 PROCESSING COMPLETE
================================================================================
Total videos:     3
✅ Succeeded:     2
❌ Failed:        1

✅ Success directory: /home/jk/jkbox/assets
❌ Failed directory:  /home/jk/jkbox/assets/failed
```

## 🔄 Rate Limiting

If you hit the daily limit (20 downloads for free accounts), the script will stop:

```
⏸️  RATE LIMITED - Processing stopped
   Free accounts: 20 downloads/day
   Resume this script tomorrow or upgrade to VIP
```

Just run the script again the next day - it will only process remaining videos!

## 🛠️ Troubleshooting

### "API key not set"
```bash
# Make sure you exported the variable:
export OPENSUBTITLES_API_KEY="your_key"

# Or add to ~/.bashrc permanently
```

### "No subtitles found"
The video may have:
- Non-standard filename (try renaming to: `MovieName (Year).ext`)
- Very rare/obscure film (check manually at opensubtitles.com)
- Non-English original title (try adding English title to filename)

Videos that fail are automatically moved to `~/jkbox/assets/failed/` for manual review.

### "Hash calculation failed"
File may be too small or corrupted. The script will try filename search as fallback.

## 📁 Directory Structure

```
~/jkbox/assets/
├── needs-subtitles/     # Input: Videos needing subtitles
│   ├── film1.mkv
│   └── film2.mp4
├── failed/              # Output: Videos with no subtitles found
│   └── obscure-film.avi
└── (root)               # Output: Videos with subtitles successfully downloaded
    ├── film1.mkv
    ├── film1.srt        # ← Downloaded subtitle
    ├── film2.mp4
    └── film2.srt        # ← Downloaded subtitle
```

## 🔧 Technical Details

**Subtitle Search Algorithm:**
1. Calculate OpenSubtitles hash (most accurate - matches exact file)
2. Search by hash in OpenSubtitles database
3. If no results, parse filename and search by movie name + year
4. Download best match (highest download count)

**Supported Video Formats:**
- `.mp4`, `.mkv`, `.avi`, `.mov`, `.wmv`, `.flv`, `.webm`

**File Naming Tips for Best Results:**
- ✅ `Amarcord (1973).mkv` - Year helps matching
- ✅ `the-400-blows-1959-1080p.mp4` - Quality tags OK
- ⚠️  `movie_rip_x264.mkv` - Generic names may fail
- ⚠️  `random123.avi` - Will likely fail

## 🔗 Related Scripts

After downloading subtitles, process videos with:
```bash
~/jkbox/scripts/batch-process-videos.sh
```

This will create Cinema Pippin game clips from your videos with subtitles!

## 📚 API Documentation

- OpenSubtitles API: https://opensubtitles.stoplight.io/docs/opensubtitles-api
- Rate limits: https://opensubtitles.tawk.help/article/about-the-api
- Upgrade to VIP: https://www.opensubtitles.com/en/vip

---

**Questions?** Check JOURNAL.md for session notes or create an issue in the repo.
