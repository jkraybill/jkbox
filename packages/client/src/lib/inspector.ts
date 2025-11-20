/**
 * XState Inspector Setup (Development Only)
 *
 * Enables visual debugging of state machines via Stately Inspector
 * Automatically enabled in development mode (import.meta.env.DEV)
 *
 * Inspector URL: https://stately.ai/registry/inspect
 */

import { createBrowserInspector } from '@statelyai/inspect'

let inspector: ReturnType<typeof createBrowserInspector> | null = null

/**
 * Initialize XState inspector in development mode
 * Call this once at app startup (in main.tsx)
 */
export function initInspector(): void {
	// Only enable in development (Vite sets import.meta.env.DEV)
	if (!import.meta.env.DEV) {
		return
	}

	// NEVER enable on mobile/remote access - only on localhost
	const isLocalhost =
		window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
	if (!isLocalhost) {
		console.log('[Inspector] XState inspector disabled (not on localhost)')
		return
	}

	// Allow opt-out via localStorage
	const isDisabled = localStorage.getItem('xstate-inspect-disabled') === 'true'
	if (isDisabled) {
		console.log('[Inspector] XState inspector disabled via localStorage')
		return
	}

	try {
		inspector = createBrowserInspector({
			autoStart: false // Don't auto-redirect to inspector page
		})
		console.log(
			'[Inspector] XState inspector enabled (manual mode). Visit: https://stately.ai/registry/inspect'
		)
		console.log('[Inspector] To disable: localStorage.setItem("xstate-inspect-disabled", "true")')
	} catch (error) {
		console.error('[Inspector] Failed to initialize XState inspector:', error)
	}
}

/**
 * Get the inspector instance (if enabled)
 * Pass to machine.provide({ inspect: getInspector() }) to enable inspection
 */
export function getInspector(): typeof inspector {
	return inspector
}
