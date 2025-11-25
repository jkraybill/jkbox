#!/bin/bash
# Download Subtitles Script
# Automated subtitle download for videos in ~/jkbox/assets/needs-subtitles

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JKBOX_DIR="$(dirname "$SCRIPT_DIR")"

# Check if API key is set (in environment or will be loaded from .env)
# The TypeScript script will load from ~/jkbox/.env automatically
if [ -z "${OPENSUBTITLES_API_KEY:-}" ] && [ ! -f "$HOME/jkbox/.env" ]; then
  echo "❌ ERROR: OPENSUBTITLES_API_KEY not found!"
  echo ""
  echo "Please follow these steps:"
  echo ""
  echo "1. Create a FREE account at: https://www.opensubtitles.com/en/users/sign_up"
  echo "2. Get your API key at: https://www.opensubtitles.com/en/consumers"
  echo "3. Add to ~/jkbox/.env file:"
  echo "   echo 'OPENSUBTITLES_API_KEY=\"your_api_key_here\"' >> ~/jkbox/.env"
  echo ""
  echo "Or set as environment variable:"
  echo "   export OPENSUBTITLES_API_KEY=\"your_api_key_here\""
  echo ""
  exit 1
fi

echo "🎬 Starting subtitle download process..."
echo ""

# Run the TypeScript script via tsx
cd "$JKBOX_DIR"
npx tsx scripts/process-subtitles.ts
