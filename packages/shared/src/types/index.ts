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
