// Core type exports for jkbox

// Room types (legacy - being migrated)
export type { Room, RoomConfig as LegacyRoomConfig } from './room'

// Phase-based room state (new discriminated union pattern)
export type {
	RoomState,
	RoomConfig,
	PauseState,
	TitleState,
	LobbyState,
	CountdownState,
	PlayingState,
	ResultsState,
	Achievement
} from './room-state'
export {
	isTitleState,
	isLobbyState,
	isCountdownState,
	isPlayingState,
	isResultsState
} from './room-state'

// Player types
export type { Player } from './player'

// Game module types (legacy - being refactored)
export type {
	GamePhase,
	RoundTimers,
	ScoringRules,
	GameConfig,
	RoundState,
	RoundResults,
	GameResults,
	GameModule as LegacyGameModule
} from './game'

// New game module interface (pluggable pattern)
export type {
	GameAction,
	GameState,
	GameResults as ModuleGameResults,
	Achievement as GameAchievement,
	JumbotronProps,
	ControllerProps,
	GameModule as PluggableGameModule,
	GameRegistry,
	GameModuleContext,
	GameCompleteCallback
} from './game-module'

// Voting types
export type { GameId, GameVote, PlayerReadyState, RoomVotingState } from './voting'

// WebSocket message types
export type {
	// Client messages
	JoinMessage,
	SubmitMessage,
	VoteMessage,
	AdminStartGameMessage,
	AdminPauseMessage,
	AdminUnpauseMessage,
	AdminSkipPhaseMessage,
	AdminDelegateMessage,
	AdminBootPlayerMessage,
	AdminBackToLobbyMessage,
	AdminHardResetMessage,
	AdminUpdateConfigMessage,
	RestoreSessionMessage,
	LobbyVoteGameMessage,
	LobbyReadyToggleMessage,
	ClientMessage,
	// Server messages
	JoinSuccessMessage,
	RoomUpdateMessage,
	RoomStateMessage, // NEW: Phase-based state
	WatchMessage,
	GameStateMessage,
	GameStartMessage,
	RoundPhaseChangeMessage,
	TimerTickMessage,
	VoteOption,
	VoteOptionsMessage,
	RoundResultsMessage,
	ReconnectSuccessMessage,
	ErrorMessage,
	LobbyVotingUpdateMessage,
	LobbyCountdownMessage,
	LobbyCountdownCancelledMessage,
	ServerMessage
} from './messages'
