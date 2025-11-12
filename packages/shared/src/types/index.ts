// Core type exports for jkbox

// Room types
export type { Room, RoomConfig, RoomState } from './room'

// Player types
export type { Player } from './player'

// Game module types
export type {
  GamePhase,
  RoundTimers,
  ScoringRules,
  GameConfig,
  RoundState,
  RoundResults,
  GameResults,
  GameModule
} from './game'

// WebSocket message types
export type {
  // Client messages
  JoinMessage,
  SubmitMessage,
  VoteMessage,
  AdminStartGameMessage,
  AdminPauseTimerMessage,
  AdminResumeTimerMessage,
  AdminSkipPhaseMessage,
  AdminDelegateMessage,
  ClientMessage,
  // Server messages
  RoomUpdateMessage,
  GameStateMessage,
  RoundPhaseChangeMessage,
  TimerTickMessage,
  VoteOption,
  VoteOptionsMessage,
  RoundResultsMessage,
  ReconnectSuccessMessage,
  ErrorMessage,
  ServerMessage
} from './messages'
