/**
 * Phase-based room state for jkbox
 * Discriminated union pattern for type-safe state management
 */

import type { Player } from './player'

/**
 * Room configuration - global settings that affect gameplay
 * These are accessible by all game modules
 */
export interface RoomConfig {
	aiGuesses: number // Number of AI-generated fake answers (0-5), default 1
}

/**
 * Title phase - Intro screen with Pippin animation (before lobby)
 * Non-interactive, shows "Welcome to Pippin's Playhouse"
 */
export interface TitleState {
	phase: 'title'
	roomId: string
	players: Player[] // Empty during title screen
	config: RoomConfig
}

/**
 * Lobby phase - Players joining, selecting game, marking ready
 */
export interface LobbyState {
	phase: 'lobby'
	roomId: string
	players: Player[]
	gameVotes: Record<string, string> // playerId → gameId
	readyStates: Record<string, boolean> // playerId → isReady
	selectedGame: string | null // Majority-voted game (null if no votes yet)
	config: RoomConfig
}

/**
 * Countdown phase - 5→0 countdown before game starts
 */
export interface CountdownState {
	phase: 'countdown'
	roomId: string
	players: Player[]
	selectedGame: string // Game that will start
	secondsRemaining: number // 5→0
	config: RoomConfig
}

/**
 * Playing phase - Game in progress
 */
export interface PlayingState {
	phase: 'playing'
	roomId: string
	players: Player[]
	gameId: string
	gameState: unknown // Owned by game module, opaque to lobby
	config: RoomConfig
}

/**
 * Results phase - Showing winners/scores after game completes
 */
export interface ResultsState {
	phase: 'results'
	roomId: string
	players: Player[]
	gameId: string
	winners: string[] // Player IDs (can have multiple for ties)
	scores: Record<string, number> // playerId → final score
	achievements?: Achievement[] // Optional achievements/awards
	config: RoomConfig
}

/**
 * Achievement/award shown in results
 */
export interface Achievement {
	playerId: string
	achievementId: string
	label: string // Display text (e.g., "Perfect Round!", "Comeback King!")
	description?: string // Optional detailed description
}

/**
 * Room state discriminated union
 * TypeScript will narrow types based on phase property
 */
export type RoomState = TitleState | LobbyState | CountdownState | PlayingState | ResultsState

/**
 * Type guard: Check if state is in title phase
 */
export function isTitleState(state: RoomState): state is TitleState {
	return state.phase === 'title'
}

/**
 * Type guard: Check if state is in lobby phase
 */
export function isLobbyState(state: RoomState): state is LobbyState {
	return state.phase === 'lobby'
}

/**
 * Type guard: Check if state is in countdown phase
 */
export function isCountdownState(state: RoomState): state is CountdownState {
	return state.phase === 'countdown'
}

/**
 * Type guard: Check if state is in playing phase
 */
export function isPlayingState(state: RoomState): state is PlayingState {
	return state.phase === 'playing'
}

/**
 * Type guard: Check if state is in results phase
 */
export function isResultsState(state: RoomState): state is ResultsState {
	return state.phase === 'results'
}
