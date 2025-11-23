/**
 * Get the network-accessible URL for joining the game
 * Dynamically fetches the server's local network IP address
 */

let cachedNetworkIP: string | null = null

/**
 * Fetch the server's network IP from the backend
 */
async function fetchNetworkIP(): Promise<string | null> {
	if (cachedNetworkIP) {
		return cachedNetworkIP
	}

	try {
		const response = await fetch('http://localhost:3001/api/network-ip')
		const data = (await response.json()) as { ip: string }
		cachedNetworkIP = data.ip
		return cachedNetworkIP
	} catch (error) {
		console.error('Failed to fetch network IP:', error)
		return null
	}
}

/**
 * Get the best network-accessible base URL
 * Priority:
 * 1. Use network IP if we're on localhost (for WSL2 compatibility)
 * 2. Otherwise use current origin (already network-accessible)
 */
export async function getNetworkUrl(): Promise<string> {
	const currentOrigin = window.location.origin
	const currentHostname = window.location.hostname

	// If we're on localhost, replace with network IP
	if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
		const networkIP = await fetchNetworkIP()

		if (networkIP) {
			const port = window.location.port
			const protocol = window.location.protocol
			return `${protocol}//${networkIP}${port ? `:${port}` : ''}`
		}
	}

	// Fallback: use current origin
	return currentOrigin
}

/**
 * Get the full join URL for the singleton room
 * roomId parameter is deprecated and ignored (kept for backwards compatibility)
 */
export async function getJoinUrl(_roomId?: string): Promise<string> {
	const baseUrl = await getNetworkUrl()
	return `${baseUrl}/join`
}
