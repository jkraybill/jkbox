/**
 * Casing utilities for keyword replacement
 */

enum CasingType {
	Lowercase,
	Uppercase,
	Titlecase
}

function detectCasing(word: string): CasingType {
	if (word === word.toLowerCase()) {
		return CasingType.Lowercase
	}
	if (word === word.toUpperCase()) {
		return CasingType.Uppercase
	}
	// Title case: first letter uppercase, rest lowercase
	if (word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
		return CasingType.Titlecase
	}
	// Default to lowercase if mixed casing
	return CasingType.Lowercase
}

function applyCasing(word: string, casing: CasingType): string {
	switch (casing) {
		case CasingType.Lowercase:
			return word.toLowerCase()
		case CasingType.Uppercase:
			return word.toUpperCase()
		case CasingType.Titlecase:
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
	}
}

/**
 * Replace keyword in text while preserving the original word's casing
 * @param text Text containing [keyword] placeholder
 * @param originalWord The original word that was blanked (to detect casing)
 * @param replacementWord The winning answer to use as replacement
 * @returns Text with [keyword] replaced, preserving casing
 */
export function replaceKeywordPreservingCasing(
	text: string,
	originalWord: string,
	replacementWord: string
): string {
	const casing = detectCasing(originalWord)
	const casedReplacement = applyCasing(replacementWord, casing)
	return text.replace(/\[keyword\]/g, casedReplacement)
}
