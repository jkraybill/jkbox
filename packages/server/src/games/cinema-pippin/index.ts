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

	initialize(players: Player[], context: GameModuleContext): Promise<GameState> {
		this.context = context

		const playerIds = players.map((p) => p.id)
		this.game.initialize(playerIds)

		return Promise.resolve(this.game.getState() as GameState)
	}

	handleAction(action: GameAction, _state: GameState): Promise<GameState> {
		// Handle player actions
		console.log('[CinemaPippinModule] Received action:', action)
		this.game.handlePlayerAction(action.playerId, action)

		return Promise.resolve(this.game.getState() as GameState)
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
