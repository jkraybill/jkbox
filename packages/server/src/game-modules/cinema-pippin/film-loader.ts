import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { FilmData, ClipData } from './types'

interface AvailableFilm {
	filmName: string
	sequenceCounts: number
}

interface SelectedFilm extends AvailableFilm {
	sequenceNumber: number
}

/**
 * Load all available films from the clips directory
 * @param clipsDir - Path to generated/clips directory
 * @returns List of available films with sequence counts
 */
export async function loadFilms(clipsDir: string): Promise<AvailableFilm[]> {
	const entries = await fs.readdir(clipsDir)
	const films: AvailableFilm[] = []

	for (const entry of entries) {
		const entryPath = path.join(clipsDir, entry)
		const stat = await fs.stat(entryPath)

		if (!stat.isDirectory()) {
			continue
		}

		// Count sequence directories (1, 2, 3, 4, 5, 6)
		const sequences = await fs.readdir(entryPath)
		const sequenceDirs = sequences.filter((s) => /^\d+$/.test(s))

		films.push({
			filmName: entry,
			sequenceCounts: sequenceDirs.length
		})
	}

	return films
}

/**
 * Select N unique random films and pick a random sequence for each
 * @param availableFilms - List of available films
 * @param count - Number of films to select (default: 3)
 * @param clipsDir - Optional clips directory for loading clip data
 * @returns Selected films with random sequences
 */
export function selectRandomFilms(
	availableFilms: AvailableFilm[],
	count: number = 3,
	_clipsDir?: string
): SelectedFilm[] {
	if (availableFilms.length < count) {
		throw new Error(`Not enough films available. Need ${count}, have ${availableFilms.length}`)
	}

	// Shuffle and select
	const shuffled = [...availableFilms].sort(() => Math.random() - 0.5)
	const selected = shuffled.slice(0, count)

	// Pick random sequence for each
	return selected.map((film) => ({
		...film,
		sequenceNumber: Math.floor(Math.random() * film.sequenceCounts) + 1
	}))
}

/**
 * Load complete film data including clip assets
 * @param selectedFilms - Films with selected sequences
 * @param clipsDir - Path to generated/clips directory
 * @returns Complete film data with clip information
 */
export async function loadFilmClips(
	selectedFilms: SelectedFilm[],
	clipsDir: string
): Promise<FilmData[]> {
	return Promise.all(
		selectedFilms.map(async (film) => {
			const seqDir = path.join(clipsDir, film.filmName, film.sequenceNumber.toString())
			const answersPath = path.join(seqDir, 'answers.json')

			// Load precomputed answers
			const answersRaw = await fs.readFile(answersPath, 'utf-8')
			const answersData = JSON.parse(answersRaw) as { answers: string[][] }

			const clips: ClipData[] = [
				{
					clipNumber: 1,
					videoPath: path.join(seqDir, `${film.filmName}-1-question.mp4`),
					srtPath: path.join(seqDir, `${film.filmName}-1-question.srt`),
					precomputedAnswers: answersData.answers[0] as string[]
				},
				{
					clipNumber: 2,
					videoPath: path.join(seqDir, `${film.filmName}-2-question.mp4`),
					srtPath: path.join(seqDir, `${film.filmName}-2-question.srt`),
					precomputedAnswers: answersData.answers[1] as string[]
				},
				{
					clipNumber: 3,
					videoPath: path.join(seqDir, `${film.filmName}-3-question.mp4`),
					srtPath: path.join(seqDir, `${film.filmName}-3-question.srt`),
					precomputedAnswers: answersData.answers[2] as string[]
				}
			]

			return {
				filmName: film.filmName,
				sequenceNumber: film.sequenceNumber,
				clips
			}
		})
	)
}
