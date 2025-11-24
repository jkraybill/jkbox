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

	describe('FILM_SELECT_COMPLETE action', () => {
		it('should transition from film_select to clip_intro', () => {
			game.initialize([])

			// Game starts in film_select
			expect(game.getPhase()).toBe('film_select')

			// Jumbotron sends FILM_SELECT_COMPLETE after showing "Selecting films..."
			game.handlePlayerAction('jumbotron', { type: 'FILM_SELECT_COMPLETE', payload: {} })

			// Should now be in clip_intro
			expect(game.getPhase()).toBe('clip_intro')
		})

		it('should not transition if not in film_select phase', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro

			expect(game.getPhase()).toBe('clip_intro')

			// Try to send FILM_SELECT_COMPLETE while in clip_intro
			game.handlePlayerAction('jumbotron', { type: 'FILM_SELECT_COMPLETE', payload: {} })

			// Should still be in clip_intro
			expect(game.getPhase()).toBe('clip_intro')
		})
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

	describe('advancePhase', () => {
		it('should advance through all phase transitions correctly', () => {
			game.initialize([])

			// Test each phase transition
			expect(game.getPhase()).toBe('film_select')
			game.advancePhase()
			expect(game.getPhase()).toBe('clip_intro')

			game.advancePhase()
			expect(game.getPhase()).toBe('clip_playback')

			game.advancePhase()
			expect(game.getPhase()).toBe('answer_collection')

			game.advancePhase()
			expect(game.getPhase()).toBe('voting_playback')

			game.advancePhase()
			expect(game.getPhase()).toBe('voting_collection')

			game.advancePhase()
			expect(game.getPhase()).toBe('results_display')

			// Note: results_display normally goes to clip_intro
			// but advanceToNextClip() would override to film_title_collection after 3 clips
			game.advancePhase()
			expect(game.getPhase()).toBe('clip_intro')
		})

		it('should advance through film title round phases', () => {
			game.initialize([])
			game.setState({ ...game.getState(), phase: 'film_title_collection' })

			expect(game.getPhase()).toBe('film_title_collection')
			game.advancePhase()
			expect(game.getPhase()).toBe('film_title_voting')

			game.advancePhase()
			expect(game.getPhase()).toBe('film_title_results')

			game.advancePhase()
			expect(game.getPhase()).toBe('final_montage')

			game.advancePhase()
			expect(game.getPhase()).toBe('next_film_or_end')
		})

		it('should advance through end game phases', () => {
			game.initialize([])
			game.setState({ ...game.getState(), phase: 'final_scores' })

			expect(game.getPhase()).toBe('final_scores')
			game.advancePhase()
			expect(game.getPhase()).toBe('end_game_vote')

			game.advancePhase()
			expect(game.getPhase()).toBe('film_select')
		})
	})

	describe('advanceToNextClip', () => {
		it('should advance to next clip when not at clip 3', () => {
			game.initialize([])
			const state = game.getState()
			expect(state.currentClipIndex).toBe(0)

			game.advanceToNextClip()
			expect(game.getState().currentClipIndex).toBe(1)
			expect(game.getPhase()).toBe('clip_intro')

			game.advanceToNextClip()
			expect(game.getState().currentClipIndex).toBe(2)
			expect(game.getPhase()).toBe('clip_intro')
		})

		it('should advance to film_title_collection after 3rd clip', () => {
			game.initialize([])
			const state = game.getState()

			// Manually set to 2nd clip (0-indexed, so this is the 3rd clip)
			state.currentClipIndex = 2

			game.advanceToNextClip()
			expect(game.getState().currentClipIndex).toBe(3)
			expect(game.getPhase()).toBe('film_title_collection')
		})
	})

	describe('advanceToNextFilm', () => {
		it('should advance to next film when not at film 3', () => {
			game.initialize([])
			const state = game.getState()
			expect(state.currentFilmIndex).toBe(0)
			expect(state.currentClipIndex).toBe(0)

			game.advanceToNextFilm()
			expect(game.getState().currentFilmIndex).toBe(1)
			expect(game.getState().currentClipIndex).toBe(0) // Reset to first clip
			expect(game.getPhase()).toBe('clip_intro')
		})

		it('should advance to final_scores after 3rd film', () => {
			game.initialize([])
			const state = game.getState()
			state.currentFilmIndex = 2 // 3rd film (0-indexed)

			game.advanceToNextFilm()
			expect(game.getState().currentFilmIndex).toBe(3)
			expect(game.getPhase()).toBe('final_scores')
		})

		it('should reset clip index when advancing films', () => {
			game.initialize([])
			const state = game.getState()
			state.currentClipIndex = 2
			state.currentFilmIndex = 0

			game.advanceToNextFilm()
			expect(game.getState().currentClipIndex).toBe(0)
			expect(game.getState().currentFilmIndex).toBe(1)
		})
	})

	describe('Full flow simulation', () => {
		it('should handle complete clip cycle', () => {
			game.initialize(['player1', 'player2'])

			// Start: film_select
			expect(game.getPhase()).toBe('film_select')

			// Jumbotron auto-advances from film_select after 2 seconds
			game.handlePlayerAction('jumbotron', { type: 'FILM_SELECT_COMPLETE', payload: {} })
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

		it('should handle complete 3-clip game flow', () => {
			game.initialize(['player1', 'player2'])
			expect(game.getPhase()).toBe('film_select')

			// Auto-advance from film_select
			game.handlePlayerAction('jumbotron', { type: 'FILM_SELECT_COMPLETE', payload: {} })
			expect(game.getPhase()).toBe('clip_intro')

			// Clip 1
			game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
			game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
			expect(game.getPhase()).toBe('answer_collection')

			// Advance through voting and results
			game.advancePhase() // voting_playback
			game.advancePhase() // voting_collection
			game.advancePhase() // results_display

			// Advance to next clip
			game.advanceToNextClip()
			expect(game.getPhase()).toBe('clip_intro')
			expect(game.getState().currentClipIndex).toBe(1)

			// Clip 2
			game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
			game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
			game.advancePhase() // voting_playback
			game.advancePhase() // voting_collection
			game.advancePhase() // results_display
			game.advanceToNextClip()
			expect(game.getState().currentClipIndex).toBe(2)

			// Clip 3
			game.handlePlayerAction('jumbotron', { type: 'INTRO_COMPLETE', payload: {} })
			game.handlePlayerAction('jumbotron', { type: 'VIDEO_COMPLETE', payload: {} })
			game.advancePhase() // voting_playback
			game.advancePhase() // voting_collection
			game.advancePhase() // results_display

			// After 3rd clip, should go to film title round
			game.advanceToNextClip()
			expect(game.getPhase()).toBe('film_title_collection')
		})

		it('should handle complete 3-film game flow', () => {
			game.initialize(['player1'])
			game.setState({ ...game.getState(), currentFilmIndex: 0 })

			// Complete film 1
			game.advanceToNextFilm()
			expect(game.getState().currentFilmIndex).toBe(1)
			expect(game.getPhase()).toBe('clip_intro')

			// Complete film 2
			game.advanceToNextFilm()
			expect(game.getState().currentFilmIndex).toBe(2)
			expect(game.getPhase()).toBe('clip_intro')

			// Complete film 3 - should go to final_scores
			game.advanceToNextFilm()
			expect(game.getState().currentFilmIndex).toBe(3)
			expect(game.getPhase()).toBe('final_scores')
		})
	})

	describe('State management', () => {
		it('should clear answers', () => {
			game.initialize(['player1', 'player2'])
			game.handlePlayerAction('player1', {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'Answer 1' }
			})
			game.handlePlayerAction('player2', {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'Answer 2' }
			})

			expect(game.getState().playerAnswers.size).toBe(2)

			game.clearAnswers()
			expect(game.getState().playerAnswers.size).toBe(0)
		})

		it('should get current film', () => {
			game.initialize([])
			const film = game.getCurrentFilm()
			expect(film).toBeDefined()
			expect(film.clips).toBeDefined()
			expect(film.clips.length).toBeGreaterThan(0)
		})

		it('should get current clip', () => {
			game.initialize([])
			const clip = game.getCurrentClip()
			expect(clip).toBeDefined()
			expect(clip.clipNumber).toBe(1) // First clip
		})
	})

	describe('SUBMIT_VOTE action', () => {
		it('should store vote during voting_collection phase', () => {
			game.initialize(['player1', 'player2'])

			// Advance to voting_collection
			const state = game.getState()
			state.phase = 'voting_collection'
			state.allAnswers = [
				{ id: 'answer-1', text: 'banana', authorId: 'player1', votedBy: [] },
				{ id: 'answer-2', text: 'rocket', authorId: 'player2', votedBy: [] }
			]
			game.setState(state)

			// Player1 votes for answer-2
			game.handlePlayerAction('player1', {
				type: 'SUBMIT_VOTE',
				payload: { answerId: 'answer-2' }
			})

			const updatedState = game.getState()
			expect(updatedState.votes.get('player1')).toBe('answer-2')
		})

		it('should auto-advance to results_display when all players vote', () => {
			game.initialize(['player1', 'player2'])

			// Advance to voting_collection
			const state = game.getState()
			state.phase = 'voting_collection'
			state.allAnswers = [
				{ id: 'answer-1', text: 'banana', authorId: 'player1', votedBy: [] },
				{ id: 'answer-2', text: 'rocket', authorId: 'player2', votedBy: [] }
			]
			game.setState(state)

			expect(game.getPhase()).toBe('voting_collection')

			// Player1 votes
			game.handlePlayerAction('player1', {
				type: 'SUBMIT_VOTE',
				payload: { answerId: 'answer-2' }
			})

			// Still in voting_collection (only 1/2 voted)
			expect(game.getPhase()).toBe('voting_collection')

			// Player2 votes
			game.handlePlayerAction('player2', {
				type: 'SUBMIT_VOTE',
				payload: { answerId: 'answer-1' }
			})

			// Should auto-advance to results_display
			expect(game.getPhase()).toBe('results_display')
		})

		it('should not advance if not all players voted', () => {
			game.initialize(['player1', 'player2', 'player3'])

			const state = game.getState()
			state.phase = 'voting_collection'
			state.allAnswers = [{ id: 'answer-1', text: 'banana', authorId: 'player1', votedBy: [] }]
			game.setState(state)

			// Only 2 out of 3 players vote
			game.handlePlayerAction('player1', {
				type: 'SUBMIT_VOTE',
				payload: { answerId: 'answer-1' }
			})
			game.handlePlayerAction('player2', {
				type: 'SUBMIT_VOTE',
				payload: { answerId: 'answer-1' }
			})

			// Should still be in voting_collection
			expect(game.getPhase()).toBe('voting_collection')
			expect(game.getState().votes.size).toBe(2)
		})

		it('should not process SUBMIT_VOTE when not in voting_collection phase', () => {
			game.initialize(['player1'])

			// In wrong phase
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.handlePlayerAction('player1', {
				type: 'SUBMIT_VOTE',
				payload: { answerId: 'answer-1' }
			})

			// Should not have stored vote
			expect(game.getState().votes.size).toBe(0)
		})

		it('should allow player to change their vote before all votes in', () => {
			game.initialize(['player1', 'player2'])

			const state = game.getState()
			state.phase = 'voting_collection'
			state.allAnswers = [
				{ id: 'answer-1', text: 'banana', authorId: 'player1', votedBy: [] },
				{ id: 'answer-2', text: 'rocket', authorId: 'player2', votedBy: [] }
			]
			game.setState(state)

			// Player1 votes for answer-2
			game.handlePlayerAction('player1', {
				type: 'SUBMIT_VOTE',
				payload: { answerId: 'answer-2' }
			})

			expect(game.getState().votes.get('player1')).toBe('answer-2')

			// Player1 changes vote to answer-1
			game.handlePlayerAction('player1', {
				type: 'SUBMIT_VOTE',
				payload: { answerId: 'answer-1' }
			})

			expect(game.getState().votes.get('player1')).toBe('answer-1')
		})
	})

	describe('RESULTS_COMPLETE action', () => {
		it('should advance to scoreboard_transition when results complete', () => {
			game.initialize(['player1'])
			const state = game.getState()
			state.phase = 'results_display'
			state.currentClipIndex = 0
			game.setState(state)

			game.handlePlayerAction('jumbotron', { type: 'RESULTS_COMPLETE', payload: {} })

			// Should advance to scoreboard_transition
			expect(game.getPhase()).toBe('scoreboard_transition')
		})

		it('should advance to next clip after scoreboard', () => {
			game.initialize(['player1'])
			const state = game.getState()
			state.phase = 'scoreboard_transition'
			state.currentClipIndex = 0
			game.setState(state)

			game.handlePlayerAction('jumbotron', { type: 'SCOREBOARD_COMPLETE', payload: {} })

			// Should advance to clip_intro for next clip
			expect(game.getPhase()).toBe('clip_intro')
			expect(game.getState().currentClipIndex).toBe(1)
		})

		it('should advance to film_title_collection after third clip scoreboard', () => {
			game.initialize(['player1'])
			const state = game.getState()
			state.phase = 'scoreboard_transition'
			state.currentClipIndex = 2 // Third clip (0-indexed)
			game.setState(state)

			game.handlePlayerAction('jumbotron', { type: 'SCOREBOARD_COMPLETE', payload: {} })

			expect(game.getPhase()).toBe('film_title_collection')
		})
	})

	describe('FILM_TITLE_RESULTS_COMPLETE action', () => {
		it('should advance to final_montage', () => {
			game.initialize(['player1'])
			const state = game.getState()
			state.phase = 'film_title_results'
			game.setState(state)

			game.handlePlayerAction('jumbotron', { type: 'FILM_TITLE_RESULTS_COMPLETE', payload: {} })

			expect(game.getPhase()).toBe('final_montage')
		})
	})

	describe('FINAL_SCORES_COMPLETE action', () => {
		it('should advance to end_game_vote', () => {
			game.initialize(['player1'])
			const state = game.getState()
			state.phase = 'final_scores'
			game.setState(state)

			game.handlePlayerAction('jumbotron', { type: 'FINAL_SCORES_COMPLETE', payload: {} })

			expect(game.getPhase()).toBe('end_game_vote')
		})
	})

	describe('MONTAGE_COMPLETE action', () => {
		it('should advance to next_film_or_end', () => {
			game.initialize(['player1'])
			const state = game.getState()
			state.phase = 'final_montage'
			game.setState(state)

			game.handlePlayerAction('jumbotron', { type: 'MONTAGE_COMPLETE', payload: {} })

			expect(game.getPhase()).toBe('next_film_or_end')
		})
	})

	describe('NEXT_FILM_CHECK action', () => {
		it('should advance to next film if more films remain', () => {
			game.initialize(['player1'])
			const state = game.getState()
			state.phase = 'next_film_or_end'
			state.currentFilmIndex = 0
			state.currentClipIndex = 2
			game.setState(state)

			game.handlePlayerAction('jumbotron', { type: 'NEXT_FILM_CHECK', payload: {} })

			// Should advance to next film
			expect(game.getPhase()).toBe('clip_intro')
			expect(game.getState().currentFilmIndex).toBe(1)
			expect(game.getState().currentClipIndex).toBe(0) // Reset to first clip
		})

		it('should advance to final_scores if all films complete', () => {
			game.initialize(['player1'])
			const state = game.getState()
			state.phase = 'next_film_or_end'
			state.currentFilmIndex = 2 // Third film (0-indexed)
			game.setState(state)

			game.handlePlayerAction('jumbotron', { type: 'NEXT_FILM_CHECK', payload: {} })

			// Should go to final scores
			expect(game.getPhase()).toBe('final_scores')
		})
	})
})
