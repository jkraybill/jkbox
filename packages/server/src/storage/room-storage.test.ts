import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RoomStorage } from './room-storage'
import type { Room, Player } from '@jkbox/shared'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('RoomStorage', () => {
  let storage: RoomStorage

  beforeEach(() => {
    // Use in-memory SQLite for tests
    storage = new RoomStorage(':memory:')
  })

  afterEach(() => {
    storage.close()
  })

  describe('saveRoom', () => {
    it('should save room to database', () => {
      const room: Room = {
        id: 'TEST',
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

      storage.saveRoom(room)
      const loaded = storage.getRoom('TEST')

      expect(loaded).toBeDefined()
      expect(loaded?.id).toBe('TEST')
      expect(loaded?.hostId).toBe('player-1')
      expect(loaded?.state).toBe('lobby')
    })

    it('should save room with players', () => {
      const players: Player[] = [
        {
          id: 'player-1',
          roomId: 'TEST',
          nickname: 'Alice',
          sessionToken: 'token-1',
          isAdmin: true,
          isHost: true,
          score: 0,
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          isConnected: true
        },
        {
          id: 'player-2',
          roomId: 'TEST',
          nickname: 'Bob',
          sessionToken: 'token-2',
          isAdmin: false,
          isHost: false,
          score: 100,
          connectedAt: new Date(),
          lastSeenAt: new Date(),
          isConnected: true
        }
      ]

      const room: Room = {
        id: 'TEST',
        hostId: 'player-1',
        adminIds: ['player-1'],
        state: 'lobby',
        currentGame: null,
        players,
        createdAt: new Date(),
        config: {
          maxPlayers: 12,
          allowMidGameJoin: false,
          autoAdvanceTimers: true
        }
      }

      storage.saveRoom(room)
      const loaded = storage.getRoom('TEST')

      expect(loaded?.players).toHaveLength(2)
      expect(loaded?.players[0]?.nickname).toBe('Alice')
      expect(loaded?.players[1]?.nickname).toBe('Bob')
      expect(loaded?.players[1]?.score).toBe(100)
    })

    it('should update existing room', () => {
      const room: Room = {
        id: 'TEST',
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

      storage.saveRoom(room)

      // Update state
      room.state = 'playing'
      room.currentGame = 'fake-facts'
      storage.saveRoom(room)

      const loaded = storage.getRoom('TEST')
      expect(loaded?.state).toBe('playing')
      expect(loaded?.currentGame).toBe('fake-facts')
    })
  })

  describe('getRoom', () => {
    it('should return undefined for non-existent room', () => {
      const loaded = storage.getRoom('NOPE')
      expect(loaded).toBeUndefined()
    })

    it('should restore Date objects correctly', () => {
      const createdAt = new Date('2025-01-01T12:00:00Z')
      const room: Room = {
        id: 'TEST',
        hostId: 'player-1',
        adminIds: ['player-1'],
        state: 'lobby',
        currentGame: null,
        players: [],
        createdAt,
        config: {
          maxPlayers: 12,
          allowMidGameJoin: false,
          autoAdvanceTimers: true
        }
      }

      storage.saveRoom(room)
      const loaded = storage.getRoom('TEST')

      expect(loaded?.createdAt).toBeInstanceOf(Date)
      expect(loaded?.createdAt.toISOString()).toBe(createdAt.toISOString())
    })
  })

  describe('getAllRooms', () => {
    it('should return all rooms', () => {
      const room1: Room = {
        id: 'ROOM1',
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

      const room2: Room = {
        id: 'ROOM2',
        hostId: 'player-2',
        adminIds: ['player-2'],
        state: 'playing',
        currentGame: 'fake-facts',
        players: [],
        createdAt: new Date(),
        config: {
          maxPlayers: 8,
          allowMidGameJoin: true,
          autoAdvanceTimers: false
        }
      }

      storage.saveRoom(room1)
      storage.saveRoom(room2)

      const rooms = storage.getAllRooms()
      expect(rooms).toHaveLength(2)
      expect(rooms.map(r => r.id).sort()).toEqual(['ROOM1', 'ROOM2'])
    })

    it('should return empty array when no rooms exist', () => {
      const rooms = storage.getAllRooms()
      expect(rooms).toEqual([])
    })
  })

  describe('deleteRoom', () => {
    it('should delete room and associated players', () => {
      const room: Room = {
        id: 'TEST',
        hostId: 'player-1',
        adminIds: ['player-1'],
        state: 'lobby',
        currentGame: null,
        players: [
          {
            id: 'player-1',
            roomId: 'TEST',
            nickname: 'Alice',
            sessionToken: 'token-1',
            isAdmin: true,
            isHost: true,
            score: 0,
            connectedAt: new Date(),
            lastSeenAt: new Date(),
            isConnected: true
          }
        ],
        createdAt: new Date(),
        config: {
          maxPlayers: 12,
          allowMidGameJoin: false,
          autoAdvanceTimers: true
        }
      }

      storage.saveRoom(room)
      expect(storage.getRoom('TEST')).toBeDefined()

      storage.deleteRoom('TEST')
      expect(storage.getRoom('TEST')).toBeUndefined()
    })

    it('should not error when deleting non-existent room', () => {
      expect(() => storage.deleteRoom('NOPE')).not.toThrow()
    })
  })

  describe('schema initialization', () => {
    it('should create tables from schema file', () => {
      // Schema already applied in constructor
      // Verify by inserting and retrieving data
      const room: Room = {
        id: 'TEST',
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

      expect(() => storage.saveRoom(room)).not.toThrow()
      expect(storage.getRoom('TEST')).toBeDefined()
    })
  })
})
