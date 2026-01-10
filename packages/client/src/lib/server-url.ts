/**
 * Server URL utilities
 *
 * Dynamically determines the backend server URL based on current environment.
 * Handles WSL2, localhost dev, and network access scenarios.
 */

/**
 * Get the backend server URL dynamically
 * - In dev (localhost): use localhost:3001
 * - On network (192.168.x.x): use same hostname with port 3001
 * - Handles WSL2 network access from phones
 */
export function getServerUrl(): string {
	// Allow override via env var (useful for custom deployments)
	if (import.meta.env['VITE_SERVER_URL']) {
		return import.meta.env['VITE_SERVER_URL'] as string
	}

	const hostname = window.location.hostname
	const protocol = window.location.protocol

	// In production (served from server), use same port as the page
	// In dev (localhost with separate vite server), use configured port
	const isDevMode = hostname === 'localhost' || hostname === '127.0.0.1'
	const serverPort = isDevMode
		? (import.meta.env['VITE_SERVER_PORT'] as string | undefined) || '3001'
		: window.location.port

	return `${protocol}//${hostname}:${serverPort}`
}

/**
 * Get the audio files base URL
 * e.g., "http://localhost:3001/audio" or "http://192.168.1.100:3001/audio"
 */
export function getAudioBaseUrl(): string {
	return `${getServerUrl()}/audio`
}

/**
 * Get the API base URL
 * e.g., "http://localhost:3001/api" or "http://192.168.1.100:3001/api"
 */
export function getApiBaseUrl(): string {
	return `${getServerUrl()}/api`
}
