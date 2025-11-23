import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { VideoPlayer } from './VideoPlayer'

describe('VideoPlayer', () => {
	beforeEach(() => {
		// Mock HTMLMediaElement methods
		window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
		window.HTMLMediaElement.prototype.pause = vi.fn()
		window.HTMLMediaElement.prototype.load = vi.fn()
	})

	it('should render video element with correct source', () => {
		render(
			<VideoPlayer
				videoUrl="/test-video.mp4"
				subtitles={[]}
				onComplete={() => {}}
				fadeInDuration={0}
				fadeOutDuration={0}
			/>
		)

		const video = screen.getByTestId('video-player')
		expect(video).toBeInTheDocument()
		expect(video).toHaveAttribute('src', '/test-video.mp4')
	})

	it('should display subtitles at current time', async () => {
		const subtitles = [
			{
				index: 1,
				startTime: '00:00:00,000',
				endTime: '00:00:02,000',
				text: 'First subtitle'
			},
			{
				index: 2,
				startTime: '00:00:02,000',
				endTime: '00:00:04,000',
				text: 'Second subtitle'
			}
		]

		render(
			<VideoPlayer
				videoUrl="/test-video.mp4"
				subtitles={subtitles}
				onComplete={() => {}}
				fadeInDuration={0}
				fadeOutDuration={0}
			/>
		)

		// Initially no subtitle shown
		expect(screen.queryByTestId('subtitle-text')).not.toBeInTheDocument()

		// Simulate video time update to 1 second (first subtitle)
		const video = screen.getByTestId('video-player') as HTMLVideoElement
		act(() => {
			Object.defineProperty(video, 'currentTime', { value: 1.0, writable: true })
			video.dispatchEvent(new Event('timeupdate'))
		})

		await waitFor(() => {
			expect(screen.getByTestId('subtitle-text')).toHaveTextContent('First subtitle')
		})

		// Simulate video time update to 3 seconds (second subtitle)
		act(() => {
			Object.defineProperty(video, 'currentTime', { value: 3.0, writable: true })
			video.dispatchEvent(new Event('timeupdate'))
		})

		await waitFor(() => {
			expect(screen.getByTestId('subtitle-text')).toHaveTextContent('Second subtitle')
		})
	})

	it('should handle multi-line subtitles', async () => {
		const subtitles = [
			{
				index: 1,
				startTime: '00:00:00,000',
				endTime: '00:00:02,000',
				text: 'Line 1\nLine 2\nLine 3'
			}
		]

		render(
			<VideoPlayer
				videoUrl="/test-video.mp4"
				subtitles={subtitles}
				onComplete={() => {}}
				fadeInDuration={0}
				fadeOutDuration={0}
			/>
		)

		const video = screen.getByTestId('video-player') as HTMLVideoElement
		act(() => {
			Object.defineProperty(video, 'currentTime', { value: 1.0, writable: true })
			video.dispatchEvent(new Event('timeupdate'))
		})

		await waitFor(() => {
			const subtitle = screen.getByTestId('subtitle-text')
			expect(subtitle.innerHTML).toContain('Line 1')
			expect(subtitle.innerHTML).toContain('Line 2')
			expect(subtitle.innerHTML).toContain('Line 3')
		})
	})

	it('should apply fade-in effect on mount', () => {
		render(
			<VideoPlayer
				videoUrl="/test-video.mp4"
				subtitles={[]}
				onComplete={() => {}}
				fadeInDuration={1000}
				fadeOutDuration={0}
			/>
		)

		const container = screen.getByTestId('video-container')
		const style = window.getComputedStyle(container)
		expect(style.transition).toContain('opacity')
	})

	it('should call onComplete when video ends', async () => {
		const onComplete = vi.fn()

		render(
			<VideoPlayer
				videoUrl="/test-video.mp4"
				subtitles={[]}
				onComplete={onComplete}
				fadeInDuration={0}
				fadeOutDuration={0}
			/>
		)

		const video = screen.getByTestId('video-player') as HTMLVideoElement
		act(() => {
			video.dispatchEvent(new Event('ended'))
		})

		await waitFor(() => {
			expect(onComplete).toHaveBeenCalledTimes(1)
		})
	})

	it('should display pre-roll overlay when provided', () => {
		render(
			<VideoPlayer
				videoUrl="/test-video.mp4"
				subtitles={[]}
				onComplete={() => {}}
				fadeInDuration={0}
				fadeOutDuration={0}
				preRollText="Act I"
			/>
		)

		expect(screen.getByTestId('preroll-overlay')).toBeInTheDocument()
		expect(screen.getByTestId('preroll-overlay')).toHaveTextContent('Act I')
	})

	it('should hide pre-roll overlay after duration', async () => {
		vi.useFakeTimers()

		render(
			<VideoPlayer
				videoUrl="/test-video.mp4"
				subtitles={[]}
				onComplete={() => {}}
				fadeInDuration={0}
				fadeOutDuration={0}
				preRollText="Act I"
				preRollDuration={2000}
			/>
		)

		expect(screen.getByTestId('preroll-overlay')).toBeInTheDocument()

		// Fast-forward 2 seconds
		await act(async () => {
			await vi.advanceTimersByTimeAsync(2000)
		})

		expect(screen.queryByTestId('preroll-overlay')).not.toBeInTheDocument()

		vi.useRealTimers()
	})

	it('should convert SRT timestamp to seconds correctly', async () => {
		const subtitles = [
			{
				index: 1,
				startTime: '00:01:30,500', // 1 min 30.5 sec = 90.5 sec
				endTime: '00:01:32,000',
				text: 'Timestamp test'
			}
		]

		render(
			<VideoPlayer
				videoUrl="/test-video.mp4"
				subtitles={subtitles}
				onComplete={() => {}}
				fadeInDuration={0}
				fadeOutDuration={0}
			/>
		)

		const video = screen.getByTestId('video-player') as HTMLVideoElement
		act(() => {
			Object.defineProperty(video, 'currentTime', { value: 91.0, writable: true })
			video.dispatchEvent(new Event('timeupdate'))
		})

		await waitFor(() => {
			expect(screen.getByTestId('subtitle-text')).toHaveTextContent('Timestamp test')
		})
	})
})
