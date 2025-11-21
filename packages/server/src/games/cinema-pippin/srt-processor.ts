/**
 * Cinema Pippin - SRT Subtitle Processor
 * Parse, merge, and manipulate SRT subtitle files
 */

import { readFileSync } from 'fs'

export interface Subtitle {
	index: number
	startTime: string // "00:00:01,000"
	endTime: string // "00:00:04,000"
	text: string
}

/**
 * Parse SRT file content into subtitle objects
 */
export function parseSRT(srtContent: string): Subtitle[] {
	const subtitles: Subtitle[] = []
	const blocks = srtContent.trim().split('\n\n')

	for (const block of blocks) {
		const lines = block.split('\n')
		if (lines.length < 3) continue

		const indexLine = lines[0]
		const timeLine = lines[1]
		if (!indexLine || !timeLine) continue

		const index = parseInt(indexLine, 10)
		const [startTime, endTime] = timeLine.split(' --> ')
		if (!startTime || !endTime) continue

		const text = lines.slice(2).join('\n')

		subtitles.push({
			index,
			startTime,
			endTime,
			text
		})
	}

	return subtitles
}

/**
 * Replace blank (_____ or ____ __ ____) with player answer
 */
export function mergeSRT(subtitles: Subtitle[], answer: string): Subtitle[] {
	return subtitles.map((sub) => ({
		...sub,
		text: sub.text.replace(/_{2,}(\s+_{2,})*/g, answer)
	}))
}

/**
 * Replace [keyword] with C1 winner keyword
 */
export function replaceKeyword(subtitles: Subtitle[], keyword: string): Subtitle[] {
	return subtitles.map((sub) => ({
		...sub,
		text: sub.text.replace(/\[keyword\]/g, keyword)
	}))
}

/**
 * Format subtitles back to SRT string
 */
export function formatSRT(subtitles: Subtitle[]): string {
	return (
		subtitles
			.map((sub) => {
				return `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}`
			})
			.join('\n\n') + '\n\n'
	)
}

/**
 * Read and parse SRT file
 */
export function loadSRT(srtPath: string): Subtitle[] {
	const content = readFileSync(srtPath, 'utf-8')
	return parseSRT(content)
}
