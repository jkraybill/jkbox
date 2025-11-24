/**
 * Cinema Pippin - SRT Subtitle Processor
 * Parse, merge, and manipulate SRT subtitle files
 */

import { readFileSync } from 'fs'
import { replaceKeywordPreservingCasing } from './casing-utils'
import { replaceBlankedText, splitLongLine, extendLastFrameTimestamp } from '@jkbox/cinema-pippin'

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

		// Split long lines (>60 chars) for better subtitle display
		const processedText = splitLongLine(text)

		subtitles.push({
			index,
			startTime,
			endTime,
			text: processedText
		})
	}

	return subtitles
}

/**
 * Replace blank (_____ or ____ __ ____) with player answer
 * Uses replaceBlankedText which:
 * - Replaces only first occurrence (F3 frame)
 * - Applies smart line splitting for long answers
 */
export function mergeSRT(subtitles: Subtitle[], answer: string): Subtitle[] {
	// Convert subtitles to SRT text format
	const srtText = subtitles
		.map((sub) => `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}`)
		.join('\n\n')

	// Replace blanks with answer (handles line splitting automatically)
	let replacedText = replaceBlankedText(srtText, answer)

	// Extend the last subtitle by 2 seconds to ensure player answers stay visible
	replacedText = extendLastFrameTimestamp(replacedText, 2.0)

	// Parse back to subtitle objects
	const blocks = replacedText.trim().split(/\n\n+/)
	const result: Subtitle[] = []

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

		result.push({ index, startTime, endTime, text })
	}

	return result
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

/**
 * Replace [keyword] with C1 winner, preserving original word's casing
 * @param questionSrtPath Path to the question SRT file (contains [keyword])
 * @param originalSrtPath Path to the original SRT file (contains original word)
 * @param replacementKeyword The C1 winning answer to use
 * @returns Subtitles with [keyword] replaced, preserving casing
 */
export function loadSRTWithKeywordReplacement(
	questionSrtPath: string,
	originalSrtPath: string,
	replacementKeyword: string
): Subtitle[] {
	// Load question SRT (has [keyword] placeholders)
	const questionSubs = loadSRT(questionSrtPath)

	// Load original SRT to detect casing
	const originalSubs = loadSRT(originalSrtPath)

	// Find the original keyword by looking for the first subtitle with [keyword] in question
	// and extracting the corresponding word from the original
	let originalKeyword = ''

	for (let i = 0; i < questionSubs.length && i < originalSubs.length; i++) {
		const questionText = questionSubs[i]?.text
		const originalText = originalSubs[i]?.text

		if (questionText?.includes('[keyword]') && originalText) {
			// Extract the word that was replaced with [keyword]
			// Find word at same position in original text
			const words = originalText.split(/\s+/)
			const questionWords = questionText.split(/\s+/)
			const keywordWordIndex = questionWords.findIndex((w) => w.includes('[keyword]'))
			if (keywordWordIndex >= 0 && words[keywordWordIndex]) {
				originalKeyword = words[keywordWordIndex].replace(/[.,!?;:]/g, '')
				break
			}
		}
	}

	// If we found the original keyword, apply casing-aware replacement
	if (originalKeyword) {
		return questionSubs.map((sub) => ({
			...sub,
			text: replaceKeywordPreservingCasing(sub.text, originalKeyword, replacementKeyword)
		}))
	}

	// Fallback: simple replacement without casing preservation
	return questionSubs.map((sub) => ({
		...sub,
		text: sub.text.replace(/\[keyword\]/g, replacementKeyword)
	}))
}
