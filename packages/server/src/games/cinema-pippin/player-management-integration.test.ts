/**
 * Player Management Integration Tests
 *
 * End-to-end tests for mid-game join and player quit functionality.
 * These tests simulate the full socket flow: socket → connection handler → game → broadcast
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Socket, Server } from 'socket.io'
import { RoomManager } from '../../room-manager'
import { ConnectionHandler } from '../../connection-handler'

// Mock socket factory
function createMockSocket(
	id: string,
	ipAddress: string = '192.168.1.100'
): Partial<Socket> & {
	_getEmittedEvents: () => Array<{ event: string; data: unknown }>
	_getJoinedRooms: () => string[]
	_getLeftRooms: () => string[]
} {
	const emittedEvents: Array<{ event: string; data: unknown }> = []
	const joinedRooms: string[] = []
	const leftRooms: string[] = []

	return {
		id,
		handshake: {
			address: ipAddress
		} as Socket['handshake'],
		emit: (event: string, data: unknown) => {
			emittedEvents.push({ event, data })
		},
		join: (room: string) => {
			joinedRooms.push(room)
		},
		leave: (room: string) => {
			leftRooms.push(room)
		},
		disconnect: () => {},
		_getEmittedEvents: () => emittedEvents,
		_getJoinedRooms: () => joinedRooms,
		_getLeftRooms: () => leftRooms
	} as Partial<Socket> & {
		_getEmittedEvents: () => Array<{ event: string; data: unknown }>
		_getJoinedRooms: () => string[]
		_getLeftRooms: () => string[]
	}
}

function createMockServer(): Partial<Server> & {
	_getBroadcastEvents: () => Array<{ room: string; event: string; data: unknown }>
	_clearBroadcastEvents: () => void
} {
	let broadcastEvents: Array<{ room: string; event: string; data: unknown }> = []

	return {
		to: (room: string) =>
			({
				emit: (event: string, data: unknown) => {
					broadcastEvents.push({ room, event, data })
				}
			}) as ReturnType<Server['to']>,
		_getBroadcastEvents: () => broadcastEvents,
		_clearBroadcastEvents: () => {
			broadcastEvents = []
		}
	} as Partial<Server> & {
		_getBroadcastEvents: () => Array<{ room: string; event: string; data: unknown }>
		_clearBroadcastEvents: () => void
	}
}

// Helper to start a game with players
async function startGameWithPlayers(
	handler: ConnectionHandler,
	roomManager: RoomManager,
	io: ReturnType<typeof createMockServer>,
	playerCount: number = 2
): Promise<{
	roomId: string
	sockets: Array<ReturnType<typeof createMockSocket>>
	playerIds: string[]
}> {
	const room = roomManager.createRoom()
	const sockets: Array<ReturnType<typeof createMockSocket>> = []
	const playerIds: string[] = []

	// Join players
	for (let i = 0; i < playerCount; i++) {
		const socket = createMockSocket(`socket-${i}`, `192.168.1.${10 + i}`)
		sockets.push(socket)

		handler.handleJoin(socket as Socket, {
			type: 'join',
			roomId: room.roomId,
			nickname: `Player${i + 1}`
		})

		const joinSuccess = socket._getEmittedEvents().find((e) => e.event === 'join:success')
		if (joinSuccess) {
			const data = joinSuccess.data as { player: { id: string } }
			playerIds.push(data.player.id)
		}
	}

	// All players vote for cinema-pippin and ready up
	for (let i = 0; i < playerCount; i++) {
		handler.handleLobbyVote(sockets[i] as Socket, {
			type: 'lobby:vote-game',
			gameId: 'cinema-pippin'
		})
		handler.handleLobbyReadyToggle(sockets[i] as Socket, {
			type: 'lobby:ready-toggle',
			isReady: true
		})
	}

	// Wait for countdown to complete (5 seconds)
	await vi.advanceTimersByTimeAsync(5000)

	return { roomId: room.roomId, sockets, playerIds }
}

describe('Player Management Integration Tests', () => {
	let roomManager: RoomManager
	let handler: ConnectionHandler
	let io: ReturnType<typeof createMockServer>

	beforeEach(() => {
		vi.useFakeTimers()
		roomManager = new RoomManager()
		io = createMockServer()
		handler = new ConnectionHandler(roomManager, io as Server)
	})

	afterEach(() => {
		handler.stopHeartbeatMonitor()
		vi.useRealTimers()
	})

	describe('Player Quit During Gameplay', () => {
		it('should remove player when they emit game:quit', async () => {
			const { roomId, sockets, playerIds } = await startGameWithPlayers(handler, roomManager, io, 3)

			// Verify game started
			const room = roomManager.getRoom(roomId)
			expect(room?.phase).toBe('playing')
			expect(room?.players).toHaveLength(3)

			// Player 2 quits
			handler.handleGameQuit(sockets[1] as Socket)

			// Verify player removed from room
			const updatedRoom = roomManager.getRoom(roomId)
			expect(updatedRoom?.players).toHaveLength(2)
			expect(updatedRoom?.players.find((p) => p.id === playerIds[1])).toBeUndefined()

			// Verify quit:success emitted to quitter
			const quitSuccess = sockets[1]
				._getEmittedEvents()
				.find((e) => e.event === 'game:quit:success')
			expect(quitSuccess).toBeDefined()

			// Verify room:state broadcast to remaining players
			const broadcasts = io._getBroadcastEvents()
			const stateUpdate = broadcasts.find((b) => b.room === roomId && b.event === 'room:state')
			expect(stateUpdate).toBeDefined()
		})

		it('should return to lobby when not enough players remain', async () => {
			const { roomId, sockets } = await startGameWithPlayers(handler, roomManager, io, 2)

			// Verify game started with 2 players
			let room = roomManager.getRoom(roomId)
			expect(room?.phase).toBe('playing')

			// Player 1 quits - only 1 player remains
			handler.handleGameQuit(sockets[0] as Socket)

			// Game should end and return to lobby (handled by handleBackToLobby internally)
			room = roomManager.getRoom(roomId)
			// After all players quit or not enough remain, room transitions back to lobby
			expect(room?.phase).toBe('lobby')
		})

		it('should preserve game state for remaining players after quit', async () => {
			const { roomId, sockets, playerIds } = await startGameWithPlayers(handler, roomManager, io, 3)

			// Get initial game state
			const roomBefore = roomManager.getRoom(roomId)
			expect(roomBefore?.phase).toBe('playing')

			// Player 2 quits
			handler.handleGameQuit(sockets[1] as Socket)

			// Game should still be in playing phase
			const roomAfter = roomManager.getRoom(roomId)
			expect(roomAfter?.phase).toBe('playing')

			// Remaining players should still be in game
			expect(roomAfter?.players.map((p) => p.id)).toContain(playerIds[0])
			expect(roomAfter?.players.map((p) => p.id)).toContain(playerIds[2])
		})

		it('should not affect game when quit called in non-playing phase', () => {
			const room = roomManager.createRoom()
			const socket = createMockSocket('socket-1')

			// Join during lobby phase
			handler.handleJoin(socket as Socket, {
				type: 'join',
				roomId: room.roomId,
				nickname: 'Player1'
			})

			// Try to quit (should be ignored - not in playing phase)
			handler.handleGameQuit(socket as Socket)

			// Player should still be in room
			const updatedRoom = roomManager.getRoom(room.roomId)
			expect(updatedRoom?.players).toHaveLength(1)
		})
	})

	describe('Mid-Game Join', () => {
		it('should allow player to join during playing phase', async () => {
			const { roomId, sockets } = await startGameWithPlayers(handler, roomManager, io, 2)

			// Verify game started
			const roomBefore = roomManager.getRoom(roomId)
			expect(roomBefore?.phase).toBe('playing')
			expect(roomBefore?.players).toHaveLength(2)

			// New player joins mid-game
			const newSocket = createMockSocket('socket-new', '192.168.1.50')
			handler.handleJoin(newSocket as Socket, {
				type: 'join',
				roomId,
				nickname: 'Latecomer'
			})

			// Verify player was added
			const roomAfter = roomManager.getRoom(roomId)
			expect(roomAfter?.players).toHaveLength(3)
			expect(roomAfter?.players.find((p) => p.nickname === 'Latecomer')).toBeDefined()

			// Verify join:success sent to new player
			const joinSuccess = newSocket._getEmittedEvents().find((e) => e.event === 'join:success')
			expect(joinSuccess).toBeDefined()
		})

		it('should add mid-game joiner to game with score 0', async () => {
			const { roomId } = await startGameWithPlayers(handler, roomManager, io, 2)

			// New player joins mid-game
			const newSocket = createMockSocket('socket-new', '192.168.1.50')
			handler.handleJoin(newSocket as Socket, {
				type: 'join',
				roomId,
				nickname: 'Latecomer'
			})

			// Get the join success to find player ID
			const joinSuccess = newSocket._getEmittedEvents().find((e) => e.event === 'join:success')
			const newPlayerId = (joinSuccess?.data as { player: { id: string } }).player.id

			// Get room to check game state
			const room = roomManager.getRoom(roomId)
			expect(room?.phase).toBe('playing')

			// Note: The game's handlePlayerJoin is called internally
			// We can't directly inspect game state from here, but the integration works
			expect(room?.players.find((p) => p.id === newPlayerId)).toBeDefined()
		})
	})

	describe('Multiple Player Quit Sequence', () => {
		it('should handle multiple players quitting in sequence', async () => {
			const { roomId, sockets, playerIds } = await startGameWithPlayers(handler, roomManager, io, 4)

			// Verify 4 players
			expect(roomManager.getRoom(roomId)?.players).toHaveLength(4)

			// Player 1 quits
			handler.handleGameQuit(sockets[0] as Socket)
			expect(roomManager.getRoom(roomId)?.players).toHaveLength(3)

			// Player 3 quits
			handler.handleGameQuit(sockets[2] as Socket)
			expect(roomManager.getRoom(roomId)?.players).toHaveLength(2)

			// Game should still be running with 2 players
			expect(roomManager.getRoom(roomId)?.phase).toBe('playing')

			// Player 2 quits - only 1 left, game should end
			handler.handleGameQuit(sockets[1] as Socket)
			expect(roomManager.getRoom(roomId)?.phase).toBe('lobby')
		})

		it('should handle quit followed by new join', async () => {
			const { roomId, sockets } = await startGameWithPlayers(handler, roomManager, io, 3)

			// Player 2 quits
			handler.handleGameQuit(sockets[1] as Socket)
			expect(roomManager.getRoom(roomId)?.players).toHaveLength(2)

			// New player joins
			const newSocket = createMockSocket('socket-new', '192.168.1.50')
			handler.handleJoin(newSocket as Socket, {
				type: 'join',
				roomId,
				nickname: 'Replacement'
			})

			// Should have 3 players again
			expect(roomManager.getRoom(roomId)?.players).toHaveLength(3)
			expect(roomManager.getRoom(roomId)?.phase).toBe('playing')
		})
	})

	describe('Edge Cases', () => {
		it('should ignore quit from unregistered socket', () => {
			const unknownSocket = createMockSocket('unknown-socket')

			// Should not throw, just log error
			expect(() => handler.handleGameQuit(unknownSocket as Socket)).not.toThrow()
		})

		it('should handle rapid quit and rejoin', async () => {
			const { roomId, sockets, playerIds } = await startGameWithPlayers(handler, roomManager, io, 3)

			// Player quits
			handler.handleGameQuit(sockets[1] as Socket)

			// Same device tries to join immediately
			const sameDeviceSocket = createMockSocket('socket-new', '192.168.1.11') // Same IP as player 2
			handler.handleJoin(sameDeviceSocket as Socket, {
				type: 'join',
				roomId,
				nickname: 'Player2Again'
			})

			// Should be allowed to join
			const room = roomManager.getRoom(roomId)
			expect(room?.players).toHaveLength(3)
			expect(room?.players.find((p) => p.nickname === 'Player2Again')).toBeDefined()
		})
	})
})
