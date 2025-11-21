/**
 * Phase Transition Integration Tests
 * Tests that actions properly transition between game phases
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'

describe('Cinema Pippin Phase Transitions', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame()
	})

	describe('INTRO_COMPLETE action', () => {
		it('should transition from clip_intro to clip_playback', () => {
			// Initialize game
			game.initialize([])

			// Game starts in film_select, advance to clip_intro
			game.advancePhase()
			expect(game.getPhase()).toBe('clip_intro')

			// Send INTRO_COMPLETE action
			const action = {
				type: 'INTRO_COMPLETE',
				payload: {}
			}
			game.handlePlayerAction('jumbotron', action)

			// Should now be in clip_playback
			expect(game.getPhase()).toBe('clip_playback')
		})

		it('should not transition if not in clip_intro phase', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro
			game.advancePhase() // to clip_playback

			expect(game.getPhase()).toBe('clip_playback')

			// Try to send INTRO_COMPLETE while in clip_playback
			game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })

			// Should still be in clip_playback
			expect(game.getPhase()).toBe('clip_playback')
		})
	})

	describe('VIDEO_COMPLETE action', () => {
		it('should transition from clip_playback to answer_collection', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro
			game.advancePhase() // to clip_playback

			expect(game.getPhase()).toBe('clip_playback')

			// Send VIDEO_COMPLETE action
			game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })

			// Should now be in answer_collection
			expect(game.getPhase()).toBe('answer_collection')
		})
	})

	describe('SUBMIT_ANSWER action', () => {
		it('should store player answer', () => {
			game.initialize(['player1', 'player2'])

			const action = {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'This is my funny answer!' }
			}

			game.handlePlayerAction('player1', action)

			const state = game.getState()
			expect(state.playerAnswers.get('player1')).toBe('This is my funny answer!')
		})

		it('should allow multiple players to submit answers', () => {
			game.initialize(['player1', 'player2', 'player3'])

			game.handlePlayerAction('player1', {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'Answer 1' }
			})

			game.handlePlayerAction('player2', {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'Answer 2' }
			})

			game.handlePlayerAction('player3', {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'Answer 3' }
			})

			const state = game.getState()
			expect(state.playerAnswers.size).toBe(3)
			expect(state.playerAnswers.get('player1')).toBe('Answer 1')
			expect(state.playerAnswers.get('player2')).toBe('Answer 2')
			expect(state.playerAnswers.get('player3')).toBe('Answer 3')
		})
	})

	describe('Unknown action', () => {
		it('should not crash on unknown action type', () => {
			game.initialize([])

			expect(() => {
				game.handlePlayerAction('player1', {
					type: 'UNKNOWN_ACTION',
					payload: {}
				})
			}).not.toThrow()
		})
	})

	describe('Full flow simulation', () => {
		it('should handle complete clip cycle', () => {
			game.initialize(['player1', 'player2'])

			// Start: film_select
			expect(game.getPhase()).toBe('film_select')

			// Advance to clip_intro
			game.advancePhase()
			expect(game.getPhase()).toBe('clip_intro')

			// Jumbotron sends INTRO_COMPLETE after 3 seconds
			game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
			expect(game.getPhase()).toBe('clip_playback')

			// Video finishes, jumbotron sends VIDEO_COMPLETE
			game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
			expect(game.getPhase()).toBe('answer_collection')

			// Players submit answers
			game.handlePlayerAction('player1', {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'Player 1 answer' }
			})
			game.handlePlayerAction('player2', {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'Player 2 answer' }
			})

			const state = game.getState()
			expect(state.playerAnswers.size).toBe(2)
		})
	})
})
