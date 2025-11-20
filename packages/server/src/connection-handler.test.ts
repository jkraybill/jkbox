import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Socket, Server } from 'socket.io'
import { RoomManager } from './room-manager'
import { ConnectionHandler } from './connection-handler'

// Mock Socket.io socket
function createMockSocket(id: string, ipAddress: string = '192.168.1.100'): Partial<Socket> {
  const emittedEvents: Array<{ event: string; data: unknown }> = []
  const joinedRooms: string[] = []

  return {
    id,
    handshake: {
      address: ipAddress
    } as any,
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

  afterEach(() => {
    // Clean up heartbeat monitor
    handler.stopHeartbeatMonitor()
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
          deviceId: `192.168.1.${i}`,
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

    it('should remove all existing players from same device when new player joins', () => {
      const room = roomManager.createRoom()
      const deviceIp = '192.168.1.50'

      // First player joins from device
      const socket1 = createMockSocket('socket-1', deviceIp)
      handler.handleJoin(socket1 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Verify first player added
      let updated = roomManager.getRoom(room.roomId)
      expect(updated?.players).toHaveLength(1)
      expect(updated?.players[0]?.nickname).toBe('Alice')
      expect(updated?.players[0]?.deviceId).toBe(deviceIp)

      // Second player joins from SAME device (different socket, same IP)
      const socket2 = createMockSocket('socket-2', deviceIp)
      handler.handleJoin(socket2 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Bob'
      })

      // Verify Alice was removed, only Bob remains
      updated = roomManager.getRoom(room.roomId)
      expect(updated?.players).toHaveLength(1)
      expect(updated?.players[0]?.nickname).toBe('Bob')
      expect(updated?.players[0]?.deviceId).toBe(deviceIp)

      // Verify Alice is NOT in the player list
      const aliceExists = updated?.players.some(p => p.nickname === 'Alice')
      expect(aliceExists).toBe(false)
    })

    it('should allow multiple players from different devices', () => {
      const room = roomManager.createRoom()

      // Player 1 from device A
      const socket1 = createMockSocket('socket-1', '192.168.1.10')
      handler.handleJoin(socket1 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Player 2 from device B
      const socket2 = createMockSocket('socket-2', '192.168.1.20')
      handler.handleJoin(socket2 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Bob'
      })

      // Player 3 from device C
      const socket3 = createMockSocket('socket-3', '192.168.1.30')
      handler.handleJoin(socket3 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Charlie'
      })

      // All three players should be in the room
      const updated = roomManager.getRoom(room.roomId)
      expect(updated?.players).toHaveLength(3)
      expect(updated?.players.map(p => p.nickname)).toContain('Alice')
      expect(updated?.players.map(p => p.nickname)).toContain('Bob')
      expect(updated?.players.map(p => p.nickname)).toContain('Charlie')
    })
  })

  describe('handleWatch', () => {
    it('should send full room state snapshot to watcher', () => {
      const room = roomManager.createRoom()
      const socket = createMockSocket('socket-jumbotron') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
        _getJoinedRooms: () => string[]
      }

      handler.handleWatch(socket, {
        type: 'watch',
        roomId: room.roomId
      })

      // Check socket joined the room
      const joinedRooms = socket._getJoinedRooms()
      expect(joinedRooms).toContain(room.roomId)

      // Check initial room:state snapshot sent
      const events = socket._getEmittedEvents()
      const stateEvent = events.find(e => e.event === 'room:state')

      expect(stateEvent).toBeDefined()
      const data = stateEvent?.data as { type: string; state: { roomId: string; phase: string } }
      expect(data.type).toBe('room:state')
      expect(data.state.roomId).toBe(room.roomId)
      expect(data.state.phase).toBe('lobby')
    })

    it('should emit error if room does not exist', () => {
      const socket = createMockSocket('socket-jumbotron') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
      }

      handler.handleWatch(socket, {
        type: 'watch',
        roomId: 'INVALID'
      })

      const events = socket._getEmittedEvents()
      const errorEvent = events.find(e => e.event === 'error')

      expect(errorEvent).toBeDefined()
      expect((errorEvent?.data as { code: string }).code).toBe('ROOM_NOT_FOUND')
    })

    it('should send state snapshot with players after joins', () => {
      const room = roomManager.createRoom()

      // Add a player first
      const playerSocket = createMockSocket('player-1')
      handler.handleJoin(playerSocket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Now jumbotron watches
      const jumboSocket = createMockSocket('socket-jumbotron') as Socket & {
        _getEmittedEvents: () => Array<{ event: string; data: unknown }>
      }

      handler.handleWatch(jumboSocket, {
        type: 'watch',
        roomId: room.roomId
      })

      // Verify snapshot includes the player
      const events = jumboSocket._getEmittedEvents()
      const stateEvent = events.find(e => e.event === 'room:state')

      expect(stateEvent).toBeDefined()
      const data = stateEvent?.data as { state: { players: Array<{ nickname: string }> } }
      expect(data.state.players).toHaveLength(1)
      expect(data.state.players[0]?.nickname).toBe('Alice')
    })
  })

  describe('Heartbeat System', () => {
    it('should update lastSeenAt when receiving heartbeat ping', () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket = createMockSocket('player-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      const player = room.players.find(p => p.nickname === 'Alice')
      expect(player).toBeDefined()

      const beforePing = player!.lastSeenAt

      // Simulate 1 second passing
      vi.advanceTimersByTime(1000)

      // Send heartbeat ping
      handler.handleHeartbeat(socket as Socket)

      // Get updated player
      const updatedRoom = roomManager.getRoom(room.roomId)
      const updatedPlayer = updatedRoom?.players.find(p => p.nickname === 'Alice')

      expect(updatedPlayer?.lastSeenAt.getTime()).toBeGreaterThan(beforePing.getTime())

      vi.useRealTimers()
    })

    it('should mark player as disconnected after 5 seconds without heartbeat', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket = createMockSocket('player-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Start heartbeat monitor
      handler.startHeartbeatMonitor()

      // Advance 6 seconds (past 5s threshold)
      vi.advanceTimersByTime(6000)

      const updatedRoom = roomManager.getRoom(room.roomId)
      const player = updatedRoom?.players.find(p => p.nickname === 'Alice')

      expect(player?.isConnected).toBe(false)

      vi.useRealTimers()
    })

    it('should boot player after 60 seconds without heartbeat', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket = createMockSocket('player-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Start heartbeat monitor
      handler.startHeartbeatMonitor()

      // Advance 61 seconds (past 60s threshold)
      vi.advanceTimersByTime(61000)

      const updatedRoom = roomManager.getRoom(room.roomId)
      const player = updatedRoom?.players.find(p => p.nickname === 'Alice')

      expect(player).toBeUndefined() // Player removed from room

      vi.useRealTimers()
    })

    it('should preserve score when booted player rejoins with same name', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket1 = createMockSocket('player-1')

      handler.handleJoin(socket1 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Give player a score
      const player = room.players.find(p => p.nickname === 'Alice')
      roomManager.updatePlayer(room.roomId, player!.id, { score: 100 })

      // Start heartbeat monitor
      handler.startHeartbeatMonitor()

      // Advance 61 seconds (player gets booted)
      vi.advanceTimersByTime(61000)

      // Player rejoins with same name
      const socket2 = createMockSocket('player-2')
      handler.handleJoin(socket2 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      const updatedRoom = roomManager.getRoom(room.roomId)
      const rejoinedPlayer = updatedRoom?.players.find(p => p.nickname === 'Alice')

      expect(rejoinedPlayer?.score).toBe(100) // Score preserved

      vi.useRealTimers()
    })

    it('should not mark player disconnected if heartbeat received within 5s', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket = createMockSocket('player-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Start heartbeat monitor
      handler.startHeartbeatMonitor()

      // Send heartbeats every 2 seconds for 10 seconds
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(2000)
        handler.handleHeartbeat(socket as Socket)
      }

      const updatedRoom = roomManager.getRoom(room.roomId)
      const player = updatedRoom?.players.find(p => p.nickname === 'Alice')

      expect(player?.isConnected).toBe(true) // Still connected

      vi.useRealTimers()
    })

    it('should broadcast room state when player marked disconnected', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket = createMockSocket('player-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      // Clear previous broadcasts
      io._getBroadcastEvents().length = 0

      // Start heartbeat monitor
      handler.startHeartbeatMonitor()

      // Advance 6 seconds (past 5s threshold)
      vi.advanceTimersByTime(6000)

      const broadcasts = io._getBroadcastEvents()
      const stateUpdate = broadcasts.find(
        b => b.room === room.roomId && b.event === 'room:state'
      )

      expect(stateUpdate).toBeDefined()

      vi.useRealTimers()
    })
  })

  describe('Disconnect During Lobby/Countdown', () => {
    it('should remove player from lobby when they disconnect', () => {
      const room = roomManager.createRoom()
      const socket = createMockSocket('player-1')

      handler.handleJoin(socket as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      expect(room.players).toHaveLength(1)

      // Player disconnects
      handler.handleDisconnect(socket as Socket)

      const updatedRoom = roomManager.getRoom(room.roomId)
      const player = updatedRoom?.players.find(p => p.nickname === 'Alice')

      // Player marked as disconnected (not removed - heartbeat system removes after 60s)
      expect(player?.isConnected).toBe(false)
    })

    it('should cancel countdown if player disconnects during countdown', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket1 = createMockSocket('player-1', '192.168.1.10')
      const socket2 = createMockSocket('player-2', '192.168.1.20')

      // Two players join and vote
      handler.handleJoin(socket1 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      handler.handleJoin(socket2 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Bob'
      })

      // Vote for game
      handler.handleLobbyVote(socket1 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyVote(socket2 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      // Mark ready (should trigger countdown)
      handler.handleLobbyReadyToggle(socket1 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      handler.handleLobbyReadyToggle(socket2 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      // Advance 2 seconds into countdown
      vi.advanceTimersByTime(2000)

      // Player disconnects during countdown
      handler.handleDisconnect(socket1 as Socket)

      // Room should return to lobby phase
      const updatedRoom = roomManager.getRoom(room.roomId)
      expect(updatedRoom?.phase).toBe('lobby')

      vi.useRealTimers()
    })

    it('should broadcast countdown cancellation message when player disconnects', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket1 = createMockSocket('player-1', '192.168.1.10')
      const socket2 = createMockSocket('player-2', '192.168.1.20')

      handler.handleJoin(socket1 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      handler.handleJoin(socket2 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Bob'
      })

      // Vote and ready
      handler.handleLobbyVote(socket1 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyVote(socket2 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyReadyToggle(socket1 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      handler.handleLobbyReadyToggle(socket2 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      // Clear previous broadcasts
      io._getBroadcastEvents().length = 0

      // Advance into countdown
      vi.advanceTimersByTime(1000)

      // Player disconnects
      handler.handleDisconnect(socket1 as Socket)

      // Check for countdown:cancelled message
      const broadcasts = io._getBroadcastEvents()
      const cancelMessage = broadcasts.find(
        b => b.room === room.roomId && b.event === 'lobby:countdown-cancelled'
      )

      expect(cancelMessage).toBeDefined()

      vi.useRealTimers()
    })
  })

  describe('Game Start Transition', () => {
    it('should transition to playing phase after countdown completes', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket1 = createMockSocket('player-1')
      const socket2 = createMockSocket('player-2')

      // Setup: Two players vote and ready
      handler.handleJoin(socket1 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      handler.handleJoin(socket2 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Bob'
      })

      handler.handleLobbyVote(socket1 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyVote(socket2 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyReadyToggle(socket1 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      handler.handleLobbyReadyToggle(socket2 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      // Advance past countdown (5 seconds)
      await vi.advanceTimersByTimeAsync(6000)

      // Room should transition to playing phase
      const updatedRoom = roomManager.getRoom(room.roomId)
      expect(updatedRoom?.phase).toBe('playing')
      if (updatedRoom?.phase === 'playing') {
        expect(updatedRoom.gameId).toBe('fake-facts')
      }

      vi.useRealTimers()
    })

    it('should emit game:start message after countdown', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket1 = createMockSocket('player-1')
      const socket2 = createMockSocket('player-2')

      handler.handleJoin(socket1 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      handler.handleJoin(socket2 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Bob'
      })

      handler.handleLobbyVote(socket1 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyVote(socket2 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyReadyToggle(socket1 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      handler.handleLobbyReadyToggle(socket2 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      // Clear previous broadcasts
      io._getBroadcastEvents().length = 0

      // Advance past countdown
      await vi.advanceTimersByTimeAsync(6000)

      // Check for game:start message
      const broadcasts = io._getBroadcastEvents()
      const gameStartMessage = broadcasts.find(
        b => b.room === room.roomId && b.event === 'game:start'
      )

      expect(gameStartMessage).toBeDefined()

      vi.useRealTimers()
    })

    it('should preserve players list during lobby→playing transition', async () => {
      vi.useFakeTimers()

      const room = roomManager.createRoom()
      const socket1 = createMockSocket('player-1', '192.168.1.10')
      const socket2 = createMockSocket('player-2', '192.168.1.20')

      handler.handleJoin(socket1 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Alice'
      })

      handler.handleJoin(socket2 as Socket, {
        type: 'join',
        roomId: room.roomId,
        nickname: 'Bob'
      })

      handler.handleLobbyVote(socket1 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyVote(socket2 as Socket, {
        type: 'lobby:vote-game',
        gameId: 'fake-facts'
      })

      handler.handleLobbyReadyToggle(socket1 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      handler.handleLobbyReadyToggle(socket2 as Socket, {
        type: 'lobby:ready-toggle',
        isReady: true
      })

      // Advance past countdown
      await vi.advanceTimersByTimeAsync(6000)

      // Players should be preserved
      const updatedRoom = roomManager.getRoom(room.roomId)
      expect(updatedRoom?.players).toHaveLength(2)
      expect(updatedRoom?.players.find(p => p.nickname === 'Alice')).toBeDefined()
      expect(updatedRoom?.players.find(p => p.nickname === 'Bob')).toBeDefined()

      vi.useRealTimers()
    })
  })
})
