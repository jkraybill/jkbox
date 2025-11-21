import { describe, it, expect } from 'vitest'
import { parseSRT, mergeSRT, replaceKeyword, formatSRT } from './srt-processor'

describe('srt-processor', () => {
	describe('parseSRT', () => {
		it('should parse basic SRT format', () => {
			const srtContent = `1
00:00:01,000 --> 00:00:04,378
Hello world

2
00:00:05,000 --> 00:00:08,000
This is a test
`

			const subtitles = parseSRT(srtContent)

			expect(subtitles).toHaveLength(2)
			expect(subtitles[0]).toEqual({
				index: 1,
				startTime: '00:00:01,000',
				endTime: '00:00:04,378',
				text: 'Hello world'
			})
			expect(subtitles[1]).toEqual({
				index: 2,
				startTime: '00:00:05,000',
				endTime: '00:00:08,000',
				text: 'This is a test'
			})
		})

		it('should handle multi-line subtitle text', () => {
			const srtContent = `1
00:00:01,000 --> 00:00:04,000
Line 1
Line 2
Line 3
`

			const subtitles = parseSRT(srtContent)

			expect(subtitles).toHaveLength(1)
			expect(subtitles[0].text).toBe('Line 1\nLine 2\nLine 3')
		})
	})

	describe('mergeSRT', () => {
		it('should replace _____ with answer', () => {
			const subtitles = [
				{
					index: 1,
					startTime: '00:00:01,000',
					endTime: '00:00:04,000',
					text: 'Ah, _____.'
				}
			]

			const merged = mergeSRT(subtitles, 'banana')

			expect(merged[0].text).toBe('Ah, banana.')
		})

		it('should replace multi-word blanks', () => {
			const subtitles = [
				{
					index: 1,
					startTime: '00:00:01,000',
					endTime: '00:00:04,000',
					text: '____ __ ____ ____'
				}
			]

			const merged = mergeSRT(subtitles, 'eating pasta raw')

			expect(merged[0].text).toBe('eating pasta raw')
		})

		it('should handle blanks in middle of sentence', () => {
			const subtitles = [
				{
					index: 1,
					startTime: '00:00:01,000',
					endTime: '00:00:04,000',
					text: 'I saw _____ yesterday.'
				}
			]

			const merged = mergeSRT(subtitles, 'something weird')

			expect(merged[0].text).toBe('I saw something weird yesterday.')
		})
	})

	describe('replaceKeyword', () => {
		it('should replace [keyword] with C1 winner', () => {
			const subtitles = [
				{
					index: 1,
					startTime: '00:00:01,000',
					endTime: '00:00:04,000',
					text: '[keyword], this is Mr. Smith.'
				}
			]

			const replaced = replaceKeyword(subtitles, 'Banana')

			expect(replaced[0].text).toBe('Banana, this is Mr. Smith.')
		})

		it('should replace multiple instances', () => {
			const subtitles = [
				{
					index: 1,
					startTime: '00:00:01,000',
					endTime: '00:00:04,000',
					text: 'The [keyword] is in the [keyword].'
				}
			]

			const replaced = replaceKeyword(subtitles, 'cat')

			expect(replaced[0].text).toBe('The cat is in the cat.')
		})
	})

	describe('formatSRT', () => {
		it('should format subtitles as SRT string', () => {
			const subtitles = [
				{
					index: 1,
					startTime: '00:00:01,000',
					endTime: '00:00:04,000',
					text: 'Hello world'
				},
				{
					index: 2,
					startTime: '00:00:05,000',
					endTime: '00:00:08,000',
					text: 'Second subtitle'
				}
			]

			const formatted = formatSRT(subtitles)

			expect(formatted).toBe(`1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,000
Second subtitle

`)
		})
	})
})
