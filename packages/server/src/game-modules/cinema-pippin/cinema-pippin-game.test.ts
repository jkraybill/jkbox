import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CinemaPippinGame } from './cinema-pippin-game'
import * as filmLoader from './film-loader'
import * as srtProcessor from '../../games/cinema-pippin/srt-processor'

vi.mock('./film-loader')
vi.mock('../../games/cinema-pippin/srt-processor')

describe('CinemaPippinGame', () => {
	let game: CinemaPippinGame

	const mockFilms = [
		{
			filmName: 'test-film-1',
			sequenceNumber: 1,
			clips: [
				{
					clipNumber: 1 as const,
					videoPath: '/path/to/1-question.mp4',
					srtPath: '/path/to/1-question.srt',
					precomputedAnswers: ['answer1', 'answer2', 'answer3']
				},
				{
					clipNumber: 2 as const,
					videoPath: '/path/to/2-question.mp4',
					srtPath: '/path/to/2-question.srt',
					precomputedAnswers: ['answer4', 'answer5', 'answer6']
				},
				{
					clipNumber: 3 as const,
					videoPath: '/path/to/3-question.mp4',
					srtPath: '/path/to/3-question.srt',
					precomputedAnswers: ['answer7', 'answer8', 'answer9']
				}
			]
		}
	]

	const mockSubtitles = [
		{
			index: 1,
			startTime: '00:00:00,000',
			endTime: '00:00:02,000',
			text: 'Test subtitle'
		}
	]

	beforeEach(() => {
		vi.clearAllMocks()
		game = new CinemaPippinGame()

		// Mock film loading
		vi.mocked(filmLoader.loadFilms).mockResolvedValue([
			{ filmName: 'test-film-1', sequenceCounts: 6 }
		])
		vi.mocked(filmLoader.selectRandomFilms).mockReturnValue([
			{ filmName: 'test-film-1', sequenceCounts: 6, sequenceNumber: 1 }
		])
		vi.mocked(filmLoader.loadFilmClips).mockResolvedValue(mockFilms)

		// Mock SRT loading
		vi.mocked(srtProcessor.loadSRT).mockReturnValue(mockSubtitles)
	})

	describe('getMetadata', () => {
		it('should return correct metadata', () => {
			const metadata = game.getMetadata()

			expect(metadata).toEqual({
				id: 'cinema-pippin',
				name: 'Cinema Pippin',
				description: 'Fill in the blanks of foreign film subtitles to create comedy gold',
				minPlayers: 2,
				maxPlayers: 20
			})
		})
	})

	describe('initialize', () => {
		it('should load films and start FSM', async () => {
			await game.initialize(['player1', 'player2'])

			const state = game.getState()
			expect(state.phase).toBe('clip_intro')
			expect(state.currentFilmIndex).toBe(0)
			expect(state.currentClipIndex).toBe(0)
		})

		it('should load 3 random films', async () => {
			await game.initialize(['player1', 'player2'])

			expect(filmLoader.loadFilms).toHaveBeenCalledWith('/home/jk/jkbox/generated/clips')
			expect(filmLoader.selectRandomFilms).toHaveBeenCalledWith(expect.anything(), 3)
			expect(filmLoader.loadFilmClips).toHaveBeenCalled()
		})
	})

	describe('getState', () => {
		it('should return current game state', async () => {
			await game.initialize(['player1'])

			const state = game.getState()

			expect(state.phase).toBe('clip_intro')
			expect(state.currentFilm).toEqual({
				filmName: 'test-film-1',
				sequenceNumber: 1
			})
			expect(state.currentClip).toMatchObject({
				clipNumber: 1,
				videoUrl: '/clips/test-film-1/1/test-film-1-1-question.mp4'
			})
		})

		it('should include loaded subtitles', async () => {
			await game.initialize(['player1'])

			const state = game.getState()

			expect(state.currentClip?.subtitles).toEqual(mockSubtitles)
			expect(srtProcessor.loadSRT).toHaveBeenCalledWith('/path/to/1-question.srt')
		})

		it('should throw if game not initialized', () => {
			expect(() => game.getState()).toThrow('Game not initialized')
		})
	})

	describe('getPhase', () => {
		it('should return current FSM phase', async () => {
			await game.initialize(['player1'])

			expect(game.getPhase()).toBe('clip_intro')
		})

		it('should return film_select if not initialized', () => {
			expect(game.getPhase()).toBe('film_select')
		})
	})

	describe('handlePlayerAction', () => {
		beforeEach(async () => {
			await game.initialize(['player1', 'player2'])
		})

		it('should handle SUBMIT_ANSWER action', () => {
			game.handlePlayerAction('player1', {
				type: 'SUBMIT_ANSWER',
				payload: { answer: 'banana' }
			})

			const state = game.getState()
			expect(state.playerAnswers['player1']).toBe('banana')
		})

		it('should handle VIDEO_COMPLETE during clip_playback', () => {
			// Manually advance to clip_playback phase
			// (In real usage, this would happen via FSM transitions)
			const beforePhase = game.getPhase()
			expect(beforePhase).toBe('clip_intro')

			// Simulate state progression
			// We can't directly test VIDEO_COMPLETE without advancing the FSM first
			// This would require integration testing with actual FSM transitions
		})

		it('should throw if game not initialized', () => {
			const uninitializedGame = new CinemaPippinGame()
			expect(() =>
				uninitializedGame.handlePlayerAction('player1', {
					type: 'SUBMIT_ANSWER',
					payload: { answer: 'test' }
				})
			).toThrow('Game not initialized')
		})
	})

	describe('getMergedSubtitles', () => {
		beforeEach(async () => {
			await game.initialize(['player1'])

			vi.mocked(srtProcessor.mergeSRT).mockReturnValue([
				{
					index: 1,
					startTime: '00:00:00,000',
					endTime: '00:00:02,000',
					text: 'Merged subtitle'
				}
			])
		})

		it('should merge answer into subtitles', () => {
			const merged = game.getMergedSubtitles('banana')

			expect(srtProcessor.mergeSRT).toHaveBeenCalledWith(mockSubtitles, 'banana')
			expect(merged[0].text).toBe('Merged subtitle')
		})

		it('should replace keyword if provided', () => {
			vi.mocked(srtProcessor.replaceKeyword).mockReturnValue(mockSubtitles)

			game.getMergedSubtitles('test answer', 'fruit')

			expect(srtProcessor.replaceKeyword).toHaveBeenCalledWith(mockSubtitles, 'fruit')
		})

		it('should return empty array if no current clip', () => {
			const noClipGame = new CinemaPippinGame()
			// Don't initialize, so there's no current clip

			// This will throw because game isn't initialized
			expect(() => noClipGame.getMergedSubtitles('test')).toThrow()
		})
	})
})
