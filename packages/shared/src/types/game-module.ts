// Game module interface for pluggable jkbox games
// This defines the contract between lobby system and individual games

import type * as React from 'react'
import type { Player } from './player'
import type { PauseState } from './room-state'

/**
 * Game identifier (e.g., 'fake-facts', 'drawful', 'trivia-murder')
 */
export type GameId = 'fake-facts' | 'cinema-pippin' | 'scratchpad1' | 'test'

/**
 * Game-specific state (opaque to lobby system)
 * Each game module defines its own state structure
 */
export type GameState = unknown

/**
 * Player action within a game
 */
export interface GameAction {
	playerId: string
	type: string // Game-specific action types (e.g., 'submit-answer', 'vote', 'skip')
	payload: unknown // Game-specific payload
}

/**
 * Game results after completion
 */
export interface GameResults {
	winners: string[] // Player IDs (can have multiple for ties)
	scores: Record<string, number> // playerId → final score
	achievements?: Achievement[] // Optional achievements/awards
	stats?: Record<string, unknown> // Game-specific statistics
}

/**
 * Achievement/award earned during game
 */
export interface Achievement {
	playerId: string
	achievementId: string
	label: string // Display text (e.g., "Perfect Round!", "Comeback King!")
	description?: string // Optional detailed description
}

/**
 * Props for game's jumbotron component (TV display)
 */
export interface JumbotronProps {
	state: GameState
	players: Player[]
	sendToServer: (action: GameAction) => void
	pauseState?: PauseState
	replayTrigger?: number // Increments when admin requests clip replay
}

/**
 * Props for game's controller component (player phone)
 */
export interface ControllerProps {
	state: GameState
	playerId: string
	players: Player[]
	sendToServer: (action: GameAction) => void
	onQuit?: () => void // Optional callback for player to quit game mid-play
}

/**
 * Callback for game completion
 * Game module calls this when it wants to exit and return to lobby
 */
export type GameCompleteCallback = (results: GameResults) => void

/**
 * Game module lifecycle context
 * Passed to game on initialization to control FSM transitions
 */
export interface GameModuleContext {
	/**
	 * Game calls this to signal completion and return to results/lobby
	 * FSM transition: playing → results
	 */
	complete: GameCompleteCallback

	/**
	 * Room ID for this game session
	 */
	roomId: string

	/**
	 * Check if the game is currently paused
	 * Game modules should check this before running timers/transitions
	 */
	isPaused: () => boolean
}

/**
 * Game module interface
 * Each game implements this to plug into jkbox
 *
 * FSM Boundary Contract:
 * ========================
 * ENTER (lobby → game):
 *   - Lobby calls initialize(players, context) when countdown hits 0
 *   - Game returns initial state
 *   - FSM transitions: countdown → playing
 *
 * DURING (game owns FSM):
 *   - Game receives actions via handleAction()
 *   - Game updates its internal state (opaque to lobby)
 *   - Lobby stores & broadcasts state, but doesn't interpret it
 *
 * EXIT (game → lobby):
 *   - Game calls context.complete(results) when ready to exit
 *   - Lobby validates and transitions: playing → results → lobby
 *   - Game module is unloaded after results phase
 */
export interface GameModule {
	/**
	 * Unique game identifier
	 */
	id: GameId

	/**
	 * Display name shown in lobby
	 */
	name: string

	/**
	 * Short description shown in lobby voting
	 */
	description: string

	/**
	 * Sort order for lobby display (lower = higher priority)
	 */
	sortOrder: number

	/**
	 * Whether game is visible/selectable in lobby
	 */
	visible: boolean

	/**
	 * Player count constraints
	 */
	minPlayers: number
	maxPlayers: number

	/**
	 * Initialize game with player list
	 * Called when: Countdown reaches 0 (lobby → playing transition)
	 * Returns: Initial game state
	 *
	 * @param players - List of players in this game session
	 * @param context - Lifecycle context (contains complete() callback)
	 */
	initialize(players: Player[], context: GameModuleContext): Promise<GameState>

	/**
	 * Handle player action
	 * Called when: Player submits action from their controller
	 * Returns: Updated game state (functional/immutable pattern)
	 *
	 * Game should call context.complete(results) when ready to exit
	 */
	handleAction(action: GameAction, state: GameState): Promise<GameState>

	/**
	 * Check if game is complete (for polling/validation)
	 * Optional fallback - prefer using context.complete() callback
	 *
	 * @deprecated Use context.complete() callback in handleAction instead
	 */
	isComplete?(state: GameState): boolean

	/**
	 * Get final results (for polling/validation)
	 * Optional fallback - prefer passing results to context.complete()
	 *
	 * @deprecated Pass results directly to context.complete() instead
	 */
	getResults?(state: GameState): GameResults

	/**
	 * Lazy-load jumbotron component (TV display)
	 * Allows code-splitting per game
	 */
	loadJumbotronComponent(): Promise<React.ComponentType<JumbotronProps>>

	/**
	 * Lazy-load controller component (player phone)
	 * Allows code-splitting per game
	 */
	loadControllerComponent(): Promise<React.ComponentType<ControllerProps>>

	/**
	 * Cleanup hook (optional)
	 * Called when: Game module is being unloaded (after results phase)
	 * Use for: Clearing timers, closing connections, etc.
	 */
	cleanup?(): Promise<void>
}

/**
 * Game registry for dynamic loading
 */
export interface GameRegistry {
	/**
	 * Register a game module
	 */
	register(module: GameModule): void

	/**
	 * Get game module by ID
	 */
	get(gameId: GameId): GameModule | undefined

	/**
	 * List all registered games
	 */
	list(): GameModule[]
}
