# Network Setup for Local Multiplayer

## WSL2 Configuration (IMPORTANT!)

If you're running on WSL2 (Windows Subsystem for Linux), you need to set up port forwarding because WSL2 uses a virtualized network adapter.

### Automated Setup (Recommended)

We've provided a PowerShell script that handles all the port forwarding automatically:

1. **The script is already in the Windows location:**
   ```
   C:\Users\jerem\jkbox\wsl-port-forward.ps1
   ```

2. **Run PowerShell as Administrator** and execute:
   ```powershell
   cd C:\Users\jerem\jkbox
   .\wsl-port-forward.ps1
   ```

3. **Set up auto-run on startup** (see `WSL_PORT_FORWARD_SETUP.md` for detailed instructions):
   ```powershell
   $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Users\jerem\jkbox\wsl-port-forward.ps1"
   $trigger = New-ScheduledTaskTrigger -AtStartup
   $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
   $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
   Register-ScheduledTask -TaskName "JKBox WSL2 Port Forwarding" -Action $action -Trigger $trigger -Principal $principal -Settings $settings
   ```

**After setup, servers will be accessible at:**
- From Windows host: `http://localhost:3000` or `http://192.168.68.55:3000`
- From other devices: `http://192.168.68.55:3000` (your Windows machine's IP)

**Note:** The WSL2 IP address changes on every reboot, which is why the automated script is necessary.

## mDNS Configuration (jkbox.local)

To allow players on your local network to access the game via `jkbox.local`:

### Linux (Ubuntu/Debian)

**Note:** For WSL2, configure this on the **Windows host**, not inside WSL!

```bash
# Install Avahi (mDNS daemon)
sudo apt-get update
sudo apt-get install avahi-daemon avahi-utils

# Set hostname to 'jkbox'
sudo hostnamectl set-hostname jkbox

# Restart Avahi
sudo systemctl restart avahi-daemon

# Verify it's working
avahi-browse -a
```

After setup, the server will be accessible at `http://jkbox.local:3000`

### Windows (for WSL2 users)

For mDNS on Windows, you need to:
1. Install [Bonjour Print Services](https://support.apple.com/kb/DL999) (free from Apple)
2. In Windows Settings → Network → Properties, set your PC name to `jkbox`
3. Restart your PC

After setup, devices can access: `http://jkbox.local:3000`

### macOS

macOS has mDNS (Bonjour) built-in:

```bash
# Set hostname to 'jkbox'
sudo scutil --set HostName jkbox
sudo scutil --set LocalHostName jkbox
sudo scutil --set ComputerName jkbox

# Restart mDNS
sudo killall -HUP mDNSResponder
```

After setup, the server will be accessible at `http://jkbox.local:3000`

### Windows

Install Bonjour Print Services or use your actual IP address (fallback method below).

## Fallback: Use IP Address

If mDNS doesn't work, the QR code will still show `jkbox.local`, but you can manually find your IP:

```bash
# Linux/macOS
ip addr show | grep "inet "
# or
ifconfig | grep "inet "

# Windows
ipconfig
```

Then manually navigate to `http://YOUR_IP:3000` on player devices.

## Testing

1. Start the server: `npm run dev`
2. On another device on the same network, navigate to `http://jkbox.local:3000`
3. If it doesn't work, check:
   - Is Avahi/mDNS running? `sudo systemctl status avahi-daemon`
   - Are devices on the same network?
   - Try the IP address fallback

## Firewall

Make sure port 3000 (frontend) and 3001 (backend) are open:

```bash
# Linux (ufw)
sudo ufw allow 3000
sudo ufw allow 3001

# Linux (firewalld)
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --add-port=3001/tcp --permanent
sudo firewall-cmd --reload
```

## How It Works

The QR code displayed on the Jumbotron will automatically use:
- `http://jkbox.local:3000/join/XXXX` when accessed via localhost
- The actual network URL if accessed via IP or hostname

Players scan the QR code and join instantly!
