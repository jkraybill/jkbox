/**
 * Cinema Pippin Controller Tests
 * Tests player phone interface including answer submission and voting
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { CinemaPippinController } from './CinemaPippinController'

describe('CinemaPippinController', () => {
	const playerId = 'player-123'

	describe('voting_collection phase', () => {
		it('should display voting buttons with answer text', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_collection',
				currentClipIndex: 0,
				allAnswers: [
					{ id: '1', text: 'banana', authorId: 'player1', votedBy: [] },
					{ id: '2', text: 'rocket ship', authorId: 'player2', votedBy: [] },
					{ id: '3', text: 'disco ball', authorId: 'house', votedBy: [] }
				]
			}

			const { getByText } = render(
				<CinemaPippinController playerId={playerId} state={state} sendToServer={sendToServer} />
			)

			// Should show all answers as buttons
			expect(getByText('banana')).toBeTruthy()
			expect(getByText('rocket ship')).toBeTruthy()
			expect(getByText('disco ball')).toBeTruthy()
		})

		it('should display answers in playback order', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_collection',
				currentClipIndex: 0,
				allAnswers: [
					{ id: '1', text: 'first answer', authorId: 'player1', votedBy: [] },
					{ id: '2', text: 'second answer', authorId: 'player2', votedBy: [] },
					{ id: '3', text: 'third answer', authorId: 'house', votedBy: [] }
				]
			}

			const { container } = render(
				<CinemaPippinController playerId={playerId} state={state} sendToServer={sendToServer} />
			)

			const buttons = container.querySelectorAll('button')
			expect(buttons[0]?.textContent).toBe('first answer')
			expect(buttons[1]?.textContent).toBe('second answer')
			expect(buttons[2]?.textContent).toBe('third answer')
		})

		it('should send SUBMIT_VOTE when button clicked', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_collection',
				currentClipIndex: 0,
				allAnswers: [
					{ id: 'answer-1', text: 'banana', authorId: 'player1', votedBy: [] },
					{ id: 'answer-2', text: 'rocket ship', authorId: 'player2', votedBy: [] }
				]
			}

			const { getByText } = render(
				<CinemaPippinController playerId={playerId} state={state} sendToServer={sendToServer} />
			)

			const button = getByText('banana')
			fireEvent.click(button)

			expect(sendToServer).toHaveBeenCalledWith({
				playerId: 'player-123',
				type: 'SUBMIT_VOTE',
				payload: {
					answerId: 'answer-1'
				}
			})
		})

		it('should show "voted" state after clicking button', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_collection',
				currentClipIndex: 0,
				allAnswers: [{ id: 'answer-1', text: 'banana', authorId: 'player1', votedBy: [] }]
			}

			const { getByText, queryByText } = render(
				<CinemaPippinController playerId={playerId} state={state} sendToServer={sendToServer} />
			)

			const button = getByText('banana')
			fireEvent.click(button)

			// Should show voted confirmation
			expect(getByText(/voted/i)).toBeTruthy()
			// Buttons should be disabled or hidden
			expect(queryByText('banana')).toBeFalsy()
		})

		it('should prevent voting for own answer', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_collection',
				currentClipIndex: 0,
				allAnswers: [
					{ id: 'answer-1', text: 'banana', authorId: 'player-123', votedBy: [] },
					{ id: 'answer-2', text: 'rocket ship', authorId: 'player2', votedBy: [] }
				]
			}

			const { container } = render(
				<CinemaPippinController playerId={playerId} state={state} sendToServer={sendToServer} />
			)

			// Should only show 1 button (player2's answer), not player-123's answer
			const buttons = container.querySelectorAll('button')
			expect(buttons.length).toBe(1)
			expect(buttons[0]?.textContent).toBe('rocket ship')
		})

		it('should handle state with no allAnswers gracefully', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'voting_collection',
				currentClipIndex: 0
			}

			const { getByText } = render(
				<CinemaPippinController playerId={playerId} state={state} sendToServer={sendToServer} />
			)

			// Should show voting UI title without crashing
			expect(getByText('Vote for the Funniest!')).toBeTruthy()
			// Should show empty state message
			expect(getByText('No answers to vote on')).toBeTruthy()
		})
	})

	describe('answer_collection phase', () => {
		it('should show answer input', () => {
			const sendToServer = vi.fn()
			const state = {
				phase: 'answer_collection',
				currentClipIndex: 0,
				answerTimeout: 60
			}

			const { getByText } = render(
				<CinemaPippinController playerId={playerId} state={state} sendToServer={sendToServer} />
			)

			expect(getByText('Submit Your Answer!')).toBeTruthy()
		})
	})
})
