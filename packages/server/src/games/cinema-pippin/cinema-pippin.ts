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
			// Clear state from previous clip voting
			this.clearAnswers()
			this.clearVotes()
			console.log('[CinemaPippinGame] Cleared state before film_title_collection')

			this.state.phase = 'film_title_collection'
		} else {
			// Next clip
			this.state.phase = 'clip_intro'
		}
	}

	advanceToNextFilm(): void {
		this.state.currentFilmIndex++
		this.state.currentClipIndex = 0

		// Clear state from previous film
		this.clearAnswers()
		this.clearVotes()
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

					// Pre-mark AI players as having submitted (before async generation)
					// This ensures clients see AI players as "submitted" immediately
					console.log('[CinemaPippinGame] Pre-marking AI player statuses...')
					for (const aiPlayer of this.state.aiPlayers) {
						// Add placeholder answer so auto-advance/timeout logic sees them as submitted
						this.state.playerAnswers.set(aiPlayer.playerId, '...')

						const status = this.state.playerStatus.get(aiPlayer.playerId) || {}
						status.hasSubmittedAnswer = true
						this.state.playerStatus.set(aiPlayer.playerId, status)
						console.log(`  - Pre-marked ${aiPlayer.nickname} (${aiPlayer.playerId}) as submitted`)
					}

					console.log('[CinemaPippinGame] Advanced to answer_collection')
					console.log(
						`[CinemaPippinGame] Active players: ${this.state.scores.size}, AI players: ${this.state.aiPlayers.length}`
					)

					// Start answer timeout timer
					this.startAnswerTimeout()

					// Trigger AI answer generation (async, don't await)
					// Answers will be populated asynchronously, but status is already marked
					console.log('[CinemaPippinGame] Triggering AI answer generation...')
					void this.generateAIAnswers()
				} else if (this.state.phase === 'voting_playback') {
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

						// Pre-mark AI players as having voted (before async generation)
						// This ensures clients see AI players as "voted" immediately
						console.log('[CinemaPippinGame] Pre-marking AI player voting statuses...')
						for (const aiPlayer of this.state.aiPlayers) {
							// Add placeholder vote so auto-advance logic sees them as voted
							this.state.votes.set(aiPlayer.playerId, '...')

							const status = this.state.playerStatus.get(aiPlayer.playerId) || {}
							status.hasVoted = true
							this.state.playerStatus.set(aiPlayer.playerId, status)
							console.log(`  - Pre-marked ${aiPlayer.nickname} (${aiPlayer.playerId}) as voted`)
						}

						console.log('[CinemaPippinGame] All answers shown, advanced to voting_collection')

						// Start voting timeout timer
						this.startVotingTimeout()

						// Trigger AI voting (async, don't await)
						// Votes will be populated asynchronously, but status is already marked
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
				// Handle answer submission
				const { answer } = gameAction.payload as { answer: string }
				const trimmedAnswer = answer.trim()

				// Clear any previous errors for this player
				this.state.playerErrors.delete(_playerId)

				// For C1 (clip index 0), check for duplicate answers (case-insensitive)
				if (this.state.currentClipIndex === 0) {
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

					console.log(
						'[CinemaPippinGame] All active players submitted (',
						this.state.playerAnswers.size,
						'/',
						activePlayers,
						'), advancing to voting_playback'
					)

					this.advanceToVotingPlayback()
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
						'), advancing to results_display'
					)

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

	/**
	 * Generate batch answers (AI + house) during answer_collection phase
	 */
	private async generateAIAnswers(): Promise<void> {
		const clipNumber = (this.state.currentClipIndex + 1) as 1 | 2 | 3
		const keyword = clipNumber === 1 ? 'blank' : this.state.keywords[0] || 'blank'

		const aiConstraints = this.state.aiPlayers.map((ai) => ai.constraint)
		const playerCount = this.state.scores.size

		// Load the SRT text for context
		const currentClip = this.getCurrentClip()
		const questionSrt = fs.readFileSync(currentClip.srtPath, 'utf-8')

		// Build previous clips context (for T > 1)
		const previousClips: Array<{ srtText: string; winningAnswer: string; keyword: string }> = []
		const currentFilm = this.getCurrentFilm()

		for (let i = 0; i < this.state.currentClipIndex; i++) {
			const prevClip = currentFilm.clips[i]
			if (!prevClip) continue

			const prevSrt = fs.readFileSync(prevClip.srtPath, 'utf-8')
			const prevWinningAnswer = this.state.clipWinners[i] || ''
			const prevKeyword = this.state.keywords[0] || 'blank'

			previousClips.push({
				srtText: prevSrt,
				winningAnswer: prevWinningAnswer,
				keyword: prevKeyword
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

			console.log(`[AI] Assigning ${aiAnswers.length} answers to AI players...`)

			// Assign AI answers to AI players
			this.state.aiPlayers.forEach((aiPlayer, index) => {
				const answer = aiAnswers[index]
				this.state.playerAnswers.set(aiPlayer.playerId, answer)

				// Mark AI player as having submitted answer
				const status = this.state.playerStatus.get(aiPlayer.playerId) || {}
				status.hasSubmittedAnswer = true
				this.state.playerStatus.set(aiPlayer.playerId, status)

				console.log(
					`[AI] ✓ ${aiPlayer.nickname} (${aiPlayer.playerId}): "${answer}" - Status marked: hasSubmittedAnswer=true`
				)
			})

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
			const answersArray = JSON.parse(answersData) as string[][]

			// answers.json is 2D array: outer index = clip number (0-2), inner = answers
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

		// Prepare answers for voting
		const answerList = this.state.allAnswers.map((a) => ({ id: a.id, text: a.text }))

		// Generate all AI votes in parallel
		const votePromises = this.state.aiPlayers.map(async (aiPlayer) => {
			try {
				const votedAnswerId = await generateAIVote(this.aiConfig, answerList, aiPlayer.constraint)

				console.log(
					`[AI] ${aiPlayer.nickname} (${aiPlayer.constraint}) voted for: ${votedAnswerId}`
				)

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

			// Determine winner
			const winner = this.calculateWinner()
			if (winner) {
				this.state.clipWinners.push(winner.text)

				// If C1, save keyword for C2/C3 (indexed by film, not pushed)
				if (this.state.currentClipIndex === 0) {
					this.state.keywords[this.state.currentFilmIndex] = winner.text
					console.log(
						'[AI] Stored C1 winner as keyword:',
						winner.text,
						'for film',
						this.state.currentFilmIndex
					)
				}
			}

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
