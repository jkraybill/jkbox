import { describe, it, expect, beforeEach } from 'vitest'
import type { Socket } from 'socket.io'
import { RoomManager } from './room-manager'
import { ConnectionHandler } from './connection-handler'

// Mock Socket.io socket
function createMockSocket(id: string): Partial<Socket> {
  const emittedEvents: Array<{ event: string; data: unknown }> = []

  return {
    id,
    emit: (event: string, data: unknown) => {
      emittedEvents.push({ event, data })
    },
    disconnect: () => {
      // Mock disconnect
    },
    // Helper to check emitted events in tests
    _getEmittedEvents: () => emittedEvents
  } as Partial<Socket> & { _getEmittedEvents: () => Array<{ event: string; data: unknown }> }
}

describe('ConnectionHandler', () => {
  let roomManager: RoomManager
  let handler: ConnectionHandler

  beforeEach(() => {
    roomManager = new RoomManager()
    handler = new ConnectionHandler(roomManager)
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

    it('should emit room:update after successful join', () => {
      const room = roomManager.createRoom('host-1')
      const socket = createMockSocket('socket-1') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
      }

      handler.handleJoin(socket, {
        type: 'join',
        roomId: room.id,
        nickname: 'Alice'
      })

      const events = socket._getEmittedEvents()
      const roomUpdateEvent = events.find(e => e.event === 'room:update')

      expect(roomUpdateEvent).toBeDefined()
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
