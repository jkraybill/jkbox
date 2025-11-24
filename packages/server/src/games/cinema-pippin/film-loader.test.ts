import { describe, it, expect } from 'vitest'
import { loadFilms, loadClipsFromSequence } from './film-loader'

describe('film-loader', () => {
	describe('loadFilms', () => {
		it('should select 3 unique films', () => {
			const films = loadFilms()
			expect(films).toHaveLength(3)

			// Check all films are unique
			const filmNames = films.map((f) => f.filmName)
			const uniqueNames = new Set(filmNames)
			expect(uniqueNames.size).toBe(3)
		})

		it('should have valid film structure', () => {
			const films = loadFilms()

			films.forEach((film) => {
				expect(film.filmName).toBeTruthy()
				expect(film.sequenceNumber).toBeGreaterThanOrEqual(1)
				expect(film.clips).toHaveLength(3)

				film.clips.forEach((clip, index) => {
					expect(clip.clipNumber).toBe((index + 1) as 1 | 2 | 3)
					expect(clip.videoPath).toContain('.mp4')
					expect(clip.srtPath).toContain('.srt')
					expect(clip.srtPath).toContain('-question.srt')
					// At least 3 precomputed answers (may have more from AI generation over time)
					expect(clip.precomputedAnswers.length).toBeGreaterThanOrEqual(3)
					// Verify each answer is a non-empty string
					clip.precomputedAnswers.forEach((answer) => {
						expect(typeof answer).toBe('string')
						expect(answer.length).toBeGreaterThan(0)
					})
				})
			})
		})
	})

	describe('loadClipsFromSequence', () => {
		it('should load all 3 clips with correct paths', () => {
			const filmName = 'day-for-night-1973-francois-truffaut-1080p-brrip-x264-classics'
			const sequenceNumber = 3

			const clips = loadClipsFromSequence(filmName, sequenceNumber)

			expect(clips).toHaveLength(3)
			expect(clips[0].clipNumber).toBe(1)
			expect(clips[1].clipNumber).toBe(2)
			expect(clips[2].clipNumber).toBe(3)

			clips.forEach((clip) => {
				expect(clip.videoPath).toContain(filmName)
				expect(clip.videoPath).toContain(`-${clip.clipNumber}-question.mp4`)
				expect(clip.srtPath).toContain(`-${clip.clipNumber}-question.srt`)
				// At least 3 precomputed answers
				expect(clip.precomputedAnswers.length).toBeGreaterThanOrEqual(3)
			})
		})
	})
})
