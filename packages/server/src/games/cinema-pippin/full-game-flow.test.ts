/**
 * Full Game Flow Integration Test
 * Tests complete game through Act 3 with AI players to verify state management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'

describe('Full Game Flow Through Act 3 (State Management)', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame(true)
	})

	it('should handle complete 3-clip flow with state cleanup', () => {
		// Setup: 2 human players + 1 AI player
		const mockAIPlayers = [
			{ playerId: 'ai-1', nickname: 'TestBot', constraint: 'Foodie constraint' }
		]
		const allPlayers = ['player1', 'player2', 'ai-1']
		game.initialize(allPlayers, mockAIPlayers)

		let state = game.getState()
		expect(state.phase).toBe('film_select')
		expect(state.scores.size).toBe(3)
		expect(state.aiPlayers.length).toBe(1)

		// ACT 1 (C1) - Complete cycle
		console.log('\n=== ACT 1 (C1) ===')

		// Film select → clip intro
		game.handlePlayerAction('jumbotron', { type: 'FILM_SELECT_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('clip_intro')

		// Clip intro → clip playback
		game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('clip_playback')

		// Clip playback → answer collection
		game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('answer_collection')
		expect(state.playerAnswers.size).toBe(0) // No pre-marking - AI answers come with staggered delays

		// Submit human answers
		game.handlePlayerAction('player1', { type: 'SUBMIT_ANSWER', payload: { answer: 'tacos' } })
		game.handlePlayerAction('player2', { type: 'SUBMIT_ANSWER', payload: { answer: 'pizza' } })

		// Game is now waiting for AI generation - manually advance for testing
		// (In production, AI generation completes and triggers auto-advance)
		game.advanceToVotingPlayback() // Proper transition that sets up allAnswers

		state = game.getState()
		expect(state.phase).toBe('voting_playback') // Manually advanced
		expect(state.playerAnswers.size).toBe(2) // 2 humans (AI comes later with staggered delays)
		expect(state.votes.size).toBe(0) // Votes cleared for new round
		expect(state.allAnswers.length).toBe(2) // Only 2 answers since AI hasn't submitted yet (async delay)

		// Voting playback → voting collection (manual advance for testing)
		game.advancePhase() // In real game, this happens when all answers shown
		state = game.getState()
		expect(state.phase).toBe('voting_collection')
		// Note: advancePhase() doesn't trigger AI pre-marking (that happens in advance())
		expect(state.votes.size).toBe(0)

		// Submit votes (including AI)
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
		expect(state.phase).toBe('results_display') // Auto-advanced
		expect(state.votes.size).toBe(3) // 2 humans + 1 AI

		// Results → Scoreboard → Next clip
		game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('scoreboard_transition')

		game.handlePlayerAction('jumbotron', { type: 'SCOREBOARD_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('clip_intro')
		expect(state.currentClipIndex).toBe(1) // Now on C2

		// ACT 2 (C2) - Complete cycle
		console.log('\n=== ACT 2 (C2) ===')

		// Clip intro → clip playback
		game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('clip_playback')

		// Clip playback → answer collection
		game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('answer_collection')

		// CRITICAL: Answers should be cleared from C1
		expect(state.playerAnswers.size).toBe(0) // No pre-marking - AI answers come with staggered delays
		expect(state.playerAnswers.has('player1')).toBe(false)
		expect(state.playerAnswers.has('player2')).toBe(false)

		// CRITICAL: Player statuses should be reset
		expect(state.playerStatus.get('player1')?.hasSubmittedAnswer).toBeFalsy()
		expect(state.playerStatus.get('player2')?.hasSubmittedAnswer).toBeFalsy()

		// Submit answers for C2
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_ANSWER',
			payload: { answer: 'eating delicious tacos' }
		})
		game.handlePlayerAction('player2', {
			type: 'SUBMIT_ANSWER',
			payload: { answer: 'pizza party tonight' }
		})

		// Manually advance past AI generation wait
		game.advanceToVotingPlayback()

		state = game.getState()
		expect(state.phase).toBe('voting_playback')
		expect(state.allAnswers.length).toBe(2) // Only 2 answers since AI hasn't submitted yet (async delay)

		// Complete voting (including AI)
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

		state = game.getState()
		expect(state.phase).toBe('results_display')
		expect(state.votes.size).toBe(3) // Verify all votes counted

		// Results → Scoreboard → Next clip
		game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('scoreboard_transition')

		game.handlePlayerAction('jumbotron', { type: 'SCOREBOARD_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('clip_intro')
		expect(state.currentClipIndex).toBe(2) // Now on C3

		// ACT 3 (C3) - Complete cycle
		console.log('\n=== ACT 3 (C3) ===')

		// Clip intro → clip playback
		game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('clip_playback')

		// Clip playback → answer collection
		game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('answer_collection')

		// CRITICAL: Answers cleared from C2
		expect(state.playerAnswers.size).toBe(0) // No pre-marking - AI answers come with staggered delays
		expect(state.playerAnswers.has('player1')).toBe(false)
		expect(state.playerAnswers.has('player2')).toBe(false)

		// Submit answers for C3
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_ANSWER',
			payload: { answer: 'munching tacos today' }
		})
		game.handlePlayerAction('player2', {
			type: 'SUBMIT_ANSWER',
			payload: { answer: 'fresh pizza slice' }
		})

		// Manually advance past AI generation wait
		game.advanceToVotingPlayback()

		state = game.getState()
		expect(state.phase).toBe('voting_playback')

		// Complete voting (including AI)
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

		state = game.getState()
		expect(state.phase).toBe('results_display')
		expect(state.votes.size).toBe(3) // Verify all votes counted

		// CRITICAL: After Act 3 → Scoreboard → Film Title Collection
		console.log('\n=== AFTER ACT 3 → SCOREBOARD → FILM TITLE ===')
		game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })
		state = game.getState()
		expect(state.phase).toBe('scoreboard_transition')

		game.handlePlayerAction('jumbotron', { type: 'SCOREBOARD_COMPLETE', payload: {} })
		state = game.getState()

		expect(state.phase).toBe('film_title_collection')
		expect(state.currentClipIndex).toBe(3)

		// CRITICAL: State should be cleared before film title
		// AI players not pre-marked anymore - answers come with staggered delays
		expect(state.playerAnswers.size).toBe(0) // No pre-marking
		expect(state.votes.size).toBe(0) // ⭐ Fixed!
		expect(state.allAnswers.length).toBe(0) // ⭐ Fixed!

		console.log('✅ All Act 3 state cleanup verified!')
	})

	it('should clean state when transitioning between films', () => {
		const mockAIPlayers = [{ playerId: 'ai-1', nickname: 'TestBot', constraint: 'Test' }]
		game.initialize(['player1', 'ai-1'], mockAIPlayers)

		// Manually set current film and populate state
		const state = game.getState()
		state.currentFilmIndex = 0
		state.currentClipIndex = 3 // All clips done
		state.playerAnswers.set('player1', 'leftover answer')
		state.votes.set('player1', 'leftover vote')
		state.playerStatus.set('player1', { hasSubmittedAnswer: true, hasVoted: true })

		// Trigger next film
		game.advanceToNextFilm()

		const newState = game.getState()
		expect(newState.currentFilmIndex).toBe(1)
		expect(newState.currentClipIndex).toBe(0) // Reset to C1

		// CRITICAL: State cleaned up
		expect(newState.playerAnswers.size).toBe(0)
		expect(newState.votes.size).toBe(0)
		expect(newState.allAnswers.length).toBe(0)

		// CRITICAL: Player statuses reset
		expect(newState.playerStatus.get('player1')).toEqual({})
		expect(newState.playerStatus.get('ai-1')).toEqual({})

		console.log('✅ Film transition cleanup verified!')
	})

	it('should clean state when transitioning to final scores', () => {
		const mockAIPlayers = [{ playerId: 'ai-1', nickname: 'TestBot', constraint: 'Test' }]
		game.initialize(['player1', 'ai-1'], mockAIPlayers)

		// Manually set to film 3, all clips done
		const state = game.getState()
		state.currentFilmIndex = 2 // Film 3 (0-indexed)
		state.currentClipIndex = 3 // All clips done
		state.playerAnswers.set('player1', 'leftover')
		state.votes.set('player1', 'leftover')

		// Trigger next film (should go to final_scores)
		game.advanceToNextFilm()

		const newState = game.getState()
		expect(newState.currentFilmIndex).toBe(3)
		expect(newState.phase).toBe('final_scores')

		// CRITICAL: State cleaned even when going to final_scores
		expect(newState.playerAnswers.size).toBe(0)
		expect(newState.votes.size).toBe(0)

		console.log('✅ Final scores cleanup verified!')
	})
})
