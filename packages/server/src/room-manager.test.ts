import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from './room-manager'

describe('RoomManager', () => {
  let manager: RoomManager

  beforeEach(() => {
    manager = new RoomManager()
  })

  describe('createRoom', () => {
    it('should create a room with unique ID', () => {
      const room = manager.createRoom('host-1')

      expect(room.id).toBeDefined()
      expect(room.id.length).toBeGreaterThan(0)
      expect(room.hostId).toBe('host-1')
      expect(room.state).toBe('lobby')
      expect(room.players).toHaveLength(0)
    })

    it('should create rooms with different IDs', () => {
      const room1 = manager.createRoom('host-1')
      const room2 = manager.createRoom('host-2')

      expect(room1.id).not.toBe(room2.id)
    })

    it('should initialize with default config', () => {
      const room = manager.createRoom('host-1')

      expect(room.config.maxPlayers).toBe(12)
      expect(room.config.allowMidGameJoin).toBe(false)
      expect(room.config.autoAdvanceTimers).toBe(true)
    })

    it('should set host as admin', () => {
      const room = manager.createRoom('host-1')

      expect(room.adminIds).toContain('host-1')
      expect(room.adminIds).toHaveLength(1)
    })

    it('should initialize with no current game', () => {
      const room = manager.createRoom('host-1')

      expect(room.currentGame).toBeNull()
    })
  })

  describe('getRoom', () => {
    it('should retrieve existing room by ID', () => {
      const created = manager.createRoom('host-1')
      const retrieved = manager.getRoom(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
    })

    it('should return undefined for non-existent room', () => {
      const room = manager.getRoom('INVALID')

      expect(room).toBeUndefined()
    })
  })

  describe('getRoomByPlayerId', () => {
    it('should find room containing player', () => {
      const room = manager.createRoom('host-1')
      manager.addPlayer(room.id, {
        id: 'player-1',
        roomId: room.id,
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
      expect(found?.id).toBe(room.id)
    })

    it('should return undefined if player not in any room', () => {
      manager.createRoom('host-1')
      const found = manager.getRoomByPlayerId('nonexistent')

      expect(found).toBeUndefined()
    })
  })

  describe('addPlayer', () => {
    it('should add player to room', () => {
      const room = manager.createRoom('host-1')

      manager.addPlayer(room.id, {
        id: 'player-1',
        roomId: room.id,
        nickname: 'Alice',
        sessionToken: 'token-1',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      })

      const updated = manager.getRoom(room.id)
      expect(updated?.players).toHaveLength(1)
      expect(updated?.players[0]?.id).toBe('player-1')
    })

    it('should not add player if room is full', () => {
      const room = manager.createRoom('host-1')

      // Add max players (12)
      for (let i = 0; i < 12; i++) {
        manager.addPlayer(room.id, {
          id: `player-${i}`,
          roomId: room.id,
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
      const result = manager.addPlayer(room.id, {
        id: 'player-13',
        roomId: room.id,
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
      const updated = manager.getRoom(room.id)
      expect(updated?.players).toHaveLength(12)
    })
  })

  describe('removePlayer', () => {
    it('should remove player from room', () => {
      const room = manager.createRoom('host-1')
      manager.addPlayer(room.id, {
        id: 'player-1',
        roomId: room.id,
        nickname: 'Alice',
        sessionToken: 'token-1',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      })

      manager.removePlayer(room.id, 'player-1')

      const updated = manager.getRoom(room.id)
      expect(updated?.players).toHaveLength(0)
    })

    it('should not error when removing non-existent player', () => {
      const room = manager.createRoom('host-1')

      expect(() => {
        manager.removePlayer(room.id, 'nonexistent')
      }).not.toThrow()
    })
  })

  describe('updatePlayer', () => {
    it('should update player properties', () => {
      const room = manager.createRoom('host-1')
      manager.addPlayer(room.id, {
        id: 'player-1',
        roomId: room.id,
        nickname: 'Alice',
        sessionToken: 'token-1',
        isAdmin: false,
        isHost: false,
        score: 0,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        isConnected: true
      })

      manager.updatePlayer(room.id, 'player-1', {
        score: 100,
        isAdmin: true
      })

      const updated = manager.getRoom(room.id)
      const player = updated?.players.find(p => p.id === 'player-1')
      expect(player?.score).toBe(100)
      expect(player?.isAdmin).toBe(true)
      expect(player?.nickname).toBe('Alice') // Unchanged
    })
  })

  describe('deleteRoom', () => {
    it('should delete room', () => {
      const room = manager.createRoom('host-1')
      manager.deleteRoom(room.id)

      const found = manager.getRoom(room.id)
      expect(found).toBeUndefined()
    })
  })
})
