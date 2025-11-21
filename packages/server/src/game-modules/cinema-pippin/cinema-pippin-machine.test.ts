import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { cinemaPippinMachine } from './cinema-pippin-machine'
import type { FilmData } from './types'

describe('Cinema Pippin State Machine', () => {
	const mockFilms: FilmData[] = [
		{
			filmName: 'test-film-1',
			sequenceNumber: 1,
			clips: [
				{
					clipNumber: 1,
					videoPath: '/test/1-question.mp4',
					srtPath: '/test/1-question.srt',
					precomputedAnswers: ['word1', 'word2', 'word3']
				},
				{
					clipNumber: 2,
					videoPath: '/test/2-question.mp4',
					srtPath: '/test/2-question.srt',
					precomputedAnswers: ['phrase1', 'phrase2', 'phrase3']
				},
				{
					clipNumber: 3,
					videoPath: '/test/3-question.mp4',
					srtPath: '/test/3-question.srt',
					precomputedAnswers: ['phrase4', 'phrase5', 'phrase6']
				}
			]
		}
	]

	describe('Initial State', () => {
		it('should start in film_select state', () => {
			const actor = createActor(cinemaPippinMachine, {
				input: { films: mockFilms }
			})
			actor.start()

			expect(actor.getSnapshot().value).toBe('film_select')
		})

		it('should initialize context with films', () => {
			const actor = createActor(cinemaPippinMachine, {
				input: { films: mockFilms }
			})
			actor.start()

			const context = actor.getSnapshot().context
			expect(context.films).toEqual(mockFilms)
			expect(context.currentFilmIndex).toBe(0)
			expect(context.currentClipIndex).toBe(0)
		})
	})

	describe('State Transitions', () => {
		it('should transition film_select → clip_intro → clip_playback', () => {
			const actor = createActor(cinemaPippinMachine, {
				input: { films: mockFilms }
			})
			actor.start()

			expect(actor.getSnapshot().value).toBe('film_select')

			actor.send({ type: 'FILM_SELECTED' })
			expect(actor.getSnapshot().value).toBe('clip_intro')

			actor.send({ type: 'INTRO_COMPLETE' })
			expect(actor.getSnapshot().value).toBe('clip_playback')
		})

		it('should transition through clip phases', () => {
			const actor = createActor(cinemaPippinMachine, {
				input: { films: mockFilms }
			})
			actor.start()

			// Navigate to clip_playback
			actor.send({ type: 'FILM_SELECTED' })
			actor.send({ type: 'INTRO_COMPLETE' })

			expect(actor.getSnapshot().value).toBe('clip_playback')

			actor.send({ type: 'PLAYBACK_COMPLETE' })
			expect(actor.getSnapshot().value).toBe('answer_collection')

			actor.send({ type: 'ANSWERS_COLLECTED' })
			expect(actor.getSnapshot().value).toBe('voting_playback')

			actor.send({ type: 'VOTING_PLAYBACK_COMPLETE' })
			expect(actor.getSnapshot().value).toBe('voting_collection')

			actor.send({ type: 'VOTES_COLLECTED' })
			expect(actor.getSnapshot().value).toBe('results_display')
		})

		it('should advance to next clip after results', () => {
			const actor = createActor(cinemaPippinMachine, {
				input: { films: mockFilms }
			})
			actor.start()

			// Complete first clip cycle
			actor.send({ type: 'FILM_SELECTED' })
			actor.send({ type: 'INTRO_COMPLETE' })
			actor.send({ type: 'PLAYBACK_COMPLETE' })
			actor.send({ type: 'ANSWERS_COLLECTED' })
			actor.send({ type: 'VOTING_PLAYBACK_COMPLETE' })
			actor.send({ type: 'VOTES_COLLECTED' })

			expect(actor.getSnapshot().value).toBe('results_display')

			actor.send({ type: 'RESULTS_SHOWN' })

			// Should go to clip_intro for clip 2
			expect(actor.getSnapshot().value).toBe('clip_intro')
			expect(actor.getSnapshot().context.currentClipIndex).toBe(1)
		})

		it('should transition to film_title_collection after 3 clips', () => {
			const actor = createActor(cinemaPippinMachine, {
				input: { films: mockFilms }
			})
			actor.start()

			// Complete 3 clips
			for (let i = 0; i < 3; i++) {
				actor.send({ type: 'FILM_SELECTED' })
				actor.send({ type: 'INTRO_COMPLETE' })
				actor.send({ type: 'PLAYBACK_COMPLETE' })
				actor.send({ type: 'ANSWERS_COLLECTED' })
				actor.send({ type: 'VOTING_PLAYBACK_COMPLETE' })
				actor.send({ type: 'VOTES_COLLECTED' })
				actor.send({ type: 'RESULTS_SHOWN' })
			}

			expect(actor.getSnapshot().value).toBe('film_title_collection')
		})

		it('should transition through film title voting', () => {
			const actor = createActor(cinemaPippinMachine, {
				input: { films: mockFilms }
			})
			actor.start()

			// Fast-forward to film_title_collection
			for (let i = 0; i < 3; i++) {
				actor.send({ type: 'FILM_SELECTED' })
				actor.send({ type: 'INTRO_COMPLETE' })
				actor.send({ type: 'PLAYBACK_COMPLETE' })
				actor.send({ type: 'ANSWERS_COLLECTED' })
				actor.send({ type: 'VOTING_PLAYBACK_COMPLETE' })
				actor.send({ type: 'VOTES_COLLECTED' })
				actor.send({ type: 'RESULTS_SHOWN' })
			}

			expect(actor.getSnapshot().value).toBe('film_title_collection')

			actor.send({ type: 'FILM_TITLES_COLLECTED' })
			expect(actor.getSnapshot().value).toBe('film_title_voting')

			actor.send({ type: 'FILM_TITLE_VOTES_COLLECTED' })
			expect(actor.getSnapshot().value).toBe('film_title_results')

			actor.send({ type: 'FILM_TITLE_RESULTS_SHOWN' })
			expect(actor.getSnapshot().value).toBe('final_montage')
		})
	})

	describe('Film Progression', () => {
		it('should cycle through 3 films before final_scores', () => {
			const threeFilms: FilmData[] = [mockFilms[0], mockFilms[0], mockFilms[0]]

			const actor = createActor(cinemaPippinMachine, {
				input: { films: threeFilms }
			})
			actor.start()

			// Complete film 1
			for (let clip = 0; clip < 3; clip++) {
				actor.send({ type: 'FILM_SELECTED' })
				actor.send({ type: 'INTRO_COMPLETE' })
				actor.send({ type: 'PLAYBACK_COMPLETE' })
				actor.send({ type: 'ANSWERS_COLLECTED' })
				actor.send({ type: 'VOTING_PLAYBACK_COMPLETE' })
				actor.send({ type: 'VOTES_COLLECTED' })
				actor.send({ type: 'RESULTS_SHOWN' })
			}

			// Film title flow
			actor.send({ type: 'FILM_TITLES_COLLECTED' })
			actor.send({ type: 'FILM_TITLE_VOTES_COLLECTED' })
			actor.send({ type: 'FILM_TITLE_RESULTS_SHOWN' })
			actor.send({ type: 'MONTAGE_COMPLETE' })

			expect(actor.getSnapshot().value).toBe('next_film_or_end')
			expect(actor.getSnapshot().context.currentFilmIndex).toBe(0)

			actor.send({ type: 'NEXT_FILM' })

			// Should loop back to film_select for film 2
			expect(actor.getSnapshot().value).toBe('film_select')
			expect(actor.getSnapshot().context.currentFilmIndex).toBe(1)
			expect(actor.getSnapshot().context.currentClipIndex).toBe(0)
		})

		it('should transition to final_scores after 3 films', () => {
			const threeFilms: FilmData[] = [mockFilms[0], mockFilms[0], mockFilms[0]]

			const actor = createActor(cinemaPippinMachine, {
				input: { films: threeFilms }
			})
			actor.start()

			// Complete all 3 films
			for (let filmIdx = 0; filmIdx < 3; filmIdx++) {
				for (let clip = 0; clip < 3; clip++) {
					actor.send({ type: 'FILM_SELECTED' })
					actor.send({ type: 'INTRO_COMPLETE' })
					actor.send({ type: 'PLAYBACK_COMPLETE' })
					actor.send({ type: 'ANSWERS_COLLECTED' })
					actor.send({ type: 'VOTING_PLAYBACK_COMPLETE' })
					actor.send({ type: 'VOTES_COLLECTED' })
					actor.send({ type: 'RESULTS_SHOWN' })
				}

				actor.send({ type: 'FILM_TITLES_COLLECTED' })
				actor.send({ type: 'FILM_TITLE_VOTES_COLLECTED' })
				actor.send({ type: 'FILM_TITLE_RESULTS_SHOWN' })
				actor.send({ type: 'MONTAGE_COMPLETE' })

				if (filmIdx < 2) {
					actor.send({ type: 'NEXT_FILM' })
				} else {
					actor.send({ type: 'END_GAME' })
				}
			}

			expect(actor.getSnapshot().value).toBe('final_scores')
		})

		it('should transition to end_game_vote after final scores', () => {
			const threeFilms: FilmData[] = [mockFilms[0], mockFilms[0], mockFilms[0]]

			const actor = createActor(cinemaPippinMachine, {
				input: { films: threeFilms }
			})
			actor.start()

			// Navigate to final_scores (abbreviated)
			for (let filmIdx = 0; filmIdx < 3; filmIdx++) {
				for (let clip = 0; clip < 3; clip++) {
					actor.send({ type: 'FILM_SELECTED' })
					actor.send({ type: 'INTRO_COMPLETE' })
					actor.send({ type: 'PLAYBACK_COMPLETE' })
					actor.send({ type: 'ANSWERS_COLLECTED' })
					actor.send({ type: 'VOTING_PLAYBACK_COMPLETE' })
					actor.send({ type: 'VOTES_COLLECTED' })
					actor.send({ type: 'RESULTS_SHOWN' })
				}
				actor.send({ type: 'FILM_TITLES_COLLECTED' })
				actor.send({ type: 'FILM_TITLE_VOTES_COLLECTED' })
				actor.send({ type: 'FILM_TITLE_RESULTS_SHOWN' })
				actor.send({ type: 'MONTAGE_COMPLETE' })

				if (filmIdx < 2) {
					actor.send({ type: 'NEXT_FILM' })
				} else {
					actor.send({ type: 'END_GAME' })
				}
			}

			expect(actor.getSnapshot().value).toBe('final_scores')

			actor.send({ type: 'FINAL_SCORES_SHOWN' })
			expect(actor.getSnapshot().value).toBe('end_game_vote')
		})
	})
})
