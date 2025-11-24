/**
 * Cinema Pippin - Game Module Export
 * Implements PluggableGameModule interface for jkbox
 */

import type {
	PluggableGameModule,
	GameModuleContext,
	Player,
	GameState,
	GameAction,
	JumbotronProps,
	ControllerProps
} from '@jkbox/shared'
import { CinemaPippinGame } from './cinema-pippin'
import { loadSRT, loadSRTWithKeywordReplacement, mergeSRT, type Subtitle } from './srt-processor'

class CinemaPippinModule implements PluggableGameModule {
	id = 'cinema-pippin' as const
	name = 'Cinema Pippin'
	description = 'Subtitle insanity - write hilarious dialogue for classic films!'
	sortOrder = 100
	visible = true
	minPlayers = 1
	maxPlayers = 20

	private game: CinemaPippinGame
	private context?: GameModuleContext
	private stateChangeCallback?: (state: GameState) => void

	constructor() {
		this.game = new CinemaPippinGame()

		// Wire up async state change notifications
		this.game.setStateChangeCallback(() => {
			if (this.stateChangeCallback) {
				console.log('[CinemaPippinModule] Async state change detected, notifying subscriber')
				this.stateChangeCallback(this.enrichStateForClient())
			}
		})
	}

	/**
	 * Subscribe to async state changes (e.g., AI generation completing)
	 * Connection handler uses this to broadcast updates to clients
	 */
	onStateChange(callback: (state: GameState) => void): void {
		this.stateChangeCallback = callback
	}

	/**
	 * Enrich game state with client-ready data
	 * - Adds currentClip with videoUrl and parsed subtitles
	 * - Converts Maps to plain objects for JSON serialization
	 * - Merges current answer into subtitles during voting_playback
	 */
	private enrichStateForClient(): GameState {
		const rawState = this.game.getState()

		// Get current clip data
		const currentClip = this.game.getCurrentClip()

		// Only enrich clip data if we're in a clip-based phase
		let enrichedClipData:
			| { clipNumber: 1 | 2 | 3; videoUrl: string; subtitles: Subtitle[] }
			| undefined
		if (currentClip) {
			// Load and parse SRT subtitles
			// For C2/C3, replace [keyword] with C1 winner (preserving casing)
			let subtitles: ReturnType<typeof loadSRT>
			const isC2OrC3 = rawState.currentClipIndex > 0
			const keyword = rawState.keywords[rawState.currentFilmIndex]

			if (isC2OrC3 && keyword) {
				// Get the original SRT path by replacing "-question.srt" with "-original.srt"
				const originalSrtPath = currentClip.srtPath.replace('-question.srt', '-original.srt')
				subtitles = loadSRTWithKeywordReplacement(currentClip.srtPath, originalSrtPath, keyword)
				console.log(
					'[CinemaPippinModule] Replaced [keyword] with',
					keyword,
					'for clip',
					currentClip.clipNumber
				)
			} else {
				subtitles = loadSRT(currentClip.srtPath)
			}

			// During voting_playback, merge current answer into subtitles
			if (rawState.phase === 'voting_playback' && rawState.allAnswers.length > 0) {
				const currentAnswer = rawState.allAnswers[rawState.currentAnswerIndex]
				if (currentAnswer) {
					subtitles = subtitles.map((sub) => ({
						...sub,
						text: sub.text.replace(/_{2,}(\s+_{2,})*/g, currentAnswer.text)
					}))
				}
			}

			// Convert filesystem path to web URL
			// /home/jk/jkbox/generated/clips/... → /clips/...
			const videoUrl = currentClip.videoPath.replace('/home/jk/jkbox/generated/clips', '/clips')

			enrichedClipData = {
				clipNumber: currentClip.clipNumber,
				videoUrl,
				subtitles
			}
		}

		// During results_display or film_title_results, include sorted answers with vote data
		const sortedResults =
			rawState.phase === 'results_display' || rawState.phase === 'film_title_results'
				? this.game.getSortedAnswersByVotes()
				: undefined

		// During final_montage, prepare all 3 clips with winning answers merged into subtitles
		let montageClips:
			| Array<{ clipNumber: 1 | 2 | 3; videoUrl: string; subtitles: Subtitle[] }>
			| undefined
		if (rawState.phase === 'final_montage') {
			const film = this.game.getCurrentFilm()
			const keyword = rawState.keywords[rawState.currentFilmIndex] || ''

			montageClips = film.clips.map((clip, index) => {
				const clipNumber = (index + 1) as 1 | 2 | 3
				const winningAnswer = rawState.clipWinners[index] || ''

				// Load subtitles and merge winning answer
				let subtitles: ReturnType<typeof loadSRT>
				if (index === 0) {
					// C1: just load question SRT
					subtitles = loadSRT(clip.srtPath)
				} else {
					// C2/C3: Replace [keyword] with C1 winner
					const originalSrtPath = clip.srtPath.replace('-question.srt', '-original.srt')
					subtitles = loadSRTWithKeywordReplacement(clip.srtPath, originalSrtPath, keyword)
				}

				// Merge winning answer into subtitles (replace blanks)
				subtitles = mergeSRT(subtitles, winningAnswer)

				// Convert filesystem path to web URL
				const videoUrl = clip.videoPath.replace('/home/jk/jkbox/generated/clips', '/clips')

				return {
					clipNumber,
					videoUrl,
					subtitles
				}
			})
		}

		// Create enriched state for client
		// Convert Map objects to plain objects for JSON serialization over WebSocket
		const enrichedState = {
			...rawState,
			playerAnswers: Object.fromEntries(rawState.playerAnswers),
			votes: Object.fromEntries(rawState.votes),
			scores: Object.fromEntries(rawState.scores),
			scoresBeforeRound: Object.fromEntries(rawState.scoresBeforeRound),
			voteCountsThisRound: Object.fromEntries(rawState.voteCountsThisRound),
			endGameVotes: Object.fromEntries(rawState.endGameVotes),
			playerStatus: Object.fromEntries(rawState.playerStatus),
			playerErrors: Object.fromEntries(rawState.playerErrors),
			...(enrichedClipData && { currentClip: enrichedClipData }),
			...(sortedResults && { sortedResults }),
			...(montageClips && { montageClips })
		}

		return enrichedState as GameState
	}

	initialize(players: Player[], context: GameModuleContext): Promise<GameState> {
		this.context = context

		// Extract AI players from lobby (players with isAI: true)
		const aiPlayers = players
			.filter((p) => p.isAI)
			.map((p) => ({
				playerId: p.id,
				nickname: p.nickname,
				constraint: p.aiConstraint || p.nickname.replace(/Bot$/, '') // Fallback to nickname
			}))

		// Get all player IDs (both human and AI)
		const playerIds = players.map((p) => p.id)

		// Initialize game with player IDs and AI player data
		this.game.initialize(playerIds, aiPlayers)

		return Promise.resolve(this.enrichStateForClient())
	}

	handleAction(action: GameAction, _state: GameState): Promise<GameState> {
		// Handle player actions
		console.log('[CinemaPippinModule] Received action:', action)
		this.game.handlePlayerAction(action.playerId, action)

		const enrichedState = this.enrichStateForClient()

		// Check if game ended and should return to lobby
		if (action.type === 'END_GAME_COMPLETE' && this.context) {
			console.log('[CinemaPippinModule] Game complete, returning to lobby')
			this.context.complete()
		}

		// Log playerStatus to debug AI status issue
		if (
			action.type === 'VIDEO_COMPLETE' ||
			action.type === 'SUBMIT_ANSWER' ||
			action.type === 'SUBMIT_VOTE'
		) {
			console.log(
				'[CinemaPippinModule] Returning state with playerStatus:',
				enrichedState.playerStatus
			)
		}

		return Promise.resolve(enrichedState)
	}

	async loadJumbotronComponent(): Promise<React.ComponentType<JumbotronProps>> {
		// Lazy load jumbotron component
		const module = (await import(
			'../../../client/src/games/cinema-pippin/CinemaPippinJumbotron'
		)) as { CinemaPippinJumbotron: React.ComponentType<JumbotronProps> }
		return module.CinemaPippinJumbotron
	}

	async loadControllerComponent(): Promise<React.ComponentType<ControllerProps>> {
		// Lazy load controller component
		const module = (await import(
			'../../../client/src/games/cinema-pippin/CinemaPippinController'
		)) as { CinemaPippinController: React.ComponentType<ControllerProps> }
		return module.CinemaPippinController
	}

	async cleanup(): Promise<void> {
		// Cleanup resources
		// No cleanup needed for now
		return Promise.resolve()
	}
}

export const CinemaPippinGameModule = new CinemaPippinModule()
