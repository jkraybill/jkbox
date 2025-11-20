# WSL2 Port Forwarding - Auto-Start Setup

## Quick Start

### 1. Run the Script Manually (First Time)

Open **PowerShell as Administrator** and run:

```powershell
cd C:\Users\jerem\jkbox
.\wsl-port-forward.ps1
```

This will set up port forwarding for ports 3000 and 3001.

### 2. Set Up Auto-Start on Windows Boot

#### Option A: Task Scheduler (Recommended)

1. Open **PowerShell as Administrator** and run this command:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Users\jerem\jkbox\wsl-port-forward.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "JKBox WSL2 Port Forwarding" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Automatically forwards ports 3000 and 3001 from Windows to WSL2 for JKBox multiplayer"
```

2. Verify it was created:
   - Open **Task Scheduler** (press Win+R, type `taskschd.msc`)
   - Look for "JKBox WSL2 Port Forwarding" in the task list
   - Right-click → Run to test it

3. **Important:** The script runs at startup, but WSL2 might not be ready yet. To handle this:
   - The task is configured with "Start when available" which will retry if WSL2 isn't ready

#### Option B: Startup Folder (Simple but Less Reliable)

1. Create a shortcut to the script:
   - Right-click on Desktop → New → Shortcut
   - Location: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File C:\Users\jerem\jkbox\wsl-port-forward.ps1`
   - Name: JKBox Port Forward

2. Move the shortcut to Startup folder:
   - Press `Win+R`, type `shell:startup`, press Enter
   - Move the shortcut there

3. Set to run as Administrator:
   - Right-click shortcut → Properties → Advanced
   - Check "Run as administrator"

### 3. Test It

After running the script:

1. Start your dev servers in WSL2:
   ```bash
   cd /home/jk/jkbox
   npm run dev
   ```

2. From your phone (on same WiFi), open:
   ```
   http://192.168.68.55:3000
   ```

## Troubleshooting

### "Execution Policy" Error

If you get an error about execution policy, run this in PowerShell as Administrator:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### WSL2 IP Changed

The WSL2 IP address changes on every Windows reboot. The script automatically detects and updates the port forwarding rules. If something isn't working:

1. Check your current WSL2 IP:
   ```powershell
   wsl hostname -I
   ```

2. Re-run the script:
   ```powershell
   cd C:\Users\jerem\jkbox
   .\wsl-port-forward.ps1
   ```

### Can't Access from Phone

1. **Check Windows Firewall is allowing the ports:**
   ```powershell
   Get-NetFirewallRule -DisplayName "JKBox*"
   ```

2. **Check port forwarding is active:**
   ```powershell
   netsh interface portproxy show all
   ```

   You should see entries for ports 3000 and 3001.

3. **Test from Windows first:**
   Open http://192.168.68.55:3000 in your Windows browser. If this doesn't work, the dev server isn't running.

4. **Check your router isn't blocking local access:**
   Some routers have "AP Isolation" or "Client Isolation" enabled. Check your router settings.

### Disable Auto-Start

To remove the scheduled task:

```powershell
Unregister-ScheduledTask -TaskName "JKBox WSL2 Port Forwarding" -Confirm:$false
```

## Manual Port Forwarding Commands

If you need to manage port forwarding manually:

```powershell
# Show current rules
netsh interface portproxy show all

# Remove specific ports
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=3001 listenaddress=0.0.0.0

# Add specific ports (replace WSL_IP with your WSL2 IP from 'wsl hostname -I')
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=WSL_IP
netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=WSL_IP

# Remove all port forwarding rules
netsh interface portproxy reset
```

## How It Works

WSL2 uses a virtualized network adapter, so it has a different IP address than Windows. This script:

1. Detects the current WSL2 IP address (changes on reboot)
2. Creates port forwarding rules from Windows (0.0.0.0:3000 → WSL2_IP:3000)
3. Adds Windows Firewall exceptions for ports 3000 and 3001
4. Makes these rules persistent (until next reboot when WSL2 IP changes)

The scheduled task ensures port forwarding is reconfigured on every Windows startup.
