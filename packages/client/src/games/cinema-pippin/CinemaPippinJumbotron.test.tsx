/**
 * Cinema Pippin Jumbotron Integration Tests
 * Tests phase transitions and timer behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { CinemaPippinJumbotron } from './CinemaPippinJumbotron'

describe('CinemaPippinJumbotron', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('film_select phase', () => {
		it('should auto-advance to clip_intro after 2 seconds', async () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'film_select',
				currentClipIndex: 0
			}

			render(<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />)

			// Should not send immediately
			expect(sendToServer).not.toHaveBeenCalled()

			// Fast-forward 2 seconds
			await vi.advanceTimersByTimeAsync(2000)

			// Should send FILM_SELECT_COMPLETE event
			expect(sendToServer).toHaveBeenCalledWith({
				playerId: 'jumbotron',
				type: 'FILM_SELECT_COMPLETE',
				payload: {}
			})
		})
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
			await act(async () => {
				video?.dispatchEvent(new Event('ended'))
				// VideoPlayer has fadeOutDuration (1000ms) before calling onComplete
				await vi.advanceTimersByTimeAsync(1000)
			})

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

	describe('voting_playback phase', () => {
		it('should render VideoPlayer for first answer', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_playback',
				currentClipIndex: 0,
				currentAnswerIndex: 0,
				allAnswers: [
					{ id: '1', text: 'answer one', authorId: 'player1', votedBy: [] },
					{ id: '2', text: 'answer two', authorId: 'player2', votedBy: [] }
				],
				currentClip: {
					clipNumber: 1 as const,
					videoUrl: '/test.mp4',
					subtitles: [
						{
							index: 1,
							startTime: '00:00:01,000',
							endTime: '00:00:03,000',
							text: 'Subtitle with answer one'
						}
					]
				}
			}

			const { container } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			const video = container.querySelector('video')
			expect(video).toBeTruthy()
			expect(video?.src).toContain('/test.mp4')
		})

		it('should remount VideoPlayer when currentAnswerIndex changes', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_playback',
				currentClipIndex: 0,
				currentAnswerIndex: 0,
				allAnswers: [
					{ id: '1', text: 'answer one', authorId: 'player1', votedBy: [] },
					{ id: '2', text: 'answer two', authorId: 'player2', votedBy: [] }
				],
				currentClip: {
					clipNumber: 1 as const,
					videoUrl: '/test.mp4',
					subtitles: []
				}
			}

			const { container, rerender } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			const video1 = container.querySelector('video')
			const videoKey1 =
				video1?.getAttribute('data-key') || video1?.parentElement?.getAttribute('data-key')

			// Advance to next answer
			rerender(
				<CinemaPippinJumbotron
					state={{ ...state, currentAnswerIndex: 1 }}
					sendToServer={sendToServer}
				/>
			)

			const video2 = container.querySelector('video')
			const videoKey2 =
				video2?.getAttribute('data-key') || video2?.parentElement?.getAttribute('data-key')

			// VideoPlayer should have different key (causes remount)
			// Note: React keys are not in DOM, but we can check that video element changed
			expect(video1).not.toBe(video2)
		})

		it('should send VIDEO_COMPLETE when voting playback video ends', async () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_playback',
				currentClipIndex: 0,
				currentAnswerIndex: 0,
				allAnswers: [{ id: '1', text: 'answer one', authorId: 'player1', votedBy: [] }],
				currentClip: {
					clipNumber: 1 as const,
					videoUrl: '/test.mp4',
					subtitles: []
				}
			}

			const { container } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			const video = container.querySelector('video')
			await act(async () => {
				video?.dispatchEvent(new Event('ended'))
				await vi.advanceTimersByTimeAsync(1000)
			})

			expect(sendToServer).toHaveBeenCalledWith({
				playerId: 'jumbotron',
				type: 'VIDEO_COMPLETE',
				payload: {}
			})
		})
	})

	describe('voting_collection phase', () => {
		it('should show voting message', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_collection',
				currentClipIndex: 0
			}

			const { getByText } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			expect(getByText('Vote for the Funniest!')).toBeTruthy()
		})
	})

	describe('results_display phase', () => {
		it('should render ResultsDisplay component when sortedResults and scores exist', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'results_display',
				currentClipIndex: 0,
				sortedResults: [
					{
						answer: { id: '1', text: 'Test answer', authorId: 'player1', votedBy: ['player2'] },
						voteCount: 1,
						voters: ['player2']
					}
				],
				scores: { player1: 1 }
			}
			const players = [
				{ id: 'player1', nickname: 'Alice', isAI: false },
				{ id: 'player2', nickname: 'Bob', isAI: false }
			]

			const { getByText } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} players={players} />
			)

			expect(getByText('Results')).toBeTruthy()
			expect(getByText('"Test answer"')).toBeTruthy()
		})

		it('should show calculating message when sortedResults not ready', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'results_display',
				currentClipIndex: 0
			}

			const { getByText } = render(
				<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />
			)

			expect(getByText('Results')).toBeTruthy()
			expect(getByText('Calculating scores...')).toBeTruthy()
		})
	})

	// Removed: film_title_results phase tests - FILM_TITLE_RESULTS_COMPLETE is triggered by ResultsDisplay.onComplete callback, not auto-timer

	describe('final_scores phase', () => {
		it('should auto-advance to end_game_vote after 5 seconds', async () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'final_scores'
			}

			render(<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />)

			expect(sendToServer).not.toHaveBeenCalled()

			await vi.advanceTimersByTimeAsync(5000)

			expect(sendToServer).toHaveBeenCalledWith({
				playerId: 'jumbotron',
				type: 'FINAL_SCORES_COMPLETE',
				payload: {}
			})
		})
	})

	// Removed: final_montage phase tests - MONTAGE_COMPLETE is triggered by FinalMontage.onComplete callback, not auto-timer

	describe('next_film_or_end phase', () => {
		it('should auto-advance after 2 seconds', async () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'next_film_or_end'
			}

			render(<CinemaPippinJumbotron state={state} sendToServer={sendToServer} />)

			expect(sendToServer).not.toHaveBeenCalled()

			await vi.advanceTimersByTimeAsync(2000)

			expect(sendToServer).toHaveBeenCalledWith({
				playerId: 'jumbotron',
				type: 'NEXT_FILM_CHECK',
				payload: {}
			})
		})
	})
})
