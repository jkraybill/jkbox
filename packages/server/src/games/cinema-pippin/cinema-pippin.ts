/**
 * Cinema Pippin - Main Game Module
 */

import * as fs from 'fs'
import type { GameModuleMetadata, GameModule } from '@jkbox/shared'
import { loadFilms } from './film-loader'
import type { CinemaPippinState, GamePhase, FilmData, ClipData, AIPlayerData } from './types'
import {
	createAIPlayers,
	loadConstraints,
	shuffleConstraints,
	generateBatchAnswers,
	generateBatchFilmTitles,
	generateAIVote,
	type AIConfig
} from './ai-player'
import { getGlobalConfigStorage } from '../../storage/global-config-storage'

export class CinemaPippinGame implements GameModule<CinemaPippinState> {
	private state: CinemaPippinState
	private aiConfig: AIConfig
	private enableAI: boolean
	private answerTimeoutTimer: NodeJS.Timeout | null = null
	private votingTimeoutTimer: NodeJS.Timeout | null = null
	private aiGenerationInProgress: boolean = false
	private aiVotingInProgress: boolean = false
	private stateChangeCallback?: () => void

	constructor(enableAI = false) {
		this.state = this.createInitialState()
		this.enableAI = enableAI || process.env.ENABLE_AI_PLAYERS === 'true'
		this.aiConfig = {
			ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
			model: process.env.OLLAMA_MODEL || 'qwen-fast:latest',
			temperature: 0.9
		}
	}

	/**
	 * Set callback for async state changes (e.g., AI generation completing)
	 */
	setStateChangeCallback(callback: () => void): void {
		this.stateChangeCallback = callback
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

	initialize(playerIds: string[], aiPlayersFromLobby?: AIPlayerData[]): void {
		// Load 3 random films
		const films = loadFilms()

		let aiPlayers: AIPlayerData[] = []

		// Use AI players from lobby if provided, otherwise create from scratch
		if (aiPlayersFromLobby && aiPlayersFromLobby.length > 0) {
			aiPlayers = aiPlayersFromLobby
			console.log(
				`[CinemaPippinGame] Using ${aiPlayers.length} AI players from lobby:`,
				aiPlayers.map((ai) => `${ai.nickname} (${ai.constraint})`).join(', ')
			)
		} else if (this.enableAI) {
			// Fallback: Create AI players from global config (for tests)
			const globalConfig = getGlobalConfigStorage()
			const aiPlayerCount = globalConfig.getAIPlayerCount()

			if (aiPlayerCount > 0) {
				try {
					// Load and shuffle constraints
					const constraints = loadConstraints()
					const shuffled = shuffleConstraints(constraints)

					// Create AI players with constraints
					const aiPlayerInstances = createAIPlayers(aiPlayerCount, shuffled)

					// Convert to state format
					aiPlayers.push(
						...aiPlayerInstances.map((ai) => ({
							playerId: ai.playerId,
							nickname: ai.nickname,
							constraint: ai.constraint
						}))
					)

					console.log(
						`[CinemaPippinGame] Created ${aiPlayerCount} AI players from scratch:`,
						aiPlayers.map((ai) => `${ai.nickname} (${ai.constraint})`).join(', ')
					)
				} catch (error) {
					console.warn('[CinemaPippinGame] Failed to initialize AI players:', error)
					// Continue without AI players
				}
			}
		}

		// Initialize state
		// If AI players from lobby: they're already in playerIds
		// If created from scratch: need to add their IDs
		const allPlayerIds =
			aiPlayersFromLobby && aiPlayersFromLobby.length > 0
				? playerIds // AI players already included in playerIds from lobby
				: [...playerIds, ...aiPlayers.map((ai) => ai.playerId)] // Add AI player IDs

		this.state = {
			phase: 'film_select',
			films,
			currentFilmIndex: 0,
			currentClipIndex: 0,
			keywords: [],
			playerAnswers: new Map(),
			houseAnswerQueue: [],
			allAnswers: [],
			currentAnswerIndex: 0,
			votes: new Map(),
			scores: new Map(allPlayerIds.map((id) => [id, 0])),
			scoresBeforeRound: new Map(allPlayerIds.map((id) => [id, 0])),
			voteCountsThisRound: new Map(),
			clipWinners: [],
			filmTitle: '',
			endGameVotes: new Map(),
			answerTimeout: 60,
			votingTimeout: 30,
			totalPlayers: allPlayerIds.length,
			aiPlayers,
			playerStatus: new Map(allPlayerIds.map((id) => [id, {}])),
			playerErrors: new Map()
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

	clearVotes(): void {
		this.state.votes.clear()
		this.state.allAnswers = []
	}

	/**
	 * Calculate winner from votes
	 * Tie-breaking rules:
	 * 1. If all same type (all human OR all AI) → random from all
	 * 2. If single human + bots → human wins
	 * 3. If multiple humans + bots → random from humans only
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

		// Tie-breaking logic
		const humanAnswers = topAnswers.filter((a) => a.authorId !== 'house')
		const aiAnswers = topAnswers.filter((a) => a.authorId === 'house')

		// Case 1: All same type (all human OR all AI) → random from all
		if (humanAnswers.length === 0 || aiAnswers.length === 0) {
			return topAnswers[Math.floor(Math.random() * topAnswers.length)]
		}

		// Case 2: Single human + bots → human wins
		if (humanAnswers.length === 1) {
			return humanAnswers[0]
		}

		// Case 3: Multiple humans + bots → random from humans only
		return humanAnswers[Math.floor(Math.random() * humanAnswers.length)]
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
	 * Get points per vote based on current film (1/2/3)
	 */
	getPointsPerVote(): number {
		return this.state.currentFilmIndex + 1 // Film 1 = 1pt, Film 2 = 2pts, Film 3 = 3pts
	}

	/**
	 * Prepare scoreboard transition data (capture scores before applying votes)
	 * and calculate vote counts per player
	 */
	prepareScoreboardTransition(): void {
		// Save current scores (before this round)
		this.state.scoresBeforeRound = new Map(this.state.scores)

		// Count votes for each answer -> player
		const voteCountsPerPlayer = new Map<string, number>()
		const voteCounts = new Map<string, number>()

		for (const [, answerId] of this.state.votes) {
			voteCounts.set(answerId, (voteCounts.get(answerId) || 0) + 1)
		}

		// Map vote counts to players
		for (const answer of this.state.allAnswers) {
			const voteCount = voteCounts.get(answer.id) || 0
			if (voteCount > 0 && answer.authorId !== 'house') {
				voteCountsPerPlayer.set(answer.authorId, voteCount)
			}
		}

		this.state.voteCountsThisRound = voteCountsPerPlayer
		console.log('[CinemaPippinGame] Prepared scoreboard transition data')
		console.log('[CinemaPippinGame] Vote counts:', Array.from(voteCountsPerPlayer.entries()))
	}

	/**
	 * Apply vote scores to player scores
	 * Points per vote depend on current film (1/2/3)
	 */
	applyVoteScores(): void {
		const pointsPerVote = this.getPointsPerVote()

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
				this.state.scores.set(answer.authorId, currentScore + voteCount * pointsPerVote)
			}
		}

		console.log(`[CinemaPippinGame] Applied vote scores (${pointsPerVote} pts/vote)`)
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

		// Clear state from previous clip (votes, answers, player status flags)
		this.clearAnswers()
		this.clearVotes()

		// Reset player voting/answer status for new clip
		for (const [playerId, status] of this.state.playerStatus.entries()) {
			status.hasSubmittedAnswer = false
			status.hasVoted = false
			this.state.playerStatus.set(playerId, status)
		}

		if (this.state.currentClipIndex >= 3) {
			// All 3 clips done, go to film title round
			console.log('[CinemaPippinGame] Cleared state before film_title_collection')
			this.state.phase = 'film_title_collection'
			this.state.answerCollectionStartTime = Date.now()

			// Start answer timeout timer
			this.startAnswerTimeout()

			// Trigger AI film title generation (async, don't await)
			// AI players will be marked as submitted after their responses come back (with staggered delays)
			console.log('[CinemaPippinGame] Triggering AI film title generation...')
			void this.generateAIFilmTitles()
		} else {
			// Next clip
			console.log('[CinemaPippinGame] Cleared state before next clip')
			this.state.phase = 'clip_intro'
		}
	}

	advanceToNextFilm(): void {
		this.state.currentFilmIndex++
		this.state.currentClipIndex = 0

		// Clear state from previous film
		this.clearAnswers()
		this.clearVotes()
		// CRITICAL: Clear clipWinners to prevent keyword pollution between films
		// Bug: Without this, Film 2's C2/C3 would use Film 1's C1 winner as keyword
		this.state.clipWinners = []
		console.log('[CinemaPippinGame] Cleared state before new film or final_scores')

		if (this.state.currentFilmIndex >= 3) {
			// All 3 films done
			this.state.phase = 'final_scores'
		} else {
			// Next film - reset player statuses for new film
			for (const playerId of this.state.playerStatus.keys()) {
				this.state.playerStatus.set(playerId, {})
			}
			console.log('[CinemaPippinGame] Reset player statuses for new film')

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

					// Clear previous clip's answers
					this.clearAnswers()
					console.log('[CinemaPippinGame] Cleared previous answers for new clip')

					// Reset player statuses for answer submission
					console.log('[CinemaPippinGame] Resetting player statuses for answer collection')
					for (const playerId of this.state.playerStatus.keys()) {
						this.state.playerStatus.set(playerId, {})
						console.log(`  - Reset status for ${playerId}`)
					}

					console.log('[CinemaPippinGame] Advanced to answer_collection')
					console.log(
						`[CinemaPippinGame] Active players: ${this.state.scores.size}, AI players: ${this.state.aiPlayers.length}`
					)

					// Start answer timeout timer
					this.startAnswerTimeout()

					// Trigger AI answer generation (async, don't await)
					// AI players will be marked as submitted after their responses come back (with staggered delays)
					console.log('[CinemaPippinGame] Triggering AI answer generation...')
					void this.generateAIAnswers()
				} else if (this.state.phase === 'voting_playback') {
					// Guard against empty allAnswers (skip voting if no answers)
					if (this.state.allAnswers.length === 0) {
						console.error('[CinemaPippinGame] ERROR: No answers to vote on! Skipping voting phase.')
						// Skip to results with empty state
						this.state.phase = 'results_display'
						// No results to calculate if no answers
						break
					}

					// Advance to next answer or move to voting_collection
					this.state.currentAnswerIndex++
					if (this.state.currentAnswerIndex >= this.state.allAnswers.length) {
						// All answers shown, move to voting
						this.state.phase = 'voting_collection'
						this.state.votingCollectionStartTime = Date.now()

						// Reset player statuses for voting
						for (const playerId of this.state.playerStatus.keys()) {
							const status = this.state.playerStatus.get(playerId) || {}
							status.hasVoted = false
							this.state.playerStatus.set(playerId, status)
						}

						console.log('[CinemaPippinGame] All answers shown, advanced to voting_collection')

						// Start voting timeout timer
						this.startVotingTimeout()

						// Trigger AI voting (async, don't await)
						// AI players will be marked as voted after their responses come back (with staggered delays)
						void this.generateAIVotes()
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
				// Handle answer submission (for both clips and film titles)
				const { answer } = gameAction.payload as { answer: string }
				const trimmedAnswer = answer.trim()

				// Clear any previous errors for this player
				this.state.playerErrors.delete(_playerId)

				// For C1 (clip index 0) or film_title_collection, check for duplicate answers (case-insensitive)
				if (this.state.currentClipIndex === 0 || this.state.phase === 'film_title_collection') {
					const normalizedAnswer = trimmedAnswer.toLowerCase()
					const existingAnswers = Array.from(this.state.playerAnswers.entries())

					// Check if any other player (human or AI) already submitted this answer
					const isDuplicate = existingAnswers.some(
						([playerId, existingAnswer]) =>
							playerId !== _playerId && existingAnswer.toLowerCase() === normalizedAnswer
					)

					if (isDuplicate) {
						// Set error for this player
						this.state.playerErrors.set(_playerId, {
							playerId: _playerId,
							message: 'Someone else already answered that, try again!',
							code: 'DUPLICATE_ANSWER'
						})

						console.log(
							`[CinemaPippinGame] Player ${_playerId} submitted duplicate C1 answer: "${trimmedAnswer}"`
						)

						// Don't save the answer, return early
						break
					}
				}

				// Valid answer - save it
				this.state.playerAnswers.set(_playerId, trimmedAnswer)

				// Update player status
				const status = this.state.playerStatus.get(_playerId) || {}
				status.hasSubmittedAnswer = true
				this.state.playerStatus.set(_playerId, status)

				console.log(
					'[CinemaPippinGame] Player',
					_playerId,
					'submitted answer (',
					this.state.playerAnswers.size,
					'/',
					this.state.totalPlayers,
					')'
				)

				// Auto-advance if all active players have submitted
				// Use scores.size instead of totalPlayers to handle disconnected players
				const activePlayers = this.state.scores.size
				if (activePlayers && this.state.playerAnswers.size >= activePlayers) {
					// Check if AI generation is still in progress AND there are actual AI players
					// (House answer generation doesn't block since it's just fallback for timeouts)
					const hasAIPlayers = this.state.aiPlayers.length > 0
					if (this.aiGenerationInProgress && hasAIPlayers) {
						console.log(
							'[CinemaPippinGame] All active players submitted (',
							this.state.playerAnswers.size,
							'/',
							activePlayers,
							'), but waiting for AI player answer generation to complete'
						)
						// Don't advance yet - generateAIAnswers will trigger advance when done
						break
					}

					// Clear the timeout timer since all players submitted
					this.clearAnswerTimeout()

					// Film title round has no playback, go straight to voting
					if (this.state.phase === 'film_title_collection') {
						console.log(
							'[CinemaPippinGame] All film titles submitted (',
							this.state.playerAnswers.size,
							'/',
							activePlayers,
							'), advancing to film_title_voting'
						)
						this.advanceToFilmTitleVoting()
					} else {
						console.log(
							'[CinemaPippinGame] All active players submitted (',
							this.state.playerAnswers.size,
							'/',
							activePlayers,
							'), advancing to voting_playback'
						)
						this.advanceToVotingPlayback()
					}
				}
				break
			}

			case 'SUBMIT_VOTE': {
				// Handle vote submission (for both clip voting and film title voting)
				if (this.state.phase !== 'voting_collection' && this.state.phase !== 'film_title_voting') {
					console.log('[CinemaPippinGame] Ignoring SUBMIT_VOTE - not in voting phase')
					break
				}

				const { answerId } = gameAction.payload as { answerId: string }
				this.state.votes.set(_playerId, answerId)

				// Update player status
				const status = this.state.playerStatus.get(_playerId) || {}
				status.hasVoted = true
				this.state.playerStatus.set(_playerId, status)

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

				// Auto-advance if all active players have voted
				// Use scores.size instead of totalPlayers to handle disconnected players
				const activePlayersVoting = this.state.scores.size
				if (activePlayersVoting && this.state.votes.size >= activePlayersVoting) {
					// Check if AI voting is still in progress AND there are actual AI players
					const hasAIPlayers = this.state.aiPlayers.length > 0
					if (this.aiVotingInProgress && hasAIPlayers) {
						console.log(
							'[CinemaPippinGame] All active players voted (',
							this.state.votes.size,
							'/',
							activePlayersVoting,
							'), but waiting for AI player voting to complete'
						)
						// Don't advance yet - generateAIVotes will trigger advance when done
						break
					}

					// Clear the voting timeout timer since all players voted
					this.clearVotingTimeout()

					console.log(
						'[CinemaPippinGame] All active players voted (',
						this.state.votes.size,
						'/',
						activePlayersVoting,
						'), advancing to results'
					)

					// Prepare scoreboard transition data (save scores BEFORE applying votes)
					this.prepareScoreboardTransition()

					// Calculate scores before showing results
					this.applyVoteScores()
					console.log('[CinemaPippinGame] Applied vote scores')

					// Advance to appropriate results phase
					if (this.state.phase === 'film_title_voting') {
						// Store winning film title
						const winner = this.calculateWinner()
						if (winner) {
							this.state.filmTitle = winner.text
							console.log('[CinemaPippinGame] Stored winning film title:', winner.text)
						}
						this.state.phase = 'film_title_results'
					} else {
						this.state.phase = 'results_display'
					}
				}
				break
			}

			case 'RESULTS_COMPLETE':
				if (this.state.phase === 'results_display') {
					// Store the winning answer in clipWinners array
					const winner = this.calculateWinner()
					if (winner) {
						this.state.clipWinners.push(winner.text)
						console.log(
							'[CinemaPippinGame] Stored clip',
							this.state.currentClipIndex + 1,
							'winner:',
							winner.text
						)

						// If this was C1 (clip index 0), also store as keyword for [keyword] replacement
						if (this.state.currentClipIndex === 0) {
							this.state.keywords[this.state.currentFilmIndex] = winner.text
							console.log(
								'[CinemaPippinGame] Stored C1 winner as keyword for film',
								this.state.currentFilmIndex
							)
						}
					}

					// Transition to scoreboard animation
					this.state.phase = 'scoreboard_transition'
					console.log('[CinemaPippinGame] Results complete, advancing to scoreboard_transition')
				}
				break

			case 'SCOREBOARD_COMPLETE':
				if (this.state.phase === 'scoreboard_transition') {
					// Advance to next clip after scoreboard animation
					this.advanceToNextClip()
					console.log('[CinemaPippinGame] Scoreboard complete, advanced to', this.state.phase)
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

			case 'END_GAME_COMPLETE':
				if (this.state.phase === 'end_game_vote') {
					// Module layer will call context.complete() to return to lobby
					console.log('[CinemaPippinGame] End game complete, module will handle lobby transition')
					// No phase change needed - module calls context.complete()
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

	/**
	 * Generate batch answers (AI + house) during answer_collection phase
	 */
	private async generateAIAnswers(): Promise<void> {
		const clipNumber = (this.state.currentClipIndex + 1) as 1 | 2 | 3
		const keyword = clipNumber === 1 ? 'blank' : this.state.clipWinners[0] || 'blank'

		const aiConstraints = this.state.aiPlayers.map((ai) => ai.constraint)
		const playerCount = this.state.scores.size

		// Load the SRT text for context
		const currentClip = this.getCurrentClip()
		const questionSrt = fs.readFileSync(currentClip.srtPath, 'utf-8')

		// Build previous clips context (for T > 1)
		const previousClips: Array<{ srtText: string; winningAnswer: string; keyword: string }> = []
		const currentFilm = this.getCurrentFilm()

		// C1 winner is always the "keyword" used in [keyword] placeholders
		const c1Winner = this.state.clipWinners[0] || ''

		for (let i = 0; i < this.state.currentClipIndex; i++) {
			const prevClip = currentFilm.clips[i]
			if (!prevClip) continue

			const prevSrt = fs.readFileSync(prevClip.srtPath, 'utf-8')
			const prevWinningAnswer = this.state.clipWinners[i] || ''

			previousClips.push({
				srtText: prevSrt,
				winningAnswer: prevWinningAnswer,
				keyword: c1Winner // Always use C1 winner for [keyword] replacement
			})
		}

		// ALWAYS block auto-advance during generation (for both AI players + house answers)
		// The auto-advance check will only wait if there are actual AI players
		this.aiGenerationInProgress = true
		const hasAIPlayers = aiConstraints.length > 0
		if (hasAIPlayers) {
			console.log('[AI] Generation started for AI players, blocking auto-advance until complete')
		} else {
			console.log('[AI] Generation started for house answers only (fallback for timeouts)')
		}

		console.log(
			`[AI] Generating batch answers: ${aiConstraints.length} AI + ${playerCount} house for clip ${clipNumber}...`
		)
		console.log(
			`[AI] AI Players:`,
			this.state.aiPlayers.map((ai) => `${ai.nickname} (${ai.playerId})`)
		)

		try {
			// Generate X AI + N house answers in one batch
			const batchAnswers = await generateBatchAnswers(
				this.aiConfig,
				clipNumber,
				keyword,
				aiConstraints,
				playerCount,
				questionSrt,
				previousClips,
				currentClip.srtPath
			)

			console.log(`[AI] Batch generation returned ${batchAnswers.length} answers`)

			// First X answers are for AI players (in randomized constraint order from batch generation)
			// We need to map them back to the correct AI players
			// Since batch generation randomizes, we'll assign in order
			const aiAnswers = batchAnswers.slice(0, aiConstraints.length)
			const houseAnswers = batchAnswers.slice(aiConstraints.length)

			console.log(
				`[AI] Assigning ${aiAnswers.length} answers to AI players with staggered delays...`
			)

			// Assign AI answers with staggered delays (like voting)
			const assignmentPromises = this.state.aiPlayers.map(async (aiPlayer, index) => {
				const answer = aiAnswers[index]

				// Wait random delay (0-1500ms) before showing as "submitted"
				const delay = Math.floor(Math.random() * 1500)
				console.log(`[AI] Delaying ${aiPlayer.nickname} answer UI update by ${delay}ms`)
				await new Promise((resolve) => setTimeout(resolve, delay))

				// Assign answer
				this.state.playerAnswers.set(aiPlayer.playerId, answer)

				// Mark AI player as having submitted answer
				const status = this.state.playerStatus.get(aiPlayer.playerId) || {}
				status.hasSubmittedAnswer = true
				this.state.playerStatus.set(aiPlayer.playerId, status)

				console.log(
					`[AI] ✓ ${aiPlayer.nickname} (${aiPlayer.playerId}): "${answer}" - Status marked: hasSubmittedAnswer=true`
				)

				// Trigger state update to broadcast this AI answer to clients
				if (this.stateChangeCallback) {
					this.stateChangeCallback()
				}
			})

			// Wait for all AI assignments to complete
			await Promise.all(assignmentPromises)

			// Store house answers in queue
			this.state.houseAnswerQueue = houseAnswers
			console.log(`[AI] Generated ${houseAnswers.length} house answers for timeout fallback`)
		} catch (error) {
			console.error('[AI] Batch answer generation failed, using fallback:', error)
			// Fallback: Load from answers.json files
			try {
				await this.loadFallbackAnswers(clipNumber)
			} catch (fallbackError) {
				console.error('[AI] Fallback answers also failed, leaving placeholders:', fallbackError)
				// If fallback fails too, placeholders remain but we'll still auto-advance
			}
		} finally {
			console.log(
				`[AI] Submitted answers. Total: ${this.state.playerAnswers.size}/${this.state.scores.size}`
			)

			// Log final playerStatus for debugging
			console.log('[AI] Final playerStatus after AI generation:')
			for (const [playerId, status] of this.state.playerStatus.entries()) {
				const playerName =
					this.state.aiPlayers.find((ai) => ai.playerId === playerId)?.nickname || playerId
				console.log(
					`  - ${playerName}: hasSubmittedAnswer=${status.hasSubmittedAnswer}, hasVoted=${status.hasVoted}`
				)
			}

			// Mark generation complete and check if we should auto-advance
			this.aiGenerationInProgress = false
			console.log('[AI] Generation complete, checking if auto-advance needed')

			// Check if all players have now submitted (might have happened during generation)
			const activePlayers = this.state.scores.size
			if (
				this.state.phase === 'answer_collection' &&
				activePlayers &&
				this.state.playerAnswers.size >= activePlayers
			) {
				console.log('[AI] All players submitted during generation, advancing now')
				this.clearAnswerTimeout()
				this.advanceToVotingPlayback()

				// Notify module of state change so it can broadcast to clients
				if (this.stateChangeCallback) {
					console.log('[AI] Triggering state change callback to broadcast update')
					this.stateChangeCallback()
				}
			}
		}
	}

	/**
	 * Generate batch film titles (AI + house) during film_title_collection phase
	 */
	private async generateAIFilmTitles(): Promise<void> {
		// Get the 3 winning answers from clipWinners
		const act1Winner = this.state.clipWinners[0] || 'mystery'
		const act2Winner = this.state.clipWinners[1] || 'intrigue'
		const act3Winner = this.state.clipWinners[2] || 'revelation'

		const aiConstraints = this.state.aiPlayers.map((ai) => ai.constraint)
		const playerCount = this.state.scores.size

		// ALWAYS block auto-advance during generation
		this.aiGenerationInProgress = true
		const hasAIPlayers = aiConstraints.length > 0
		if (hasAIPlayers) {
			console.log(
				'[AI] Film title generation started for AI players, blocking auto-advance until complete'
			)
		} else {
			console.log('[AI] Film title generation started for house titles only')
		}

		console.log(`[AI] Generating ${aiConstraints.length} AI + ${playerCount} house film titles...`)
		console.log(
			`[AI] AI Players:`,
			this.state.aiPlayers.map((ai) => `${ai.nickname} (${ai.playerId})`)
		)
		console.log(`[AI] Clip winners: "${act1Winner}", "${act2Winner}", "${act3Winner}"`)

		try {
			// Generate X AI + N house film titles in one batch
			const batchTitles = await generateBatchFilmTitles(
				this.aiConfig,
				act1Winner,
				act2Winner,
				act3Winner,
				aiConstraints,
				playerCount
			)

			console.log(`[AI] Batch generation returned ${batchTitles.length} film titles`)

			// First X titles are for AI players
			const aiTitles = batchTitles.slice(0, aiConstraints.length)
			const houseTitles = batchTitles.slice(aiConstraints.length)

			console.log(`[AI] Assigning ${aiTitles.length} titles to AI players with staggered delays...`)

			// Assign AI titles with staggered delays (like voting)
			const assignmentPromises = this.state.aiPlayers.map(async (aiPlayer, index) => {
				const title = aiTitles[index]

				// Wait random delay (0-1500ms) before showing as "submitted"
				const delay = Math.floor(Math.random() * 1500)
				console.log(`[AI] Delaying ${aiPlayer.nickname} film title UI update by ${delay}ms`)
				await new Promise((resolve) => setTimeout(resolve, delay))

				// Assign title
				this.state.playerAnswers.set(aiPlayer.playerId, title)

				// Mark AI player as having submitted title
				const status = this.state.playerStatus.get(aiPlayer.playerId) || {}
				status.hasSubmittedAnswer = true
				this.state.playerStatus.set(aiPlayer.playerId, status)

				console.log(`[AI] ✓ ${aiPlayer.nickname} (${aiPlayer.playerId}): "${title}"`)

				// Trigger state update to broadcast this AI title to clients
				if (this.stateChangeCallback) {
					this.stateChangeCallback()
				}
			})

			// Wait for all AI assignments to complete
			await Promise.all(assignmentPromises)

			// Store house titles in queue
			this.state.houseAnswerQueue = houseTitles
			console.log(`[AI] Generated ${houseTitles.length} house film titles for timeout fallback`)
		} catch (error) {
			console.error('[AI] Film title generation failed, using fallback:', error)
			// Fallback: Use generic film titles
			const fallbackTitles = [
				'The Mystery Continues',
				'A Foreign Affair',
				'Tales of the Unexpected',
				'The Final Chapter',
				'Shadows and Light',
				'The Last Dance',
				'Beyond the Horizon',
				'Midnight Revelations'
			]

			const shuffled = this.shuffleArray([...fallbackTitles])

			// Assign to AI players
			this.state.aiPlayers.forEach((aiPlayer, index) => {
				if (index < shuffled.length) {
					const title = shuffled[index]
					this.state.playerAnswers.set(aiPlayer.playerId, title)

					const status = this.state.playerStatus.get(aiPlayer.playerId) || {}
					status.hasSubmittedAnswer = true
					this.state.playerStatus.set(aiPlayer.playerId, status)

					console.log(`[AI FALLBACK] ${aiPlayer.nickname}: "${title}"`)
				}
			})

			// Broadcast state update so clients see AI players marked as submitted
			if (this.stateChangeCallback) {
				this.stateChangeCallback()
			}

			// Store rest as house titles
			const aiCount = this.state.aiPlayers.length
			this.state.houseAnswerQueue = shuffled.slice(aiCount, aiCount + playerCount)
			console.log(`[AI FALLBACK] Using ${this.state.houseAnswerQueue.length} fallback titles`)
		} finally {
			console.log(
				`[AI] Film titles submitted. Total: ${this.state.playerAnswers.size}/${this.state.scores.size}`
			)

			// Mark generation complete and check if we should auto-advance
			this.aiGenerationInProgress = false
			console.log('[AI] Film title generation complete, checking if auto-advance needed')

			// Check if all players have now submitted
			const activePlayers = this.state.scores.size
			if (
				this.state.phase === 'film_title_collection' &&
				activePlayers &&
				this.state.playerAnswers.size >= activePlayers
			) {
				console.log('[AI] All players submitted film titles during generation, advancing now')
				this.clearAnswerTimeout()
				this.advanceToFilmTitleVoting()

				// Notify module of state change so it can broadcast to clients
				if (this.stateChangeCallback) {
					console.log('[AI] Triggering state change callback to broadcast update')
					this.stateChangeCallback()
				}
			}
		}
	}

	/**
	 * Load fallback answers from answers.json files when AI generation fails
	 */
	private async loadFallbackAnswers(clipNumber: 1 | 2 | 3): Promise<void> {
		try {
			const currentFilm = this.getCurrentFilm()
			const currentClip = currentFilm.clips[this.state.currentClipIndex]

			// Load answers.json from clip directory (same directory as the SRT file)
			const path = await import('path')
			const clipDir = path.dirname(currentClip.srtPath)
			const answersPath = path.join(clipDir, 'answers.json')
			const fs = await import('fs/promises')
			const answersData = await fs.readFile(answersPath, 'utf-8')
			const parsed = JSON.parse(answersData) as { answers: string[][] }

			// answers.json is { answers: [[c1], [c2], [c3]] } - outer index = clip number (0-2)
			const answersArray = parsed.answers || []
			const clipAnswers = answersArray[clipNumber - 1] || []

			// Shuffle and take what we need
			const shuffled = this.shuffleArray([...clipAnswers])
			const aiCount = this.state.aiPlayers.length
			const playerCount = this.state.scores.size

			// Assign to AI players
			this.state.aiPlayers.forEach((aiPlayer, index) => {
				if (index < shuffled.length) {
					const answer = shuffled[index]
					this.state.playerAnswers.set(aiPlayer.playerId, answer)

					// Mark AI player as having submitted answer
					const status = this.state.playerStatus.get(aiPlayer.playerId) || {}
					status.hasSubmittedAnswer = true
					this.state.playerStatus.set(aiPlayer.playerId, status)

					console.log(`[AI FALLBACK] ${aiPlayer.nickname}: "${answer}"`)
				}
			})

			// Broadcast state update so clients see AI players marked as submitted
			if (this.stateChangeCallback) {
				this.stateChangeCallback()
			}

			// Store rest as house answers
			this.state.houseAnswerQueue = shuffled.slice(aiCount, aiCount + playerCount)
			console.log(`[AI FALLBACK] Loaded ${this.state.houseAnswerQueue.length} house answers`)
		} catch (error) {
			console.error('[AI FALLBACK] Failed to load answers.json:', error)
			// Last resort: Use generic placeholders
			this.state.houseAnswerQueue = Array.from(
				{ length: this.state.scores.size },
				(_, i) => `answer ${i + 1}`
			)
		}
	}

	/**
	 * Generate AI player votes during voting_collection phase
	 */
	private async generateAIVotes(): Promise<void> {
		if (this.state.aiPlayers.length === 0) {
			return
		}

		this.aiVotingInProgress = true
		console.log(`[AI] Voting started, blocking auto-advance until complete`)
		console.log(`[AI] Generating ${this.state.aiPlayers.length} AI votes...`)

		// Generate all AI votes in parallel (but with staggered UI updates)
		const votePromises = this.state.aiPlayers.map(async (aiPlayer) => {
			try {
				// Filter out this AI player's own answer (can't vote for yourself!)
				const answerList = this.state.allAnswers
					.filter((a) => a.authorId !== aiPlayer.playerId)
					.map((a) => ({ id: a.id, text: a.text }))

				// Generate the vote (happens instantly with Claude)
				const votedAnswerId = await generateAIVote(this.aiConfig, answerList, aiPlayer.constraint)

				console.log(
					`[AI] ${aiPlayer.nickname} (${aiPlayer.constraint}) voted for: ${votedAnswerId}`
				)

				// Wait random delay (0-1500ms) before showing as "voted"
				const delay = Math.floor(Math.random() * 1500)
				console.log(`[AI] Delaying ${aiPlayer.nickname} vote UI update by ${delay}ms`)
				await new Promise((resolve) => setTimeout(resolve, delay))

				// Submit the vote (simulate SUBMIT_VOTE action)
				this.state.votes.set(aiPlayer.playerId, votedAnswerId)

				// Mark AI player as having voted
				const status = this.state.playerStatus.get(aiPlayer.playerId) || {}
				status.hasVoted = true
				this.state.playerStatus.set(aiPlayer.playerId, status)

				// Update votedBy array
				const answer = this.state.allAnswers.find((a) => a.id === votedAnswerId)
				if (answer) {
					answer.votedBy.push(aiPlayer.playerId)
				}

				// Trigger state update to broadcast this AI vote to clients
				if (this.stateChangeCallback) {
					this.stateChangeCallback()
				}
			} catch (error) {
				console.error(`[AI] Failed to generate vote for ${aiPlayer.nickname}:`, error)
			}
		})

		await Promise.all(votePromises)

		// Mark voting complete
		this.aiVotingInProgress = false
		console.log('[AI] Voting complete, checking if auto-advance needed')
		console.log(
			`[AI] Generated votes. Total votes: ${this.state.votes.size}/${this.state.scores.size}`
		)

		// Check if all players (human + AI) have voted
		const activePlayersVoting = this.state.scores.size
		if (activePlayersVoting && this.state.votes.size >= activePlayersVoting) {
			console.log('[AI] All players voted (including AI), advancing to results_display')

			// Calculate scores before showing results
			this.applyVoteScores()
			console.log('[AI] Applied vote scores')

			// NOTE: Winner is stored in clipWinners array by RESULTS_COMPLETE handler
			// when leaving results_display phase, not here when entering it

			this.state.phase = 'results_display'
			console.log('[AI] Advanced to results_display')

			// Notify module of state change so it can broadcast to clients
			if (this.stateChangeCallback) {
				console.log('[AI] Triggering state change callback to broadcast update')
				this.stateChangeCallback()
			}
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
			houseAnswerQueue: [],
			allAnswers: [],
			currentAnswerIndex: 0,
			votes: new Map(),
			scores: new Map(),
			clipWinners: [],
			filmTitle: '',
			endGameVotes: new Map(),
			answerTimeout: 60,
			votingTimeout: 30,
			aiPlayers: [],
			playerStatus: new Map(),
			playerErrors: new Map()
		}
	}

	/**
	 * Fisher-Yates shuffle
	 */
	private shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array]
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
		}
		return shuffled
	}

	/**
	 * Start answer timeout timer
	 */
	private startAnswerTimeout(): void {
		this.clearAnswerTimeout() // Clear any existing timer

		const timeoutMs = this.state.answerTimeout * 1000
		this.answerTimeoutTimer = setTimeout(() => {
			this.handleAnswerTimeout()
		}, timeoutMs)

		console.log(`[CinemaPippinGame] Started answer timeout timer: ${this.state.answerTimeout}s`)
	}

	/**
	 * Clear answer timeout timer
	 */
	private clearAnswerTimeout(): void {
		if (this.answerTimeoutTimer) {
			clearTimeout(this.answerTimeoutTimer)
			this.answerTimeoutTimer = null
		}
	}

	/**
	 * Handle answer timeout - assign house answers to non-submitters
	 */
	private handleAnswerTimeout(): void {
		console.log('[CinemaPippinGame] Answer timeout expired')
		console.log('[CinemaPippinGame] scores.size:', this.state.scores.size)
		console.log(
			'[CinemaPippinGame] playerAnswers.size BEFORE timeout:',
			this.state.playerAnswers.size
		)
		console.log(
			'[CinemaPippinGame] playerAnswers BEFORE:',
			Array.from(this.state.playerAnswers.entries())
		)
		console.log('[CinemaPippinGame] houseAnswerQueue.length:', this.state.houseAnswerQueue.length)

		// Find players who haven't submitted
		const nonSubmitters: string[] = []
		for (const playerId of this.state.scores.keys()) {
			if (!this.state.playerAnswers.has(playerId)) {
				nonSubmitters.push(playerId)
			}
		}

		if (nonSubmitters.length > 0) {
			console.log(
				`[CinemaPippinGame] Assigning house answers to ${nonSubmitters.length} non-submitters:`,
				nonSubmitters
			)

			// Assign house answers to non-submitters
			for (let i = 0; i < nonSubmitters.length; i++) {
				const playerId = nonSubmitters[i]
				const houseAnswer = this.state.houseAnswerQueue[i] || `answer ${i + 1}` // Fallback

				this.state.playerAnswers.set(playerId, houseAnswer)

				// Don't mark hasSubmittedAnswer as true - this lets us detect house answers later
				// The player status remains with hasSubmittedAnswer: false/undefined

				console.log(`[CinemaPippinGame] Assigned house answer to ${playerId}: "${houseAnswer}"`)
			}
		}

		console.log(
			'[CinemaPippinGame] playerAnswers.size AFTER timeout:',
			this.state.playerAnswers.size
		)
		console.log(
			'[CinemaPippinGame] playerAnswers AFTER:',
			Array.from(this.state.playerAnswers.entries())
		)

		// Advance to voting playback
		this.advanceToVotingPlayback()
	}

	/**
	 * Advance to voting playback phase
	 * Public to allow tests to skip AI generation wait
	 */
	advanceToVotingPlayback(): void {
		// Clear votes from previous clip
		this.clearVotes()
		console.log('[CinemaPippinGame] Cleared votes and allAnswers for new voting round')

		console.log(
			'[CinemaPippinGame] Film',
			this.state.currentFilmIndex + 1,
			'Clip',
			this.state.currentClipIndex + 1,
			'- playerAnswers.size:',
			this.state.playerAnswers.size
		)
		console.log('[CinemaPippinGame] playerAnswers:', Array.from(this.state.playerAnswers.entries()))
		console.log('[CinemaPippinGame] playerStatus:', Array.from(this.state.playerStatus.entries()))

		// Guard against empty playerAnswers
		if (this.state.playerAnswers.size === 0) {
			console.error('[CinemaPippinGame] ERROR: No player answers to create voting round from!')
			console.error(
				'[CinemaPippinGame] Film',
				this.state.currentFilmIndex + 1,
				'Clip',
				this.state.currentClipIndex + 1
			)
			console.error('[CinemaPippinGame] Current phase:', this.state.phase)
			console.error('[CinemaPippinGame] scores.size:', this.state.scores.size)
			console.error('[CinemaPippinGame] aiPlayers.length:', this.state.aiPlayers.length)
			console.error(
				'[CinemaPippinGame] houseAnswerQueue.length:',
				this.state.houseAnswerQueue.length
			)
			// This is a critical bug - we should not be here with 0 answers
			// Skip voting entirely and go to next clip
			this.state.phase = 'results_display'
			// No results to calculate with 0 answers
			return
		}

		// Prepare answers for voting
		const answers: typeof this.state.allAnswers = []

		// Add all player answers (including house-assigned ones)
		for (const [playerId, answerText] of this.state.playerAnswers.entries()) {
			// Check if this was a house answer assigned due to timeout
			const isHouseAnswer =
				!this.state.aiPlayers.some((ai) => ai.playerId === playerId) &&
				!this.state.playerStatus.get(playerId)?.hasSubmittedAnswer

			answers.push({
				id: `player-${playerId}`,
				text: answerText,
				authorId: playerId,
				isHouseAnswer,
				houseAssignedTo: isHouseAnswer ? playerId : undefined,
				votedBy: []
			})
		}

		// Shuffle answers
		this.state.allAnswers = this.shuffleArray(answers)
		this.state.currentAnswerIndex = 0
		this.state.phase = 'voting_playback'

		console.log('[CinemaPippinGame] Prepared', this.state.allAnswers.length, 'answers for voting')
	}

	advanceToFilmTitleVoting(): void {
		// Clear votes from previous round
		this.clearVotes()
		console.log('[CinemaPippinGame] Cleared votes and allAnswers for film title voting')

		// Prepare film title answers for voting
		const answers: typeof this.state.allAnswers = []

		// Add all player film title answers
		for (const [playerId, titleText] of this.state.playerAnswers.entries()) {
			answers.push({
				id: `player-${playerId}`,
				text: titleText,
				authorId: playerId,
				votedBy: []
			})
		}

		// Shuffle film titles
		this.state.allAnswers = this.shuffleArray(answers)
		this.state.phase = 'film_title_voting'

		console.log(
			'[CinemaPippinGame] Prepared',
			this.state.allAnswers.length,
			'film titles for voting'
		)

		// Start voting timeout
		this.startVotingTimeout()

		// Reset player voting status
		for (const playerId of this.state.playerStatus.keys()) {
			const status = this.state.playerStatus.get(playerId) || {}
			status.hasVoted = false
			this.state.playerStatus.set(playerId, status)
		}

		// Trigger AI voting (async)
		// AI players will be marked as voted after their responses come back (with staggered delays)
		void this.generateAIVotes()
	}

	/**
	 * Start voting timeout timer
	 */
	private startVotingTimeout(): void {
		this.clearVotingTimeout() // Clear any existing timer

		const timeoutMs = this.state.votingTimeout * 1000
		this.votingTimeoutTimer = setTimeout(() => {
			this.handleVotingTimeout()
		}, timeoutMs)

		console.log(`[CinemaPippinGame] Started voting timeout timer: ${this.state.votingTimeout}s`)
	}

	/**
	 * Clear voting timeout timer
	 */
	private clearVotingTimeout(): void {
		if (this.votingTimeoutTimer) {
			clearTimeout(this.votingTimeoutTimer)
			this.votingTimeoutTimer = null
		}
	}

	/**
	 * Handle voting timeout - non-voters simply don't vote
	 */
	private handleVotingTimeout(): void {
		console.log('[CinemaPippinGame] Voting timeout expired')

		// Find players who haven't voted
		const nonVoters: string[] = []
		for (const playerId of this.state.scores.keys()) {
			if (!this.state.votes.has(playerId)) {
				nonVoters.push(playerId)
			}
		}

		if (nonVoters.length > 0) {
			console.log(`[CinemaPippinGame] ${nonVoters.length} players did not vote:`, nonVoters)
		}

		// Calculate scores before showing results
		this.applyVoteScores()
		console.log('[CinemaPippinGame] Applied vote scores')

		this.state.phase = 'results_display'
		console.log('[CinemaPippinGame] Advanced to results_display (voting timeout)')
	}
}
