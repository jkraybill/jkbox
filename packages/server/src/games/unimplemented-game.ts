/**
 * UnimplementedGame - Placeholder game module for games not yet implemented
 *
 * Flow:
 * 1. Shows 5-second countdown on jumbotron
 * 2. Displays message: "This game isn't implemented yet. Talk to JK"
 * 3. Auto-completes after 5 seconds, returns to lobby
 */

import type {
	PluggableGameModule,
	GameModuleContext,
	Player,
	GameState,
	GameAction,
	ModuleGameResults,
	JumbotronProps,
	ControllerProps,
	GameId
} from '@jkbox/shared'

interface UnimplementedGameState {
	startedAt: number // Timestamp when game started
	countdown: number // Seconds remaining (5→0)
}

/**
 * Create unimplemented game module for a specific game ID
 */
export function createUnimplementedGame(gameId: GameId, gameName: string): PluggableGameModule {
	let completeCallback: ((results: ModuleGameResults) => void) | null = null
	let countdownTimer: NodeJS.Timeout | null = null

	return {
		id: gameId,
		name: gameName,
		minPlayers: 1,
		maxPlayers: 12,

		// eslint-disable-next-line @typescript-eslint/require-await
		async initialize(players: Player[], context: GameModuleContext): Promise<GameState> {
			console.log(`[UnimplementedGame:${gameId}] Initializing placeholder game`)

			// Store completion callback
			completeCallback = context.complete

			const state: UnimplementedGameState = {
				startedAt: Date.now(),
				countdown: 5
			}

			// Start countdown timer with pause support (check every 100ms)
			let secondsRemaining = 5
			let lastTickTime = Date.now()

			countdownTimer = setInterval(() => {
				// Check if paused - if so, skip this tick
				if (context.isPaused()) {
					lastTickTime = Date.now() // Reset tick timer when paused
					return
				}

				// Check if enough time has elapsed (1 second)
				const now = Date.now()
				const elapsed = now - lastTickTime

				if (elapsed >= 1000) {
					lastTickTime = now
					secondsRemaining--

					if (secondsRemaining <= 0) {
						// Countdown complete - exit to lobby
						if (countdownTimer) {
							clearInterval(countdownTimer)
							countdownTimer = null
						}

						console.log(`[UnimplementedGame:${gameId}] Countdown complete, returning to lobby`)

						// Call completion callback
						if (completeCallback) {
							completeCallback({
								winners: [], // No winners in placeholder
								scores: Object.fromEntries(players.map((p) => [p.id, 0])), // Everyone gets 0
								achievements: []
							})
						}
					} else {
						console.log(`[UnimplementedGame:${gameId}] Countdown: ${secondsRemaining}s`)
					}
				}
			}, 100) // Check every 100ms for responsiveness

			return state
		},

		// eslint-disable-next-line @typescript-eslint/require-await
		async handleAction(_action: GameAction, state: GameState): Promise<GameState> {
			// No actions to handle - this is a passive countdown
			return state
		},

		// eslint-disable-next-line @typescript-eslint/require-await
		async loadJumbotronComponent(): Promise<React.ComponentType<JumbotronProps>> {
			// This is called client-side only - server never calls this
			// The actual implementation is in the client package
			throw new Error('loadJumbotronComponent should only be called on client')
		},

		// eslint-disable-next-line @typescript-eslint/require-await
		async loadControllerComponent(): Promise<React.ComponentType<ControllerProps>> {
			// This is called client-side only - server never calls this
			// The actual implementation is in the client package
			throw new Error('loadControllerComponent should only be called on client')
		},

		// eslint-disable-next-line @typescript-eslint/require-await
		async cleanup(): Promise<void> {
			console.log(`[UnimplementedGame:${gameId}] Cleaning up`)

			// Clear countdown timer
			if (countdownTimer) {
				clearInterval(countdownTimer)
				countdownTimer = null
			}

			completeCallback = null
		}
	}
}
