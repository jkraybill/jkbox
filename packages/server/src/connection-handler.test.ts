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
      const room = roomManager.createRoom('host-1')
      const socket = createMockSocket('socket-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.id,
        nickname: 'Alice'
      })

      const updated = roomManager.getRoom(room.id)
      expect(updated?.players).toHaveLength(1)
      expect(updated?.players[0]?.nickname).toBe('Alice')
      expect(updated?.players[0]?.isConnected).toBe(true)
    })

    it('should emit join:success with player and room after successful join', () => {
      const room = roomManager.createRoom('host-1')
      const socket = createMockSocket('socket-1') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
        _getJoinedRooms: () => string[]
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: room.id,
        nickname: 'Alice'
      })

      const events = socket._getEmittedEvents()
      const joinSuccessEvent = events.find(e => e.event === 'join:success')

      expect(joinSuccessEvent).toBeDefined()

      const data = joinSuccessEvent?.data as { type: string; player: { nickname: string; sessionToken: string }; room: { id: string } }
      expect(data.type).toBe('join:success')
      expect(data.player.nickname).toBe('Alice')
      expect(data.player.sessionToken).toBeDefined()
      expect(data.room.id).toBe(room.id)
    })

    it('should make socket join room and broadcast room update', () => {
      const room = roomManager.createRoom('host-1')
      const socket = createMockSocket('socket-1') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
        _getJoinedRooms: () => string[]
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: room.id,
        nickname: 'Alice'
      })

      // Check socket joined the room
      const joinedRooms = socket._getJoinedRooms()
      expect(joinedRooms).toContain(room.id)

      // Check broadcast to room
      const broadcasts = io._getBroadcastEvents()
      const roomUpdateBroadcast = broadcasts.find(b => b.room === room.id && b.event === 'room:update')

      expect(roomUpdateBroadcast).toBeDefined()
      const broadcastData = roomUpdateBroadcast?.data as { type: string; room: { id: string } }
      expect(broadcastData.type).toBe('room:update')
      expect(broadcastData.room.id).toBe(room.id)
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
      const room = roomManager.createRoom('host-1')

      // Fill room to capacity
      for (let i = 0; i < 12; i++) {
        roomManager.addPlayer(room.id, {
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

      const socket = createMockSocket('socket-13') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: room.id,
        nickname: 'Overflow'
      })

      const events = socket._getEmittedEvents()
      const errorEvent = events.find(e => e.event === 'error')

      expect(errorEvent).toBeDefined()
      expect((errorEvent?.data as { code: string }).code).toBe('ROOM_FULL')
    })
  })

  describe('handleDisconnect', () => {
    it('should mark player as disconnected', () => {
      const room = roomManager.createRoom('host-1')
      const socket = createMockSocket('socket-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.id,
        nickname: 'Alice'
      })

      handler.handleDisconnect(socket as Socket)

      const updated = roomManager.getRoom(room.id)
      const player = updated?.players[0]

      expect(player?.isConnected).toBe(false)
    })

    it('should update lastSeenAt timestamp', () => {
      const room = roomManager.createRoom('host-1')
      const socket = createMockSocket('socket-1')
      const beforeDisconnect = new Date()

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.id,
        nickname: 'Alice'
      })

      handler.handleDisconnect(socket as Socket)

      const updated = roomManager.getRoom(room.id)
      const player = updated?.players[0]

      expect(player?.lastSeenAt.getTime()).toBeGreaterThanOrEqual(beforeDisconnect.getTime())
    })
  })
})
