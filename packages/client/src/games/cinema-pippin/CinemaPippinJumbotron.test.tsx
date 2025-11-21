/**
 * Cinema Pippin Jumbotron Integration Tests
 * Tests phase transitions and timer behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { CinemaPippinJumbotron } from './CinemaPippinJumbotron'

describe('CinemaPippinJumbotron', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('clip_intro phase', () => {
		it('should auto-advance to clip_playback after 3 seconds', async () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'clip_intro',
				currentClipIndex: 0,
				currentClip: {
					clipNumber: 1 as const,
					videoUrl: '/test.mp4',
					subtitles: []
				}
			}

			render(<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />)

			// Should not send immediately
			expect(sendToServer).not.toHaveBeenCalled()

			// Fast-forward 3 seconds
			await vi.advanceTimersByTimeAsync(3000)

			// Should send INTRO_COMPLETE event
			expect(sendToServer).toHaveBeenCalledWith({
				playerId: 'jumbotron',
				type: 'INTRO_COMPLETE',
				payload: {}
			})
		})

		it('should not send INTRO_COMPLETE if phase changes before timer', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'clip_intro',
				currentClipIndex: 0
			}

			const { rerender } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			// Advance time partially
			vi.advanceTimersByTime(1500)

			// Change phase before timer completes
			rerender(
				<CinemaPippinJumbotron
					state={{ ...state, phase: 'clip_playback' }}
					sendToServer={sendToServer}
				/>
			)

			// Complete the remaining time
			vi.advanceTimersByTime(1500)

			// Should not have sent INTRO_COMPLETE (timer was cancelled)
			expect(sendToServer).not.toHaveBeenCalled()
		})
	})

	describe('clip_playback phase', () => {
		it('should render VideoPlayer with correct props', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'clip_playback',
				currentClipIndex: 0,
				currentClip: {
					clipNumber: 1 as const,
					videoUrl: '/test.mp4',
					subtitles: [
						{
							index: 1,
							startTime: '00:00:01,000',
							endTime: '00:00:03,000',
							text: 'Test subtitle'
						}
					]
				}
			}

			const { container } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			// Should render video element
			const video = container.querySelector('video')
			expect(video).toBeTruthy()
			expect(video?.src).toContain('/test.mp4')
		})

		it('should send VIDEO_COMPLETE when video ends', async () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'clip_playback',
				currentClipIndex: 0,
				currentClip: {
					clipNumber: 1 as const,
					videoUrl: '/test.mp4',
					subtitles: []
				}
			}

			const { container } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			// Simulate video ending
			const video = container.querySelector('video')
			video?.dispatchEvent(new Event('ended'))

			// VideoPlayer has fadeOutDuration (1000ms) before calling onComplete
			await vi.advanceTimersByTimeAsync(1000)

			expect(sendToServer).toHaveBeenCalledWith({
				playerId: 'jumbotron',
				type: 'VIDEO_COMPLETE',
				payload: {}
			})
		})
	})

	describe('answer_collection phase', () => {
		it('should show answer collection message', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'answer_collection',
				currentClipIndex: 0
			}

			const { getByText } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			expect(getByText('Submit Your Answer!')).toBeTruthy()
		})
	})
})
