import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadFilms, selectRandomFilms } from './film-loader'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

vi.mock('node:fs/promises')

describe('Film Loader', () => {
	const CLIPS_DIR = '/test/clips'

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('loadFilms', () => {
		it('should load all available films from directory', async () => {
			// Mock directory structure
			vi.mocked(fs.readdir).mockResolvedValueOnce([
				'malena-2000',
				'bellissima-1952',
				'bicycle-thieves-1948'
			] as any)

			// Mock sequence directories for each film
			vi.mocked(fs.readdir)
				.mockResolvedValueOnce(['1', '2', '3', '4', '5', '6'] as any) // malena
				.mockResolvedValueOnce(['1', '2', '3', '4', '5', '6'] as any) // bellissima
				.mockResolvedValueOnce(['1', '2', '3', '4', '5', '6'] as any) // bicycle

			// Mock stats to verify directories
			vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)

			const films = await loadFilms(CLIPS_DIR)

			expect(films).toHaveLength(3)
			expect(films[0]).toMatchObject({
				filmName: 'malena-2000',
				sequenceCounts: 6
			})
		})

		it('should handle films with different sequence counts', async () => {
			vi.mocked(fs.readdir).mockResolvedValueOnce(['film-a', 'film-b'] as any)

			vi.mocked(fs.readdir)
				.mockResolvedValueOnce(['1', '2', '3'] as any) // film-a: 3 sequences
				.mockResolvedValueOnce(['1', '2', '3', '4', '5', '6'] as any) // film-b: 6 sequences

			vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any)

			const films = await loadFilms(CLIPS_DIR)

			expect(films).toHaveLength(2)
			expect(films[0].sequenceCounts).toBe(3)
			expect(films[1].sequenceCounts).toBe(6)
		})

		it('should skip non-directory entries', async () => {
			vi.mocked(fs.readdir).mockResolvedValueOnce([
				'malena-2000',
				'README.md' // File, not directory
			] as any)

			vi.mocked(fs.readdir).mockResolvedValueOnce(['1', '2'] as any)

			const isDirectoryMock = vi.fn()
			isDirectoryMock.mockReturnValueOnce(true) // malena-2000 is dir
			isDirectoryMock.mockReturnValueOnce(false) // README.md is file

			vi.mocked(fs.stat).mockImplementation(
				async () =>
					({
						isDirectory: isDirectoryMock
					}) as any
			)

			const films = await loadFilms(CLIPS_DIR)

			expect(films).toHaveLength(1)
			expect(films[0].filmName).toBe('malena-2000')
		})
	})

	describe('selectRandomFilms', () => {
		it('should select 3 unique random films', () => {
			const availableFilms = [
				{ filmName: 'film-a', sequenceCounts: 6 },
				{ filmName: 'film-b', sequenceCounts: 6 },
				{ filmName: 'film-c', sequenceCounts: 6 },
				{ filmName: 'film-d', sequenceCounts: 6 },
				{ filmName: 'film-e', sequenceCounts: 6 }
			]

			const selected = selectRandomFilms(availableFilms, 3)

			expect(selected).toHaveLength(3)

			// Check uniqueness
			const filmNames = selected.map((f) => f.filmName)
			const uniqueNames = new Set(filmNames)
			expect(uniqueNames.size).toBe(3)
		})

		it('should select random sequence for each film', () => {
			const availableFilms = [
				{ filmName: 'film-a', sequenceCounts: 6 },
				{ filmName: 'film-b', sequenceCounts: 4 },
				{ filmName: 'film-c', sequenceCounts: 3 }
			]

			const selected = selectRandomFilms(availableFilms, 3)

			// Verify each film has a sequence number within its valid range
			selected.forEach((film) => {
				const originalFilm = availableFilms.find((f) => f.filmName === film.filmName)
				expect(originalFilm).toBeDefined()
				expect(film.sequenceNumber).toBeGreaterThanOrEqual(1)
				expect(film.sequenceNumber).toBeLessThanOrEqual(originalFilm!.sequenceCounts)
			})
		})

		it('should throw if not enough films available', () => {
			const availableFilms = [
				{ filmName: 'film-a', sequenceCounts: 6 },
				{ filmName: 'film-b', sequenceCounts: 6 }
			]

			expect(() => selectRandomFilms(availableFilms, 3)).toThrow('Not enough films')
		})

		it('should load clip data for selected films', async () => {
			const availableFilms = [{ filmName: 'malena-2000', sequenceCounts: 6 }]

			const selected = selectRandomFilms(availableFilms, 1, CLIPS_DIR)

			// Mock answers.json file
			vi.mocked(fs.readFile).mockResolvedValue(
				JSON.stringify({
					answers: [
						['word1', 'word2', 'word3'],
						['phrase1', 'phrase2', 'phrase3'],
						['phrase4', 'phrase5', 'phrase6']
					]
				})
			)

			const filmsWithClips = await Promise.all(
				selected.map(async (film) => {
					const seqDir = path.join(CLIPS_DIR, film.filmName, film.sequenceNumber.toString())
					const answersPath = path.join(seqDir, 'answers.json')
					const answersData = JSON.parse(await fs.readFile(answersPath, 'utf-8'))

					return {
						...film,
						clips: [
							{
								clipNumber: 1 as const,
								videoPath: path.join(seqDir, `${film.filmName}-1-question.mp4`),
								srtPath: path.join(seqDir, `${film.filmName}-1-question.srt`),
								precomputedAnswers: answersData.answers[0]
							},
							{
								clipNumber: 2 as const,
								videoPath: path.join(seqDir, `${film.filmName}-2-question.mp4`),
								srtPath: path.join(seqDir, `${film.filmName}-2-question.srt`),
								precomputedAnswers: answersData.answers[1]
							},
							{
								clipNumber: 3 as const,
								videoPath: path.join(seqDir, `${film.filmName}-3-question.mp4`),
								srtPath: path.join(seqDir, `${film.filmName}-3-question.srt`),
								precomputedAnswers: answersData.answers[2]
							}
						]
					}
				})
			)

			expect(filmsWithClips[0].clips).toHaveLength(3)
			expect(filmsWithClips[0].clips[0].precomputedAnswers).toEqual(['word1', 'word2', 'word3'])
			expect(filmsWithClips[0].clips[1].precomputedAnswers).toEqual([
				'phrase1',
				'phrase2',
				'phrase3'
			])
		})
	})
})
