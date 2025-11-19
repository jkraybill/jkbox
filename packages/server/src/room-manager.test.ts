import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from './room-manager'

describe('RoomManager', () => {
  let manager: RoomManager

  beforeEach(() => {
    manager = new RoomManager()
  })

  describe('createRoom', () => {
    it('should create a room with unique ID', () => {
      const room = manager.createRoom()

      expect(room.roomId).toBeDefined()
      expect(room.roomId.length).toBeGreaterThan(0)
      expect(room.phase).toBe('lobby')
      expect(room.players).toHaveLength(0)
    })

    it('should create rooms with different IDs', () => {
      const room1 = manager.createRoom()
      const room2 = manager.createRoom()

      expect(room1.roomId).not.toBe(room2.roomId)
    })

    it('should initialize lobby state with voting properties', () => {
      const room = manager.createRoom()

      expect(room.gameVotes).toEqual({})
      expect(room.readyStates).toEqual({})
      expect(room.selectedGame).toBeNull()
    })
  })

  describe('getRoom', () => {
    it('should retrieve existing room by ID', () => {
      const created = manager.createRoom()
      const retrieved = manager.getRoom(created.roomId)

      expect(retrieved).toBeDefined()
      expect(retrieved?.roomId).toBe(created.roomId)
    })

    it('should return undefined for non-existent room', () => {
      const room = manager.getRoom('INVALID')

      expect(room).toBeUndefined()
    })
  })

  describe('getRoomByPlayerId', () => {
    it('should find room containing player', () => {
      const room = manager.createRoom()
      manager.addPlayer(room.roomId, {
        id: 'player-1',
        roomId: room.roomId,
        nickname: 'Alice',
        sessionToken: 'token-1',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      })

      const found = manager.getRoomByPlayerId('player-1')

      expect(found).toBeDefined()
      expect(found?.roomId).toBe(room.roomId)
    })

    it('should return undefined if player not in any room', () => {
      manager.createRoom()
      const found = manager.getRoomByPlayerId('nonexistent')

      expect(found).toBeUndefined()
    })
  })

  describe('addPlayer', () => {
    it('should add player to room', () => {
      const room = manager.createRoom()

      manager.addPlayer(room.roomId, {
        id: 'player-1',
        roomId: room.roomId,
        nickname: 'Alice',
        sessionToken: 'token-1',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      })

      const updated = manager.getRoom(room.roomId)
      expect(updated?.players).toHaveLength(1)
      expect(updated?.players[0]?.id).toBe('player-1')
    })

    it('should not add player if room is full', () => {
      const room = manager.createRoom()

      // Add max players (12)
      for (let i = 0; i < 12; i++) {
        manager.addPlayer(room.roomId, {
          id: `player-${i}`,
          roomId: room.roomId,
          nickname: `Player${i}`,
          sessionToken: `token-${i}`,
          isAdmin: false,
          isHost: false,
          score: 0,
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          isConnected: true
        })
      }

      // Try to add 13th player
      const result = manager.addPlayer(room.roomId, {
        id: 'player-13',
        roomId: room.roomId,
        nickname: 'Overflow',
        sessionToken: 'token-13',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      })

      expect(result).toBe(false)
      const updated = manager.getRoom(room.roomId)
      expect(updated?.players).toHaveLength(12)
    })
  })

  describe('removePlayer', () => {
    it('should remove player from room', () => {
      const room = manager.createRoom()
      manager.addPlayer(room.roomId, {
        id: 'player-1',
        roomId: room.roomId,
        nickname: 'Alice',
        sessionToken: 'token-1',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      })

      manager.removePlayer(room.roomId, 'player-1')

      const updated = manager.getRoom(room.roomId)
      expect(updated?.players).toHaveLength(0)
    })

    it('should not error when removing non-existent player', () => {
      const room = manager.createRoom()

      expect(() => {
        manager.removePlayer(room.roomId, 'nonexistent')
      }).not.toThrow()
    })
  })

  describe('updatePlayer', () => {
    it('should update player properties', () => {
      const room = manager.createRoom()
      manager.addPlayer(room.roomId, {
        id: 'player-1',
        roomId: room.roomId,
        nickname: 'Alice',
        sessionToken: 'token-1',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      })

      manager.updatePlayer(room.roomId, 'player-1', {
        score: 100,
        isAdmin: true
      })

      const updated = manager.getRoom(room.roomId)
      const player = updated?.players.find(p => p.id === 'player-1')
      expect(player?.score).toBe(100)
      expect(player?.isAdmin).toBe(true)
      expect(player?.nickname).toBe('Alice') // Unchanged
    })
  })

  describe('deleteRoom', () => {
    it('should delete room', () => {
      const room = manager.createRoom()
      manager.deleteRoom(room.roomId)

      const found = manager.getRoom(room.roomId)
      expect(found).toBeUndefined()
    })
  })
})
