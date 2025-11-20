// WebSocket message types for jkbox client-server communication

import type { Room } from './room'
import type { RoomState } from './room-state'
import type { Player } from './player'
import type { GameConfig, RoundResults, GamePhase } from './game'
import type { GameId, RoomVotingState } from './voting'

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface JoinMessage {
	type: 'join'
	roomId: string
	nickname: string
	deviceId?: string // Client-generated UUID from localStorage (preferred over IP)
	sessionToken?: string // For reconnection
}

export interface SubmitMessage {
	type: 'submit'
	roundId: string
	content: unknown // Game-specific submission
}

export interface VoteMessage {
	type: 'vote'
	roundId: string
	votedForId: string
}

export interface AdminStartGameMessage {
	type: 'admin:start-game'
	gameId: string
	config: GameConfig
}

export interface AdminPauseTimerMessage {
	type: 'admin:pause-timer'
}

export interface AdminResumeTimerMessage {
	type: 'admin:resume-timer'
}

export interface AdminSkipPhaseMessage {
	type: 'admin:skip-phase'
}

export interface AdminDelegateMessage {
	type: 'admin:delegate'
	playerId: string
}

export interface WatchMessage {
	type: 'watch'
	roomId: string
}

export interface LobbyVoteGameMessage {
	type: 'lobby:vote-game'
	gameId: GameId
}

export interface LobbyReadyToggleMessage {
	type: 'lobby:ready-toggle'
	isReady: boolean
}

export interface HeartbeatMessage {
	type: 'heartbeat'
}

export interface AdminBootPlayerMessage {
	type: 'admin:boot-player'
	playerId: string
}

export interface AdminBackToLobbyMessage {
	type: 'admin:back-to-lobby'
}

export interface AdminHardResetMessage {
	type: 'admin:hard-reset'
}

export interface RestoreSessionMessage {
	type: 'restore-session'
	roomId: string
	playerId: string
	sessionToken: string
}

export interface AdminUpdateConfigMessage {
	type: 'admin:update-config'
	config: Partial<import('./room-state').RoomConfig>
}

export type ClientMessage =
	| JoinMessage
	| SubmitMessage
	| VoteMessage
	| AdminStartGameMessage
	| AdminPauseTimerMessage
	| AdminResumeTimerMessage
	| AdminSkipPhaseMessage
	| AdminDelegateMessage
	| AdminBootPlayerMessage
	| AdminBackToLobbyMessage
	| AdminHardResetMessage
	| AdminUpdateConfigMessage
	| WatchMessage
	| LobbyVoteGameMessage
	| LobbyReadyToggleMessage
	| HeartbeatMessage
	| RestoreSessionMessage

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface JoinSuccessMessage {
	type: 'join:success'
	player: Player
	state: RoomState // Phase-based state instead of old Room
}

export interface RoomUpdateMessage {
	type: 'room:update'
	room: Room
}

// NEW: Phase-based room state (replaces RoomUpdateMessage)
export interface RoomStateMessage {
	type: 'room:state'
	state: RoomState
}

export interface GameStateMessage {
	type: 'game:state'
	state: unknown // Game-specific state
}

export interface RoundPhaseChangeMessage {
	type: 'round:phase-change'
	phase: GamePhase
	timeRemaining: number
}

export interface TimerTickMessage {
	type: 'timer:tick'
	timeRemaining: number
}

export interface VoteOption {
	id: string
	content: string
	isHouseAnswer: boolean
}

export interface VoteOptionsMessage {
	type: 'vote:options'
	options: VoteOption[]
}

export interface RoundResultsMessage {
	type: 'round:results'
	results: RoundResults
}

export interface ReconnectSuccessMessage {
	type: 'reconnect:success'
	player: Player
	gameState: unknown // Current game state
}

export interface ErrorMessage {
	type: 'error'
	code: string
	message: string
}

export interface LobbyVotingUpdateMessage {
	type: 'lobby:voting-update'
	votingState: RoomVotingState
}

export interface LobbyCountdownMessage {
	type: 'lobby:countdown'
	countdown: number // Seconds remaining (5, 4, 3, 2, 1, 0)
	selectedGame: GameId
}

export interface LobbyCountdownCancelledMessage {
	type: 'lobby:countdown-cancelled'
	reason: 'player_disconnect' | 'manual_cancel'
}

export interface GameStartMessage {
	type: 'game:start'
	gameId: GameId
	gameState: unknown // Game module owns this
}

export type ServerMessage =
	| JoinSuccessMessage
	| RoomUpdateMessage
	| RoomStateMessage // NEW: Phase-based state
	| GameStateMessage
	| RoundPhaseChangeMessage
	| TimerTickMessage
	| VoteOptionsMessage
	| RoundResultsMessage
	| ReconnectSuccessMessage
	| ErrorMessage
	| LobbyVotingUpdateMessage
	| LobbyCountdownMessage
	| LobbyCountdownCancelledMessage
	| GameStartMessage
