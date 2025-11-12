// Game module types for jkbox

import type { Room } from './room'

export type GamePhase = 'submit' | 'vote' | 'results'

export interface RoundTimers {
  submit: number    // Seconds for submission phase
  vote: number      // Seconds for voting phase
  results: number   // Seconds to show results
}

export interface ScoringRules {
  // Game-specific scoring configuration
  // Will be extended by specific game implementations
  [key: string]: number | boolean | string
}

export interface GameConfig {
  roundTimers: RoundTimers
  scoring: ScoringRules
  contentPacks: string[]  // Enabled content pack IDs
}

export interface RoundState {
  phase: GamePhase
  timeRemaining: number
  isPaused: boolean
  submissions: Map<string, unknown>  // playerId → submission (game-specific)
  votes: Map<string, string>         // voterId → votedForId
}

export interface RoundResults {
  winner: string  // Submission ID
  scores: Map<string, number>  // playerId → points earned
  breakdown: unknown  // Game-specific result details
}

export interface GameResults {
  finalScores: Map<string, number>  // playerId → total score
  winners: string[]  // Player IDs (can have ties)
  stats: unknown  // Game-specific statistics
}

export interface GameModule {
  // Metadata
  id: string
  name: string
  minPlayers: number
  maxPlayers: number

  // Configuration
  config: GameConfig

  // State
  currentRound: number
  totalRounds: number
  roundState: RoundState

  // Lifecycle hooks
  onStart(room: Room): void
  onRoundStart(roundNumber: number): void
  onPlayerSubmit(playerId: string, submission: unknown): void
  onVote(playerId: string, votedForId: string): void
  onRoundEnd(): RoundResults
  onGameEnd(): GameResults

  // Timer controls
  pauseTimer(): void
  resumeTimer(): void
  skipPhase(): void
}
