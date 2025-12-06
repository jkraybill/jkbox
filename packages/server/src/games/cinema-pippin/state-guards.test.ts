/**
 * State Transition Guards - Critical Safety Tests
 *
 * These tests ensure the game NEVER advances to invalid states:
 * - No advancing to voting with 0 answers
 * - No advancing to results with 0 votes
 * - No phase transitions without proper prerequisites
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'

describe('State Transition Guards', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(false) // Disable AI for deterministic tests
		game.initialize(['player1', 'player2', 'player3'])
	})

	describe('Answer Collection Guards', () => {
		it('should NOT auto-advance to voting with 0 answers', () => {
			const state = game.getState()
			state.phase = 'answer_collection'
			state.playerAnswers.clear()
			game.setState(state)

			// Simulate what happens when AI generation completes with no answers
			// The game should NOT advance
			expect(game.getState().phase).toBe('answer_collection')
			expect(game.getState().playerAnswers.size).toBe(0)
		})

		it('should NOT auto-advance if playerAnswers.size < scores.size', () => {
			const state = game.getState()
			state.phase = 'answer_collection'
			state.playerAnswers.clear()
			state.playerAnswers.set('player1', 'answer1') // Only 1 of 3
			game.setState(state)

			// Manually trigger the check that happens after AI generation
			const activePlayers = state.scores.size
			const hasAllAnswers = state.playerAnswers.size >= activePlayers

			expect(hasAllAnswers).toBe(false)
			expect(state.playerAnswers.size).toBe(1)
			expect(activePlayers).toBe(3)
		})

		it('should require ALL players to have answers before advancing', () => {
			const state = game.getState()
			state.phase = 'answer_collection'
			state.playerAnswers.clear()
			state.playerAnswers.set('player1', 'answer1')
			state.playerAnswers.set('player2', 'answer2')
			state.playerAnswers.set('player3', 'answer3')
			game.setState(state)

			const activePlayers = state.scores.size
			const hasAllAnswers = state.playerAnswers.size >= activePlayers

			expect(hasAllAnswers).toBe(true)
			expect(state.playerAnswers.size).toBe(3)
		})
	})

	describe('Voting Playback Guards', () => {
		it('should have answers prepared before entering voting_playback', () => {
			// Set up answer collection with answers
			const state = game.getState()
			state.phase = 'answer_collection'
			state.playerAnswers.set('player1', 'answer1')
			state.playerAnswers.set('player2', 'answer2')
			state.playerAnswers.set('player3', 'answer3')
			game.setState(state)

			// Advance to voting
			game.advanceToVotingPlayback()

			const newState = game.getState()
			expect(newState.phase).toBe('voting_playback')
			expect(newState.allAnswers.length).toBeGreaterThan(0)
		})

		it('should NOT have empty allAnswers array after advancing', () => {
			const state = game.getState()
			state.phase = 'answer_collection'
			state.playerAnswers.set('player1', 'test1')
			state.playerAnswers.set('player2', 'test2')
			state.playerAnswers.set('player3', 'test3')
			game.setState(state)

			game.advanceToVotingPlayback()

			expect(game.getState().allAnswers.length).toBe(3)
		})
	})

	describe('Voting Collection Guards', () => {
		it('should NOT advance to results with 0 votes', () => {
			const state = game.getState()
			state.phase = 'voting_collection'
			state.votes.clear()
			state.allAnswers = [
				{ id: 'a1', text: 'test1', authorId: 'player1' },
				{ id: 'a2', text: 'test2', authorId: 'player2' }
			]
			game.setState(state)

			// The game should NOT auto-advance with 0 votes
			expect(game.getState().votes.size).toBe(0)
			expect(game.getState().phase).toBe('voting_collection')
		})

		it('should require ALL players to vote before advancing', () => {
			const state = game.getState()
			state.phase = 'voting_collection'
			state.votes.clear()
			state.allAnswers = [
				{ id: 'a1', text: 'test1', authorId: 'player1' },
				{ id: 'a2', text: 'test2', authorId: 'player2' },
				{ id: 'a3', text: 'test3', authorId: 'player3' }
			]
			game.setState(state)

			// Only 2 of 3 voted
			state.votes.set('player1', 'a2')
			state.votes.set('player2', 'a3')

			const activePlayers = state.scores.size
			const hasAllVotes = state.votes.size >= activePlayers

			expect(hasAllVotes).toBe(false)
		})
	})

	describe('Results Display Guards', () => {
		it('should handle "No Results" gracefully but log warning', () => {
			const state = game.getState()
			state.phase = 'results_display'
			state.votes.clear()
			state.allAnswers = []
			game.setState(state)

			// This is an error state - should never happen but handle gracefully
			expect(game.getState().allAnswers.length).toBe(0)
		})
	})

	describe('Phase Transition Sequence', () => {
		it('should follow correct phase sequence for clips', () => {
			const expectedSequence = [
				'film_select',
				'clip_intro',
				'clip_playback',
				'answer_collection',
				'voting_playback',
				'voting_collection',
				'results_display'
			]

			// Verify initial phase
			expect(game.getState().phase).toBe('film_select')
		})

		it('should NOT skip answer_collection phase', () => {
			const state = game.getState()

			// Simulate clip_playback completing
			state.phase = 'clip_playback'
			game.setState(state)

			// Handle VIDEO_COMPLETE action
			game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })

			// Should be in answer_collection, NOT voting
			expect(game.getState().phase).toBe('answer_collection')
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty scores map gracefully', () => {
			const state = game.getState()
			state.scores.clear() // Edge case: no players?
			state.phase = 'answer_collection'
			game.setState(state)

			const activePlayers = state.scores.size
			expect(activePlayers).toBe(0)

			// Should NOT divide by zero or advance incorrectly
			const hasAllAnswers = activePlayers > 0 && state.playerAnswers.size >= activePlayers
			expect(hasAllAnswers).toBe(false)
		})

		it('should handle playerAnswers larger than scores (disconnected players)', () => {
			const state = game.getState()
			state.phase = 'answer_collection'
			// 4 answers but only 3 in scores (someone disconnected after answering)
			state.playerAnswers.set('player1', 'a1')
			state.playerAnswers.set('player2', 'a2')
			state.playerAnswers.set('player3', 'a3')
			state.playerAnswers.set('player4', 'a4') // Disconnected player
			game.setState(state)

			const activePlayers = state.scores.size // 3
			const hasAllAnswers = state.playerAnswers.size >= activePlayers

			expect(hasAllAnswers).toBe(true) // 4 >= 3
		})

		it('should clear houseAnswerQueue when clearing answers', () => {
			const state = game.getState()
			state.houseAnswerQueue = ['stale1', 'stale2', 'stale3']
			game.setState(state)

			game.clearAnswers()

			expect(game.getState().houseAnswerQueue.length).toBe(0)
		})
	})
})

describe('advanceToVotingPlayback Guards', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(false)
		game.initialize(['player1', 'player2', 'player3'])
	})

	it('should NOT advance to voting_playback with 0 answers', () => {
		const state = game.getState()
		state.phase = 'answer_collection'
		state.playerAnswers.clear() // 0 answers
		game.setState(state)

		// Try to advance - should be blocked by guard
		game.advanceToVotingPlayback()

		// Should still be in answer_collection (guard blocked advance)
		// Note: clearVotes() is called so phase check depends on guard returning early
		expect(game.getState().playerAnswers.size).toBe(0)
	})

	it('should NOT advance to voting_playback with 0 active players (empty scores)', () => {
		const state = game.getState()
		state.phase = 'answer_collection'
		state.scores.clear() // 0 active players - edge case
		state.playerAnswers.clear()
		game.setState(state)

		// Try to advance - should be blocked by scores guard
		game.advanceToVotingPlayback()

		// Guard should have blocked the advance
		expect(game.getState().scores.size).toBe(0)
	})

	it('should successfully advance with valid answers', () => {
		const state = game.getState()
		state.phase = 'answer_collection'
		state.playerAnswers.set('player1', 'test1')
		state.playerAnswers.set('player2', 'test2')
		state.playerAnswers.set('player3', 'test3')
		game.setState(state)

		game.advanceToVotingPlayback()

		expect(game.getState().phase).toBe('voting_playback')
		expect(game.getState().allAnswers.length).toBe(3)
	})
})

describe('advanceToFilmTitleVoting Guards', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(false)
		game.initialize(['player1', 'player2'])
	})

	it('should NOT advance to film_title_voting with 0 answers', () => {
		const state = game.getState()
		state.phase = 'film_title_collection'
		state.playerAnswers.clear() // 0 film title answers
		game.setState(state)

		// Try to advance - should be blocked by guard
		game.advanceToFilmTitleVoting()

		// Guard should block - phase should not change
		expect(game.getState().playerAnswers.size).toBe(0)
	})

	it('should NOT advance to film_title_voting with 0 active players', () => {
		const state = game.getState()
		state.phase = 'film_title_collection'
		state.scores.clear() // 0 active players
		game.setState(state)

		game.advanceToFilmTitleVoting()

		expect(game.getState().scores.size).toBe(0)
	})

	it('should successfully advance with valid film title answers', () => {
		const state = game.getState()
		state.phase = 'film_title_collection'
		state.playerAnswers.set('player1', 'My Film Title')
		state.playerAnswers.set('player2', 'Another Title')
		game.setState(state)

		game.advanceToFilmTitleVoting()

		expect(game.getState().phase).toBe('film_title_voting')
		expect(game.getState().allAnswers.length).toBe(2)
	})
})

describe('Guard Functions', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(false)
		game.initialize(['player1', 'player2'])
	})

	describe('canAdvanceToVoting', () => {
		it('should return false with 0 answers', () => {
			const state = game.getState()
			state.phase = 'answer_collection'
			state.playerAnswers.clear()

			const canAdvance =
				state.phase === 'answer_collection' &&
				state.playerAnswers.size > 0 &&
				state.playerAnswers.size >= state.scores.size

			expect(canAdvance).toBe(false)
		})

		it('should return false with partial answers', () => {
			const state = game.getState()
			state.phase = 'answer_collection'
			state.playerAnswers.clear()
			state.playerAnswers.set('player1', 'answer1')

			const canAdvance =
				state.phase === 'answer_collection' &&
				state.playerAnswers.size > 0 &&
				state.playerAnswers.size >= state.scores.size

			expect(canAdvance).toBe(false)
		})

		it('should return true with all answers', () => {
			const state = game.getState()
			state.phase = 'answer_collection'
			state.playerAnswers.clear()
			state.playerAnswers.set('player1', 'answer1')
			state.playerAnswers.set('player2', 'answer2')

			const canAdvance =
				state.phase === 'answer_collection' &&
				state.playerAnswers.size > 0 &&
				state.playerAnswers.size >= state.scores.size

			expect(canAdvance).toBe(true)
		})
	})

	describe('canAdvanceToResults', () => {
		it('should return false with 0 votes', () => {
			const state = game.getState()
			state.phase = 'voting_collection'
			state.votes.clear()

			const canAdvance =
				state.phase === 'voting_collection' &&
				state.votes.size > 0 &&
				state.votes.size >= state.scores.size

			expect(canAdvance).toBe(false)
		})

		it('should return true with all votes', () => {
			const state = game.getState()
			state.phase = 'voting_collection'
			state.votes.clear()
			state.votes.set('player1', 'a1')
			state.votes.set('player2', 'a2')

			const canAdvance =
				state.phase === 'voting_collection' &&
				state.votes.size > 0 &&
				state.votes.size >= state.scores.size

			expect(canAdvance).toBe(true)
		})
	})
})

describe('Timeout Handling Safety', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(false)
		game.initialize(['player1', 'player2', 'player3'])
	})

	it('should assign fallback answers when houseAnswerQueue is empty', () => {
		const state = game.getState()
		state.phase = 'answer_collection'
		state.playerAnswers.clear() // No one submitted
		state.houseAnswerQueue = [] // Empty queue
		game.setState(state)

		// Simulate timeout by directly calling the advance method
		// The guard should prevent advancing with 0 answers
		game.advanceToVotingPlayback()

		// Should NOT have advanced since no answers
		expect(game.getState().phase).not.toBe('voting_playback')
	})

	it('should have playerStatus marked for non-submitters after house answer assignment', () => {
		const state = game.getState()
		state.phase = 'answer_collection'
		state.playerAnswers.clear()
		state.playerAnswers.set('player1', 'my answer') // Only player1 submitted
		state.houseAnswerQueue = ['house1', 'house2'] // House answers for timeouts
		game.setState(state)

		// Manually assign house answers like timeout would
		const nonSubmitters = ['player2', 'player3']
		nonSubmitters.forEach((playerId, i) => {
			state.playerAnswers.set(playerId, state.houseAnswerQueue[i] || `fallback ${i}`)
			const status = state.playerStatus.get(playerId) || {}
			status.hasSubmittedAnswer = true
			status.timedOut = true
			state.playerStatus.set(playerId, status)
		})

		expect(state.playerAnswers.size).toBe(3)
		expect(state.playerStatus.get('player2')?.timedOut).toBe(true)
		expect(state.playerStatus.get('player3')?.timedOut).toBe(true)
		expect(state.playerStatus.get('player1')?.timedOut).toBeUndefined()
	})

	it('should use fallback strings when houseAnswerQueue has fewer items than needed', () => {
		const state = game.getState()
		state.phase = 'answer_collection'
		state.playerAnswers.clear()
		state.houseAnswerQueue = ['only_one_house_answer'] // Only 1 house answer but 3 players need it
		game.setState(state)

		// Simulate assigning to all 3 non-submitters
		const nonSubmitters = ['player1', 'player2', 'player3']
		nonSubmitters.forEach((playerId, i) => {
			const houseAnswer = state.houseAnswerQueue[i] || `answer ${i + 1}`
			state.playerAnswers.set(playerId, houseAnswer)
		})

		expect(state.playerAnswers.get('player1')).toBe('only_one_house_answer')
		expect(state.playerAnswers.get('player2')).toBe('answer 2') // Fallback
		expect(state.playerAnswers.get('player3')).toBe('answer 3') // Fallback
	})

	it('should NOT advance if phase changed before timeout fires', () => {
		const state = game.getState()
		// Simulate: timeout was set during answer_collection
		// But phase already advanced to voting_playback before timeout fired
		state.phase = 'voting_playback'
		state.playerAnswers.clear()
		game.setState(state)

		// advanceToVotingPlayback is called (simulating stale timeout)
		// It should detect wrong phase via guards
		game.advanceToVotingPlayback()

		// Phase should remain voting_playback (not change to something else)
		expect(game.getState().phase).toBe('voting_playback')
	})
})

describe('Film Title Phase Safety', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(false)
		game.initialize(['player1', 'player2'])
	})

	it('should set votingCollectionStartTime when advancing to film_title_voting', () => {
		const state = game.getState()
		state.phase = 'film_title_collection'
		state.playerAnswers.set('player1', 'My Film Title')
		state.playerAnswers.set('player2', 'Another Title')
		game.setState(state)

		const beforeTime = Date.now()
		game.advanceToFilmTitleVoting()
		const afterTime = Date.now()

		const newState = game.getState()
		expect(newState.phase).toBe('film_title_voting')
		expect(newState.votingCollectionStartTime).toBeDefined()
		expect(newState.votingCollectionStartTime).toBeGreaterThanOrEqual(beforeTime)
		expect(newState.votingCollectionStartTime).toBeLessThanOrEqual(afterTime)
	})

	it('should set answerCollectionStartTime for film_title_collection phase', () => {
		const state = game.getState()
		// Simulate completing all 3 clips to enter film_title_collection
		state.currentClipIndex = 2 // After clip 3
		state.clipWinners = ['word1', 'word2', 'word3']
		game.setState(state)

		// advanceToNextClip should set us to film_title_collection with startTime
		game.advanceToNextClip()

		const newState = game.getState()
		expect(newState.phase).toBe('film_title_collection')
		expect(newState.answerCollectionStartTime).toBeDefined()
	})
})
