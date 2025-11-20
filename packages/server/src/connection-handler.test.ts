import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Socket, Server } from 'socket.io'
import { RoomManager } from './room-manager'
import { ConnectionHandler } from './connection-handler'

// Mock Socket.io socket
function createMockSocket(id: string): Partial<Socket> {
  const emittedEvents: Array<{ event: string; data: unknown }> = []
  const joinedRooms: string[] = []

  return {
    id,
    emit: (event: string, data: unknown) => {
      emittedEvents.push({ event, data })
    },
    join: (room: string) => {
      joinedRooms.push(room)
    },
    disconnect: () => {
      // Mock disconnect
    },
    // Helper to check emitted events in tests
    _getEmittedEvents: () => emittedEvents,
    _getJoinedRooms: () => joinedRooms
  } as Partial<Socket> & {
    _getEmittedEvents: () => Array<{ event: string; data: unknown }>
    _getJoinedRooms: () => string[]
  }
}

// Mock Socket.io server
function createMockServer(): Partial<Server> {
  const broadcastEvents: Array<{ room: string; event: string; data: unknown }> = []

  return {
    to: (room: string) => ({
      emit: (event: string, data: unknown) => {
        broadcastEvents.push({ room, event, data })
      }
    } as any),
    _getBroadcastEvents: () => broadcastEvents
  } as any
}

describe('ConnectionHandler', () => {
  let roomManager: RoomManager
  let handler: ConnectionHandler
  let io: Partial<Server> & { _getBroadcastEvents: () => Array<{ room: string; event: string; data: unknown }> }

  beforeEach(() => {
    roomManager = new RoomManager()
    io = createMockServer() as any
    handler = new ConnectionHandler(roomManager, io as Server)
  })

  describe('handleJoin', () => {
    it('should create player and add to room', () => {
      const room = roomManager.createRoom()
      const socket = createMockSocket('socket-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      const updated = roomManager.getRoom(room.roomId)
      expect(updated?.players).toHaveLength(1)
      expect(updated?.players[0]?.nickname).toBe('Alice')
      expect(updated?.players[0]?.isConnected).toBe(true)
    })

    it('should emit join:success with player and state after successful join', () => {
      const room = roomManager.createRoom()
      const socket = createMockSocket('socket-1') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
        _getJoinedRooms: () => string[]
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      const events = socket._getEmittedEvents()
      const joinSuccessEvent = events.find(e => e.event === 'join:success')

      expect(joinSuccessEvent).toBeDefined()

      const data = joinSuccessEvent?.data as { type: string; player: { nickname: string; sessionToken: string }; state: { roomId: string; phase: string } }
      expect(data.type).toBe('join:success')
      expect(data.player.nickname).toBe('Alice')
      expect(data.player.sessionToken).toBeDefined()
      expect(data.state.roomId).toBe(room.roomId)
      expect(data.state.phase).toBe('lobby')
    })

    it('should make socket join room and broadcast room state', () => {
      const room = roomManager.createRoom()
      const socket = createMockSocket('socket-1') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
        _getJoinedRooms: () => string[]
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Check socket joined the room
      const joinedRooms = socket._getJoinedRooms()
      expect(joinedRooms).toContain(room.roomId)

      // Check broadcast to room
      const broadcasts = io._getBroadcastEvents()
      const roomStateBroadcast = broadcasts.find(b => b.room === room.roomId && b.event === 'room:state')

      expect(roomStateBroadcast).toBeDefined()
      const broadcastData = roomStateBroadcast?.data as { type: string; state: { roomId: string; phase: string } }
      expect(broadcastData.type).toBe('room:state')
      expect(broadcastData.state.roomId).toBe(room.roomId)
      expect(broadcastData.state.phase).toBe('lobby')
    })

    it('should emit error if room does not exist', () => {
      const socket = createMockSocket('socket-1') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: 'INVALID',
        nickname: 'Alice'
      })

      const events = socket._getEmittedEvents()
      const errorEvent = events.find(e => e.event === 'error')

      expect(errorEvent).toBeDefined()
      expect((errorEvent?.data as { code: string }).code).toBe('ROOM_NOT_FOUND')
    })

    it('should emit error if room is full', () => {
      const room = roomManager.createRoom()

      // Fill room to capacity
      for (let i = 0; i < 12; i++) {
        roomManager.addPlayer(room.roomId, {
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

      const socket = createMockSocket('socket-13') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Overflow'
      })

      const events = socket._getEmittedEvents()
      const errorEvent = events.find(e => e.event === 'error')

      expect(errorEvent).toBeDefined()
      expect((errorEvent?.data as { code: string }).code).toBe('ROOM_FULL')
    })

    it('should reject join if game is in progress (playing phase)', () => {
      // Create room and transition to playing phase
      const lobbyRoom = roomManager.createRoom()
      const playingRoom: import('@jkbox/shared').PlayingState = {
        phase: 'playing',
        roomId: lobbyRoom.roomId,
        players: [],
        gameId: 'fake-facts',
        roundNumber: 1,
        currentRound: null
      }
      roomManager.updateRoomState(lobbyRoom.roomId, playingRoom)

      const socket = createMockSocket('socket-1') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: lobbyRoom.roomId,
        nickname: 'Latecomer'
      })

      const events = socket._getEmittedEvents()
      const errorEvent = events.find(e => e.event === 'error')

      expect(errorEvent).toBeDefined()
      expect((errorEvent?.data as { code: string }).code).toBe('GAME_IN_PROGRESS')
      expect((errorEvent?.data as { message: string }).message).toContain('game is in progress')
    })

    it('should allow join if game is in results phase (between rounds)', () => {
      // Create room and transition to results phase
      const lobbyRoom = roomManager.createRoom()
      const resultsRoom: import('@jkbox/shared').ResultsState = {
        phase: 'results',
        roomId: lobbyRoom.roomId,
        players: [],
        roundResults: [],
        finalStandings: []
      }
      roomManager.updateRoomState(lobbyRoom.roomId, resultsRoom)

      const socket = createMockSocket('socket-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: lobbyRoom.roomId,
        nickname: 'NewPlayer'
      })

      const updated = roomManager.getRoom(lobbyRoom.roomId)
      expect(updated?.players).toHaveLength(1)
      expect(updated?.players[0]?.nickname).toBe('NewPlayer')
    })
  })

  describe('handleDisconnect', () => {
    it('should mark player as disconnected', () => {
      const room = roomManager.createRoom()
      const socket = createMockSocket('socket-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      handler.handleDisconnect(socket as Socket)

      const updated = roomManager.getRoom(room.roomId)
      const player = updated?.players[0]

      expect(player?.isConnected).toBe(false)
    })

    it('should update lastSeenAt timestamp', () => {
      const room = roomManager.createRoom()
      const socket = createMockSocket('socket-1')
      const beforeDisconnect = new Date()

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      handler.handleDisconnect(socket as Socket)

      const updated = roomManager.getRoom(room.roomId)
      const player = updated?.players[0]

      expect(player?.lastSeenAt.getTime()).toBeGreaterThanOrEqual(beforeDisconnect.getTime())
    })
  })
})
