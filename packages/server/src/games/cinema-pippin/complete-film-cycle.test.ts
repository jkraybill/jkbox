/**
 * Complete Film Cycle Test
 * Verifies: Act 3 → Title Challenge → Next Film
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'

describe('Complete Film Cycle: Act 3 → Title → Next Film', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(true)
	})

	it('should complete full film cycle: all 3 acts → title challenge → next film', () => {
		// Setup: 2 humans + 1 AI
		const mockAIPlayers = [{ playerId: 'ai-1', nickname: 'TestBot', constraint: 'Test constraint' }]
		game.initialize(['player1', 'player2', 'ai-1'], mockAIPlayers)

		let state = game.getState()
		expect(state.currentFilmIndex).toBe(0) // Film 1
		expect(state.currentClipIndex).toBe(0) // Clip 1
		expect(state.phase).toBe('film_select')

		console.log('\n🎬 === FILM 1 ===')

		// Fast-forward through Film 1, Act 1 (C1)
		console.log('\n📝 Act 1 (C1)')
		game.handlePlayerAction('jumbotron', { type: 'FILM_SELECT_COMPLETE', payload: {} })
		game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
		game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
		game.handlePlayerAction('player1', { type: 'SUBMIT_ANSWER', payload: { answer: 'tacos' } })
		game.handlePlayerAction('player2', { type: 'SUBMIT_ANSWER', payload: { answer: 'pizza' } })

		// Manually advance past AI generation wait (Ollama not running in tests)
		game.advanceToVotingPlayback()

		state = game.getState()
		expect(state.phase).toBe('voting_playback')
		expect(state.currentClipIndex).toBe(0)

		// Complete C1 voting
		game.advancePhase() // voting_collection
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player2' }
		})
		game.handlePlayerAction('player2', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player1' }
		})
		game.handlePlayerAction('ai-1', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player1' }
		})

		state = game.getState()
		expect(state.phase).toBe('results_display')

		// C1 Results → C2
		game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('clip_intro')
		expect(state.currentClipIndex).toBe(1) // Now on C2

		// Fast-forward through Act 2 (C2)
		console.log('\n📝 Act 2 (C2)')
		game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
		game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_ANSWER',
			payload: { answer: 'eating delicious tacos' }
		})
		game.handlePlayerAction('player2', {
			type: 'SUBMIT_ANSWER',
			payload: { answer: 'pizza party tonight' }
		})

		game.advanceToVotingPlayback() // Skip AI generation wait
		game.advancePhase() // voting_playback → voting_collection
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player2' }
		})
		game.handlePlayerAction('player2', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player1' }
		})
		game.handlePlayerAction('ai-1', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player2' }
		})

		// C2 Results → C3
		game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('clip_intro')
		expect(state.currentClipIndex).toBe(2) // Now on C3

		// Fast-forward through Act 3 (C3)
		console.log('\n📝 Act 3 (C3)')
		game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
		game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_ANSWER',
			payload: { answer: 'munching tacos now' }
		})
		game.handlePlayerAction('player2', {
			type: 'SUBMIT_ANSWER',
			payload: { answer: 'fresh pizza slice' }
		})

		game.advanceToVotingPlayback() // Skip AI generation wait
		game.advancePhase() // voting_playback → voting_collection
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player2' }
		})
		game.handlePlayerAction('player2', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player1' }
		})
		game.handlePlayerAction('ai-1', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: 'player-player1' }
		})

		state = game.getState()
		expect(state.phase).toBe('results_display')
		expect(state.currentClipIndex).toBe(2) // Still C3

		// ⭐ CRITICAL: After Act 3 results → Film Title Collection
		console.log('\n🏆 === TITLE CHALLENGE ===')
		game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })
		state = game.getState()

		expect(state.phase).toBe('film_title_collection')
		expect(state.currentClipIndex).toBe(3) // Incremented to 3
		expect(state.currentFilmIndex).toBe(0) // Still Film 1

		// CRITICAL: State should be cleared (AI players not pre-marked anymore)
		expect(state.playerAnswers.size).toBe(0) // No pre-marking - AI answers come with staggered delays
		expect(state.votes.size).toBe(0)
		expect(state.allAnswers.length).toBe(0)
		console.log('✅ State cleared after Act 3')

		// Title Collection → Title Voting
		game.advancePhase()
		state = game.getState()
		expect(state.phase).toBe('film_title_voting')

		// Title Voting → Title Results
		game.advancePhase()
		state = game.getState()
		expect(state.phase).toBe('film_title_results')

		// Title Results → Final Montage
		game.handlePlayerAction('jumbotron', { type: 'FILM_TITLE_RESULTS_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('final_montage')

		// Final Montage → Next Film or End
		game.handlePlayerAction('jumbotron', { type: 'MONTAGE_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('next_film_or_end')

		// ⭐ CRITICAL: Next Film Check → Should go to Film 2
		console.log('\n🎬 === FILM 2 ===')
		game.handlePlayerAction('jumbotron', { type: 'NEXT_FILM_CHECK', payload: {} })
		state = game.getState()

		expect(state.phase).toBe('clip_intro')
		expect(state.currentFilmIndex).toBe(1) // Film 2!
		expect(state.currentClipIndex).toBe(0) // Reset to C1

		// CRITICAL: State cleaned for new film
		expect(state.playerAnswers.size).toBe(0)
		expect(state.votes.size).toBe(0)
		expect(state.allAnswers.length).toBe(0)
		console.log('✅ State cleared for Film 2')

		// CRITICAL: Player statuses reset
		expect(state.playerStatus.get('player1')).toEqual({})
		expect(state.playerStatus.get('player2')).toEqual({})
		expect(state.playerStatus.get('ai-1')).toEqual({})
		console.log('✅ Player statuses reset for Film 2')

		console.log('\n✅ Complete film cycle verified!')
	})

	it('should go to final_scores after completing all 3 films', () => {
		game.initialize(
			['player1', 'ai-1'],
			[{ playerId: 'ai-1', nickname: 'TestBot', constraint: 'Test' }]
		)

		const state = game.getState()

		// Manually set to film 3 (last film), ready to advance
		state.currentFilmIndex = 2
		state.currentClipIndex = 0
		state.phase = 'next_film_or_end'
		game.setState(state)

		console.log('\n🏁 === ALL 3 FILMS COMPLETE ===')

		// Try to advance to next film (but there isn't one)
		game.handlePlayerAction('jumbotron', { type: 'NEXT_FILM_CHECK', payload: {} })

		const newState = game.getState()
		expect(newState.currentFilmIndex).toBe(3)
		expect(newState.phase).toBe('final_scores')

		// State should still be cleaned
		expect(newState.playerAnswers.size).toBe(0)
		expect(newState.votes.size).toBe(0)

		console.log('✅ Correctly went to final_scores after 3 films')
	})
})
