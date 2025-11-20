import type { Player, RoomState, LobbyState, TitleState } from '@jkbox/shared'
import { generateRoomCode } from './utils/room-code'
import type { RoomStorage } from './storage/room-storage'

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map()
  private storage?: RoomStorage
  private singletonRoomId: string | null = null  // For single-room mode

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

  /**
   * Get or create singleton room (for single-room Jumbotron mode)
   * Room starts in 'title' phase for Pippin intro animation
   */
  getOrCreateSingletonRoom(): RoomState {
    // If singleton room exists, return it
    if (this.singletonRoomId) {
      const room = this.rooms.get(this.singletonRoomId)
      if (room) {
        return room
      }
    }

    // Check if any room exists (from storage restore)
    const existingRooms = Array.from(this.rooms.values())
    if (existingRooms.length > 0) {
      const room = existingRooms[0]!
      this.singletonRoomId = room.roomId
      return room
    }

    // Create new room in title phase
    const roomId = generateRoomCode()
    const room: TitleState = {
      phase: 'title',
      roomId,
      players: []
    }

    this.rooms.set(roomId, room)
    this.singletonRoomId = roomId
    this.persistRoom(room)

    console.log(`✨ Created singleton room ${roomId} in title phase`)
    return room
  }

  /**
   * Transition singleton room from title → lobby
   * Called after Pippin intro animation completes
   */
  transitionTitleToLobby(): LobbyState | null {
    if (!this.singletonRoomId) {
      return null
    }

    const room = this.rooms.get(this.singletonRoomId)
    if (!room || room.phase !== 'title') {
      return null
    }

    // Transition to lobby phase
    const lobbyRoom: LobbyState = {
      phase: 'lobby',
      roomId: room.roomId,
      players: room.players,
      gameVotes: {},
      readyStates: {},
      selectedGame: null
    }

    this.rooms.set(room.roomId, lobbyRoom)
    this.persistRoom(lobbyRoom)

    console.log(`✅ Transitioned room ${room.roomId} from title → lobby`)
    return lobbyRoom
  }
}
