/**
 * XState Inspector Setup (Development Only)
 *
 * Enables visual debugging of state machines via Stately Inspector
 * Usage: Set XSTATE_INSPECT=true in .env to enable
 *
 * Inspector URL: https://stately.ai/registry/inspect
 */

import { createBrowserInspector } from '@statelyai/inspect'

let inspector: ReturnType<typeof createBrowserInspector> | null = null

/**
 * Initialize XState inspector if enabled via environment variable
 * Call this once at server startup
 */
export function initInspector(): void {
  const isEnabled = process.env['XSTATE_INSPECT'] === 'true'

  if (!isEnabled) {
    console.log('[Inspector] XState inspector disabled. Set XSTATE_INSPECT=true to enable.')
    return
  }

  try {
    inspector = createBrowserInspector({
      autoStart: true,
    })
    console.log('[Inspector] XState inspector enabled. Visit: https://stately.ai/registry/inspect')
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

/**
 * Shutdown inspector (cleanup on server close)
 */
export function shutdownInspector(): void {
  if (inspector) {
    // Inspector cleanup happens automatically on process exit
    inspector = null
    console.log('[Inspector] XState inspector shutdown')
  }
}
