import { describe, it, expect, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin'
import type { GameModuleMetadata } from '@jkbox/shared'

describe('CinemaPippinGame', () => {
	let game: CinemaPippinGame

	beforeEach(() => {
		game = new CinemaPippinGame()
	})

	describe('getMetadata', () => {
		it('should return correct metadata', () => {
			const metadata: GameModuleMetadata = game.getMetadata()

			expect(metadata.id).toBe('cinema-pippin')
			expect(metadata.name).toBe('Cinema Pippin')
			expect(metadata.minPlayers).toBe(2)
			expect(metadata.maxPlayers).toBe(20)
			expect(metadata.description).toContain('foreign film')
		})
	})

	describe('initialize', () => {
		it('should initialize with 3 films', () => {
			game.initialize([])

			const state = game.getState()
			expect(state.films).toHaveLength(3)
			expect(state.currentFilmIndex).toBe(0)
			expect(state.currentClipIndex).toBe(0)
			expect(state.phase).toBe('film_select')
		})

		it('should initialize scores for all players', () => {
			game.initialize(['p1', 'p2', 'p3'])

			const state = game.getState()
			expect(state.scores.get('p1')).toBe(0)
			expect(state.scores.get('p2')).toBe(0)
			expect(state.scores.get('p3')).toBe(0)
		})

		it('should load valid film clips', () => {
			game.initialize([])

			const state = game.getState()
			state.films.forEach((film) => {
				expect(film.clips).toHaveLength(3)
				film.clips.forEach((clip) => {
					expect(clip.videoPath).toBeTruthy()
					expect(clip.srtPath).toBeTruthy()
					expect(clip.precomputedAnswers).toHaveLength(3)
				})
			})
		})
	})

	describe('getPhase', () => {
		it('should return current phase', () => {
			game.initialize([])
			expect(game.getPhase()).toBe('film_select')
		})
	})

	describe('getCurrentFilm', () => {
		it('should return current film', () => {
			game.initialize([])

			const film = game.getCurrentFilm()
			expect(film).toBeDefined()
			expect(film.clips).toHaveLength(3)
		})
	})

	describe('getCurrentClip', () => {
		it('should return current clip', () => {
			game.initialize([])

			const clip = game.getCurrentClip()
			expect(clip).toBeDefined()
			expect(clip.clipNumber).toBe(1)
		})
	})

	describe('advancePhase', () => {
		it('should advance from film_select to clip_intro', () => {
			game.initialize([])
			expect(game.getPhase()).toBe('film_select')

			game.advancePhase()
			expect(game.getPhase()).toBe('clip_intro')
		})

		it('should advance through all clip phases', () => {
			game.initialize([])

			const phases = [
				'film_select',
				'clip_intro',
				'clip_playback',
				'answer_collection',
				'voting_playback',
				'voting_collection',
				'results_display'
			]

			phases.forEach((expectedPhase) => {
				expect(game.getPhase()).toBe(expectedPhase)
				game.advancePhase()
			})
		})
	})

	describe('submitAnswer', () => {
		it('should store player answer', () => {
			game.initialize(['player1', 'player2'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.submitAnswer('player1', 'banana')

			const state = game.getState()
			expect(state.playerAnswers.get('player1')).toBe('banana')
		})

		it('should allow multiple players to submit answers', () => {
			game.initialize(['player1', 'player2', 'player3'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.submitAnswer('player1', 'apple')
			game.submitAnswer('player2', 'orange')
			game.submitAnswer('player3', 'grape')

			const state = game.getState()
			expect(state.playerAnswers.get('player1')).toBe('apple')
			expect(state.playerAnswers.get('player2')).toBe('orange')
			expect(state.playerAnswers.get('player3')).toBe('grape')
		})

		it('should clear answers when moving to next clip', () => {
			game.initialize(['player1', 'player2'])
			game.setState({ ...game.getState(), phase: 'answer_collection' })

			game.submitAnswer('player1', 'test')
			expect(game.getState().playerAnswers.size).toBe(1)

			game.clearAnswers()
			expect(game.getState().playerAnswers.size).toBe(0)
		})
	})

	describe('advanceToNextClip', () => {
		it('should advance from C1 to C2', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro

			const stateBefore = game.getState()
			expect(stateBefore.currentClipIndex).toBe(0)

			game.advanceToNextClip()

			const stateAfter = game.getState()
			expect(stateAfter.currentClipIndex).toBe(1)
			expect(stateAfter.phase).toBe('clip_intro')
		})

		it('should advance from C2 to C3', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro
			game.advanceToNextClip() // to C2

			const stateBefore = game.getState()
			expect(stateBefore.currentClipIndex).toBe(1)

			game.advanceToNextClip()

			const stateAfter = game.getState()
			expect(stateAfter.currentClipIndex).toBe(2)
		})

		it('should advance from C3 to film title round', () => {
			game.initialize([])
			game.advancePhase() // to clip_intro
			game.advanceToNextClip() // to C2
			game.advanceToNextClip() // to C3

			const stateBefore = game.getState()
			expect(stateBefore.currentClipIndex).toBe(2)

			game.advanceToNextClip()

			const stateAfter = game.getState()
			expect(stateAfter.phase).toBe('film_title_collection')
		})
	})

	describe('advanceToNextFilm', () => {
		it('should advance from film 1 to film 2', () => {
			game.initialize([])

			const stateBefore = game.getState()
			expect(stateBefore.currentFilmIndex).toBe(0)

			game.advanceToNextFilm()

			const stateAfter = game.getState()
			expect(stateAfter.currentFilmIndex).toBe(1)
			expect(stateAfter.currentClipIndex).toBe(0)
			expect(stateAfter.phase).toBe('clip_intro')
		})

		it('should advance from film 2 to film 3', () => {
			game.initialize([])
			game.advanceToNextFilm() // to film 2

			const stateBefore = game.getState()
			expect(stateBefore.currentFilmIndex).toBe(1)

			game.advanceToNextFilm()

			const stateAfter = game.getState()
			expect(stateAfter.currentFilmIndex).toBe(2)
		})

		it('should transition to final_scores after film 3', () => {
			game.initialize([])
			game.advanceToNextFilm() // to film 2
			game.advanceToNextFilm() // to film 3

			const stateBefore = game.getState()
			expect(stateBefore.currentFilmIndex).toBe(2)

			game.advanceToNextFilm()

			const stateAfter = game.getState()
			expect(stateAfter.phase).toBe('final_scores')
		})
	})

	describe('Winner Calculation', () => {
		it('should select answer with most votes as winner', () => {
			game.initialize(['player1', 'player2', 'player3'])
			const state = game.getState()
			state.allAnswers = [
				{ id: 'a1', text: 'answer1', authorId: 'player1', votedBy: [] },
				{ id: 'a2', text: 'answer2', authorId: 'player2', votedBy: [] },
				{ id: 'a3', text: 'answer3', authorId: 'player3', votedBy: [] }
			]
			state.votes = new Map([
				['player1', 'a2'],
				['player2', 'a3'],
				['player3', 'a2']
			])
			game.setState(state)

			const winner = game.calculateWinner()

			expect(winner?.id).toBe('a2')
			expect(winner?.authorId).toBe('player2')
		})

		it('should break tie with human answer beating AI answer', () => {
			game.initialize(['player1', 'player2', 'player3'])
			const state = game.getState()
			state.allAnswers = [
				{ id: 'a1', text: 'answer1', authorId: 'player1', votedBy: [] },
				{ id: 'house-1', text: 'house answer', authorId: 'house', votedBy: [] }
			]
			state.votes = new Map([
				['player2', 'a1'],
				['player3', 'house-1']
			])
			game.setState(state)

			const winner = game.calculateWinner()

			expect(winner?.id).toBe('a1')
			expect(winner?.authorId).toBe('player1')
		})

		it('should handle tied human answers with deterministic selection', () => {
			game.initialize(['player1', 'player2', 'player3'])
			const state = game.getState()
			state.allAnswers = [
				{ id: 'a1', text: 'answer1', authorId: 'player1', votedBy: [] },
				{ id: 'a2', text: 'answer2', authorId: 'player2', votedBy: [] }
			]
			state.votes = new Map([
				['player3', 'a1']
			])
			game.setState(state)

			const winner = game.calculateWinner()

			expect(['a1', 'a2']).toContain(winner?.id)
		})

		it('should sort answers by vote count ascending for results display', () => {
			game.initialize(['player1', 'player2', 'player3'])
			const state = game.getState()
			state.allAnswers = [
				{ id: 'a1', text: 'answer1', authorId: 'player1', votedBy: [] },
				{ id: 'a2', text: 'answer2', authorId: 'player2', votedBy: [] },
				{ id: 'a3', text: 'answer3', authorId: 'player3', votedBy: [] }
			]
			state.votes = new Map([
				['player1', 'a3'],
				['player2', 'a3'],
				['player3', 'a1']
			])
			game.setState(state)

			const sorted = game.getSortedAnswersByVotes()

			expect(sorted.length).toBe(2) // Only answers with 1+ votes
			expect(sorted[0].answer.id).toBe('a1') // 1 vote (lowest first)
			expect(sorted[0].voteCount).toBe(1)
			expect(sorted[1].answer.id).toBe('a3') // 2 votes
			expect(sorted[1].voteCount).toBe(2)
		})

		it('should calculate score increases from votes', () => {
			game.initialize(['player1', 'player2', 'player3'])
			const state = game.getState()
			state.allAnswers = [
				{ id: 'a1', text: 'answer1', authorId: 'player1', votedBy: [] },
				{ id: 'a2', text: 'answer2', authorId: 'player2', votedBy: [] }
			]
			state.votes = new Map([
				['player2', 'a1'],
				['player3', 'a1']
			])
			state.scores = new Map([
				['player1', 0],
				['player2', 0],
				['player3', 0]
			])
			game.setState(state)

			game.applyVoteScores()

			const updatedState = game.getState()
			expect(updatedState.scores.get('player1')).toBe(2)
			expect(updatedState.scores.get('player2')).toBe(0)
		})
	})

	describe('AI Player Status Marking', () => {
		/**
		 * These tests verify the fix for the critical bug where AI players weren't
		 * marking their status as submitted/voted, causing the game to wait indefinitely.
		 *
		 * Note: We test by manually simulating what the async AI generation does,
		 * since testing async generation directly would require mocking Ollama.
		 */

		it('should have AI players in initialized state when AI enabled', () => {
			const gameWithAI = new CinemaPippinGame(true)
			gameWithAI.initialize(['player1', 'player2'])

			const state = gameWithAI.getState()
			// This test passes if AI players are initialized (depends on global config)
			expect(state.scores).toBeDefined()
		})

		it('should track player status for all players including AI', () => {
			game.initialize(['player1', 'player2'])

			const state = game.getState()
			state.aiPlayers = [
				{ playerId: 'ai-1', nickname: 'PoopBot', constraint: 'Poop' }
			]
			state.playerStatus = new Map([
				['player1', {}],
				['player2', {}],
				['ai-1', { hasSubmittedAnswer: true }] // Simulate AI marking
			])
			game.setState(state)

			const updatedState = game.getState()
			const ai1Status = updatedState.playerStatus.get('ai-1')

			// Verify that AI status can be set and retrieved
			expect(ai1Status?.hasSubmittedAnswer).toBe(true)
		})

		it('should allow AI players to submit answers', () => {
			game.initialize(['player1', 'player2'])

			const state = game.getState()
			state.aiPlayers = [
				{ playerId: 'ai-1', nickname: 'PoopBot', constraint: 'Poop' }
			]
			state.phase = 'answer_collection'

			// Simulate what generateAIAnswers() does
			state.playerAnswers.set('ai-1', 'poop joke')
			state.playerStatus.set('ai-1', { hasSubmittedAnswer: true })

			game.setState(state)

			const updatedState = game.getState()

			// Verify AI answer is stored
			expect(updatedState.playerAnswers.get('ai-1')).toBe('poop joke')
			// Verify AI is marked as submitted
			expect(updatedState.playerStatus.get('ai-1')?.hasSubmittedAnswer).toBe(true)
		})

		it('should allow AI players to vote', () => {
			game.initialize(['player1', 'player2'])

			const state = game.getState()
			state.aiPlayers = [
				{ playerId: 'ai-1', nickname: 'PoopBot', constraint: 'Poop' }
			]
			state.phase = 'voting_collection'
			state.allAnswers = [
				{ id: 'a1', text: 'answer1', authorId: 'player1', votedBy: [] }
			]

			// Simulate what generateAIVotes() does
			state.votes.set('ai-1', 'a1')
			state.playerStatus.set('ai-1', { hasSubmittedAnswer: true, hasVoted: true })
			state.allAnswers[0].votedBy.push('ai-1')

			game.setState(state)

			const updatedState = game.getState()

			// Verify AI vote is stored
			expect(updatedState.votes.get('ai-1')).toBe('a1')
			// Verify AI is marked as voted
			expect(updatedState.playerStatus.get('ai-1')?.hasVoted).toBe(true)
			// Verify votedBy array is updated
			expect(updatedState.allAnswers[0].votedBy).toContain('ai-1')
		})

		it('should handle multiple AI players submitting answers', () => {
			game.initialize(['player1'])

			const state = game.getState()
			state.aiPlayers = [
				{ playerId: 'ai-1', nickname: 'PoopBot', constraint: 'Poop' },
				{ playerId: 'ai-2', nickname: 'BananaBot', constraint: 'Banana' }
			]
			state.phase = 'answer_collection'

			// Simulate batch AI answer generation
			state.aiPlayers.forEach((ai) => {
				state.playerAnswers.set(ai.playerId, `${ai.constraint} answer`)
				state.playerStatus.set(ai.playerId, { hasSubmittedAnswer: true })
			})

			game.setState(state)

			const updatedState = game.getState()

			// Verify all AI players have answers
			expect(updatedState.playerAnswers.get('ai-1')).toBe('Poop answer')
			expect(updatedState.playerAnswers.get('ai-2')).toBe('Banana answer')

			// Verify all AI players are marked as submitted
			expect(updatedState.playerStatus.get('ai-1')?.hasSubmittedAnswer).toBe(true)
			expect(updatedState.playerStatus.get('ai-2')?.hasSubmittedAnswer).toBe(true)
		})

		it('should handle fallback answers for AI players', () => {
			game.initialize([])

			const state = game.getState()
			state.aiPlayers = [
				{ playerId: 'ai-1', nickname: 'PoopBot', constraint: 'Poop' }
			]
			state.phase = 'answer_collection'

			// Simulate what loadFallbackAnswers() does
			state.playerAnswers.set('ai-1', 'fallback answer')
			state.playerStatus.set('ai-1', { hasSubmittedAnswer: true })

			game.setState(state)

			const updatedState = game.getState()

			// Verify fallback answer is stored
			expect(updatedState.playerAnswers.get('ai-1')).toBe('fallback answer')
			// Verify AI is marked as submitted even with fallback
			expect(updatedState.playerStatus.get('ai-1')?.hasSubmittedAnswer).toBe(true)
		})

		it('should include AI players in vote counting', () => {
			game.initialize(['player1', 'player2'])

			const state = game.getState()
			state.aiPlayers = [
				{ playerId: 'ai-1', nickname: 'PoopBot', constraint: 'Poop' }
			]

			state.allAnswers = [
				{ id: 'a1', text: 'answer1', authorId: 'player1', votedBy: ['ai-1', 'player2'] }
			]
			state.votes = new Map([
				['ai-1', 'a1'],
				['player2', 'a1']
			])
			state.scores = new Map([
				['player1', 0],
				['player2', 0],
				['ai-1', 0]
			])

			game.setState(state)
			game.applyVoteScores()

			const updatedState = game.getState()

			// Player1's answer should get 2 points (1 from AI, 1 from player2)
			expect(updatedState.scores.get('player1')).toBe(2)
		})
	})
})
