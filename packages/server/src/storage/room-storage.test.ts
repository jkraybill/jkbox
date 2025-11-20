import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RoomStorage } from './room-storage'
import type { LobbyState, PlayingState, Player } from '@jkbox/shared'

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
      const room: LobbyState = {
        phase: 'lobby',
        roomId: 'TEST',
        players: [],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      }

      storage.saveRoom(room)
      const loaded = storage.getRoom('TEST')

      expect(loaded).toBeDefined()
      expect(loaded?.roomId).toBe('TEST')
      expect(loaded?.phase).toBe('lobby')
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

      const room: LobbyState = {
        phase: 'lobby',
        roomId: 'TEST',
        players,
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      }

      storage.saveRoom(room)
      const loaded = storage.getRoom('TEST')

      expect(loaded?.players).toHaveLength(2)
      expect(loaded?.players[0]?.nickname).toBe('Alice')
      expect(loaded?.players[1]?.nickname).toBe('Bob')
      expect(loaded?.players[1]?.score).toBe(100)
    })

    it('should update existing room', () => {
      const room: LobbyState = {
        phase: 'lobby',
        roomId: 'TEST',
        players: [],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      }

      storage.saveRoom(room)

      // Update state to playing
      const playingRoom: PlayingState = {
        phase: 'playing',
        roomId: 'TEST',
        players: [],
        gameId: 'fake-facts',
        roundNumber: 1,
        currentRound: null
      }
      storage.saveRoom(playingRoom)

      const loaded = storage.getRoom('TEST')
      expect(loaded?.phase).toBe('playing')
      if (loaded?.phase === 'playing') {
        expect(loaded.gameId).toBe('fake-facts')
      }
    })
  })

  describe('getRoom', () => {
    it('should return undefined for non-existent room', () => {
      const loaded = storage.getRoom('NOPE')
      expect(loaded).toBeUndefined()
    })

    it('should restore Date objects correctly', () => {
      const connectedAt = new Date('2025-01-01T12:00:00Z')
      const room: LobbyState = {
        phase: 'lobby',
        roomId: 'TEST',
        players: [
          {
            id: 'player-1',
            roomId: 'TEST',
            nickname: 'Alice',
            sessionToken: 'token-1',
            isAdmin: false,
            isHost: false,
            score: 0,
            connectedAt,
            lastSeenAt: connectedAt,
            isConnected: true
          }
        ],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      }

      storage.saveRoom(room)
      const loaded = storage.getRoom('TEST')

      expect(loaded?.players[0]?.connectedAt).toBeInstanceOf(Date)
      expect(loaded?.players[0]?.connectedAt.toISOString()).toBe(connectedAt.toISOString())
    })
  })

  describe('getAllRooms', () => {
    it('should return all rooms', () => {
      const room1: LobbyState = {
        phase: 'lobby',
        roomId: 'ROOM1',
        players: [],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      }

      const room2: PlayingState = {
        phase: 'playing',
        roomId: 'ROOM2',
        players: [],
        gameId: 'fake-facts',
        roundNumber: 1,
        currentRound: null
      }

      storage.saveRoom(room1)
      storage.saveRoom(room2)

      const rooms = storage.getAllRooms()
      expect(rooms).toHaveLength(2)
      expect(rooms.map(r => r.roomId).sort()).toEqual(['ROOM1', 'ROOM2'])
    })

    it('should return empty array when no rooms exist', () => {
      const rooms = storage.getAllRooms()
      expect(rooms).toEqual([])
    })
  })

  describe('deleteRoom', () => {
    it('should delete room', () => {
      const room: LobbyState = {
        phase: 'lobby',
        roomId: 'TEST',
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
        gameVotes: {},
        readyStates: {},
        selectedGame: null
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
      const room: LobbyState = {
        phase: 'lobby',
        roomId: 'TEST',
        players: [],
        gameVotes: {},
        readyStates: {},
        selectedGame: null
      }

      expect(() => storage.saveRoom(room)).not.toThrow()
      expect(storage.getRoom('TEST')).toBeDefined()
    })

    it('should have correct schema with phase column', () => {
      // Verify rooms table has expected columns
      const tableInfo = storage['db'].prepare("PRAGMA table_info(rooms)").all() as Array<{
        cid: number
        name: string
        type: string
        notnull: number
        dflt_value: string | null
        pk: number
      }>

      const columnNames = tableInfo.map(col => col.name)

      expect(columnNames).toContain('room_id')
      expect(columnNames).toContain('phase')
      expect(columnNames).toContain('state_json')
      expect(columnNames).toContain('created_at')
      expect(columnNames).toContain('updated_at')

      // Verify phase column has correct constraint
      const phaseColumn = tableInfo.find(col => col.name === 'phase')
      expect(phaseColumn?.notnull).toBe(1) // NOT NULL constraint
    })

    it('should have correct indexes', () => {
      const indexes = storage['db'].prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='rooms'").all() as Array<{ name: string }>

      const indexNames = indexes.map(idx => idx.name)
      expect(indexNames).toContain('idx_rooms_phase')
      expect(indexNames).toContain('idx_rooms_updated_at')
    })

    it('should have room_players table with foreign key', () => {
      const tableInfo = storage['db'].prepare("PRAGMA table_info(room_players)").all() as Array<{
        name: string
      }>

      const columnNames = tableInfo.map(col => col.name)

      expect(columnNames).toContain('player_id')
      expect(columnNames).toContain('room_id')
      expect(columnNames).toContain('nickname')
      expect(columnNames).toContain('connected')
      expect(columnNames).toContain('joined_at')
    })
  })
})
