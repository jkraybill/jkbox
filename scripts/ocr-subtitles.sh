#!/bin/bash
# OCR bitmap subtitles from videos and move successful ones to assets/

set -euo pipefail

NEEDS_SUBS_DIR="$HOME/jkbox/assets/needs-subtitles"
ASSETS_DIR="$HOME/jkbox/assets"
LOG_FILE="$HOME/jkbox/ocr-subtitles.log"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if vobsub2srt is available
if ! command -v vobsub2srt &> /dev/null; then
    error "vobsub2srt not found. Install with: snap install vobsub2srt"
    exit 1
fi

# Create temp directory for processing (use home dir for snap access)
TEMP_DIR="$HOME/jkbox/temp-ocr"
mkdir -p "$TEMP_DIR"
trap "rm -rf $TEMP_DIR/*" EXIT

log "Starting OCR subtitle extraction..."
log "Source: $NEEDS_SUBS_DIR"
log "Target: $ASSETS_DIR"
log "Temp: $TEMP_DIR"
echo ""

# Counters
total=0
success=0
failed=0
skipped=0

# Process all video files recursively
while IFS= read -r -d '' video_file; do
    ((total++))

    filename=$(basename "$video_file")
    basename_no_ext="${filename%.*}"

    log "Processing ($total): $filename"

    # Check if video has bitmap subtitle streams
    subtitle_streams=$(ffprobe -v error -select_streams s -show_entries stream=codec_name -of csv=p=0 "$video_file" 2>/dev/null || echo "")

    if [ -z "$subtitle_streams" ]; then
        warn "  No subtitle streams found, skipping"
        ((skipped++))
        echo ""
        continue
    fi

    # Check if any are bitmap subtitles (hdmv_pgs_subtitle, dvd_subtitle, etc.)
    if ! echo "$subtitle_streams" | grep -qE "hdmv_pgs_subtitle|dvd_subtitle|dvdsub|pgssub"; then
        # Check if there are text subtitles already
        if echo "$subtitle_streams" | grep -qE "subrip|ass|ssa"; then
            warn "  Already has text subtitles, skipping"
            ((skipped++))
        else
            warn "  Unknown subtitle format: $subtitle_streams"
            ((skipped++))
        fi
        echo ""
        continue
    fi

    log "  Found bitmap subtitles: $subtitle_streams"

    # Get subtitle track number
    subtitle_track=$(ffprobe -v error -select_streams s:0 -show_entries stream=index -of csv=p=0 "$video_file" 2>/dev/null || echo "")

    if [ -z "$subtitle_track" ]; then
        error "  Could not determine subtitle track number"
        ((failed++))
        echo ""
        continue
    fi

    log "  Subtitle track: $subtitle_track"

    # Extract bitmap subtitle to VobSub format (.idx/.sub)
    cd "$TEMP_DIR"
    log "  Extracting subtitle stream to VobSub format..."

    # Use mkvextract for MKV files
    if [[ "$filename" =~ \.mkv$ ]]; then
        if mkvextract tracks "$video_file" "${subtitle_track}:${basename_no_ext}.sub" 2>&1 | tee -a "$LOG_FILE" | grep -q "Progress: 100%"; then
            log "  ✓ Subtitle stream extracted"
        else
            error "  Failed to extract subtitle stream with mkvextract"
            ((failed++))
            rm -f "$TEMP_DIR"/*
            cd - > /dev/null
            echo ""
            continue
        fi
    else
        # For MP4/AVI: remux to MKV temporarily, then extract
        log "  Remuxing to MKV for subtitle extraction..."
        temp_mkv="${basename_no_ext}_temp.mkv"

        if ffmpeg -i "$video_file" -map 0:s:0 -c copy "$temp_mkv" -y 2>&1 | tee -a "$LOG_FILE" | grep -q "Output"; then
            log "  ✓ Remuxed to temporary MKV"

            # Extract subtitle from temp MKV
            if mkvextract tracks "$temp_mkv" "0:${basename_no_ext}.sub" 2>&1 | tee -a "$LOG_FILE" | grep -q "Progress: 100%"; then
                log "  ✓ Subtitle stream extracted"
                rm -f "$temp_mkv"  # Clean up temp MKV
            else
                error "  Failed to extract subtitle stream from temp MKV"
                ((failed++))
                rm -f "$TEMP_DIR"/*
                cd - > /dev/null
                echo ""
                continue
            fi
        else
            error "  Failed to remux to MKV"
            ((failed++))
            rm -f "$TEMP_DIR"/*
            cd - > /dev/null
            echo ""
            continue
        fi
    fi

    # Run vobsub2srt on extracted subtitle (without --lang flag, works better)
    log "  Running OCR..."

    if vobsub2srt "$basename_no_ext" 2>&1 | tee -a "$LOG_FILE" | grep -q "Wrote Subtitles"; then
        # Check if SRT file was created
        srt_file="${basename_no_ext}.srt"

        if [ -f "$srt_file" ] && [ -s "$srt_file" ]; then
            log "  ✓ OCR successful ($(wc -l < "$srt_file") lines), moving files..."

            # Move SRT to assets
            mv "$srt_file" "$ASSETS_DIR/"

            # Move video to assets
            mv "$video_file" "$ASSETS_DIR/"

            log "  ✓ Moved to: $ASSETS_DIR/"
            ((success++))
        else
            error "  SRT file is empty or missing"
            ((failed++))
        fi
    else
        error "  vobsub2srt failed"
        ((failed++))
    fi

    # Clean up temp directory
    rm -f "$TEMP_DIR"/*
    cd - > /dev/null

    echo ""

done < <(find "$NEEDS_SUBS_DIR" -type f \( -iname "*.mkv" -o -iname "*.mp4" -o -iname "*.avi" \) -print0) || true

# Summary
echo "================================================"
log "OCR Subtitle Extraction Complete"
echo "================================================"
log "Total videos processed: $total"
log "Successful: ${GREEN}$success${NC}"
log "Failed: ${RED}$failed${NC}"
log "Skipped: ${YELLOW}$skipped${NC}"
log "Log file: $LOG_FILE"
