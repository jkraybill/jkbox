// Room and related types for jkbox arena

import type { Player } from './player'
import type { GameModule } from './game'

export interface RoomConfig {
  maxPlayers: number
  allowMidGameJoin: boolean
  autoAdvanceTimers: boolean
}

export type RoomState = 'lobby' | 'playing' | 'finished'

export interface Room {
  id: string
  hostId: string
  adminIds: string[]
  state: RoomState
  currentGame: GameModule | null
  players: Player[]
  createdAt: Date
  config: RoomConfig
}
