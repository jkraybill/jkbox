import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Socket, Server } from 'socket.io'
import type { PlayingState } from '@jkbox/shared'
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
		to: (room: string) =>
			({
				emit: (event: string, data: unknown) => {
					broadcastEvents.push({ room, event, data })
				}
			}) as any,
		_getBroadcastEvents: () => broadcastEvents
	} as any
}

describe('ConnectionHandler', () => {
	let roomManager: RoomManager
	let handler: ConnectionHandler
	let io: Partial<Server> & {
		_getBroadcastEvents: () => Array<{ room: string; event: string; data: unknown }>
	}

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
			const joinSuccessEvent = events.find((e) => e.event === 'join:success')

			expect(joinSuccessEvent).toBeDefined()

			const data = joinSuccessEvent?.data as {
				type: string
				player: { nickname: string; sessionToken: string }
				state: { roomId: string; phase: string }
			}
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
			const roomStateBroadcast = broadcasts.find(
				(b) => b.room === room.roomId && b.event === 'room:state'
			)

			expect(roomStateBroadcast).toBeDefined()
			const broadcastData = roomStateBroadcast?.data as {
				type: string
				state: { roomId: string; phase: string }
			}
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
			const errorEvent = events.find((e) => e.event === 'error')

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
			const errorEvent = events.find((e) => e.event === 'error')

			expect(errorEvent).toBeDefined()
			expect((errorEvent?.data as { code: string }).code).toBe('ROOM_FULL')
		})

		it('should allow mid-game join when game is in playing phase', () => {
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

			// Should allow join (mid-game join feature)
			const events = socket._getEmittedEvents()
			const successEvent = events.find((e) => e.event === 'join:success')
			expect(successEvent).toBeDefined()

			// Player should be added to room
			const updated = roomManager.getRoom(lobbyRoom.roomId)
			expect(updated?.players.find((p) => p.nickname === 'Latecomer')).toBeDefined()
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
			const deviceUuid = 'device-uuid-123'

			// First player joins from device (sends deviceId from localStorage)
			const socket1 = createMockSocket('socket-1', '192.168.1.50')
			handler.handleJoin(socket1 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice',
				deviceId: deviceUuid
			})

			// Verify first player added
			let updated = roomManager.getRoom(room.roomId)
			expect(updated?.players).toHaveLength(1)
			expect(updated?.players[0]?.nickname).toBe('Alice')
			expect(updated?.players[0]?.deviceId).toBe(deviceUuid)

			// Second player joins from SAME device (different socket, same deviceId)
			const socket2 = createMockSocket('socket-2', '192.168.1.50')
			handler.handleJoin(socket2 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob',
				deviceId: deviceUuid
			})

			// Verify Alice was removed, only Bob remains
			updated = roomManager.getRoom(room.roomId)
			expect(updated?.players).toHaveLength(1)
			expect(updated?.players[0]?.nickname).toBe('Bob')
			expect(updated?.players[0]?.deviceId).toBe(deviceUuid)

			// Verify Alice is NOT in the player list
			const aliceExists = updated?.players.some((p) => p.nickname === 'Alice')
			expect(aliceExists).toBe(false)
		})

		it('should allow multiple players from different devices', () => {
			const room = roomManager.createRoom()

			// Player 1 from device A
			const socket1 = createMockSocket('socket-1', '192.168.1.10')
			handler.handleJoin(socket1 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice',
				deviceId: 'device-uuid-aaa'
			})

			// Player 2 from device B
			const socket2 = createMockSocket('socket-2', '192.168.1.20')
			handler.handleJoin(socket2 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob',
				deviceId: 'device-uuid-bbb'
			})

			// Player 3 from device C
			const socket3 = createMockSocket('socket-3', '192.168.1.30')
			handler.handleJoin(socket3 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Charlie',
				deviceId: 'device-uuid-ccc'
			})

			// All three players should be in the room
			const updated = roomManager.getRoom(room.roomId)
			expect(updated?.players).toHaveLength(3)
			expect(updated?.players.map((p) => p.nickname)).toContain('Alice')
			expect(updated?.players.map((p) => p.nickname)).toContain('Bob')
			expect(updated?.players.map((p) => p.nickname)).toContain('Charlie')
		})

		it('should fallback to IP address when deviceId not provided', () => {
			const room = roomManager.createRoom()
			const deviceIp = '192.168.1.99'

			// First player joins without deviceId (old client)
			const socket1 = createMockSocket('socket-1', deviceIp)
			handler.handleJoin(socket1 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice'
				// No deviceId provided
			})

			// Verify player added with IP as deviceId
			let updated = roomManager.getRoom(room.roomId)
			expect(updated?.players).toHaveLength(1)
			expect(updated?.players[0]?.nickname).toBe('Alice')
			expect(updated?.players[0]?.deviceId).toBe(deviceIp)

			// Second connection from same IP (no deviceId)
			const socket2 = createMockSocket('socket-2', deviceIp)
			handler.handleJoin(socket2 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob'
				// No deviceId provided
			})

			// Alice should be removed (same IP)
			updated = roomManager.getRoom(room.roomId)
			expect(updated?.players).toHaveLength(1)
			expect(updated?.players[0]?.nickname).toBe('Bob')
			expect(updated?.players[0]?.deviceId).toBe(deviceIp)
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
			const stateEvent = events.find((e) => e.event === 'room:state')

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
			const errorEvent = events.find((e) => e.event === 'error')

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
			const stateEvent = events.find((e) => e.event === 'room:state')

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

			const player = room.players.find((p) => p.nickname === 'Alice')
			expect(player).toBeDefined()

			const beforePing = player!.lastSeenAt

			// Simulate 1 second passing
			vi.advanceTimersByTime(1000)

			// Send heartbeat ping
			handler.handleHeartbeat(socket as Socket)

			// Get updated player
			const updatedRoom = roomManager.getRoom(room.roomId)
			const updatedPlayer = updatedRoom?.players.find((p) => p.nickname === 'Alice')

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
			const player = updatedRoom?.players.find((p) => p.nickname === 'Alice')

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
			const player = updatedRoom?.players.find((p) => p.nickname === 'Alice')

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
			const player = room.players.find((p) => p.nickname === 'Alice')
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
			const rejoinedPlayer = updatedRoom?.players.find((p) => p.nickname === 'Alice')

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
			const player = updatedRoom?.players.find((p) => p.nickname === 'Alice')

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
			const stateUpdate = broadcasts.find((b) => b.room === room.roomId && b.event === 'room:state')

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
			const player = updatedRoom?.players.find((p) => p.nickname === 'Alice')

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
				(b) => b.room === room.roomId && b.event === 'lobby:countdown-cancelled'
			)

			expect(cancelMessage).toBeDefined()

			vi.useRealTimers()
		})
	})

	describe('Game Start Transition', () => {
		it('should transition to playing phase after countdown completes', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('player-1', '192.168.1.10')
			const socket2 = createMockSocket('player-2', '192.168.1.20')

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

			// Clear previous broadcasts
			io._getBroadcastEvents().length = 0

			// Advance past countdown
			await vi.advanceTimersByTimeAsync(6000)

			// Check for game:start message
			const broadcasts = io._getBroadcastEvents()
			const gameStartMessage = broadcasts.find(
				(b) => b.room === room.roomId && b.event === 'game:start'
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
			expect(updatedRoom?.players.find((p) => p.nickname === 'Alice')).toBeDefined()
			expect(updatedRoom?.players.find((p) => p.nickname === 'Bob')).toBeDefined()

			vi.useRealTimers()
		})
	})

	describe('Admin Functionality', () => {
		it('should grant admin access when player joins with ~ suffix', () => {
			const room = roomManager.createRoom()
			const socket = createMockSocket('admin-player')

			handler.handleJoin(socket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'AdminUser~'
			})

			const updated = roomManager.getRoom(room.roomId)
			const player = updated?.players[0]

			expect(player?.isAdmin).toBe(true)
			expect(player?.nickname).toBe('AdminUser') // ~ should be stripped
		})

		it('should not grant admin access when player joins without ~ suffix', () => {
			const room = roomManager.createRoom()
			const socket = createMockSocket('regular-player')

			handler.handleJoin(socket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'RegularUser'
			})

			const updated = roomManager.getRoom(room.roomId)
			const player = updated?.players[0]

			expect(player?.isAdmin).toBe(false)
			expect(player?.nickname).toBe('RegularUser')
		})

		it('should allow admin to boot another player', () => {
			const room = roomManager.createRoom()
			const adminSocket = createMockSocket('admin-socket')
			const playerSocket = createMockSocket('player-socket', '192.168.1.20')

			// Admin joins
			handler.handleJoin(adminSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Admin~'
			})

			// Regular player joins
			handler.handleJoin(playerSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob'
			})

			const beforeBoot = roomManager.getRoom(room.roomId)
			expect(beforeBoot?.players).toHaveLength(2)

			const targetPlayer = beforeBoot?.players.find((p) => p.nickname === 'Bob')
			expect(targetPlayer).toBeDefined()

			// Admin boots Bob
			handler.handleBootPlayer(adminSocket as Socket, {
				type: 'admin:boot-player',
				playerId: targetPlayer!.id
			})

			const afterBoot = roomManager.getRoom(room.roomId)
			expect(afterBoot?.players).toHaveLength(1)
			expect(afterBoot?.players.find((p) => p.nickname === 'Bob')).toBeUndefined()
			expect(afterBoot?.players.find((p) => p.nickname === 'Admin')).toBeDefined()
		})

		it('should prevent non-admin from booting players', () => {
			const room = roomManager.createRoom()
			const player1Socket = createMockSocket('player1-socket', '192.168.1.10')
			const player2Socket = createMockSocket('player2-socket', '192.168.1.20')

			// Two regular players join
			handler.handleJoin(player1Socket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice'
			})

			handler.handleJoin(player2Socket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob'
			})

			const beforeBoot = roomManager.getRoom(room.roomId)
			const targetPlayer = beforeBoot?.players.find((p) => p.nickname === 'Bob')

			// Alice tries to boot Bob (should fail - not admin)
			handler.handleBootPlayer(player1Socket as Socket, {
				type: 'admin:boot-player',
				playerId: targetPlayer!.id
			})

			// Bob should still be in the room
			const afterBoot = roomManager.getRoom(room.roomId)
			expect(afterBoot?.players).toHaveLength(2)
			expect(afterBoot?.players.find((p) => p.nickname === 'Bob')).toBeDefined()

			// Check error was emitted
			const events = (player1Socket as any)._getEmittedEvents()
			const errorEvent = events.find((e: any) => e.event === 'error')
			expect(errorEvent).toBeDefined()
			expect((errorEvent as any).data.code).toBe('UNAUTHORIZED')
		})

		it('should prevent admin from booting themselves', () => {
			const room = roomManager.createRoom()
			const adminSocket = createMockSocket('admin-socket')

			handler.handleJoin(adminSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Admin~'
			})

			const beforeBoot = roomManager.getRoom(room.roomId)
			const adminPlayer = beforeBoot?.players[0]

			// Admin tries to boot themselves (should fail)
			handler.handleBootPlayer(adminSocket as Socket, {
				type: 'admin:boot-player',
				playerId: adminPlayer!.id
			})

			// Admin should still be in the room
			const afterBoot = roomManager.getRoom(room.roomId)
			expect(afterBoot?.players).toHaveLength(1)

			// Check error was emitted
			const events = (adminSocket as any)._getEmittedEvents()
			const errorEvent = events.find((e: any) => e.event === 'error')
			expect(errorEvent).toBeDefined()
			expect((errorEvent as any).data.code).toBe('CANNOT_BOOT_SELF')
		})

		it('should broadcast room state after player is booted', () => {
			const room = roomManager.createRoom()
			const adminSocket = createMockSocket('admin-socket')
			const playerSocket = createMockSocket('player-socket', '192.168.1.20')

			handler.handleJoin(adminSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Admin~'
			})

			handler.handleJoin(playerSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob'
			})

			const targetPlayer = roomManager
				.getRoom(room.roomId)
				?.players.find((p) => p.nickname === 'Bob')

			// Clear previous broadcasts
			io._getBroadcastEvents().length = 0

			// Admin boots Bob
			handler.handleBootPlayer(adminSocket as Socket, {
				type: 'admin:boot-player',
				playerId: targetPlayer!.id
			})

			// Check room state was broadcast
			const broadcasts = io._getBroadcastEvents()
			const stateMessage = broadcasts.find(
				(b) => b.room === room.roomId && b.event === 'room:state'
			)

			expect(stateMessage).toBeDefined()
			expect((stateMessage as any).data.state.players).toHaveLength(1)
		})

		it('should allow admin to force room back to lobby', () => {
			const room = roomManager.createRoom()
			const adminSocket = createMockSocket('admin-socket')
			const playerSocket = createMockSocket('player-socket', '192.168.1.20')

			// Admin joins
			handler.handleJoin(adminSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Admin~'
			})

			// Regular player joins
			handler.handleJoin(playerSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob'
			})

			// Transition to playing phase to simulate in-progress game
			const beforeReset = roomManager.getRoom(room.roomId)!
			const playingRoom: PlayingState = {
				phase: 'playing',
				roomId: room.roomId,
				players: beforeReset.players,
				gameId: 'fake-facts'
			}
			roomManager.updateRoomState(room.roomId, playingRoom)

			const checkPlaying = roomManager.getRoom(room.roomId)
			expect(checkPlaying?.phase).toBe('playing')

			// Admin forces back to lobby
			handler.handleBackToLobby(adminSocket as Socket, {
				type: 'admin:back-to-lobby'
			})

			const afterReset = roomManager.getRoom(room.roomId)
			expect(afterReset?.phase).toBe('lobby')
			expect(afterReset?.players).toHaveLength(2) // Players should remain
		})

		it('should prevent non-admin from forcing back to lobby', () => {
			const room = roomManager.createRoom()
			const playerSocket = createMockSocket('player-socket')

			handler.handleJoin(playerSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob'
			})

			// Transition to playing
			const currentRoom = roomManager.getRoom(room.roomId)!
			const playingRoom: PlayingState = {
				phase: 'playing',
				roomId: room.roomId,
				players: currentRoom.players,
				gameId: 'fake-facts'
			}
			roomManager.updateRoomState(room.roomId, playingRoom)

			// Bob tries to force back to lobby (should fail)
			handler.handleBackToLobby(playerSocket as Socket, {
				type: 'admin:back-to-lobby'
			})

			// Should still be in playing phase
			const room2 = roomManager.getRoom(room.roomId)
			expect(room2?.phase).toBe('playing')

			// Check error was emitted
			const events = (playerSocket as any)._getEmittedEvents()
			const errorEvent = events.find((e: any) => e.event === 'error')
			expect(errorEvent).toBeDefined()
			expect((errorEvent as any).data.code).toBe('UNAUTHORIZED')
		})

		it('should allow admin to hard reset room', () => {
			const room = roomManager.createRoom()
			const adminSocket = createMockSocket('admin-socket')
			const player1Socket = createMockSocket('player1-socket', '192.168.1.20')
			const player2Socket = createMockSocket('player2-socket', '192.168.1.30')

			// Admin joins
			handler.handleJoin(adminSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Admin~'
			})

			// Two players join
			handler.handleJoin(player1Socket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice'
			})

			handler.handleJoin(player2Socket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob'
			})

			const beforeReset = roomManager.getRoom(room.roomId)
			expect(beforeReset?.players).toHaveLength(3)

			// Admin performs hard reset
			handler.handleHardReset(adminSocket as Socket, {
				type: 'admin:hard-reset'
			})

			// Room should be reset to title phase (same roomId preserved)
			const afterReset = roomManager.getRoom(room.roomId)
			expect(afterReset?.phase).toBe('title')
			expect(afterReset?.players).toHaveLength(0)
			expect(afterReset?.roomId).toBe(room.roomId) // Same roomId preserved
		})

		it('should prevent non-admin from hard reset', () => {
			const room = roomManager.createRoom()
			const playerSocket = createMockSocket('player-socket')

			handler.handleJoin(playerSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Bob'
			})

			// Bob tries hard reset (should fail)
			handler.handleHardReset(playerSocket as Socket, {
				type: 'admin:hard-reset'
			})

			// Player should still be in room
			const room2 = roomManager.getRoom(room.roomId)
			expect(room2?.players).toHaveLength(1)

			// Check error was emitted
			const events = (playerSocket as any)._getEmittedEvents()
			const errorEvent = events.find((e: any) => e.event === 'error')
			expect(errorEvent).toBeDefined()
			expect((errorEvent as any).data.code).toBe('UNAUTHORIZED')
		})

		it('should broadcast room state after back to lobby', () => {
			const room = roomManager.createRoom()
			const adminSocket = createMockSocket('admin-socket')

			handler.handleJoin(adminSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Admin~'
			})

			// Transition to playing
			const currentRoom = roomManager.getRoom(room.roomId)!
			const playingRoom: PlayingState = {
				phase: 'playing',
				roomId: room.roomId,
				players: currentRoom.players,
				gameId: 'fake-facts'
			}
			roomManager.updateRoomState(room.roomId, playingRoom)

			// Clear previous broadcasts
			io._getBroadcastEvents().length = 0

			// Admin forces back to lobby
			handler.handleBackToLobby(adminSocket as Socket, {
				type: 'admin:back-to-lobby'
			})

			// Check room state was broadcast
			const broadcasts = io._getBroadcastEvents()
			const stateMessage = broadcasts.find(
				(b) => b.room === room.roomId && b.event === 'room:state'
			)

			expect(stateMessage).toBeDefined()
			expect((stateMessage as any).data.state.phase).toBe('lobby')
		})

		it('should broadcast room state after hard reset', () => {
			const room = roomManager.createRoom()
			const adminSocket = createMockSocket('admin-socket')

			handler.handleJoin(adminSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Admin~'
			})

			// Clear previous broadcasts
			io._getBroadcastEvents().length = 0

			// Admin performs hard reset
			handler.handleHardReset(adminSocket as Socket, {
				type: 'admin:hard-reset'
			})

			// Check room state was broadcast with title phase
			const broadcasts = io._getBroadcastEvents()
			const stateMessage = broadcasts.find(
				(b) => b.room === room.roomId && b.event === 'room:state'
			)

			expect(stateMessage).toBeDefined()
			expect((stateMessage as any).data.state.phase).toBe('title')
			expect((stateMessage as any).data.state.players).toHaveLength(0)
		})
	})

	describe('Session Restore and VotingHandler Sync', () => {
		it('should add restored player to VotingHandler', () => {
			const room = roomManager.createRoom()
			const socket1 = createMockSocket('socket-1')

			// Player joins initially
			handler.handleJoin(socket1 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice'
			})

			const player = roomManager.getRoom(room.roomId)?.players[0]
			expect(player).toBeDefined()

			// Player disconnects
			handler.handleDisconnect(socket1 as Socket)

			// New socket attempts to restore session
			const socket2 = createMockSocket('socket-2')
			handler.handleRestoreSession(socket2 as Socket, {
				type: 'restore-session',
				roomId: room.roomId,
				playerId: player!.id,
				sessionToken: player!.sessionToken
			})

			// Player should be marked as connected again
			const updatedRoom = roomManager.getRoom(room.roomId)
			const restoredPlayer = updatedRoom?.players.find((p) => p.id === player!.id)
			expect(restoredPlayer?.isConnected).toBe(true)

			// Voting handler should have player - verify by testing voting works
			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			// Check voting update was broadcast (player is in voting handler)
			const broadcasts = io._getBroadcastEvents()
			const votingUpdate = broadcasts.find(
				(b) => b.room === room.roomId && b.event === 'lobby:voting-update'
			)
			expect(votingUpdate).toBeDefined()
		})

		it('should allow restored player to vote and go ready', () => {
			const room = roomManager.createRoom()
			const socket1 = createMockSocket('socket-1')

			handler.handleJoin(socket1 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice'
			})

			const player = roomManager.getRoom(room.roomId)?.players[0]

			// Disconnect and restore
			handler.handleDisconnect(socket1 as Socket)
			const socket2 = createMockSocket('socket-2')
			handler.handleRestoreSession(socket2 as Socket, {
				type: 'restore-session',
				roomId: room.roomId,
				playerId: player!.id,
				sessionToken: player!.sessionToken
			})

			// Should be able to vote
			expect(() => {
				handler.handleLobbyVote(socket2 as Socket, {
					type: 'lobby:vote-game',
					gameId: 'cinema-pippin'
				})
			}).not.toThrow()

			// Should be able to toggle ready
			expect(() => {
				handler.handleLobbyReadyToggle(socket2 as Socket, {
					type: 'lobby:ready-toggle',
					isReady: true
				})
			}).not.toThrow()
		})
	})

	describe('Human Player Ready Flow (Auto-Start)', () => {
		it('should trigger countdown when two human players are both ready', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('socket-1', '192.168.1.10')
			const socket2 = createMockSocket('socket-2', '192.168.1.20')

			// Two players join
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

			// Both vote for same game
			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'fake-facts'
			})

			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'fake-facts'
			})

			// First player ready
			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Should still be in lobby (only 1/2 ready)
			let currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('lobby')

			// Second player ready
			handler.handleLobbyReadyToggle(socket2 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Should now be in countdown phase (non-cinema-pippin game)
			currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('countdown')

			vi.useRealTimers()
		})

		it('should skip countdown and go straight to playing for Cinema Pippin', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('socket-1', '192.168.1.10')
			const socket2 = createMockSocket('socket-2', '192.168.1.20')

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

			// Both vote for Cinema Pippin
			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			handler.handleLobbyReadyToggle(socket2 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Cinema Pippin should skip countdown and go straight to playing
			await vi.advanceTimersByTimeAsync(100)

			const currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('playing')
			if (currentRoom?.phase === 'playing') {
				expect(currentRoom.gameId).toBe('cinema-pippin')
			}

			vi.useRealTimers()
		})

		it('should emit game:start for Cinema Pippin', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('socket-1', '192.168.1.10')
			const socket2 = createMockSocket('socket-2', '192.168.1.20')

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
				gameId: 'cinema-pippin'
			})

			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			// Clear broadcasts before ready toggle
			io._getBroadcastEvents().length = 0

			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			handler.handleLobbyReadyToggle(socket2 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			await vi.advanceTimersByTimeAsync(100)

			// Check for game:start message
			const broadcasts = io._getBroadcastEvents()
			const gameStartMessage = broadcasts.find(
				(b) => b.room === room.roomId && b.event === 'game:start'
			)

			expect(gameStartMessage).toBeDefined()
			expect((gameStartMessage as any).data.gameId).toBe('cinema-pippin')

			vi.useRealTimers()
		})

		it('should not start game if only one player is ready', () => {
			const room = roomManager.createRoom()
			const socket1 = createMockSocket('socket-1', '192.168.1.10')
			const socket2 = createMockSocket('socket-2', '192.168.1.20')

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

			// Both vote
			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			// Only first player ready
			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Should still be in lobby
			const currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('lobby')
		})

		it('should not start game if votes are tied (no selected game)', () => {
			const room = roomManager.createRoom()
			const socket1 = createMockSocket('socket-1', '192.168.1.10')
			const socket2 = createMockSocket('socket-2', '192.168.1.20')

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

			// Vote for different games (tie)
			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'fake-facts'
			})

			// Both ready
			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			handler.handleLobbyReadyToggle(socket2 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Should still be in lobby (no winning game)
			const currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('lobby')
		})
	})

	describe('Reconnect Flow', () => {
		it('should handle reconnect and re-add player to voting handler', () => {
			const room = roomManager.createRoom()
			const socket1 = createMockSocket('socket-1')

			// Player joins
			handler.handleJoin(socket1 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice'
			})

			// Simulate Socket.io recovery - handleReconnect is called
			handler.handleReconnect(socket1 as Socket)

			// Player should still be connected
			const currentRoom = roomManager.getRoom(room.roomId)
			const player = currentRoom?.players[0]
			expect(player?.isConnected).toBe(true)

			// Should be able to vote (in voting handler)
			expect(() => {
				handler.handleLobbyVote(socket1 as Socket, {
					type: 'lobby:vote-game',
					gameId: 'cinema-pippin'
				})
			}).not.toThrow()
		})
	})

	describe('Nickname Validation', () => {
		it('should reject nicknames ending in "bot" (case insensitive)', () => {
			const room = roomManager.createRoom()
			const socket = createMockSocket('socket-1') as Socket & {
				_getEmittedEvents: () => Array<{ event: string; data: unknown }>
			}

			handler.handleJoin(socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'CoolBot'
			})

			const events = socket._getEmittedEvents()
			const errorEvent = events.find((e) => e.event === 'error')

			expect(errorEvent).toBeDefined()
			expect((errorEvent?.data as { code: string }).code).toBe('INVALID_NICKNAME')
		})

		it('should reject nicknames ending in "BOT" (uppercase)', () => {
			const room = roomManager.createRoom()
			const socket = createMockSocket('socket-1') as Socket & {
				_getEmittedEvents: () => Array<{ event: string; data: unknown }>
			}

			handler.handleJoin(socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'MegaBOT'
			})

			const events = socket._getEmittedEvents()
			const errorEvent = events.find((e) => e.event === 'error')

			expect(errorEvent).toBeDefined()
			expect((errorEvent?.data as { code: string }).code).toBe('INVALID_NICKNAME')
		})

		it('should allow nicknames containing "bot" but not ending with it', () => {
			const room = roomManager.createRoom()
			const socket = createMockSocket('socket-1')

			handler.handleJoin(socket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Botticelli'
			})

			const updated = roomManager.getRoom(room.roomId)
			expect(updated?.players).toHaveLength(1)
			expect(updated?.players[0]?.nickname).toBe('Botticelli')
		})
	})
})
