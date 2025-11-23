/**
 * Helper function to blank out text while preserving spaces
 * Replaces all non-space characters (excluding newlines) with underscores,
 * then condenses sequences of more than 4 underscores down to exactly 4.
 *
 * @param text - The text to blank
 * @returns The blanked text with spaces preserved and long words condensed
 *
 * @example
 * blankWithSpaces("I'll be back!") // Returns "____ __ ____"
 * blankWithSpaces("Hello world")   // Returns "____ ____"
 * blankWithSpaces("extraordinary") // Returns "____"
 */
export function blankWithSpaces(text: string): string {
	// First, replace all non-whitespace characters with underscores
	const blanked = text.replace(/\S/g, '_')

	// Then condense any sequence of 5+ underscores down to exactly 4
	return blanked.replace(/_{5,}/g, '____')
}

/**
 * Condense multi-line text to single line, then blank with max 8 "words"
 *
 * Process:
 * 1. Join multiple lines with spaces (condense to single line)
 * 2. Apply blanking (blankWithSpaces)
 * 3. Truncate to max 8 "words" of blanks if exceeded
 *
 * @param textLines - Array of text lines from SRT frame
 * @returns Blanked text with max 8 blank "words"
 *
 * @example
 * condenseAndBlank(["Hello world", "How are you?"]) // "____ ____ ____ ____ ____"
 * condenseAndBlank(["One two three four five six seven eight nine ten"]) // "____ ____ ____ ____ ____ ____ ____ ____" (truncated to 8)
 */
export function condenseAndBlank(textLines: string[]): string {
	// Step 1: Join all lines with spaces to create single line
	const singleLine = textLines.join(' ').trim()

	// Step 2: Apply blanking with space preservation
	const blanked = blankWithSpaces(singleLine)

	// Step 3: Truncate to max 8 "words" of blanks
	// Split by spaces, take first 8 groups, rejoin
	const blankWords = blanked.split(/\s+/)
	if (blankWords.length > 8) {
		return blankWords.slice(0, 8).join(' ')
	}

	return blanked
}

/**
 * Helper function to replace blanked text with new text
 * Handles both old format ("_____") and new format ("____ __ _____")
 *
 * @param sceneText - The scene containing blanked text
 * @param replacement - The text to insert in place of the blanks
 * @returns The scene with blanks replaced
 *
 * @example
 * replaceBlankedText("Frame: _____", "Hello")         // "Frame: Hello"
 * replaceBlankedText("Frame: ____ __ _____", "I am") // "Frame: I am"
 */
/**
 * Smart line splitting for long subtitle phrases
 * Splits lines > 60 chars into two lines of approximately equal length
 *
 * Algorithm:
 * 1. If <= 60 chars, return as-is
 * 2. Find midpoint
 * 3. Look for . , ? within 10 chars of midpoint (prefer these)
 * 4. Fallback: find word boundary closest to midpoint
 *
 * @param text - The text to potentially split
 * @returns Original text or text split with \n
 */
export function splitLongLine(text: string): string {
	if (text.length <= 60) {
		return text
	}

	const midpoint = Math.floor(text.length / 2)
	const searchStart = Math.max(0, midpoint - 10)
	const searchEnd = Math.min(text.length, midpoint + 10)

	// Priority 1: Look for sentence punctuation within 10 chars of midpoint
	let bestPunctuationIdx = -1
	let closestPunctuationDistance = Infinity

	for (let i = searchStart; i <= searchEnd; i++) {
		if (['.', ',', '?'].includes(text[i])) {
			const distance = Math.abs(i - midpoint)
			if (distance < closestPunctuationDistance) {
				closestPunctuationDistance = distance
				bestPunctuationIdx = i
			}
		}
	}

	if (bestPunctuationIdx !== -1) {
		// Split after the punctuation mark
		const splitIdx = bestPunctuationIdx + 1
		return text.substring(0, splitIdx).trim() + '\n' + text.substring(splitIdx).trim()
	}

	// Priority 2: Find word boundary closest to midpoint
	let bestSpaceIdx = -1
	let closestSpaceDistance = Infinity

	for (let i = searchStart; i <= searchEnd; i++) {
		if (text[i] === ' ') {
			const distance = Math.abs(i - midpoint)
			if (distance < closestSpaceDistance) {
				closestSpaceDistance = distance
				bestSpaceIdx = i
			}
		}
	}

	if (bestSpaceIdx !== -1) {
		return text.substring(0, bestSpaceIdx).trim() + '\n' + text.substring(bestSpaceIdx + 1).trim()
	}

	// Fallback: split at midpoint (rare case)
	return text.substring(0, midpoint).trim() + '\n' + text.substring(midpoint).trim()
}

export function replaceBlankedText(sceneText: string, replacement: string): string {
	// Match any sequence of underscores with optional spaces between them
	// This pattern matches both:
	// - "_____" (old format)
	// - "____ __ _____" (new format with preserved spaces)
	// Note: NO 'g' flag - only replace first occurrence (the F3 frame blanks)
	const blankPattern = /(?:_+\s*)+_+/

	// Split long lines before replacement
	const processedReplacement = splitLongLine(replacement)

	return sceneText.replace(blankPattern, processedReplacement)
}
