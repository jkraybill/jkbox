import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'
import type { GameModuleMetadata } from '@jkbox/shared'

describe('CinemaPippinGame', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame()
	})

	describe('getMetadata', () => {
		it('should return correct metadata', () => {
			const metadata: GameModuleMetadata = game.getMetadata()

			expect(metadata.id).toBe('cinema-pippin')
			expect(metadata.name).toBe('Cinema Pippin')
			expect(metadata.minPlayers).toBe(2)
			expect(metadata.maxPlayers).toBe(20)
			expect(metadata.description).toContain('foreign film')
		})
	})

	describe('initialize', () => {
		it('should initialize with 3 films', () => {
			game.initialize([])

			const state = game.getState()
			expect(state.films).toHaveLength(3)
			expect(state.currentFilmIndex).toBe(0)
			expect(state.currentClipIndex).toBe(0)
			expect(state.phase).toBe('film_select')
		})

		it('should initialize scores for all players', () => {
			game.initialize(['p1', 'p2', 'p3'])

			const state = game.getState()
			expect(state.scores.get('p1')).toBe(0)
			expect(state.scores.get('p2')).toBe(0)
			expect(state.scores.get('p3')).toBe(0)
		})

		it('should load valid film clips', () => {
			game.initialize([])

			const state = game.getState()
			state.films.forEach((film) => {
				expect(film.clips).toHaveLength(3)
				film.clips.forEach((clip) => {
					expect(clip.videoPath).toBeTruthy()
					expect(clip.srtPath).toBeTruthy()
					expect(clip.precomputedAnswers).toHaveLength(3)
				})
			})
		})
	})

	describe('getPhase', () => {
		it('should return current phase', () => {
			game.initialize([])
			expect(game.getPhase()).toBe('film_select')
		})
	})

	describe('getCurrentFilm', () => {
		it('should return current film', () => {
			game.initialize([])

			const film = game.getCurrentFilm()
			expect(film).toBeDefined()
			expect(film.clips).toHaveLength(3)
		})
	})

	describe('getCurrentClip', () => {
		it('should return current clip', () => {
			game.initialize([])

			const clip = game.getCurrentClip()
			expect(clip).toBeDefined()
			expect(clip.clipNumber).toBe(1)
		})
	})

	describe('advancePhase', () => {
		it('should advance from film_select to clip_intro', () => {
			game.initialize([])
			expect(game.getPhase()).toBe('film_select')

			game.advancePhase()
			expect(game.getPhase()).toBe('clip_intro')
		})

		it('should advance through all clip phases', () => {
			game.initialize([])

			const phases = [
				'film_select',
				'clip_intro',
				'clip_playback',
				'answer_collection',
				'voting_playback',
				'voting_collection',
				'results_display'
			]

			phases.forEach((expectedPhase) => {
				expect(game.getPhase()).toBe(expectedPhase)
				game.advancePhase()
			})
		})
	})

	describe('advanceToNextClip', () => {
		it('should advance from C1 to C2', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro

			const stateBefore = game.getState()
			expect(stateBefore.currentClipIndex).toBe(0)

			game.advanceToNextClip()

			const stateAfter = game.getState()
			expect(stateAfter.currentClipIndex).toBe(1)
			expect(stateAfter.phase).toBe('clip_intro')
		})

		it('should advance from C2 to C3', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro
			game.advanceToNextClip() // to C2

			const stateBefore = game.getState()
			expect(stateBefore.currentClipIndex).toBe(1)

			game.advanceToNextClip()

			const stateAfter = game.getState()
			expect(stateAfter.currentClipIndex).toBe(2)
		})

		it('should advance from C3 to film title round', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro
			game.advanceToNextClip() // to C2
			game.advanceToNextClip() // to C3

			const stateBefore = game.getState()
			expect(stateBefore.currentClipIndex).toBe(2)

			game.advanceToNextClip()

			const stateAfter = game.getState()
			expect(stateAfter.phase).toBe('film_title_collection')
		})
	})

	describe('advanceToNextFilm', () => {
		it('should advance from film 1 to film 2', () => {
			game.initialize([])

			const stateBefore = game.getState()
			expect(stateBefore.currentFilmIndex).toBe(0)

			game.advanceToNextFilm()

			const stateAfter = game.getState()
			expect(stateAfter.currentFilmIndex).toBe(1)
			expect(stateAfter.currentClipIndex).toBe(0)
			expect(stateAfter.phase).toBe('clip_intro')
		})

		it('should advance from film 2 to film 3', () => {
			game.initialize([])
			game.advanceToNextFilm() // to film 2

			const stateBefore = game.getState()
			expect(stateBefore.currentFilmIndex).toBe(1)

			game.advanceToNextFilm()

			const stateAfter = game.getState()
			expect(stateAfter.currentFilmIndex).toBe(2)
		})

		it('should transition to final_scores after film 3', () => {
			game.initialize([])
			game.advanceToNextFilm() // to film 2
			game.advanceToNextFilm() // to film 3

			const stateBefore = game.getState()
			expect(stateBefore.currentFilmIndex).toBe(2)

			game.advanceToNextFilm()

			const stateAfter = game.getState()
			expect(stateAfter.phase).toBe('final_scores')
		})
	})
})
