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
import { loadSRT } from './srt-processor'

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

	constructor() {
		this.game = new CinemaPippinGame()
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

		// Load and parse SRT subtitles
		let subtitles = loadSRT(currentClip.srtPath)

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

		// During results_display, include sorted answers with vote data
		const sortedResults =
			rawState.phase === 'results_display' ? this.game.getSortedAnswersByVotes() : undefined

		// Create enriched state for client
		// Convert Map objects to plain objects for JSON serialization over WebSocket
		const enrichedState = {
			...rawState,
			playerAnswers: Object.fromEntries(rawState.playerAnswers),
			votes: Object.fromEntries(rawState.votes),
			scores: Object.fromEntries(rawState.scores),
			endGameVotes: Object.fromEntries(rawState.endGameVotes),
			currentClip: {
				clipNumber: currentClip.clipNumber,
				videoUrl,
				subtitles
			},
			...(sortedResults && { sortedResults })
		}

		return enrichedState as GameState
	}

	initialize(players: Player[], context: GameModuleContext): Promise<GameState> {
		this.context = context

		const playerIds = players.map((p) => p.id)
		this.game.initialize(playerIds)

		return Promise.resolve(this.enrichStateForClient())
	}

	handleAction(action: GameAction, _state: GameState): Promise<GameState> {
		// Handle player actions
		console.log('[CinemaPippinModule] Received action:', action)
		this.game.handlePlayerAction(action.playerId, action)

		return Promise.resolve(this.enrichStateForClient())
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
