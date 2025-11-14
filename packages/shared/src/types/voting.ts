/**
 * Game voting and ready check types for jkbox lobby
 */

export type GameId = 'fake-facts' | 'cinephile' | 'joker-poker'

export interface GameVote {
  playerId: string
  gameId: GameId
  timestamp: Date
}

export interface PlayerReadyState {
  playerId: string
  hasVoted: boolean
  isReady: boolean  // "Good to Go" toggle
}

export interface RoomVotingState {
  votes: Map<string, GameVote>
  readyStates: Map<string, PlayerReadyState>
  allReady: boolean  // Computed: all players voted + ready
  selectedGame: GameId | null  // Most voted game (null if tied)
}
