import { describe, it, expect } from 'vitest'
import { replaceKeywordPreservingCasing } from './casing-utils'

describe('replaceKeywordPreservingCasing', () => {
	it('should replace with lowercase when original is lowercase', () => {
		const text = 'May [keyword] forgive me'
		const original = 'god'
		const replacement = 'BANANA'

		const result = replaceKeywordPreservingCasing(text, original, replacement)

		expect(result).toBe('May banana forgive me')
	})

	it('should replace with uppercase when original is uppercase', () => {
		const text = 'May [keyword] forgive me'
		const original = 'GOD'
		const replacement = 'banana'

		const result = replaceKeywordPreservingCasing(text, original, replacement)

		expect(result).toBe('May BANANA forgive me')
	})

	it('should replace with titlecase when original is titlecase', () => {
		const text = 'May [keyword] forgive me'
		const original = 'God'
		const replacement = 'banana'

		const result = replaceKeywordPreservingCasing(text, original, replacement)

		expect(result).toBe('May Banana forgive me')
	})

	it('should replace multiple occurrences with same casing', () => {
		const text = '[keyword] bless [keyword]'
		const original = 'God'
		const replacement = 'banana'

		const result = replaceKeywordPreservingCasing(text, original, replacement)

		expect(result).toBe('Banana bless Banana')
	})

	it('should handle multi-word replacements', () => {
		const text = 'May [keyword] help us'
		const original = 'God'
		const replacement = 'rocket ship'

		const result = replaceKeywordPreservingCasing(text, original, replacement)

		expect(result).toBe('May Rocket ship help us')
	})

	it('should handle text with no keyword placeholder', () => {
		const text = 'No placeholders here'
		const original = 'God'
		const replacement = 'banana'

		const result = replaceKeywordPreservingCasing(text, original, replacement)

		expect(result).toBe('No placeholders here')
	})

	it('should preserve casing for single letter words', () => {
		const text = '[keyword] is the answer'
		const original = 'i'
		const replacement = 'BANANA'

		const result = replaceKeywordPreservingCasing(text, original, replacement)

		expect(result).toBe('banana is the answer')
	})
})
