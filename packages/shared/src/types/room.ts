// Room and related types for jkbox arena

import type { Player } from './player'
import type { GameModule } from './game'

export interface RoomConfig {
  maxPlayers: number
  allowMidGameJoin: boolean
  autoAdvanceTimers: boolean
}

// DEPRECATED: Old string-based state (replaced by RoomState discriminated union)
export type RoomPhase = 'lobby' | 'playing' | 'finished'

// DEPRECATED: Old Room type (replaced by RoomState discriminated union)
export interface Room {
  id: string
  hostId: string
  adminIds: string[]
  state: RoomPhase
  currentGame: GameModule | null
  players: Player[]
  createdAt: Date
  config: RoomConfig
}
