#!/bin/bash
# Launch jumbotron in Chrome with autoplay enabled
# Usage: ./launch-jumbotron.sh

JUMBOTRON_URL="http://localhost:3000/jumbotron"

# Launch Chrome in kiosk mode with autoplay enabled
google-chrome \
  --kiosk \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies \
  "$JUMBOTRON_URL"
