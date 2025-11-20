# WSL2 Port Forwarding Setup for JKBox
# This script forwards ports 3000 and 3001 from Windows to WSL2
# Run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "JKBox WSL2 Port Forwarding Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get WSL2 IP address
Write-Host "Getting WSL2 IP address..." -ForegroundColor Yellow
$wslIP = (wsl hostname -I).Trim()

if ([string]::IsNullOrWhiteSpace($wslIP)) {
    Write-Host "ERROR: Could not get WSL2 IP address. Is WSL2 running?" -ForegroundColor Red
    exit 1
}

Write-Host "WSL2 IP: $wslIP" -ForegroundColor Green
Write-Host ""

# Remove old port forwarding rules (if they exist)
Write-Host "Removing old port forwarding rules..." -ForegroundColor Yellow
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0 2>$null
netsh interface portproxy delete v4tov4 listenport=3001 listenaddress=0.0.0.0 2>$null
Write-Host "Done." -ForegroundColor Green
Write-Host ""

# Add new port forwarding rules
Write-Host "Adding port forwarding rules..." -ForegroundColor Yellow
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$wslIP
netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=$wslIP
Write-Host "Done." -ForegroundColor Green
Write-Host ""

# Configure Windows Firewall (only add if rules don't exist)
Write-Host "Configuring Windows Firewall..." -ForegroundColor Yellow

$frontendRule = Get-NetFirewallRule -DisplayName "JKBox Frontend" -ErrorAction SilentlyContinue
if ($null -eq $frontendRule) {
    New-NetFirewallRule -DisplayName "JKBox Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow | Out-Null
    Write-Host "  Created firewall rule for port 3000" -ForegroundColor Green
} else {
    Write-Host "  Firewall rule for port 3000 already exists" -ForegroundColor Gray
}

$backendRule = Get-NetFirewallRule -DisplayName "JKBox Backend" -ErrorAction SilentlyContinue
if ($null -eq $backendRule) {
    New-NetFirewallRule -DisplayName "JKBox Backend" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow | Out-Null
    Write-Host "  Created firewall rule for port 3001" -ForegroundColor Green
} else {
    Write-Host "  Firewall rule for port 3001 already exists" -ForegroundColor Gray
}

Write-Host ""

# Show current port forwarding configuration
Write-Host "Current port forwarding rules:" -ForegroundColor Cyan
netsh interface portproxy show all

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your servers should now be accessible at:" -ForegroundColor Yellow
Write-Host "  http://192.168.68.55:3000 (Frontend)" -ForegroundColor White
Write-Host "  http://192.168.68.55:3001 (Backend)" -ForegroundColor White
Write-Host ""
Write-Host "To test from another device on your network:" -ForegroundColor Yellow
Write-Host "  1. Start your dev servers (npm run dev)" -ForegroundColor White
Write-Host "  2. Open http://192.168.68.55:3000 on your phone" -ForegroundColor White
Write-Host ""
