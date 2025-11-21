# Launch jumbotron in Chrome with autoplay enabled (Windows)
# Usage: .\launch-jumbotron.ps1

$jumbotronUrl = "http://localhost:3000/jumbotron"

# Find Chrome installation
$chromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LocalAppData}\Google\Chrome\Application\chrome.exe"
)

$chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chromePath) {
    Write-Error "Chrome not found. Please install Google Chrome."
    exit 1
}

Write-Host "Launching jumbotron in kiosk mode with autoplay enabled..."

# Launch Chrome with autoplay enabled
& $chromePath `
    --kiosk `
    --autoplay-policy=no-user-gesture-required `
    --disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies `
    $jumbotronUrl
