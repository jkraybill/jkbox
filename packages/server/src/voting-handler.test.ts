import { describe, it, expect, beforeEach } from 'vitest'
import { VotingHandler } from './voting-handler'
import type { GameVote, PlayerReadyState, RoomVotingState } from '@jkbox/shared'

describe('VotingHandler', () => {
	let handler: VotingHandler

	beforeEach(() => {
		handler = new VotingHandler()
	})

	describe('submitVote', () => {
		it('should record player vote', () => {
			const vote = handler.submitVote('player-1', 'fake-facts')

			expect(vote.playerId).toBe('player-1')
			expect(vote.gameId).toBe('fake-facts')
			expect(vote.timestamp).toBeInstanceOf(Date)
		})

		it('should allow changing vote', () => {
			handler.submitVote('player-1', 'fake-facts')
			const newVote = handler.submitVote('player-1', 'cinema-pippin')

			expect(newVote.gameId).toBe('cinema-pippin')

			const state = handler.getVotingState()
			expect(state.votes['player-1']?.gameId).toBe('cinema-pippin')
		})

		it('should track multiple player votes', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.submitVote('player-2', 'cinema-pippin')
			handler.submitVote('player-3', 'fake-facts')

			const state = handler.getVotingState()
			expect(Object.keys(state.votes).length).toBe(3)
		})
	})

	describe('toggleReady', () => {
		it('should require vote before ready', () => {
			expect(() => handler.toggleReady('player-1', true)).toThrow('Must vote before going ready')
		})

		it('should allow ready toggle after voting', () => {
			handler.submitVote('player-1', 'fake-facts')
			const readyState = handler.toggleReady('player-1', true)

			expect(readyState.isReady).toBe(true)
			expect(readyState.hasVoted).toBe(true)
		})

		it('should allow toggling ready off', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.toggleReady('player-1', true)
			const readyState = handler.toggleReady('player-1', false)

			expect(readyState.isReady).toBe(false)
			expect(readyState.hasVoted).toBe(true) // Vote persists
		})

		it('should keep vote when toggling ready off', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.toggleReady('player-1', true)
			handler.toggleReady('player-1', false)

			const state = handler.getVotingState()
			expect(state.votes['player-1']?.gameId).toBe('fake-facts')
		})
	})

	describe('getVotingState', () => {
		it('should compute allReady correctly when all ready', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.submitVote('player-2', 'fake-facts')
			handler.toggleReady('player-1', true)
			handler.toggleReady('player-2', true)

			const state = handler.getVotingState()
			expect(state.allReady).toBe(true)
		})

		it('should compute allReady false when some not ready', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.submitVote('player-2', 'fake-facts')
			handler.toggleReady('player-1', true)

			const state = handler.getVotingState()
			expect(state.allReady).toBe(false)
		})

		it('should compute allReady false when some not voted', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.toggleReady('player-1', true)

			// Player 2 exists but hasn't voted
			handler.addPlayer('player-2')

			const state = handler.getVotingState()
			expect(state.allReady).toBe(false)
		})

		it('should select game with most votes', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.submitVote('player-2', 'fake-facts')
			handler.submitVote('player-3', 'cinema-pippin')

			const state = handler.getVotingState()
			expect(state.selectedGame).toBe('fake-facts')
		})

		it('should return null when votes are tied', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.submitVote('player-2', 'cinema-pippin')

			const state = handler.getVotingState()
			expect(state.selectedGame).toBeNull()
		})

		it('should handle three-way tie', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.submitVote('player-2', 'cinema-pippin')
			handler.submitVote('player-3', 'joker-poker')

			const state = handler.getVotingState()
			expect(state.selectedGame).toBeNull()
		})
	})

	describe('removePlayer', () => {
		it('should remove player vote and ready state', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.toggleReady('player-1', true)
			handler.removePlayer('player-1')

			const state = handler.getVotingState()
			expect(state.votes['player-1']).toBeUndefined()
			expect(state.readyStates['player-1']).toBeUndefined()
		})

		it('should recalculate selected game after removal', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.submitVote('player-2', 'fake-facts')
			handler.submitVote('player-3', 'cinema-pippin')

			const stateBefore = handler.getVotingState()
			expect(stateBefore.selectedGame).toBe('fake-facts')

			// Remove fake-facts voter
			handler.removePlayer('player-1')

			const stateAfter = handler.getVotingState()
			expect(stateAfter.selectedGame).toBeNull() // Now tied 1-1
		})
	})

	describe('reset', () => {
		it('should clear all votes and ready states', () => {
			handler.submitVote('player-1', 'fake-facts')
			handler.submitVote('player-2', 'cinema-pippin')
			handler.toggleReady('player-1', true)
			handler.reset()

			const state = handler.getVotingState()
			expect(Object.keys(state.votes).length).toBe(0)
			expect(Object.keys(state.readyStates).length).toBe(0)
			expect(state.allReady).toBe(false)
			expect(state.selectedGame).toBeNull()
		})
	})

	describe('AI Player Voting Exclusion', () => {
		it('should allow adding AI players separately from human players', () => {
			handler.addPlayer('human-1', false)
			handler.addPlayer('ai-1', true)
			handler.addPlayer('human-2', false)

			// Only human players need to vote
			handler.submitVote('human-1', 'fake-facts')
			handler.toggleReady('human-1', true)

			// Should not be ready - human-2 hasn't voted yet
			let state = handler.getVotingState()
			expect(state.allReady).toBe(false)

			// Now human-2 votes and is ready
			handler.submitVote('human-2', 'fake-facts')
			handler.toggleReady('human-2', true)

			// Should be ready - all humans are ready, AI doesn't matter
			state = handler.getVotingState()
			expect(state.allReady).toBe(true)
		})

		it('should exclude AI players from allReady calculation', () => {
			handler.addPlayer('human-1', false)
			handler.addPlayer('ai-1', true)
			handler.addPlayer('ai-2', true)

			// Only human votes and is ready
			handler.submitVote('human-1', 'fake-facts')
			handler.toggleReady('human-1', true)

			// Should be ready - AI players don't need to vote
			const state = handler.getVotingState()
			expect(state.allReady).toBe(true)
		})

		it('should require at least 1 human player to be ready', () => {
			handler.addPlayer('ai-1', true)
			handler.addPlayer('ai-2', true)

			// No humans - should not be ready
			const state = handler.getVotingState()
			expect(state.allReady).toBe(false)
		})

		it('should not require AI players to vote even if they do vote', () => {
			handler.addPlayer('human-1', false)
			handler.addPlayer('ai-1', true)

			// AI votes (shouldn't happen in practice, but test the behavior)
			handler.submitVote('ai-1', 'fake-facts')
			handler.toggleReady('ai-1', true)

			// Human hasn't voted - should not be ready
			let state = handler.getVotingState()
			expect(state.allReady).toBe(false)

			// Human votes and is ready - now should be ready
			handler.submitVote('human-1', 'cinema-pippin')
			handler.toggleReady('human-1', true)

			state = handler.getVotingState()
			expect(state.allReady).toBe(true)
		})

		it('should remove AI players from tracking on removePlayer', () => {
			handler.addPlayer('human-1', false)
			handler.addPlayer('ai-1', true)

			handler.submitVote('human-1', 'fake-facts')
			handler.toggleReady('human-1', true)

			// Should be ready (2 total players: 1 human + 1 AI)
			let state = handler.getVotingState()
			expect(state.allReady).toBe(true)

			// Remove AI player
			handler.removePlayer('ai-1')

			// Should NOT be ready - only 1 player left (need 2 to start game)
			state = handler.getVotingState()
			expect(state.allReady).toBe(false)
		})
	})
})
