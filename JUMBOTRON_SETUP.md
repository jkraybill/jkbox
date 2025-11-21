# Jumbotron Setup Guide

## Browser Autoplay Policy Issue

Modern browsers block video autoplay without user interaction for security. This affects the jumbotron display when transitioning between video clips.

## Recommended Solution: Launch with Autoplay Enabled

For a dedicated jumbotron display, launch Chrome with autoplay policy disabled:

### Linux/Mac
```bash
./launch-jumbotron.sh
```

### Windows (PowerShell)
```powershell
.\launch-jumbotron.ps1
```

Both scripts launch Chrome in kiosk mode (fullscreen, no UI) with autoplay enabled.

## Alternative: Manual Chrome Launch

If the scripts don't work, manually launch Chrome with flags:

```bash
google-chrome --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000/jumbotron
```

### Windows Chrome Path
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000/jumbotron
```

## Future: Electron App

For production, consider building a standalone Electron app for the jumbotron with autoplay permanently enabled and optimized for party game display.
