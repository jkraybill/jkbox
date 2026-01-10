/**
 * FSM Tests - Exhaustive testing of all phase transitions
 */

import { describe, expect, it } from 'vitest'
import {
	transition,
	isValidTransition,
	getValidEvents,
	getPossibleNextPhases,
	PHASE_ORDER,
	type GameEvent,
	type TransitionContext
} from './fsm'
import type { GamePhase } from './types'

describe('FSM - Static Transitions', () => {
	it('film_select → clip_intro on FILM_SELECT_COMPLETE', () => {
		const result = transition('film_select', 'FILM_SELECT_COMPLETE')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('clip_intro')
	})

	it('clip_intro → clip_playback on INTRO_COMPLETE', () => {
		const result = transition('clip_intro', 'INTRO_COMPLETE')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('clip_playback')
	})

	it('clip_playback → answer_collection on VIDEO_COMPLETE', () => {
		const result = transition('clip_playback', 'VIDEO_COMPLETE')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('answer_collection')
	})

	it('answer_collection → voting_playback on ALL_ANSWERS_RECEIVED', () => {
		const result = transition('answer_collection', 'ALL_ANSWERS_RECEIVED')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('voting_playback')
	})

	it('answer_collection → voting_playback on ANSWER_TIMEOUT', () => {
		const result = transition('answer_collection', 'ANSWER_TIMEOUT')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('voting_playback')
	})

	it('voting_collection → results_display on ALL_VOTES_RECEIVED', () => {
		const result = transition('voting_collection', 'ALL_VOTES_RECEIVED')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('results_display')
	})

	it('voting_collection → results_display on VOTING_TIMEOUT', () => {
		const result = transition('voting_collection', 'VOTING_TIMEOUT')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('results_display')
	})

	it('results_display → scoreboard_transition on RESULTS_COMPLETE', () => {
		const result = transition('results_display', 'RESULTS_COMPLETE')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('scoreboard_transition')
	})

	it('film_title_collection → film_title_voting on ALL_ANSWERS_RECEIVED', () => {
		const result = transition('film_title_collection', 'ALL_ANSWERS_RECEIVED')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('film_title_voting')
	})

	it('film_title_collection → film_title_voting on ANSWER_TIMEOUT', () => {
		const result = transition('film_title_collection', 'ANSWER_TIMEOUT')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('film_title_voting')
	})

	it('film_title_voting → film_title_results on ALL_VOTES_RECEIVED (NOT results_display)', () => {
		const result = transition('film_title_voting', 'ALL_VOTES_RECEIVED')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('film_title_results')
		// This was bug #65 - should NOT go to results_display
		expect(result.nextPhase).not.toBe('results_display')
	})

	it('film_title_voting → film_title_results on VOTING_TIMEOUT (NOT results_display)', () => {
		const result = transition('film_title_voting', 'VOTING_TIMEOUT')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('film_title_results')
		// This was bug #65 - should NOT go to results_display
		expect(result.nextPhase).not.toBe('results_display')
	})

	it('film_title_results → final_montage on FILM_TITLE_RESULTS_COMPLETE', () => {
		const result = transition('film_title_results', 'FILM_TITLE_RESULTS_COMPLETE')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('final_montage')
	})

	it('final_montage → next_film_or_end on MONTAGE_COMPLETE', () => {
		const result = transition('final_montage', 'MONTAGE_COMPLETE')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('next_film_or_end')
	})

	it('final_scores → end_game_vote on FINAL_SCORES_COMPLETE', () => {
		const result = transition('final_scores', 'FINAL_SCORES_COMPLETE')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('end_game_vote')
	})
})

describe('FSM - Conditional Transitions', () => {
	describe('voting_playback + VIDEO_COMPLETE', () => {
		it('stays in voting_playback when not all answers shown', () => {
			const context: TransitionContext = {
				currentClipIndex: 0,
				currentFilmIndex: 0,
				allAnswersShown: false
			}
			const result = transition('voting_playback', 'VIDEO_COMPLETE', context)
			expect(result.valid).toBe(true)
			expect(result.nextPhase).toBe('voting_playback')
		})

		it('advances to voting_collection when all answers shown', () => {
			const context: TransitionContext = {
				currentClipIndex: 0,
				currentFilmIndex: 0,
				allAnswersShown: true
			}
			const result = transition('voting_playback', 'VIDEO_COMPLETE', context)
			expect(result.valid).toBe(true)
			expect(result.nextPhase).toBe('voting_collection')
		})
	})

	describe('scoreboard_transition + SCOREBOARD_COMPLETE', () => {
		// Note: clipIndex is already incremented before transition (0→1 after clip 1, etc.)
		it('goes to clip_intro after clip 1 (index now 1)', () => {
			const context: TransitionContext = {
				currentClipIndex: 1, // Already incremented from 0
				currentFilmIndex: 0
			}
			const result = transition('scoreboard_transition', 'SCOREBOARD_COMPLETE', context)
			expect(result.valid).toBe(true)
			expect(result.nextPhase).toBe('clip_intro')
		})

		it('goes to clip_intro after clip 2 (index now 2)', () => {
			const context: TransitionContext = {
				currentClipIndex: 2, // Already incremented from 1
				currentFilmIndex: 0
			}
			const result = transition('scoreboard_transition', 'SCOREBOARD_COMPLETE', context)
			expect(result.valid).toBe(true)
			expect(result.nextPhase).toBe('clip_intro')
		})

		it('goes to film_title_collection after clip 3 (index now 3)', () => {
			const context: TransitionContext = {
				currentClipIndex: 3, // Already incremented from 2
				currentFilmIndex: 0
			}
			const result = transition('scoreboard_transition', 'SCOREBOARD_COMPLETE', context)
			expect(result.valid).toBe(true)
			expect(result.nextPhase).toBe('film_title_collection')
		})
	})

	describe('next_film_or_end + NEXT_FILM_CHECK', () => {
		// Note: filmIndex is already incremented before transition (0→1 after film 1, etc.)
		it('goes to clip_intro after film 1 (index now 1)', () => {
			const context: TransitionContext = {
				currentClipIndex: 0,
				currentFilmIndex: 1 // Already incremented from 0
			}
			const result = transition('next_film_or_end', 'NEXT_FILM_CHECK', context)
			expect(result.valid).toBe(true)
			expect(result.nextPhase).toBe('clip_intro')
		})

		it('goes to clip_intro after film 2 (index now 2)', () => {
			const context: TransitionContext = {
				currentClipIndex: 0,
				currentFilmIndex: 2 // Already incremented from 1
			}
			const result = transition('next_film_or_end', 'NEXT_FILM_CHECK', context)
			expect(result.valid).toBe(true)
			expect(result.nextPhase).toBe('clip_intro')
		})

		it('goes to final_scores after film 3 (index now 3)', () => {
			const context: TransitionContext = {
				currentClipIndex: 0,
				currentFilmIndex: 3 // Already incremented from 2
			}
			const result = transition('next_film_or_end', 'NEXT_FILM_CHECK', context)
			expect(result.valid).toBe(true)
			expect(result.nextPhase).toBe('final_scores')
		})
	})
})

describe('FSM - Invalid Transitions', () => {
	it('rejects invalid event for phase', () => {
		const result = transition('film_select', 'VIDEO_COMPLETE')
		expect(result.valid).toBe(false)
		expect(result.nextPhase).toBe('film_select') // Stays in current phase
	})

	it('rejects transition from end_game_vote (terminal state)', () => {
		// END_GAME_COMPLETE doesn't lead to another phase
		const result = transition('end_game_vote', 'END_GAME_COMPLETE')
		expect(result.valid).toBe(false)
	})

	it('rejects wrong answer event during voting', () => {
		const result = transition('voting_collection', 'ALL_ANSWERS_RECEIVED')
		expect(result.valid).toBe(false)
	})

	it('rejects timeout in non-collection phase', () => {
		const result = transition('clip_intro', 'ANSWER_TIMEOUT')
		expect(result.valid).toBe(false)
	})
})

describe('FSM - Helper Functions', () => {
	describe('isValidTransition', () => {
		it('returns true for valid transitions', () => {
			expect(isValidTransition('film_select', 'FILM_SELECT_COMPLETE')).toBe(true)
			expect(isValidTransition('answer_collection', 'ALL_ANSWERS_RECEIVED')).toBe(true)
		})

		it('returns false for invalid transitions', () => {
			expect(isValidTransition('film_select', 'VIDEO_COMPLETE')).toBe(false)
		})
	})

	describe('getValidEvents', () => {
		it('returns correct events for film_select', () => {
			const events = getValidEvents('film_select')
			expect(events).toContain('FILM_SELECT_COMPLETE')
			expect(events).not.toContain('VIDEO_COMPLETE')
		})

		it('returns correct events for answer_collection', () => {
			const events = getValidEvents('answer_collection')
			expect(events).toContain('ALL_ANSWERS_RECEIVED')
			expect(events).toContain('ANSWER_TIMEOUT')
		})

		it('returns correct events for conditional phases', () => {
			const votingPlaybackEvents = getValidEvents('voting_playback')
			expect(votingPlaybackEvents).toContain('VIDEO_COMPLETE')

			const scoreboardEvents = getValidEvents('scoreboard_transition')
			expect(scoreboardEvents).toContain('SCOREBOARD_COMPLETE')
		})
	})

	describe('getPossibleNextPhases', () => {
		it('returns single phase for simple transitions', () => {
			const phases = getPossibleNextPhases('film_select')
			expect(phases).toEqual(['clip_intro'])
		})

		it('returns multiple phases for conditional transitions', () => {
			const phases = getPossibleNextPhases('scoreboard_transition')
			expect(phases).toContain('clip_intro')
			expect(phases).toContain('film_title_collection')
		})

		it('returns both stay and advance for voting_playback', () => {
			const phases = getPossibleNextPhases('voting_playback')
			expect(phases).toContain('voting_playback')
			expect(phases).toContain('voting_collection')
		})
	})

	describe('PHASE_ORDER', () => {
		it('contains all 15 phases', () => {
			expect(PHASE_ORDER).toHaveLength(15)
		})

		it('starts with film_select', () => {
			expect(PHASE_ORDER[0]).toBe('film_select')
		})

		it('ends with end_game_vote', () => {
			expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe('end_game_vote')
		})
	})
})

describe('FSM - Full Game Flow Simulation', () => {
	it('simulates complete game flow through all phases', () => {
		let currentPhase: GamePhase = 'film_select'
		let clipIndex = 0
		let filmIndex = 0
		const phases: GamePhase[] = [currentPhase]

		// Helper to advance with optional context
		const advance = (event: GameEvent, context?: TransitionContext) => {
			const result = transition(currentPhase, event, context)
			expect(result.valid).toBe(true)
			currentPhase = result.nextPhase
			phases.push(currentPhase)
		}

		// Film 1, Clip 1
		advance('FILM_SELECT_COMPLETE')
		expect(currentPhase).toBe('clip_intro')

		// Clip cycle: intro → playback → answer → voting_playback → voting → results → scoreboard
		const completeClipCycle = () => {
			advance('INTRO_COMPLETE')
			expect(currentPhase).toBe('clip_playback')

			advance('VIDEO_COMPLETE')
			expect(currentPhase).toBe('answer_collection')

			advance('ALL_ANSWERS_RECEIVED')
			expect(currentPhase).toBe('voting_playback')

			// Show all answers
			advance('VIDEO_COMPLETE', {
				currentClipIndex: clipIndex,
				currentFilmIndex: filmIndex,
				allAnswersShown: true
			})
			expect(currentPhase).toBe('voting_collection')

			advance('ALL_VOTES_RECEIVED')
			expect(currentPhase).toBe('results_display')

			advance('RESULTS_COMPLETE')
			expect(currentPhase).toBe('scoreboard_transition')

			// Increment clip index (simulating advanceToNextClip)
			clipIndex++

			// Scoreboard complete - where does it go?
			advance('SCOREBOARD_COMPLETE', { currentClipIndex: clipIndex, currentFilmIndex: filmIndex })
		}

		// Clips 1 and 2 (indices 0 and 1, become 1 and 2 after increment)
		completeClipCycle()
		expect(currentPhase).toBe('clip_intro')

		completeClipCycle()
		expect(currentPhase).toBe('clip_intro')

		// Clip 3 (index 2, becomes 3 after increment) - should go to film_title_collection
		completeClipCycle()
		expect(currentPhase).toBe('film_title_collection')

		// Film title round
		advance('ALL_ANSWERS_RECEIVED')
		expect(currentPhase).toBe('film_title_voting')

		advance('ALL_VOTES_RECEIVED')
		expect(currentPhase).toBe('film_title_results')

		advance('FILM_TITLE_RESULTS_COMPLETE')
		expect(currentPhase).toBe('final_montage')

		advance('MONTAGE_COMPLETE')
		expect(currentPhase).toBe('next_film_or_end')

		// Increment film index (simulating advanceToNextFilm)
		filmIndex++
		clipIndex = 0

		// Check next film (we're now on film index 1)
		advance('NEXT_FILM_CHECK', { currentClipIndex: clipIndex, currentFilmIndex: filmIndex })
		expect(currentPhase).toBe('clip_intro')

		// We've validated the full film 1 flow + transition to film 2
		console.log('Phases traversed:', phases.length)
	})

	it('handles timeout events correctly', () => {
		let phase: GamePhase = 'answer_collection'

		// Answer timeout should work
		let result = transition(phase, 'ANSWER_TIMEOUT')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('voting_playback')

		// Voting timeout should work
		phase = 'voting_collection'
		result = transition(phase, 'VOTING_TIMEOUT')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('results_display')

		// Film title voting timeout should go to film_title_results, NOT results_display
		phase = 'film_title_voting'
		result = transition(phase, 'VOTING_TIMEOUT')
		expect(result.valid).toBe(true)
		expect(result.nextPhase).toBe('film_title_results')
	})
})
