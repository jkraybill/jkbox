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
import type { CinemaPippinState } from './types'

class CinemaPippinModule implements PluggableGameModule {
	id = 'cinema-pippin' as const
	name = 'Cinema Pippin'
	minPlayers = 2
	maxPlayers = 20

	private game: CinemaPippinGame
	private context?: GameModuleContext

	constructor() {
		this.game = new CinemaPippinGame()
	}

	async initialize(players: Player[], context: GameModuleContext): Promise<GameState> {
		this.context = context

		const playerIds = players.map((p) => p.id)
		this.game.initialize(playerIds)

		return Promise.resolve(this.game.getState() as GameState)
	}

	async handleAction(_action: GameAction, _state: GameState): Promise<GameState> {
		// Update internal game state
		// (Will be implemented in subsequent issues)

		// For now, just return current state
		return Promise.resolve(this.game.getState() as GameState)
	}

	async loadJumbotronComponent(): Promise<React.ComponentType<JumbotronProps>> {
		// Lazy load jumbotron component
		const module = await import('../../../client/src/games/cinema-pippin/CinemaPippinJumbotron')
		return module.CinemaPippinJumbotron as React.ComponentType<JumbotronProps>
	}

	async loadControllerComponent(): Promise<React.ComponentType<ControllerProps>> {
		// Lazy load controller component
		const module = await import('../../../client/src/games/cinema-pippin/CinemaPippinController')
		return module.CinemaPippinController as React.ComponentType<ControllerProps>
	}

	async cleanup(): Promise<void> {
		// Cleanup resources
		// No cleanup needed for now
		return Promise.resolve()
	}
}

export const CinemaPippinGameModule = new CinemaPippinModule()
