/**
 * GameModuleHost - Server-side orchestrator for game module lifecycle
 *
 * Responsibilities:
 * - Manage FSM boundary: countdown → playing → results
 * - Initialize game modules with context
 * - Handle game completion callbacks
 * - Coordinate with RoomManager for state transitions
 */

import type {
	PluggableGameModule as GameModule,
	GameModuleContext,
	GameAction,
	GameState,
	ModuleGameResults as GameResults,
	Player
} from '@jkbox/shared'
import type { RoomManager } from './room-manager'

export interface GameModuleHostConfig {
	roomId: string
	gameModule: GameModule
	players: Player[]
	roomManager: RoomManager
	onGameComplete?: () => void // Callback when game completes and transitions to results
}

/**
 * GameModuleHost orchestrates a single game session
 * Lifecycle: initialize → handleActions → complete → cleanup
 */
export class GameModuleHost {
	private roomId: string
	private gameModule: GameModule
	private players: Player[]
	private roomManager: RoomManager
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	private currentState: GameState | null = null
	private isCompleted = false
	private onGameCompleteCallback?: () => void

	constructor(config: GameModuleHostConfig) {
		this.roomId = config.roomId
		this.gameModule = config.gameModule
		this.players = config.players
		this.roomManager = config.roomManager
		this.onGameCompleteCallback = config.onGameComplete
	}

	/**
	 * Initialize the game module
	 * FSM transition: countdown → playing
	 *
	 * Called when: Countdown reaches 0
	 */
	async initialize(): Promise<GameState> {
		console.log(
			`[GameModuleHost] Initializing game: ${this.gameModule.name} for room: ${this.roomId}`
		)

		// Create context with completion callback and pause state checker
		const context: GameModuleContext = {
			roomId: this.roomId,
			complete: this.handleGameComplete.bind(this),
			isPaused: () => {
				const room = this.roomManager.getRoom(this.roomId)
				// Only countdown, playing, and results phases have pauseState
				if (
					room &&
					(room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'results')
				) {
					return room.pauseState.isPaused
				}
				return false
			}
		}

		// Initialize game and get initial state
		this.currentState = await this.gameModule.initialize(this.players, context)
		console.log(`[GameModuleHost] Game initialized with state:`, this.currentState)

		return this.currentState
	}

	/**
	 * Handle player action
	 * Game module processes action and returns updated state
	 */
	async handleAction(action: GameAction): Promise<GameState> {
		if (!this.currentState) {
			throw new Error('Game not initialized - call initialize() first')
		}

		if (this.isCompleted) {
			throw new Error('Game already completed - cannot handle actions')
		}

		console.log(`[GameModuleHost] Handling action:`, action)

		// Let game module process action
		this.currentState = await this.gameModule.handleAction(action, this.currentState)

		return this.currentState
	}

	/**
	 * Get current game state
	 */
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	getState(): GameState | null {
		return this.currentState
	}

	/**
	 * Check if game has completed
	 */
	hasCompleted(): boolean {
		return this.isCompleted
	}

	/**
	 * Handle game completion callback
	 * Called by: Game module via context.complete(results)
	 * FSM transition: playing → results
	 */
	private handleGameComplete(results: GameResults): void {
		if (this.isCompleted) {
			console.warn(`[GameModuleHost] Game already completed, ignoring duplicate complete() call`)
			return
		}

		console.log(`[GameModuleHost] Game completed with results:`, results)
		this.isCompleted = true

		// Transition to results phase
		this.roomManager.transitionToResults(this.roomId, {
			gameId: this.gameModule.id,
			results
		})

		// Notify connection handler that game completed (for broadcasting + cleanup scheduling)
		if (this.onGameCompleteCallback) {
			this.onGameCompleteCallback()
		}
	}

	/**
	 * Cleanup game module resources
	 * Called when: Results phase ends, returning to lobby
	 */
	async cleanup(): Promise<void> {
		console.log(`[GameModuleHost] Cleaning up game: ${this.gameModule.name}`)

		if (this.gameModule.cleanup) {
			await this.gameModule.cleanup()
		}

		// Clear references
		this.currentState = null
		this.isCompleted = false
	}

	/**
	 * FALLBACK: Poll-based completion check (for games that don't use callback)
	 * @deprecated Games should use context.complete() instead
	 */
	checkCompletion(): GameResults | null {
		if (!this.currentState || this.isCompleted) {
			return null
		}

		// Try deprecated isComplete/getResults methods
		if (this.gameModule.isComplete?.(this.currentState)) {
			const results = this.gameModule.getResults?.(this.currentState)
			if (results) {
				this.handleGameComplete(results)
				return results
			}
		}

		return null
	}
}
