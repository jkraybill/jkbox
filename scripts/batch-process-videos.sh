#!/bin/bash
# Batch process all videos in ~/jkbox/assets through the Cinema Pippin pipeline
# Moves successful videos to succeeded/, failed videos to failed/

set -euo pipefail

ASSETS_DIR="$HOME/jkbox/assets"
CLIPS_DIR="$HOME/jkbox/generated/clips"
SUCCEEDED_DIR="$ASSETS_DIR/succeeded"
FAILED_DIR="$ASSETS_DIR/failed"
NEEDS_SUBS_DIR="$ASSETS_DIR/needs-subtitles"
LOG_FILE="$HOME/jkbox/batch-process.log"
PIPPIN_DIR="$HOME/jkbox/packages/cinema-pippin"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Create output directories
mkdir -p "$SUCCEEDED_DIR"
mkdir -p "$FAILED_DIR"
mkdir -p "$NEEDS_SUBS_DIR"

log "Starting batch video processing..."
log "Source: $ASSETS_DIR"
log "Output clips: $CLIPS_DIR"
log "Success target: $SUCCEEDED_DIR"
log "Failed target: $FAILED_DIR"
log "Needs OCR: $NEEDS_SUBS_DIR"
echo ""

# Counters
total=0
already_processed=0
success=0
failed=0
needs_ocr=0

# Main loop - continue until no video files left in assets/
while true; do
    # Find all video files in assets (not in subdirs)
    video_files=()
    while IFS= read -r -d '' file; do
        video_files+=("$file")
    done < <(find "$ASSETS_DIR" -maxdepth 1 -type f \( -iname "*.mkv" -o -iname "*.mp4" -o -iname "*.avi" \) -print0 2>/dev/null || true)

    # Check if any video files remain
    if [ ${#video_files[@]} -eq 0 ]; then
        break
    fi

    # Pick a random video from the array
    random_index=$((RANDOM % ${#video_files[@]}))
    video_file="${video_files[$random_index]}"

    total=$((total + 1))

    filename=$(basename "$video_file")
    basename_no_ext="${filename%.*}"
    extension="${filename##*.}"

    log "Processing ($total): $filename"

    # Step 2: Check if clips directory already exists
    clips_dir="$CLIPS_DIR/$basename_no_ext"
    if [ -d "$clips_dir" ]; then
        info "  ✓ Clips directory already exists, moving to succeeded/"

        # Move video file and any matching .srt file
        mv "$video_file" "$SUCCEEDED_DIR/"
        if [ -f "$ASSETS_DIR/$basename_no_ext.srt" ]; then
            mv "$ASSETS_DIR/$basename_no_ext.srt" "$SUCCEEDED_DIR/"
            info "  ✓ Moved $basename_no_ext.$extension + .srt to succeeded/"
        else
            info "  ✓ Moved $basename_no_ext.$extension to succeeded/"
        fi

        already_processed=$((already_processed + 1))
        echo ""
        continue
    fi

    # Step 3: Run npm run cli process with try/catch
    info "  Running pipeline: npm run cli process $basename_no_ext"
    info "  (Audio stream selection will be interactive if needed)"
    echo ""

    # Capture output to temp file for diagnostics, but DON'T redirect stdin (allow interactive prompts)
    TEMP_ERROR_LOG=$(mktemp)

    # Run pipeline with FULL TTY access (no background, direct output, allow keyboard input)
    # We tee output to both console and log file for diagnostics
    set +e
    (cd "$PIPPIN_DIR" && npm run cli process "$basename_no_ext" 2>&1 | tee -a "$LOG_FILE" | tee "$TEMP_ERROR_LOG")
    pipeline_exit_code=$?
    set -e

    echo ""

    if [ $pipeline_exit_code -eq 0 ]; then
        # Step 4a: Check if clips directory was created
        if [ -d "$clips_dir" ]; then
            log "  ✓ Pipeline succeeded - clips directory created"

            # Move video file and any matching .srt file to succeeded/
            mv "$video_file" "$SUCCEEDED_DIR/"
            if [ -f "$ASSETS_DIR/$basename_no_ext.srt" ]; then
                mv "$ASSETS_DIR/$basename_no_ext.srt" "$SUCCEEDED_DIR/"
                log "  ✓ Moved $basename_no_ext.$extension + .srt to succeeded/"
            else
                log "  ✓ Moved $basename_no_ext.$extension to succeeded/"
            fi

            success=$((success + 1))
        else
            # Step 4b: Pipeline succeeded but no clips directory (unexpected)
            set +e

            error "  ⚠️  UNEXPECTED: Pipeline succeeded but no clips directory created"
            error ""
            error "  📊 DIAGNOSTICS:"
            error "  Expected clips dir: $clips_dir"
            error "  Video file: $video_file"

            video_size=$(du -h "$video_file" 2>/dev/null | cut -f1 || echo "unknown")
            error "  Video size: $video_size"

            if [ -f "$ASSETS_DIR/$basename_no_ext.srt" ]; then
                srt_lines=$(wc -l < "$ASSETS_DIR/$basename_no_ext.srt" 2>/dev/null || echo 0)
                error "  SRT file: EXISTS ($srt_lines lines)"
            else
                error "  SRT file: MISSING"
            fi
            error ""
            error "  📝 LAST 30 LINES OF OUTPUT:"

            if [ -f "$TEMP_ERROR_LOG" ]; then
                tail -30 "$TEMP_ERROR_LOG" 2>/dev/null | while IFS= read -r line; do
                    error "    $line"
                done || true
            else
                error "    (Error log file not found)"
            fi

            error ""

            # Move to failed
            mv "$video_file" "$FAILED_DIR/" 2>/dev/null || error "  Failed to move video file"
            if [ -f "$ASSETS_DIR/$basename_no_ext.srt" ]; then
                mv "$ASSETS_DIR/$basename_no_ext.srt" "$FAILED_DIR/" 2>/dev/null || error "  Failed to move SRT file"
                error "  Moved $basename_no_ext.$extension + .srt to failed/"
            else
                error "  Moved $basename_no_ext.$extension to failed/"
            fi

            failed=$((failed + 1))

            set -e
        fi
    else
        # Step 4b: Pipeline failed - disable errexit for entire error handling block
        set +e

        # Check if this is a bitmap subtitle error (needs OCR)
        is_bitmap_subtitle=false
        if [ -f "$TEMP_ERROR_LOG" ] && grep -q "BITMAP SUBTITLE FORMAT" "$TEMP_ERROR_LOG" 2>/dev/null; then
            is_bitmap_subtitle=true
        fi

        if [ "$is_bitmap_subtitle" = true ]; then
            # Special case: Bitmap subtitles need OCR
            warn ""
            warn "  📺 BITMAP SUBTITLES DETECTED - Needs OCR"
            warn ""
            warn "  File: $basename_no_ext.$extension"
            warn "  Subtitle format: dvd_subtitle/PGS (bitmap-based)"
            warn "  Action: Moving to needs-subtitles/ for OCR processing"
            warn ""

            # Move to needs-subtitles
            mv "$video_file" "$NEEDS_SUBS_DIR/" 2>/dev/null || warn "  Failed to move video file"
            if [ -f "$ASSETS_DIR/$basename_no_ext.srt" ]; then
                mv "$ASSETS_DIR/$basename_no_ext.srt" "$NEEDS_SUBS_DIR/" 2>/dev/null || warn "  Failed to move SRT file"
                warn "  ✓ Moved $basename_no_ext.$extension + .srt to needs-subtitles/"
            else
                warn "  ✓ Moved $basename_no_ext.$extension to needs-subtitles/"
            fi

            needs_ocr=$((needs_ocr + 1))
        else
            # Regular failure - show full diagnostics
            error ""
            error "  ❌ PIPELINE FAILED - Exit code: $pipeline_exit_code"
            error ""
            error "  📊 DIAGNOSTICS:"
            error "  File: $basename_no_ext.$extension"
            error "  Full path: $video_file"

            # Get video size safely
            video_size=$(du -h "$video_file" 2>/dev/null | cut -f1 || echo "unknown")
            error "  Video size: $video_size"

            # Check SRT file safely
            if [ -f "$ASSETS_DIR/$basename_no_ext.srt" ]; then
                srt_lines=$(wc -l < "$ASSETS_DIR/$basename_no_ext.srt" 2>/dev/null || echo 0)
                srt_size=$(du -h "$ASSETS_DIR/$basename_no_ext.srt" 2>/dev/null | cut -f1 || echo "unknown")
                error "  SRT file: EXISTS ($srt_lines lines, $srt_size)"
            else
                error "  SRT file: MISSING (pipeline will try to extract from video)"
            fi

            error "  Working dir: $PIPPIN_DIR"
            error "  Command: npm run cli process $basename_no_ext"
            error ""
            error "  📝 LAST 50 LINES OF PIPELINE OUTPUT:"

            # Print last 50 lines safely
            if [ -f "$TEMP_ERROR_LOG" ]; then
                tail -50 "$TEMP_ERROR_LOG" 2>/dev/null | while IFS= read -r line; do
                    error "    $line"
                done || true
            else
                error "    (Error log file not found)"
            fi

            error ""
            error "  💡 COPY THE ABOVE OUTPUT TO CLAUDE FOR DIAGNOSIS"
            error ""

            # Move video file and any matching .srt file to failed/
            mv "$video_file" "$FAILED_DIR/" 2>/dev/null || error "  Failed to move video file"
            if [ -f "$ASSETS_DIR/$basename_no_ext.srt" ]; then
                mv "$ASSETS_DIR/$basename_no_ext.srt" "$FAILED_DIR/" 2>/dev/null || error "  Failed to move SRT file"
                error "  Moved $basename_no_ext.$extension + .srt to failed/"
            else
                error "  Moved $basename_no_ext.$extension to failed/"
            fi

            failed=$((failed + 1))
        fi

        # Re-enable errexit
        set -e
    fi

    # Clean up temp error log
    rm -f "$TEMP_ERROR_LOG"

    echo ""
done

# Summary
echo "================================================"
log "Batch Video Processing Complete"
echo "================================================"
log "Total videos processed: $total"
log "Already processed (skipped): ${BLUE}$already_processed${NC}"
log "Newly succeeded: ${GREEN}$success${NC}"
log "Need OCR (bitmap subs): ${YELLOW}$needs_ocr${NC}"
log "Failed: ${RED}$failed${NC}"
log ""
log "Output directories:"
log "  Succeeded: $SUCCEEDED_DIR"
log "  Needs OCR: $NEEDS_SUBS_DIR"
log "  Failed: $FAILED_DIR"
log "Log file: $LOG_FILE"
