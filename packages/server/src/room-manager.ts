import type { Player, RoomState, LobbyState } from '@jkbox/shared'
import { generateRoomCode } from './utils/room-code'
import type { RoomStorage } from './storage/room-storage'

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map()
  private storage?: RoomStorage

  constructor(storage?: RoomStorage) {
    this.storage = storage
  }

  /**
   * Restore rooms from persistent storage (call on server startup)
   */
  restoreFromStorage(): void {
    if (!this.storage) {
      return
    }

    const rooms = this.storage.getAllRooms()
    for (const room of rooms) {
      this.rooms.set(room.roomId, room)
    }

    console.log(`✓ Restored ${rooms.length} room(s) from storage`)
  }

  /**
   * Persist room to storage (auto-save helper)
   */
  private persistRoom(room: RoomState): void {
    if (this.storage) {
      this.storage.saveRoom(room)
    }
  }

  /**
   * Create a new room with a unique ID (always starts in lobby phase)
   */
  createRoom(): LobbyState {
    const roomId = generateRoomCode()

    const room: LobbyState = {
      phase: 'lobby',
      roomId,
      players: [],
      gameVotes: {},
      readyStates: {},
      selectedGame: null
    }

    this.rooms.set(roomId, room)
    this.persistRoom(room) // Auto-save
    return room
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId)
  }

  /**
   * Find room containing a specific player
   */
  getRoomByPlayerId(playerId: string): RoomState | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === playerId)) {
        return room
      }
    }
    return undefined
  }

  /**
   * Add player to room
   * Returns false if room is full or doesn't exist
   */
  addPlayer(roomId: string, player: Player): boolean {
    const room = this.rooms.get(roomId)
    if (!room) {
      return false
    }

    // Check capacity (hardcoded max 12 for now)
    const MAX_PLAYERS = 12
    if (room.players.length >= MAX_PLAYERS) {
      return false
    }

    room.players.push(player)
    this.persistRoom(room) // Auto-save
    return true
  }

  /**
   * Remove player from room
   */
  removePlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) {
      return
    }

    room.players = room.players.filter(p => p.id !== playerId)
    this.persistRoom(room) // Auto-save
  }

  /**
   * Update player properties in room
   */
  updatePlayer(roomId: string, playerId: string, updates: Partial<Player>): void {
    const room = this.rooms.get(roomId)
    if (!room) {
      return
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId)
    if (playerIndex === -1) {
      return
    }

    room.players[playerIndex] = {
      ...room.players[playerIndex]!,
      ...updates
    }
    this.persistRoom(room) // Auto-save
  }

  /**
   * Update entire room state (for phase transitions: lobby → countdown → playing → results)
   */
  updateRoomState(roomId: string, newState: RoomState): void {
    this.rooms.set(roomId, newState)
    this.persistRoom(newState) // Auto-save
  }

  /**
   * Delete room
   */
  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId)
    if (this.storage) {
      this.storage.deleteRoom(roomId)
    }
  }

  /**
   * Get all rooms (for debugging/admin)
   */
  getAllRooms(): RoomState[] {
    return Array.from(this.rooms.values())
  }
}
