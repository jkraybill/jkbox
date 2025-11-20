/**
 * Game voting and ready check types for jkbox lobby
 */

import type { GameId } from './game-module'

// Re-export for convenience
export type { GameId }

export interface GameVote {
	playerId: string
	gameId: GameId
	timestamp: Date
}

export interface PlayerReadyState {
	playerId: string
	hasVoted: boolean
	isReady: boolean // "Good to Go" toggle
}

export interface RoomVotingState {
	votes: Record<string, GameVote> // playerId → GameVote (use Record for JSON serialization)
	readyStates: Record<string, PlayerReadyState> // playerId → PlayerReadyState
	allReady: boolean // Computed: all players voted + ready
	selectedGame: GameId | null // Most voted game (null if tied)
}
