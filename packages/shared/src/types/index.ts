// Core type exports for jkbox

// Room types (legacy - being migrated)
export type { Room, RoomConfig } from './room'

// Phase-based room state (new discriminated union pattern)
export type {
  RoomState,
  LobbyState,
  CountdownState,
  PlayingState,
  ResultsState,
  Achievement
} from './room-state'
export {
  isLobbyState,
  isCountdownState,
  isPlayingState,
  isResultsState
} from './room-state'

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

// Voting types
export type {
  GameId,
  GameVote,
  PlayerReadyState,
  RoomVotingState
} from './voting'

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
  LobbyVoteGameMessage,
  LobbyReadyToggleMessage,
  ClientMessage,
  // Server messages
  JoinSuccessMessage,
  RoomUpdateMessage,
  GameStateMessage,
  RoundPhaseChangeMessage,
  TimerTickMessage,
  VoteOption,
  VoteOptionsMessage,
  RoundResultsMessage,
  ReconnectSuccessMessage,
  ErrorMessage,
  LobbyVotingUpdateMessage,
  LobbyCountdownMessage,
  ServerMessage
} from './messages'
