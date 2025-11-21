/**
 * Cinema Pippin - SRT Subtitle Processor
 * Parse, merge, and manipulate SRT subtitle files
 */

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

		const index = parseInt(lines[0], 10)
		const timeLine = lines[1]
		const [startTime, endTime] = timeLine.split(' --> ')
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
	// Dynamic import to avoid bundling fs in client
	// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
	const fs = require('fs') as typeof import('fs')
	const content = fs.readFileSync(srtPath, 'utf-8')
	return parseSRT(content)
}
