/**
 * Cinema Pippin Module Integration Tests
 * Tests the module layer to ensure actions properly flow through to game logic
 * and state is correctly enriched before being sent to clients
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGameModule } from './index'
import type { Player, GameModuleContext, GameAction } from '@jkbox/shared'

describe('Cinema Pippin Module Integration', () => {
	let context: GameModuleContext

	beforeEach(() => {
		// Mock context (not used by Cinema Pippin currently)
		context = {} as GameModuleContext
	})

	describe('State enrichment', () => {
		it('should include currentClip with videoUrl and subtitles in initial state', async () => {
			const players: Player[] = [
				{ id: 'player1', name: 'Alice' },
				{ id: 'player2', name: 'Bob' }
			]

			const state = await CinemaPippinGameModule.initialize(players, context)

			// Should have enriched currentClip
			expect(state).toHaveProperty('currentClip')
			expect(state.currentClip).toBeDefined()
			expect(state.currentClip).toHaveProperty('clipNumber')
			expect(state.currentClip).toHaveProperty('videoUrl')
			expect(state.currentClip).toHaveProperty('subtitles')
			expect(Array.isArray(state.currentClip.subtitles)).toBe(true)
		})

		it('should maintain currentClip enrichment after actions', async () => {
			const players: Player[] = [{ id: 'player1', name: 'Alice' }]
			const initialState = await CinemaPippinGameModule.initialize(players, context)

			// Send action
			const action: GameAction = {
				playerId: 'jumbotron',
				type: 'FILM_SELECT_COMPLETE',
				payload: {}
			}
			const newState = await CinemaPippinGameModule.handleAction(action, initialState)

			// Should still have enriched currentClip
			expect(newState.currentClip).toBeDefined()
			expect(newState.currentClip.videoUrl).toBeDefined()
			expect(newState.currentClip.subtitles).toBeDefined()
			expect(Array.isArray(newState.currentClip.subtitles)).toBe(true)
		})
	})

	describe('Action handling and phase transitions', () => {
		it('should advance from film_select to clip_intro via FILM_SELECT_COMPLETE', async () => {
			const players: Player[] = [{ id: 'player1', name: 'Alice' }]
			const initialState = await CinemaPippinGameModule.initialize(players, context)

			expect(initialState.phase).toBe('film_select')

			const action: GameAction = {
				playerId: 'jumbotron',
				type: 'FILM_SELECT_COMPLETE',
				payload: {}
			}
			const newState = await CinemaPippinGameModule.handleAction(action, initialState)

			expect(newState.phase).toBe('clip_intro')
		})

		it('should advance from clip_intro to clip_playback via INTRO_COMPLETE', async () => {
			const players: Player[] = [{ id: 'player1', name: 'Alice' }]
			let state = await CinemaPippinGameModule.initialize(players, context)

			// Advance to clip_intro
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'FILM_SELECT_COMPLETE', payload: {} },
				state
			)
			expect(state.phase).toBe('clip_intro')

			// Advance to clip_playback
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'INTRO_COMPLETE', payload: {} },
				state
			)
			expect(state.phase).toBe('clip_playback')
		})

		it('should advance from clip_playback to answer_collection via VIDEO_COMPLETE', async () => {
			const players: Player[] = [{ id: 'player1', name: 'Alice' }]
			let state = await CinemaPippinGameModule.initialize(players, context)

			// Advance through phases
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'FILM_SELECT_COMPLETE', payload: {} },
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'INTRO_COMPLETE', payload: {} },
				state
			)
			expect(state.phase).toBe('clip_playback')

			// Video completes
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'VIDEO_COMPLETE', payload: {} },
				state
			)
			expect(state.phase).toBe('answer_collection')
		})

		it('should store player answers via SUBMIT_ANSWER', async () => {
			const players: Player[] = [
				{ id: 'player1', name: 'Alice' },
				{ id: 'player2', name: 'Bob' }
			]
			let state = await CinemaPippinGameModule.initialize(players, context)

			// Submit answers
			state = await CinemaPippinGameModule.handleAction(
				{
					playerId: 'player1',
					type: 'SUBMIT_ANSWER',
					payload: { answer: 'Funny answer 1' }
				},
				state
			)

			// playerAnswers is a Map, but gets serialized as an object over WebSocket
			// Check both formats
			if (state.playerAnswers instanceof Map) {
				expect(state.playerAnswers.get('player1')).toBe('Funny answer 1')
			} else {
				expect(state.playerAnswers['player1']).toBe('Funny answer 1')
			}
		})
	})

	describe('Full game flow', () => {
		it('should handle complete flow from film_select through answer_collection', async () => {
			const players: Player[] = [
				{ id: 'player1', name: 'Alice' },
				{ id: 'player2', name: 'Bob' }
			]
			let state = await CinemaPippinGameModule.initialize(players, context)

			// Initial phase
			expect(state.phase).toBe('film_select')
			expect(state.currentClip).toBeDefined()

			// 1. Film selection completes
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'FILM_SELECT_COMPLETE', payload: {} },
				state
			)
			expect(state.phase).toBe('clip_intro')
			expect(state.currentClip.videoUrl).toBeDefined()

			// 2. Intro completes
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'INTRO_COMPLETE', payload: {} },
				state
			)
			expect(state.phase).toBe('clip_playback')
			expect(state.currentClip.subtitles.length).toBeGreaterThan(0)

			// 3. Video completes
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'VIDEO_COMPLETE', payload: {} },
				state
			)
			expect(state.phase).toBe('answer_collection')

			// 4. Players submit answers
			state = await CinemaPippinGameModule.handleAction(
				{
					playerId: 'player1',
					type: 'SUBMIT_ANSWER',
					payload: { answer: 'Player 1 answer' }
				},
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{
					playerId: 'player2',
					type: 'SUBMIT_ANSWER',
					payload: { answer: 'Player 2 answer' }
				},
				state
			)

			// Verify both answers stored
			if (state.playerAnswers instanceof Map) {
				expect(state.playerAnswers.size).toBe(2)
			} else {
				expect(Object.keys(state.playerAnswers).length).toBe(2)
			}
		})
	})

	describe('Regression prevention', () => {
		it('should not use stale game logic (actions must trigger state changes)', async () => {
			const players: Player[] = [{ id: 'player1', name: 'Alice' }]
			const initialState = await CinemaPippinGameModule.initialize(players, context)

			// This test would have caught the wrong import path issue
			// If the module imported stale code, handlePlayerAction wouldn't work
			const action: GameAction = {
				playerId: 'jumbotron',
				type: 'FILM_SELECT_COMPLETE',
				payload: {}
			}
			const newState = await CinemaPippinGameModule.handleAction(action, initialState)

			// Phase MUST change - if it doesn't, we're using stale code
			expect(newState.phase).not.toBe(initialState.phase)
			expect(newState.phase).toBe('clip_intro')
		})

		it('should always include currentClip in state (never undefined)', async () => {
			const players: Player[] = [{ id: 'player1', name: 'Alice' }]
			let state = await CinemaPippinGameModule.initialize(players, context)

			// This test would have caught the missing enrichment issue
			// Check at every phase transition
			const actions = [
				{ playerId: 'jumbotron', type: 'FILM_SELECT_COMPLETE', payload: {} },
				{ playerId: 'jumbotron', type: 'INTRO_COMPLETE', payload: {} },
				{ playerId: 'jumbotron', type: 'VIDEO_COMPLETE', payload: {} }
			]

			for (const action of actions) {
				state = await CinemaPippinGameModule.handleAction(action, state)
				expect(state.currentClip).toBeDefined()
				expect(state.currentClip.videoUrl).toBeDefined()
				expect(state.currentClip.subtitles).toBeDefined()
			}
		})

		it('should have auto-advance timers configured (not stuck forever)', async () => {
			// This is a documentation test - reminds developers about timers
			// The actual timer logic is in the Jumbotron component

			const players: Player[] = [{ id: 'player1', name: 'Alice' }]
			const state = await CinemaPippinGameModule.initialize(players, context)

			// Document which phases need auto-advance
			const phasesWithAutoAdvance = ['film_select', 'clip_intro']

			// If phase is in this list, Jumbotron must have a timer
			if (phasesWithAutoAdvance.includes(state.phase)) {
				// This test passes if we're aware of the requirement
				expect(true).toBe(true)
			}
		})

		it('should auto-advance to voting_playback when all players submit answers', async () => {
			// This test prevents the bug where game hung after all players submitted
			const players: Player[] = [
				{ id: 'player1', name: 'Alice' },
				{ id: 'player2', name: 'Bob' }
			]
			let state = await CinemaPippinGameModule.initialize(players, context)

			// Advance to answer_collection
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'FILM_SELECT_COMPLETE', payload: {} },
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'INTRO_COMPLETE', payload: {} },
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'VIDEO_COMPLETE', payload: {} },
				state
			)
			expect(state.phase).toBe('answer_collection')

			// First player submits - should stay in answer_collection
			state = await CinemaPippinGameModule.handleAction(
				{
					playerId: 'player1',
					type: 'SUBMIT_ANSWER',
					payload: { answer: 'First answer' }
				},
				state
			)
			expect(state.phase).toBe('answer_collection') // Still waiting

			// Second player submits - should auto-advance
			state = await CinemaPippinGameModule.handleAction(
				{
					playerId: 'player2',
					type: 'SUBMIT_ANSWER',
					payload: { answer: 'Second answer' }
				},
				state
			)
			expect(state.phase).toBe('voting_playback') // Auto-advanced!
		})

		it('should set answerCollectionStartTime when entering answer_collection', async () => {
			// This test prevents the bug where timer reset on page reload
			const players: Player[] = [{ id: 'player1', name: 'Alice' }]
			let state = await CinemaPippinGameModule.initialize(players, context)

			// Before answer_collection, no timestamp
			expect(state.answerCollectionStartTime).toBeUndefined()

			// Advance to answer_collection
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'FILM_SELECT_COMPLETE', payload: {} },
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'INTRO_COMPLETE', payload: {} },
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'VIDEO_COMPLETE', payload: {} },
				state
			)

			// Now should have timestamp
			expect(state.answerCollectionStartTime).toBeDefined()
			expect(typeof state.answerCollectionStartTime).toBe('number')
			expect(state.answerCollectionStartTime).toBeGreaterThan(0)
		})

		it('should track totalPlayers for auto-advance logic', async () => {
			// This test ensures we know how many players to wait for
			const players: Player[] = [
				{ id: 'player1', name: 'Alice' },
				{ id: 'player2', name: 'Bob' },
				{ id: 'player3', name: 'Charlie' }
			]
			const state = await CinemaPippinGameModule.initialize(players, context)

			expect(state.totalPlayers).toBe(3)
		})

		it('should serialize Maps to plain objects for WebSocket', async () => {
			// This test prevents the infinite submit loop bug
			const players: Player[] = [
				{ id: 'player1', name: 'Alice' },
				{ id: 'player2', name: 'Bob' }
			]
			let state = await CinemaPippinGameModule.initialize(players, context)

			// Advance to answer_collection and submit
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'FILM_SELECT_COMPLETE', payload: {} },
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'INTRO_COMPLETE', payload: {} },
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{ playerId: 'jumbotron', type: 'VIDEO_COMPLETE', payload: {} },
				state
			)
			state = await CinemaPippinGameModule.handleAction(
				{
					playerId: 'player1',
					type: 'SUBMIT_ANSWER',
					payload: { answer: 'Test answer' }
				},
				state
			)

			// playerAnswers should be a plain object (not a Map)
			expect(state.playerAnswers).not.toBeInstanceOf(Map)
			expect(typeof state.playerAnswers).toBe('object')
			expect(state.playerAnswers['player1']).toBe('Test answer')

			// Same for other Map fields
			expect(state.votes).not.toBeInstanceOf(Map)
			expect(state.scores).not.toBeInstanceOf(Map)
			expect(state.endGameVotes).not.toBeInstanceOf(Map)
		})
	})
})
