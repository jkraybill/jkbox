/**
 * Cinema Pippin - Film Loader
 * Loads film clips from /home/jk/jkbox/generated/clips
 */

import * as fs from 'fs'
import * as path from 'path'
import type { FilmData, ClipData, ClipNumber } from './types'

const CLIPS_ROOT = '/home/jk/jkbox/generated/clips'

/**
 * Get all available film directories
 */
export function getAvailableFilms(): string[] {
	const entries = fs.readdirSync(CLIPS_ROOT, { withFileTypes: true })
	return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

/**
 * Get available sequence numbers for a film
 */
export function getAvailableSequences(filmName: string): number[] {
	const filmPath = path.join(CLIPS_ROOT, filmName)
	const entries = fs.readdirSync(filmPath, { withFileTypes: true })
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => parseInt(entry.name, 10))
		.filter((num) => !isNaN(num))
		.sort((a, b) => a - b)
}

/**
 * Load answers.json from a clip sequence folder
 */
export function loadAnswersJSON(filmName: string, sequenceNumber: number): string[][] {
	const answersPath = path.join(CLIPS_ROOT, filmName, sequenceNumber.toString(), 'answers.json')
	const fileContent = fs.readFileSync(answersPath, 'utf-8')
	const data = JSON.parse(fileContent) as { answers: string[][] }
	return data.answers
}

/**
 * Load all clips from a sequence folder
 */
export function loadClipsFromSequence(filmName: string, sequenceNumber: number): ClipData[] {
	const sequencePath = path.join(CLIPS_ROOT, filmName, sequenceNumber.toString())
	const files = fs.readdirSync(sequencePath)

	// Load precomputed answers
	const precomputedAnswers = loadAnswersJSON(filmName, sequenceNumber)

	// Find video files for each clip (1, 2, 3)
	const clips: ClipData[] = []

	for (let clipNum = 1; clipNum <= 3; clipNum++) {
		const clipNumber = clipNum as ClipNumber

		// Find video file: *-1-question.mp4
		const videoFile = files.find(
			(f) => f.includes(`-${clipNum}-question.mp4`) || f.includes(`-${clipNum}-question.mkv`)
		)
		if (!videoFile) {
			throw new Error(`Missing video file for clip ${clipNum} in ${filmName}/${sequenceNumber}`)
		}

		// Find SRT file: *-1-question.srt
		const srtFile = files.find((f) => f.includes(`-${clipNum}-question.srt`))
		if (!srtFile) {
			throw new Error(`Missing SRT file for clip ${clipNum} in ${filmName}/${sequenceNumber}`)
		}

		clips.push({
			clipNumber,
			videoPath: path.join(sequencePath, videoFile),
			srtPath: path.join(sequencePath, srtFile),
			precomputedAnswers: precomputedAnswers[clipNum - 1]
		})
	}

	return clips
}

/**
 * Load 3 random films with random sequences
 */
export function loadFilms(): FilmData[] {
	const availableFilms = getAvailableFilms()

	if (availableFilms.length < 3) {
		throw new Error(`Not enough films available (need 3, found ${availableFilms.length})`)
	}

	// Shuffle and take 3
	const shuffled = [...availableFilms].sort(() => Math.random() - 0.5)
	const selectedFilms = shuffled.slice(0, 3)

	// Load clips for each film
	return selectedFilms.map((filmName) => {
		const availableSequences = getAvailableSequences(filmName)
		if (availableSequences.length === 0) {
			throw new Error(`No sequences found for film: ${filmName}`)
		}

		// Random sequence
		const sequenceNumber = availableSequences[Math.floor(Math.random() * availableSequences.length)]

		return {
			filmName,
			sequenceNumber,
			clips: loadClipsFromSequence(filmName, sequenceNumber)
		}
	})
}
