/**
 * Device ID management for persistent device identification
 * Uses localStorage to maintain a stable UUID across sessions
 */

const DEVICE_ID_KEY = 'jkbox-device-id'

/**
 * Get or create a persistent device ID
 * Returns a UUID that persists in localStorage
 */
export function getDeviceId(): string {
  // Try to get existing device ID from localStorage
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)

  if (!deviceId) {
    // Generate new UUID using crypto.randomUUID()
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
    console.log('[DeviceID] Generated new device ID:', deviceId)
  } else {
    console.log('[DeviceID] Using existing device ID:', deviceId)
  }

  return deviceId
}

/**
 * Clear the stored device ID (for testing/debugging)
 */
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY)
  console.log('[DeviceID] Cleared device ID')
}
