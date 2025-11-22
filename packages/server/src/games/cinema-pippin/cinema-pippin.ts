/**
 * Cinema Pippin - Main Game Module
 */

import type { GameModuleMetadata, GameModule } from '@jkbox/shared'
import { loadFilms } from './film-loader'
import type { CinemaPippinState, GamePhase, FilmData, ClipData } from './types'

export class CinemaPippinGame implements GameModule<CinemaPippinState> {
	private state: CinemaPippinState

	constructor() {
		this.state = this.createInitialState()
	}

	getMetadata(): GameModuleMetadata {
		return {
			id: 'cinema-pippin',
			name: 'Cinema Pippin',
			description: 'Fill in the blanks of foreign film subtitles to create comedy gold',
			minPlayers: 2,
			maxPlayers: 20
		}
	}

	initialize(playerIds: string[]): void {
		// Load 3 random films
		const films = loadFilms()

		// Initialize state
		this.state = {
			phase: 'film_select',
			films,
			currentFilmIndex: 0,
			currentClipIndex: 0,
			keywords: [],
			playerAnswers: new Map(),
			houseAnswers: [],
			allAnswers: [],
			currentAnswerIndex: 0,
			votes: new Map(),
			scores: new Map(playerIds.map((id) => [id, 0])),
			clipWinners: [],
			filmTitle: '',
			endGameVotes: new Map(),
			answerTimeout: 60,
			houseAnswerCount: 1,
			totalPlayers: playerIds.length
		}
	}

	getState(): CinemaPippinState {
		return this.state
	}

	getPhase(): GamePhase {
		return this.state.phase
	}

	getCurrentFilm(): FilmData {
		return this.state.films[this.state.currentFilmIndex]
	}

	getCurrentClip(): ClipData {
		const film = this.getCurrentFilm()
		return film.clips[this.state.currentClipIndex]
	}

	setState(newState: CinemaPippinState): void {
		this.state = newState
	}

	submitAnswer(playerId: string, answer: string): void {
		this.state.playerAnswers.set(playerId, answer)
	}

	clearAnswers(): void {
		this.state.playerAnswers.clear()
	}

	advancePhase(): void {
		const phaseTransitions: Record<GamePhase, GamePhase> = {
			film_select: 'clip_intro',
			clip_intro: 'clip_playback',
			clip_playback: 'answer_collection',
			answer_collection: 'voting_playback',
			voting_playback: 'voting_collection',
			voting_collection: 'results_display',
			results_display: 'clip_intro', // Will be overridden by advanceToNextClip
			film_title_collection: 'film_title_voting',
			film_title_voting: 'film_title_results',
			film_title_results: 'final_montage',
			final_montage: 'next_film_or_end',
			next_film_or_end: 'final_scores', // Will be overridden by advanceToNextFilm
			final_scores: 'end_game_vote',
			end_game_vote: 'film_select' // Loop back if "play again"
		}

		this.state.phase = phaseTransitions[this.state.phase]
	}

	advanceToNextClip(): void {
		this.state.currentClipIndex++

		if (this.state.currentClipIndex >= 3) {
			// All 3 clips done, go to film title round
			this.state.phase = 'film_title_collection'
		} else {
			// Next clip
			this.state.phase = 'clip_intro'
		}
	}

	advanceToNextFilm(): void {
		this.state.currentFilmIndex++
		this.state.currentClipIndex = 0

		if (this.state.currentFilmIndex >= 3) {
			// All 3 films done
			this.state.phase = 'final_scores'
		} else {
			// Next film
			this.state.phase = 'clip_intro'
		}
	}

	handlePlayerAction(_playerId: string, action: unknown): void {
		const gameAction = action as { type: string; payload: unknown }

		console.log(
			'[CinemaPippinGame] Handling action:',
			gameAction.type,
			'in phase:',
			this.state.phase
		)

		switch (gameAction.type) {
			case 'FILM_SELECT_COMPLETE':
				if (this.state.phase === 'film_select') {
					this.state.phase = 'clip_intro'
					console.log('[CinemaPippinGame] Advanced to clip_intro')
				}
				break

			case 'INTRO_COMPLETE':
				if (this.state.phase === 'clip_intro') {
					this.state.phase = 'clip_playback'
					console.log('[CinemaPippinGame] Advanced to clip_playback')
				}
				break

			case 'VIDEO_COMPLETE':
				if (this.state.phase === 'clip_playback') {
					this.state.phase = 'answer_collection'
					this.state.answerCollectionStartTime = Date.now()
					console.log('[CinemaPippinGame] Advanced to answer_collection')
				} else if (this.state.phase === 'voting_playback') {
					// Advance to next answer or move to voting_collection
					this.state.currentAnswerIndex++
					if (this.state.currentAnswerIndex >= this.state.allAnswers.length) {
						// All answers shown, move to voting
						this.state.phase = 'voting_collection'
						console.log('[CinemaPippinGame] All answers shown, advanced to voting_collection')
					} else {
						// Stay in voting_playback, show next answer
						console.log(
							'[CinemaPippinGame] Showing next answer',
							this.state.currentAnswerIndex + 1,
							'/',
							this.state.allAnswers.length
						)
					}
				}
				break

			case 'SUBMIT_ANSWER': {
				// Handle answer submission
				const { answer } = gameAction.payload as { answer: string }
				this.state.playerAnswers.set(_playerId, answer)
				console.log(
					'[CinemaPippinGame] Player',
					_playerId,
					'submitted answer (',
					this.state.playerAnswers.size,
					'/',
					this.state.totalPlayers,
					')'
				)

				// Auto-advance if all players have submitted
				if (this.state.totalPlayers && this.state.playerAnswers.size >= this.state.totalPlayers) {
					console.log('[CinemaPippinGame] All players submitted, advancing to voting_playback')

					// Prepare answers for voting
					const answers: typeof this.state.allAnswers = []

					// Add all player answers
					for (const [playerId, answerText] of this.state.playerAnswers.entries()) {
						answers.push({
							id: `player-${playerId}`,
							text: answerText,
							authorId: playerId,
							votedBy: []
						})
					}

					// TODO: Add house answers from precomputedAnswers
					// For now, just shuffle player answers
					this.state.allAnswers = answers.sort(() => Math.random() - 0.5)
					this.state.currentAnswerIndex = 0
					this.state.phase = 'voting_playback'

					console.log(
						'[CinemaPippinGame] Prepared',
						this.state.allAnswers.length,
						'answers for voting'
					)
				}
				break
			}

			case 'SUBMIT_VOTE': {
				// Handle vote submission
				if (this.state.phase !== 'voting_collection') {
					console.log('[CinemaPippinGame] Ignoring SUBMIT_VOTE - not in voting_collection phase')
					break
				}

				const { answerId } = gameAction.payload as { answerId: string }
				this.state.votes.set(_playerId, answerId)
				console.log(
					'[CinemaPippinGame] Player',
					_playerId,
					'voted for',
					answerId,
					'(',
					this.state.votes.size,
					'/',
					this.state.totalPlayers,
					')'
				)

				// Auto-advance if all players have voted
				if (this.state.totalPlayers && this.state.votes.size >= this.state.totalPlayers) {
					console.log('[CinemaPippinGame] All players voted, advancing to results_display')
					this.state.phase = 'results_display'
				}
				break
			}

			case 'RESULTS_COMPLETE':
				if (this.state.phase === 'results_display') {
					// Advance to next clip
					this.advanceToNextClip()
					console.log('[CinemaPippinGame] Results complete, advanced to', this.state.phase)
				}
				break

			case 'FILM_TITLE_RESULTS_COMPLETE':
				if (this.state.phase === 'film_title_results') {
					this.state.phase = 'final_montage'
					console.log('[CinemaPippinGame] Film title results complete, advanced to final_montage')
				}
				break

			case 'FINAL_SCORES_COMPLETE':
				if (this.state.phase === 'final_scores') {
					this.state.phase = 'end_game_vote'
					console.log('[CinemaPippinGame] Final scores complete, advanced to end_game_vote')
				}
				break

			case 'MONTAGE_COMPLETE':
				if (this.state.phase === 'final_montage') {
					this.state.phase = 'next_film_or_end'
					console.log('[CinemaPippinGame] Montage complete, advanced to next_film_or_end')
				}
				break

			case 'NEXT_FILM_CHECK':
				if (this.state.phase === 'next_film_or_end') {
					this.advanceToNextFilm()
					console.log('[CinemaPippinGame] Next film check, advanced to', this.state.phase)
				}
				break

			default:
				console.log('[CinemaPippinGame] Unknown action type:', gameAction.type)
		}
	}

	private createInitialState(): CinemaPippinState {
		return {
			phase: 'film_select',
			films: [],
			currentFilmIndex: 0,
			currentClipIndex: 0,
			keywords: [],
			playerAnswers: new Map(),
			houseAnswers: [],
			allAnswers: [],
			currentAnswerIndex: 0,
			votes: new Map(),
			scores: new Map(),
			clipWinners: [],
			filmTitle: '',
			endGameVotes: new Map(),
			answerTimeout: 60,
			houseAnswerCount: 1
		}
	}
}
