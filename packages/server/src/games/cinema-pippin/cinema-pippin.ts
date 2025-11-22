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

	/**
	 * Calculate winner from votes
	 * Tie-breaking rules: most votes > human beats AI > random selection for tied humans
	 */
	calculateWinner(): (typeof this.state.allAnswers)[number] | null {
		if (this.state.allAnswers.length === 0) {
			return null
		}

		// Count votes for each answer
		const voteCounts = new Map<string, number>()
		for (const [, answerId] of this.state.votes) {
			voteCounts.set(answerId, (voteCounts.get(answerId) || 0) + 1)
		}

		// Find max vote count
		let maxVotes = 0
		for (const count of voteCounts.values()) {
			if (count > maxVotes) {
				maxVotes = count
			}
		}

		// Get all answers with max votes
		const topAnswers = this.state.allAnswers.filter(
			(answer) => (voteCounts.get(answer.id) || 0) === maxVotes
		)

		if (topAnswers.length === 0) {
			return this.state.allAnswers[0]
		}

		if (topAnswers.length === 1) {
			return topAnswers[0]
		}

		// Tie-breaking: human answers beat AI answers
		const humanAnswers = topAnswers.filter((a) => a.authorId !== 'house')
		if (humanAnswers.length > 0 && humanAnswers.length < topAnswers.length) {
			// There are humans and AI tied - pick random human
			return humanAnswers[Math.floor(Math.random() * humanAnswers.length)]
		}

		// All tied answers are same type (all human or all AI) - random selection
		return topAnswers[Math.floor(Math.random() * topAnswers.length)]
	}

	/**
	 * Get answers sorted by vote count (ascending - lowest first)
	 * Only includes answers that received at least 1 vote
	 */
	getSortedAnswersByVotes(): Array<{
		answer: (typeof this.state.allAnswers)[number]
		voteCount: number
		voters: string[]
	}> {
		// Count votes and track voters for each answer
		const answerData = new Map<
			string,
			{ answer: (typeof this.state.allAnswers)[number]; voteCount: number; voters: string[] }
		>()

		// Initialize with all answers
		for (const answer of this.state.allAnswers) {
			answerData.set(answer.id, {
				answer,
				voteCount: 0,
				voters: []
			})
		}

		// Count votes
		for (const [voterId, answerId] of this.state.votes) {
			const data = answerData.get(answerId)
			if (data) {
				data.voteCount++
				data.voters.push(voterId)
			}
		}

		// Filter to only answers with 1+ votes and sort by vote count (ascending)
		return Array.from(answerData.values())
			.filter((data) => data.voteCount > 0)
			.sort((a, b) => a.voteCount - b.voteCount)
	}

	/**
	 * Apply vote scores to player scores
	 * Each vote a player's answer receives = 1 point
	 */
	applyVoteScores(): void {
		// Count votes for each answer
		const voteCounts = new Map<string, number>()
		for (const [, answerId] of this.state.votes) {
			voteCounts.set(answerId, (voteCounts.get(answerId) || 0) + 1)
		}

		// Award points to players whose answers got votes
		for (const answer of this.state.allAnswers) {
			const voteCount = voteCounts.get(answer.id) || 0
			if (voteCount > 0 && answer.authorId !== 'house') {
				const currentScore = this.state.scores.get(answer.authorId) || 0
				this.state.scores.set(answer.authorId, currentScore + voteCount)
			}
		}
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

					// Calculate scores before showing results
					this.applyVoteScores()
					console.log('[CinemaPippinGame] Applied vote scores')

					this.state.phase = 'results_display'
				}
				break
			}

			case 'RESULTS_COMPLETE':
				if (this.state.phase === 'results_display') {
					// If this was C1 (clip index 0), store the winning answer as the keyword
					if (this.state.currentClipIndex === 0) {
						const winner = this.calculateWinner()
						if (winner) {
							this.state.keywords[this.state.currentFilmIndex] = winner.text
							console.log(
								'[CinemaPippinGame] Stored C1 winner as keyword:',
								winner.text,
								'for film',
								this.state.currentFilmIndex
							)
						}
					}

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
