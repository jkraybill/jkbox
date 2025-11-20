// Game module interface for pluggable jkbox games
// This defines the contract between lobby system and individual games

import type { Player } from './player'

/**
 * Game identifier (e.g., 'fake-facts', 'drawful', 'trivia-murder')
 */
export type GameId = 'fake-facts' | 'cinephile' | 'cinema-pippin'

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
  type: string  // Game-specific action types (e.g., 'submit-answer', 'vote', 'skip')
  payload: unknown  // Game-specific payload
}

/**
 * Game results after completion
 */
export interface GameResults {
  winners: string[]  // Player IDs (can have multiple for ties)
  scores: Record<string, number>  // playerId → final score
  achievements?: Achievement[]  // Optional achievements/awards
  stats?: Record<string, unknown>  // Game-specific statistics
}

/**
 * Achievement/award earned during game
 */
export interface Achievement {
  playerId: string
  achievementId: string
  label: string  // Display text (e.g., "Perfect Round!", "Comeback King!")
  description?: string  // Optional detailed description
}

/**
 * Props for game's jumbotron component (TV display)
 */
export interface JumbotronProps {
  gameState: GameState
  players: Player[]
  onAdminAction?: (action: string) => void  // Optional admin controls
}

/**
 * Props for game's controller component (player phone)
 */
export interface ControllerProps {
  gameState: GameState
  playerId: string
  onAction: (action: GameAction) => void
}

/**
 * Game module interface
 * Each game implements this to plug into jkbox
 */
export interface GameModule {
  /**
   * Unique game identifier
   */
  id: GameId

  /**
   * Display name
   */
  name: string

  /**
   * Player count constraints
   */
  minPlayers: number
  maxPlayers: number

  /**
   * Initialize game with player list
   * Returns initial game state
   */
  initialize(players: Player[]): Promise<GameState>

  /**
   * Handle player action
   * Returns new game state (functional/immutable pattern)
   */
  handleAction(action: GameAction, state: GameState): Promise<GameState>

  /**
   * Check if game is complete
   */
  isComplete(state: GameState): boolean

  /**
   * Get final results (call when isComplete() returns true)
   */
  getResults(state: GameState): GameResults

  /**
   * Lazy-load jumbotron component
   * Allows code-splitting per game
   */
  loadJumbotronComponent(): Promise<React.ComponentType<JumbotronProps>>

  /**
   * Lazy-load controller component
   * Allows code-splitting per game
   */
  loadControllerComponent(): Promise<React.ComponentType<ControllerProps>>
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
