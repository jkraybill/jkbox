// WebSocket message types for jkbox client-server communication

import type { Room } from './room'
import type { Player } from './player'
import type { GameConfig, RoundResults, GamePhase } from './game'

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface JoinMessage {
  type: 'join'
  roomId: string
  nickname: string
  sessionToken?: string  // For reconnection
}

export interface SubmitMessage {
  type: 'submit'
  roundId: string
  content: unknown  // Game-specific submission
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

export type ClientMessage =
  | JoinMessage
  | SubmitMessage
  | VoteMessage
  | AdminStartGameMessage
  | AdminPauseTimerMessage
  | AdminResumeTimerMessage
  | AdminSkipPhaseMessage
  | AdminDelegateMessage

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface RoomUpdateMessage {
  type: 'room:update'
  room: Room
}

export interface GameStateMessage {
  type: 'game:state'
  state: unknown  // Game-specific state
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
  gameState: unknown  // Current game state
}

export interface ErrorMessage {
  type: 'error'
  code: string
  message: string
}

export type ServerMessage =
  | RoomUpdateMessage
  | GameStateMessage
  | RoundPhaseChangeMessage
  | TimerTickMessage
  | VoteOptionsMessage
  | RoundResultsMessage
  | ReconnectSuccessMessage
  | ErrorMessage
