/**
 * State Isolation Test
 * CRITICAL: Verifies that film-specific state is properly isolated between films
 *
 * Bug History:
 * - Issue: clipWinners array was not cleared when advancing to next film
 * - Impact: Film 2's C2/C3 would use Film 1's C1 winner as keyword instead of Film 2's C1 winner
 * - Root Cause: advanceToNextFilm() didn't clear clipWinners array
 * - Fix: Added clipWinners = [] in advanceToNextFilm()
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'

describe('State Isolation Between Films', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(true)
	})

	it('should clear clipWinners when advancing to next film', () => {
		// CRITICAL TEST: Verifies that clipWinners array is cleared when advancing to next film
		// This ensures Film 2's C2/C3 don't use Film 1's C1 winner as keyword

		// Setup
		game.initialize(['player1'], [])

		// Simulate clipWinners being populated during Film 1
		const state = game.getState()
		state.clipWinners = ['FILM1_C1_WINNER', 'FILM1_C2_WINNER', 'FILM1_C3_WINNER']
		state.currentFilmIndex = 0
		state.keywords[0] = 'FILM1_C1_WINNER'

		// Verify Film 1 has clipWinners
		expect(state.clipWinners).toHaveLength(3)

		// Call advanceToNextFilm() - this should clear clipWinners
		game.advanceToNextFilm()

		// CRITICAL CHECK: clipWinners should be EMPTY for Film 2
		const newState = game.getState()
		expect(newState.currentFilmIndex).toBe(1) // Film 2
		expect(newState.clipWinners).toHaveLength(0) // 🚨 CRITICAL: Must be empty!
		expect(newState.keywords[0]).toBe('FILM1_C1_WINNER') // keywords array preserved

		console.log('✅ clipWinners cleared when advancing to Film 2')
	})

	it('should preserve keywords array across films', () => {
		// This test verifies that the keywords array (which stores C1 winners for each film)
		// is NOT cleared, while clipWinners (which stores current film's 3 clip winners) IS cleared

		game.initialize(['player1', 'player2'], [])

		// Simulate Film 1 completion with C1 winner
		game.handlePlayerAction('jumbotron', { type: 'FILM_SELECT_COMPLETE', payload: {} })
		game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
		game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
		game.handlePlayerAction('player1', { type: 'SUBMIT_ANSWER', payload: { answer: 'KEYWORD_1' } })
		game.handlePlayerAction('player2', { type: 'SUBMIT_ANSWER', payload: { answer: 'other' } })
		game.advanceToVotingPlayback()
		game.advancePhase()
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player1' }
		})
		game.handlePlayerAction('player2', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player1' }
		})
		game.advancePhase()
		game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })

		let state = game.getState()
		expect(state.keywords[0]).toBe('KEYWORD_1')

		// Fast-forward to Film 2 (skip C2, C3, title round, montage)
		// This is simplified - just manually transition
		game.advanceToNextFilm()

		state = game.getState()
		expect(state.currentFilmIndex).toBe(1)
		expect(state.keywords[0]).toBe('KEYWORD_1') // Film 1's keyword preserved
		expect(state.clipWinners).toHaveLength(0) // clipWinners cleared

		console.log('✅ Keywords array preserved, clipWinners cleared between films')
	})
})
