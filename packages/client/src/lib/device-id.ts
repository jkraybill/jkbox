/**
 * Device ID management for persistent device identification
 * Uses localStorage to maintain a stable UUID across sessions
 */

const DEVICE_ID_KEY = 'jkbox-device-id'

/**
 * Generate a UUID v4 with fallback for browsers without crypto.randomUUID()
 */
function generateUUID(): string {
	// Modern browsers (Chrome 92+, Safari 15.4+, Firefox 95+)
	if (typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}

	// Fallback for older browsers (using crypto.getRandomValues)
	// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const array = new Uint8Array(1)
		crypto.getRandomValues(array)
		const r = array[0]! % 16 | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * Get or create a persistent device ID
 * Returns a UUID that persists in localStorage
 */
export function getDeviceId(): string {
	// Try to get existing device ID from localStorage
	let deviceId = localStorage.getItem(DEVICE_ID_KEY)

	if (!deviceId) {
		// Generate new UUID with fallback for older browsers
		deviceId = generateUUID()
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
