import { describe, it, expect } from 'vitest'
import type { Room, RoomConfig, RoomState } from './room'

describe('Room types', () => {
  describe('RoomConfig', () => {
    it('should have correct shape', () => {
      const config: RoomConfig = {
        maxPlayers: 12,
        allowMidGameJoin: false,
        autoAdvanceTimers: true
      }

      expect(config.maxPlayers).toBe(12)
      expect(config.allowMidGameJoin).toBe(false)
      expect(config.autoAdvanceTimers).toBe(true)
    })

    it('should enforce type safety', () => {
      const config: RoomConfig = {
        maxPlayers: 8,
        allowMidGameJoin: true,
        autoAdvanceTimers: false
      }

      // TypeScript ensures these are the correct types
      expect(typeof config.maxPlayers).toBe('number')
      expect(typeof config.allowMidGameJoin).toBe('boolean')
      expect(typeof config.autoAdvanceTimers).toBe('boolean')
    })
  })

  describe('RoomState', () => {
    it('should allow valid states', () => {
      const states: RoomState[] = ['lobby', 'playing', 'finished']

      states.forEach(state => {
        expect(['lobby', 'playing', 'finished']).toContain(state)
      })
    })
  })

  describe('Room', () => {
    it('should have correct shape', () => {
      const room: Room = {
        id: 'WXYZ',
        hostId: 'player-1',
        adminIds: ['player-1'],
        state: 'lobby',
        currentGame: null,
        players: [],
        createdAt: new Date(),
        config: {
          maxPlayers: 12,
          allowMidGameJoin: false,
          autoAdvanceTimers: true
        }
      }

      expect(room.id).toBe('WXYZ')
      expect(room.hostId).toBe('player-1')
      expect(room.state).toBe('lobby')
      expect(room.currentGame).toBeNull()
      expect(Array.isArray(room.players)).toBe(true)
      expect(room.createdAt).toBeInstanceOf(Date)
      expect(room.config.maxPlayers).toBe(12)
    })

    it('should support multiple admins', () => {
      const room: Room = {
        id: 'TEST',
        hostId: 'host-1',
        adminIds: ['host-1', 'player-2', 'player-3'],
        state: 'lobby',
        currentGame: null,
        players: [],
        createdAt: new Date(),
        config: {
          maxPlayers: 12,
          allowMidGameJoin: false,
          autoAdvanceTimers: true
        }
      }

      expect(room.adminIds).toHaveLength(3)
      expect(room.adminIds).toContain('host-1')
      expect(room.adminIds).toContain('player-2')
    })

    it('should support all room states', () => {
      const lobbyRoom: Room = {
        id: 'TEST1',
        hostId: 'host',
        adminIds: [],
        state: 'lobby',
        currentGame: null,
        players: [],
        createdAt: new Date(),
        config: { maxPlayers: 12, allowMidGameJoin: false, autoAdvanceTimers: true }
      }

      const playingRoom: Room = {
        ...lobbyRoom,
        id: 'TEST2',
        state: 'playing'
      }

      const finishedRoom: Room = {
        ...lobbyRoom,
        id: 'TEST3',
        state: 'finished'
      }

      expect(lobbyRoom.state).toBe('lobby')
      expect(playingRoom.state).toBe('playing')
      expect(finishedRoom.state).toBe('finished')
    })
  })
})
