import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from './room-manager'

describe('RoomManager - AI Player Syncing', () => {
	let roomManager: RoomManager

	beforeEach(() => {
		roomManager = new RoomManager()
	})

	it('should create singleton room with AI players from config', () => {
		const room = roomManager.getOrCreateSingletonRoom()
		expect(room.phase).toBe('title')
		expect(room.config.cinemaPippinAIPlayers).toBeDefined()
	})

	it('should add AI players when transitioning to lobby', () => {
		// Create room
		const titleRoom = roomManager.getOrCreateSingletonRoom()
		expect(titleRoom.phase).toBe('title')
		expect(titleRoom.players.length).toBe(0)

		// Transition to lobby
		const lobbyRoom = roomManager.transitionTitleToLobby()
		expect(lobbyRoom).toBeTruthy()
		expect(lobbyRoom?.phase).toBe('lobby')

		// Should have AI players based on config
		const aiPlayerCount = lobbyRoom?.config.cinemaPippinAIPlayers || 0
		const aiPlayers = lobbyRoom?.players.filter((p) => p.isAI)
		expect(aiPlayers?.length).toBe(aiPlayerCount)

		// Each AI player should have proper fields
		aiPlayers?.forEach((player) => {
			expect(player.id).toMatch(/^ai-\d+$/)
			expect(player.nickname).toBeTruthy()
			expect(player.isAI).toBe(true)
			expect(player.isConnected).toBe(true)
		})
	})

	it('should update AI players when config changes', () => {
		// Create and transition to lobby
		roomManager.getOrCreateSingletonRoom()
		const lobbyRoom = roomManager.transitionTitleToLobby()
		expect(lobbyRoom).toBeTruthy()

		const initialAICount = lobbyRoom?.players.filter((p) => p.isAI).length || 0

		// Update config to change AI player count
		const updatedRoom = roomManager.updateRoomConfig(lobbyRoom!.roomId, {
			cinemaPippinAIPlayers: initialAICount + 1
		})

		expect(updatedRoom).toBeTruthy()
		const newAICount = updatedRoom?.players.filter((p) => p.isAI).length || 0
		expect(newAICount).toBe(initialAICount + 1)
	})

	it('should remove AI players when config set to 0', () => {
		// Create and transition to lobby
		roomManager.getOrCreateSingletonRoom()
		const lobbyRoom = roomManager.transitionTitleToLobby()
		expect(lobbyRoom).toBeTruthy()

		// Update config to 0 AI players
		const updatedRoom = roomManager.updateRoomConfig(lobbyRoom!.roomId, {
			cinemaPippinAIPlayers: 0
		})

		expect(updatedRoom).toBeTruthy()
		const aiPlayers = updatedRoom?.players.filter((p) => p.isAI)
		expect(aiPlayers?.length).toBe(0)
	})

	it('should not affect human players when syncing AI players', () => {
		// Create and transition to lobby
		roomManager.getOrCreateSingletonRoom()
		const lobbyRoom = roomManager.transitionTitleToLobby()
		expect(lobbyRoom).toBeTruthy()

		// Add a human player manually
		const humanPlayer = {
			id: 'human-1',
			roomId: lobbyRoom!.roomId,
			nickname: 'TestPlayer',
			sessionToken: 'test-token',
			deviceId: 'test-device',
			isAdmin: false,
			isHost: false,
			isAI: false,
			score: 0,
			connectedAt: new Date(),
			lastSeenAt: new Date(),
			isConnected: true
		}
		lobbyRoom!.players.push(humanPlayer)

		const initialPlayerCount = lobbyRoom!.players.length

		// Update AI config
		const updatedRoom = roomManager.updateRoomConfig(lobbyRoom!.roomId, {
			cinemaPippinAIPlayers: 2
		})

		expect(updatedRoom).toBeTruthy()
		
		// Human player should still be there
		const humanPlayers = updatedRoom?.players.filter((p) => !p.isAI)
		expect(humanPlayers?.length).toBe(1)
		expect(humanPlayers?.[0].id).toBe('human-1')

		// Should have 2 AI players
		const aiPlayers = updatedRoom?.players.filter((p) => p.isAI)
		expect(aiPlayers?.length).toBe(2)
	})
})
