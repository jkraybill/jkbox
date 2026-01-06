/**
 * Lobby Integration Tests
 *
 * These tests simulate the full user journey from joining a room
 * through to game start. They're designed to catch issues like:
 * - "Loading" freeze states
 * - "Not advancing after ready" bugs
 * - Session restore failures
 * - VotingHandler desync
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Socket, Server } from 'socket.io'
import { RoomManager } from './room-manager'
import { ConnectionHandler } from './connection-handler'

// Reuse mock helpers
function createMockSocket(
	id: string,
	ipAddress: string = '192.168.1.100'
): Partial<Socket> & {
	_getEmittedEvents: () => Array<{ event: string; data: unknown }>
	_getJoinedRooms: () => string[]
} {
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
		disconnect: () => {},
		_getEmittedEvents: () => emittedEvents,
		_getJoinedRooms: () => joinedRooms
	} as any
}

function createMockServer(): Partial<Server> & {
	_getBroadcastEvents: () => Array<{ room: string; event: string; data: unknown }>
} {
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

describe('Lobby → Game Integration Tests', () => {
	let roomManager: RoomManager
	let handler: ConnectionHandler
	let io: ReturnType<typeof createMockServer>

	beforeEach(() => {
		roomManager = new RoomManager()
		io = createMockServer()
		handler = new ConnectionHandler(roomManager, io as Server)
	})

	afterEach(() => {
		handler.stopHeartbeatMonitor()
	})

	describe('Two Human Players - Cinema Pippin', () => {
		it('should successfully start game when both players vote and ready', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')
			const socket2 = createMockSocket('bob-socket', '192.168.1.20')

			// Step 1: Both players join
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

			// Verify both joined
			let currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.players).toHaveLength(2)
			expect(currentRoom?.phase).toBe('lobby')

			// Step 2: Both vote for Cinema Pippin
			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			// Verify votes were registered
			const broadcasts = io._getBroadcastEvents()
			const votingUpdates = broadcasts.filter(
				(b) => b.room === room.roomId && b.event === 'lobby:voting-update'
			)
			expect(votingUpdates.length).toBeGreaterThan(0)

			// Step 3: Both go ready
			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			handler.handleLobbyReadyToggle(socket2 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Step 4: Verify game starts (Cinema Pippin skips countdown)
			await vi.advanceTimersByTimeAsync(100)

			currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('playing')
			if (currentRoom?.phase === 'playing') {
				expect(currentRoom.gameId).toBe('cinema-pippin')
			}

			// Step 5: Verify game:start was broadcast
			const gameStartBroadcast = io
				._getBroadcastEvents()
				.find((b) => b.room === room.roomId && b.event === 'game:start')
			expect(gameStartBroadcast).toBeDefined()

			vi.useRealTimers()
		})

		it('should handle player disconnect and reconnect during lobby', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')
			const socket2 = createMockSocket('bob-socket', '192.168.1.20')

			// Both players join
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

			// Alice goes ready then disconnects
			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Get Alice's session info before disconnect
			const alicePlayer = roomManager
				.getRoom(room.roomId)
				?.players.find((p) => p.nickname === 'Alice')
			expect(alicePlayer).toBeDefined()

			// Alice disconnects
			handler.handleDisconnect(socket1 as Socket)

			// Verify Alice is marked as disconnected
			let currentRoom = roomManager.getRoom(room.roomId)
			const disconnectedAlice = currentRoom?.players.find((p) => p.id === alicePlayer!.id)
			expect(disconnectedAlice?.isConnected).toBe(false)

			// Alice reconnects with session restore
			const socket1New = createMockSocket('alice-socket-new', '192.168.1.10')
			handler.handleRestoreSession(socket1New as Socket, {
				type: 'restore-session',
				roomId: room.roomId,
				playerId: alicePlayer!.id,
				sessionToken: alicePlayer!.sessionToken
			})

			// Verify Alice is connected again
			currentRoom = roomManager.getRoom(room.roomId)
			const reconnectedAlice = currentRoom?.players.find((p) => p.id === alicePlayer!.id)
			expect(reconnectedAlice?.isConnected).toBe(true)

			// Alice can vote again after reconnect
			handler.handleLobbyVote(socket1New as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			// Alice goes ready again
			handler.handleLobbyReadyToggle(socket1New as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Bob goes ready
			handler.handleLobbyReadyToggle(socket2 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Game should start
			await vi.advanceTimersByTimeAsync(100)

			currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('playing')

			vi.useRealTimers()
		})
	})

	describe('Two Human Players - Fake Facts (with countdown)', () => {
		it('should go through countdown phase before starting', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')
			const socket2 = createMockSocket('bob-socket', '192.168.1.20')

			// Both players join
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

			// Both vote for Fake Facts
			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'fake-facts'
			})

			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'fake-facts'
			})

			// Both go ready
			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			handler.handleLobbyReadyToggle(socket2 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Should be in countdown phase (not playing yet)
			let currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('countdown')

			// Advance past countdown (5 seconds)
			await vi.advanceTimersByTimeAsync(6000)

			// Now should be playing
			currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('playing')
			if (currentRoom?.phase === 'playing') {
				expect(currentRoom.gameId).toBe('fake-facts')
			}

			vi.useRealTimers()
		})

		it('should cancel countdown if player disconnects', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')
			const socket2 = createMockSocket('bob-socket', '192.168.1.20')

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

			// Verify in countdown
			let currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('countdown')

			// Advance 2 seconds into countdown
			vi.advanceTimersByTime(2000)

			// Alice disconnects
			handler.handleDisconnect(socket1 as Socket)

			// Should return to lobby
			currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('lobby')

			// Verify countdown:cancelled was broadcast
			const cancelBroadcast = io
				._getBroadcastEvents()
				.find((b) => b.room === room.roomId && b.event === 'lobby:countdown-cancelled')
			expect(cancelBroadcast).toBeDefined()

			vi.useRealTimers()
		})

		it('should cancel countdown if player un-readies', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')
			const socket2 = createMockSocket('bob-socket', '192.168.1.20')

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

			// Verify in countdown
			let currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('countdown')

			// Alice un-readies during countdown
			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: false
			})

			// Should return to lobby
			currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('lobby')

			vi.useRealTimers()
		})
	})

	describe('Edge Cases', () => {
		it('should not start game with only one player', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')

			handler.handleJoin(socket1 as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice'
			})

			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			await vi.advanceTimersByTimeAsync(1000)

			// Should still be in lobby (need 2+ players)
			const currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('lobby')

			vi.useRealTimers()
		})

		it('should not start game if votes are split (no majority)', () => {
			const room = roomManager.createRoom()
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')
			const socket2 = createMockSocket('bob-socket', '192.168.1.20')

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

			// Vote for different games
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

			// Should still be in lobby (tied votes)
			const currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('lobby')
		})

		it('should allow player to change vote and ready state', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')
			const socket2 = createMockSocket('bob-socket', '192.168.1.20')

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

			// Alice votes for fake-facts
			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'fake-facts'
			})

			// Alice changes vote to cinema-pippin
			handler.handleLobbyVote(socket1 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			// Bob votes for cinema-pippin
			handler.handleLobbyVote(socket2 as Socket, {
				type: 'lobby:vote-game',
				gameId: 'cinema-pippin'
			})

			// Alice ready, then un-ready, then ready again
			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: false
			})

			handler.handleLobbyReadyToggle(socket1 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Bob ready
			handler.handleLobbyReadyToggle(socket2 as Socket, {
				type: 'lobby:ready-toggle',
				isReady: true
			})

			// Allow async game start to complete
			await vi.advanceTimersByTimeAsync(100)

			// Should start game (Cinema Pippin skips countdown)
			const currentRoom = roomManager.getRoom(room.roomId)
			expect(currentRoom?.phase).toBe('playing')

			vi.useRealTimers()
		})
	})

	describe('Jumbotron Watch Flow', () => {
		it('should send initial room state to jumbotron on watch', () => {
			const room = roomManager.createRoom()

			// Player joins first
			const playerSocket = createMockSocket('player-socket', '192.168.1.10')
			handler.handleJoin(playerSocket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Alice'
			})

			// Jumbotron watches
			const jumbotronSocket = createMockSocket('jumbotron-socket')
			handler.handleWatch(jumbotronSocket as Socket, {
				type: 'watch',
				roomId: room.roomId
			})

			// Jumbotron should have received room:state
			const events = jumbotronSocket._getEmittedEvents()
			const stateEvent = events.find((e) => e.event === 'room:state')

			expect(stateEvent).toBeDefined()
			const data = stateEvent?.data as {
				type: string
				state: { roomId: string; players: Array<{ nickname: string }> }
			}
			expect(data.type).toBe('room:state')
			expect(data.state.roomId).toBe(room.roomId)
			expect(data.state.players).toHaveLength(1)
			expect(data.state.players[0].nickname).toBe('Alice')
		})

		it('should receive game:start broadcast on jumbotron', async () => {
			vi.useFakeTimers()

			const room = roomManager.createRoom()

			// Jumbotron watches first
			const jumbotronSocket = createMockSocket('jumbotron-socket')
			handler.handleWatch(jumbotronSocket as Socket, {
				type: 'watch',
				roomId: room.roomId
			})

			// Players join
			const socket1 = createMockSocket('alice-socket', '192.168.1.10')
			const socket2 = createMockSocket('bob-socket', '192.168.1.20')

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

			await vi.advanceTimersByTimeAsync(100)

			// Check broadcast events for game:start
			const broadcasts = io._getBroadcastEvents()
			const gameStart = broadcasts.find((b) => b.room === room.roomId && b.event === 'game:start')

			expect(gameStart).toBeDefined()
			expect((gameStart?.data as any).gameId).toBe('cinema-pippin')

			vi.useRealTimers()
		})
	})
})
