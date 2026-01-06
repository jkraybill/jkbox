/**
 * Player Management Tests (TDD for #59)
 *
 * Tests for mid-game join and player quit functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'

describe('Player Management', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame()
	})

	describe('handlePlayerQuit', () => {
		it('should remove player from scores', () => {
			game.initialize(['p1', 'p2', 'p3'])

			game.handlePlayerQuit('p2')

			const state = game.getState()
			expect(state.scores.has('p2')).toBe(false)
			expect(state.scores.has('p1')).toBe(true)
			expect(state.scores.has('p3')).toBe(true)
			expect(state.scores.size).toBe(2)
		})

		it('should remove player from playerStatus', () => {
			game.initialize(['p1', 'p2', 'p3'])

			game.handlePlayerQuit('p2')

			const state = game.getState()
			expect(state.playerStatus.has('p2')).toBe(false)
			expect(state.playerStatus.has('p1')).toBe(true)
		})

		it('should remove pending answer from playerAnswers', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })
			game.submitAnswer('p1', 'apple')
			game.submitAnswer('p2', 'banana')

			game.handlePlayerQuit('p2')

			const state = game.getState()
			expect(state.playerAnswers.has('p2')).toBe(false)
			expect(state.playerAnswers.get('p1')).toBe('apple')
		})

		it('should remove pending vote from votes', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'voting_collection' })
			// Simulate votes
			game.getState().votes.set('p1', 'answer-1')
			game.getState().votes.set('p2', 'answer-2')

			game.handlePlayerQuit('p2')

			const state = game.getState()
			expect(state.votes.has('p2')).toBe(false)
			expect(state.votes.get('p1')).toBe('answer-1')
		})

		it('should preserve quitter previous answer for others to vote on', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'voting_collection' })

			// Simulate that p2 submitted an answer earlier and it's in allAnswers
			const state = game.getState()
			state.allAnswers = [
				{ id: 'a1', text: 'apple', authorId: 'p1', votedBy: [] },
				{ id: 'a2', text: 'banana', authorId: 'p2', votedBy: [] },
				{ id: 'a3', text: 'cherry', authorId: 'p3', votedBy: [] }
			]

			game.handlePlayerQuit('p2')

			// Answer should remain votable
			const newState = game.getState()
			const p2Answer = newState.allAnswers.find((a) => a.authorId === 'p2')
			expect(p2Answer).toBeDefined()
			expect(p2Answer?.text).toBe('banana')
		})

		it('should return true if player was removed', () => {
			game.initialize(['p1', 'p2'])

			const result = game.handlePlayerQuit('p2')

			expect(result).toBe(true)
		})

		it('should return false if player not found', () => {
			game.initialize(['p1', 'p2'])

			const result = game.handlePlayerQuit('nonexistent')

			expect(result).toBe(false)
		})
	})

	describe('Player quit during answer_collection', () => {
		it('should auto-advance when all remaining players have answered', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			// p1 and p3 submit answers
			game.submitAnswer('p1', 'apple')
			game.getState().playerStatus.set('p1', { hasSubmittedAnswer: true })
			game.submitAnswer('p3', 'cherry')
			game.getState().playerStatus.set('p3', { hasSubmittedAnswer: true })

			// p2 quits without answering
			const shouldAdvance = game.handlePlayerQuit('p2')

			expect(shouldAdvance).toBe(true)
			// All remaining players (p1, p3) have answered, should signal advance
			expect(game.shouldAutoAdvance()).toBe(true)
		})

		it('should not auto-advance if remaining players still need to answer', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			// Only p1 submits
			game.submitAnswer('p1', 'apple')
			game.getState().playerStatus.set('p1', { hasSubmittedAnswer: true })

			// p2 quits
			game.handlePlayerQuit('p2')

			// p3 still hasn't answered
			expect(game.shouldAutoAdvance()).toBe(false)
		})
	})

	describe('Player quit during voting_collection', () => {
		it('should auto-advance when all remaining players have voted', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'voting_collection' })

			// Setup answers
			game.getState().allAnswers = [
				{ id: 'a1', text: 'apple', authorId: 'p1', votedBy: [] },
				{ id: 'a2', text: 'banana', authorId: 'p2', votedBy: [] },
				{ id: 'a3', text: 'cherry', authorId: 'p3', votedBy: [] }
			]

			// p1 and p3 vote
			game.getState().votes.set('p1', 'a3')
			game.getState().playerStatus.set('p1', { hasVoted: true })
			game.getState().votes.set('p3', 'a1')
			game.getState().playerStatus.set('p3', { hasVoted: true })

			// p2 quits without voting
			game.handlePlayerQuit('p2')

			expect(game.shouldAutoAdvance()).toBe(true)
		})
	})

	describe('All players quit', () => {
		it('should return game_ended signal when last player quits', () => {
			game.initialize(['p1', 'p2'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.handlePlayerQuit('p1')
			const result = game.handlePlayerQuit('p2')

			expect(result).toBe(true)
			expect(game.getState().scores.size).toBe(0)
			expect(game.isGameEnded()).toBe(true)
		})

		it('should mark game as ended when only 1 player remains', () => {
			game.initialize(['p1', 'p2'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.handlePlayerQuit('p1')

			// Game requires 2 players minimum
			expect(game.isGameEnded()).toBe(true)
		})
	})

	describe('handlePlayerJoin (mid-game)', () => {
		it('should add new player with score 0', () => {
			game.initialize(['p1', 'p2'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.handlePlayerJoin('p3')

			const state = game.getState()
			expect(state.scores.get('p3')).toBe(0)
		})

		it('should add new player to playerStatus', () => {
			game.initialize(['p1', 'p2'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.handlePlayerJoin('p3')

			const state = game.getState()
			expect(state.playerStatus.has('p3')).toBe(true)
		})

		it('should mark new player as already submitted if joining during answer_collection', () => {
			game.initialize(['p1', 'p2'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.handlePlayerJoin('p3')

			const state = game.getState()
			// New player can't answer this round, marked as submitted to not block
			expect(state.playerStatus.get('p3')?.hasSubmittedAnswer).toBe(true)
		})

		it('should mark new player as already voted if joining during voting_collection', () => {
			game.initialize(['p1', 'p2'])
			game.setState({ ...game.getState(), phase: 'voting_collection' })

			game.handlePlayerJoin('p3')

			const state = game.getState()
			expect(state.playerStatus.get('p3')?.hasVoted).toBe(true)
		})

		it('should allow new player to participate at next question phase', () => {
			game.initialize(['p1', 'p2'])
			// Simulate we're at results display (between rounds)
			game.setState({ ...game.getState(), phase: 'results_display' })

			game.handlePlayerJoin('p3')

			const state = game.getState()
			// Player added, no special status needed
			expect(state.playerStatus.get('p3')?.hasSubmittedAnswer).toBeFalsy()
			expect(state.playerStatus.get('p3')?.hasVoted).toBeFalsy()
		})

		it('should return false if player already exists', () => {
			game.initialize(['p1', 'p2'])

			const result = game.handlePlayerJoin('p1')

			expect(result).toBe(false)
		})

		it('should return true if player was added', () => {
			game.initialize(['p1', 'p2'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			const result = game.handlePlayerJoin('p3')

			expect(result).toBe(true)
		})
	})

	describe('getActivePlayerCount', () => {
		it('should return count of players in scores', () => {
			game.initialize(['p1', 'p2', 'p3'])

			expect(game.getActivePlayerCount()).toBe(3)
		})

		it('should decrease after player quit', () => {
			game.initialize(['p1', 'p2', 'p3'])

			game.handlePlayerQuit('p2')

			expect(game.getActivePlayerCount()).toBe(2)
		})
	})

	describe('Edge cases', () => {
		it('should handle quit during film_title_collection', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'film_title_collection' })

			game.getState().playerStatus.set('p1', { hasSubmittedAnswer: true })
			game.getState().playerStatus.set('p3', { hasSubmittedAnswer: true })

			game.handlePlayerQuit('p2')

			expect(game.shouldAutoAdvance()).toBe(true)
		})

		it('should handle quit during film_title_voting', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'film_title_voting' })

			game.getState().playerStatus.set('p1', { hasVoted: true })
			game.getState().playerStatus.set('p3', { hasVoted: true })

			game.handlePlayerQuit('p2')

			expect(game.shouldAutoAdvance()).toBe(true)
		})

		it('should handle quit during end_game_vote', () => {
			game.initialize(['p1', 'p2', 'p3'])
			game.setState({ ...game.getState(), phase: 'end_game_vote' })

			game.getState().endGameVotes.set('p1', 'lobby')
			game.getState().endGameVotes.set('p3', 'again')

			game.handlePlayerQuit('p2')

			// Should remove from endGameVotes if present
			expect(game.getState().endGameVotes.has('p2')).toBe(false)
		})
	})
})
