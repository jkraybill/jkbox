/**
 * Full Game Flow Integration Test
 * Tests complete game through Act 3 with AI players to verify state management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
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
		// FSM requires being in next_film_or_end phase to call advanceToNextFilm
		state.phase = 'next_film_or_end'
		state.currentFilmIndex = 0
		state.currentClipIndex = 3 // All clips done
		state.playerAnswers.set('player1', 'leftover answer')
		state.votes.set('player1', 'leftover vote')
		state.playerStatus.set('player1', { hasSubmittedAnswer: true, hasVoted: true })
		game.setState(state)

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
		// FSM requires being in next_film_or_end phase to call advanceToNextFilm
		state.phase = 'next_film_or_end'
		state.currentFilmIndex = 2 // Film 3 (0-indexed)
		state.currentClipIndex = 3 // All clips done
		state.playerAnswers.set('player1', 'leftover')
		state.votes.set('player1', 'leftover')
		game.setState(state)

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

/**
 * Complete 3-Film Game E2E Test (Issue #66)
 *
 * This test simulates a complete game from start to finish:
 * - 3 films, each with 3 clips + film title round
 * - Film title voting → film_title_results (Issue #65 fix)
 * - Final scores → end_game_vote → lobby return
 *
 * Uses fake timers to handle timeouts without waiting.
 */
describe('Complete 3-Film Game E2E (Issue #66)', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		vi.useFakeTimers()
		game = new CinemaPippinGame(false) // No AI generation
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	/**
	 * Helper: Complete one clip cycle (intro → playback → answers → voting → results → scoreboard)
	 */
	function completeClipCycle(
		game: CinemaPippinGame,
		players: string[],
		clipNum: number,
		filmNum: number
	): void {
		console.log(`\n--- Film ${filmNum + 1}, Clip ${clipNum + 1} ---`)

		// Intro → Playback
		game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('clip_playback')

		// Playback → Answer Collection
		game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('answer_collection')

		// Submit answers (unique per clip to avoid C1 duplicate check)
		players.forEach((p, i) => {
			game.handlePlayerAction(p, {
				type: 'SUBMIT_ANSWER',
				payload: { answer: `answer-f${filmNum}-c${clipNum}-p${i}` }
			})
		})

		// Advance to voting (bypasses AI wait)
		game.advanceToVotingPlayback()
		expect(game.getPhase()).toBe('voting_playback')

		// Voting playback → Voting collection
		game.advancePhase()
		expect(game.getPhase()).toBe('voting_collection')

		// Submit votes
		const state = game.getState()
		players.forEach((p, i) => {
			const targetIdx = (i + 1) % players.length
			const targetAnswer = state.allAnswers[targetIdx]
			game.handlePlayerAction(p, {
				type: 'SUBMIT_VOTE',
				payload: { answerId: targetAnswer?.id ?? `player-${players[targetIdx]}` }
			})
		})

		expect(game.getPhase()).toBe('results_display')

		// Results → Scoreboard
		game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('scoreboard_transition')

		// Scoreboard → Next phase
		game.handlePlayerAction('jumbotron', { type: 'SCOREBOARD_COMPLETE', payload: {} })
	}

	/**
	 * Helper: Complete film title round (collection → voting → results → montage)
	 */
	function completeFilmTitleRound(
		game: CinemaPippinGame,
		players: string[],
		filmNum: number
	): void {
		console.log(`\n--- Film ${filmNum + 1}: Title Round ---`)

		expect(game.getPhase()).toBe('film_title_collection')

		// Submit film titles
		players.forEach((p, i) => {
			game.handlePlayerAction(p, {
				type: 'SUBMIT_ANSWER',
				payload: { answer: `Film ${filmNum + 1} Title by Player ${i}` }
			})
		})

		// Advance to voting
		game.advanceToFilmTitleVoting()
		expect(game.getPhase()).toBe('film_title_voting')

		// Submit votes
		const state = game.getState()
		players.forEach((p, i) => {
			const targetIdx = (i + 1) % players.length
			const targetAnswer = state.allAnswers[targetIdx]
			game.handlePlayerAction(p, {
				type: 'SUBMIT_VOTE',
				payload: { answerId: targetAnswer?.id ?? `player-${players[targetIdx]}` }
			})
		})

		// CRITICAL: Issue #65 fix - should go to film_title_results, NOT results_display
		expect(game.getPhase()).toBe('film_title_results')

		// Verify winning title was stored
		expect(game.getState().filmTitle).toBeTruthy()
		console.log(`  Winner: "${game.getState().filmTitle}"`)

		// Film title results → Final montage
		game.handlePlayerAction('jumbotron', { type: 'FILM_TITLE_RESULTS_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('final_montage')

		// Final montage → Next film check
		game.handlePlayerAction('jumbotron', { type: 'MONTAGE_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('next_film_or_end')

		// Next film check triggers transition
		game.handlePlayerAction('jumbotron', { type: 'NEXT_FILM_CHECK', payload: {} })
	}

	it('should complete full 3-film game from start to end_game_vote', () => {
		const players = ['player1', 'player2', 'player3']
		game.initialize(players)

		let state = game.getState()
		expect(state.phase).toBe('film_select')
		expect(state.scores.size).toBe(3)

		// Film select → clip intro
		game.handlePlayerAction('jumbotron', { type: 'FILM_SELECT_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('clip_intro')

		// ========== FILM 1 ==========
		console.log('\n========== FILM 1 ==========')

		// Complete 3 clips
		for (let clip = 0; clip < 3; clip++) {
			completeClipCycle(game, players, clip, 0)

			if (clip < 2) {
				// After clips 1 and 2, should be on next clip intro
				expect(game.getPhase()).toBe('clip_intro')
				expect(game.getState().currentClipIndex).toBe(clip + 1)
			} else {
				// After clip 3, should be in film title collection
				expect(game.getPhase()).toBe('film_title_collection')
			}
		}

		// Complete film title round
		completeFilmTitleRound(game, players, 0)

		// Should now be on Film 2
		state = game.getState()
		expect(state.phase).toBe('clip_intro')
		expect(state.currentFilmIndex).toBe(1)
		expect(state.currentClipIndex).toBe(0)

		// ========== FILM 2 ==========
		console.log('\n========== FILM 2 ==========')

		for (let clip = 0; clip < 3; clip++) {
			completeClipCycle(game, players, clip, 1)

			if (clip < 2) {
				expect(game.getPhase()).toBe('clip_intro')
			} else {
				expect(game.getPhase()).toBe('film_title_collection')
			}
		}

		completeFilmTitleRound(game, players, 1)

		state = game.getState()
		expect(state.phase).toBe('clip_intro')
		expect(state.currentFilmIndex).toBe(2)

		// ========== FILM 3 ==========
		console.log('\n========== FILM 3 ==========')

		for (let clip = 0; clip < 3; clip++) {
			completeClipCycle(game, players, clip, 2)

			if (clip < 2) {
				expect(game.getPhase()).toBe('clip_intro')
			} else {
				expect(game.getPhase()).toBe('film_title_collection')
			}
		}

		// Film 3 title round - after this, should go to final_scores
		console.log('\n--- Film 3: Title Round ---')

		expect(game.getPhase()).toBe('film_title_collection')

		players.forEach((p, i) => {
			game.handlePlayerAction(p, {
				type: 'SUBMIT_ANSWER',
				payload: { answer: `Final Film Title by Player ${i}` }
			})
		})

		game.advanceToFilmTitleVoting()
		expect(game.getPhase()).toBe('film_title_voting')

		const titleState = game.getState()
		players.forEach((p, i) => {
			const targetIdx = (i + 1) % players.length
			const targetAnswer = titleState.allAnswers[targetIdx]
			game.handlePlayerAction(p, {
				type: 'SUBMIT_VOTE',
				payload: { answerId: targetAnswer?.id ?? `player-${players[targetIdx]}` }
			})
		})

		expect(game.getPhase()).toBe('film_title_results')

		game.handlePlayerAction('jumbotron', { type: 'FILM_TITLE_RESULTS_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('final_montage')

		game.handlePlayerAction('jumbotron', { type: 'MONTAGE_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('next_film_or_end')

		// After Film 3, should go to final_scores
		game.handlePlayerAction('jumbotron', { type: 'NEXT_FILM_CHECK', payload: {} })
		expect(game.getPhase()).toBe('final_scores')
		expect(game.getState().currentFilmIndex).toBe(3)

		// ========== END GAME ==========
		console.log('\n========== END GAME ==========')

		// Final scores → End game vote
		game.handlePlayerAction('jumbotron', { type: 'FINAL_SCORES_COMPLETE', payload: {} })
		expect(game.getPhase()).toBe('end_game_vote')

		// Verify scores are preserved
		state = game.getState()
		expect(state.scores.size).toBe(3)
		const totalScore = Array.from(state.scores.values()).reduce((a, b) => a + b, 0)
		expect(totalScore).toBeGreaterThan(0)

		console.log('\n✅ COMPLETE GAME FLOW VERIFIED!')
		console.log(`   Final scores: ${JSON.stringify(Object.fromEntries(state.scores))}`)
	})

	it('should handle film title voting timeout correctly (Issue #65)', () => {
		const players = ['player1', 'player2']
		game.initialize(players)

		// Fast-forward to film_title_voting
		const state = game.getState()
		state.phase = 'film_title_collection'
		state.votingTimeout = 5
		state.playerAnswers = new Map([
			['player1', 'Title A'],
			['player2', 'Title B']
		])
		game.setState(state)

		game.advanceToFilmTitleVoting()
		expect(game.getPhase()).toBe('film_title_voting')

		// Only player1 votes
		const votingState = game.getState()
		game.handlePlayerAction('player1', {
			type: 'SUBMIT_VOTE',
			payload: { answerId: votingState.allAnswers[0]?.id ?? 'player-player1' }
		})

		expect(game.getPhase()).toBe('film_title_voting') // Still waiting for player2

		// Trigger timeout
		vi.advanceTimersByTime(6000)

		// CRITICAL: Should be film_title_results, NOT results_display (Issue #65)
		expect(game.getPhase()).toBe('film_title_results')

		console.log('✅ Film title voting timeout correctly advances to film_title_results')
	})

	it('should accumulate scores correctly across all films', () => {
		const players = ['player1', 'player2']
		game.initialize(players)

		// Set up initial scores to verify accumulation
		const state = game.getState()
		state.scores.set('player1', 0)
		state.scores.set('player2', 0)
		game.setState(state)

		// Simulate completing Film 1 clip (1 point per vote)
		game.setState({
			...game.getState(),
			phase: 'voting_collection',
			currentFilmIndex: 0,
			allAnswers: [
				{ id: 'a1', text: 'Answer 1', authorId: 'player1', votedBy: [] },
				{ id: 'a2', text: 'Answer 2', authorId: 'player2', votedBy: [] }
			]
		})

		game.handlePlayerAction('player1', { type: 'SUBMIT_VOTE', payload: { answerId: 'a2' } })
		game.handlePlayerAction('player2', { type: 'SUBMIT_VOTE', payload: { answerId: 'a1' } })

		// Film 1: 1 point per vote, each got 1 vote = 1 point each
		let scores = game.getState().scores
		expect(scores.get('player1')).toBe(1)
		expect(scores.get('player2')).toBe(1)

		// Simulate Film 2 voting (2 points per vote)
		game.setState({
			...game.getState(),
			phase: 'voting_collection',
			currentFilmIndex: 1,
			votes: new Map(),
			allAnswers: [
				{ id: 'b1', text: 'Answer B1', authorId: 'player1', votedBy: [] },
				{ id: 'b2', text: 'Answer B2', authorId: 'player2', votedBy: [] }
			]
		})

		// Both vote for player1's answer
		game.handlePlayerAction('player1', { type: 'SUBMIT_VOTE', payload: { answerId: 'b2' } })
		game.handlePlayerAction('player2', { type: 'SUBMIT_VOTE', payload: { answerId: 'b1' } })

		// Film 2: 2 points per vote
		// player1 got 1 vote = 2 points, total = 1 + 2 = 3
		// player2 got 1 vote = 2 points, total = 1 + 2 = 3
		scores = game.getState().scores
		expect(scores.get('player1')).toBe(3)
		expect(scores.get('player2')).toBe(3)

		// Simulate Film 3 voting (3 points per vote)
		game.setState({
			...game.getState(),
			phase: 'voting_collection',
			currentFilmIndex: 2,
			votes: new Map(),
			allAnswers: [
				{ id: 'c1', text: 'Answer C1', authorId: 'player1', votedBy: [] },
				{ id: 'c2', text: 'Answer C2', authorId: 'player2', votedBy: [] }
			]
		})

		// Both vote for player2's answer
		game.handlePlayerAction('player1', { type: 'SUBMIT_VOTE', payload: { answerId: 'c2' } })
		game.handlePlayerAction('player2', { type: 'SUBMIT_VOTE', payload: { answerId: 'c2' } })

		// Film 3: 3 points per vote
		// player1 got 0 votes = 0 points, total = 3 + 0 = 3
		// player2 got 2 votes = 6 points, total = 3 + 6 = 9
		scores = game.getState().scores
		expect(scores.get('player1')).toBe(3)
		expect(scores.get('player2')).toBe(9)

		console.log('✅ Score accumulation verified across films')
		console.log(`   player1: ${scores.get('player1')} points`)
		console.log(`   player2: ${scores.get('player2')} points`)
	})
})
