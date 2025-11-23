import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'

describe('AI Player Integration', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(true) // Enable AI for these tests
	})

	it('should initialize AI players based on global config', () => {
		// AI players should be initialized from global config
		const mockAIPlayers = [
			{ playerId: 'ai-1', nickname: 'TestBot', constraint: 'Test constraint' }
		]
		// When AI players from lobby are provided, their IDs should be in playerIds
		const allPlayers = ['player1', 'player2', 'ai-1']
		game.initialize(allPlayers, mockAIPlayers)

		const state = game.getState()
		expect(state.aiPlayers.length).toBeGreaterThan(0) // At least 1 AI player
		expect(state.scores.size).toBe(allPlayers.length)

		// AI players should have constraint
		expect(state.aiPlayers[0].constraint).toBeTruthy()

		// AI nickname should be [FirstWord]Bot
		expect(state.aiPlayers[0].nickname).toMatch(/Bot$/)
	})

	it('should include AI players in score tracking', () => {
		const humanPlayers = ['player1']
		game.initialize(humanPlayers)

		const state = game.getState()
		expect(state.scores.size).toBe(humanPlayers.length + state.aiPlayers.length)

		// Scores should be initialized to 0
		expect(state.scores.get('player1')).toBe(0)

		// All AI players should have scores initialized to 0
		state.aiPlayers.forEach(aiPlayer => {
			expect(state.scores.get(aiPlayer.playerId)).toBe(0)
		})
	})

	it('should have unique AI player IDs', () => {
		const mockAIPlayers = [
			{ playerId: 'ai-1', nickname: 'Bot1', constraint: 'Constraint 1' },
			{ playerId: 'ai-2', nickname: 'Bot2', constraint: 'Constraint 2' }
		]
		// Include AI player IDs in playerIds array
		game.initialize(['player1', 'ai-1', 'ai-2'], mockAIPlayers)

		const state = game.getState()
		const aiIds = state.aiPlayers.map((ai) => ai.playerId)
		const uniqueIds = new Set(aiIds)

		expect(uniqueIds.size).toBe(aiIds.length)
		expect(aiIds.length).toBeGreaterThan(0)
	})
})
