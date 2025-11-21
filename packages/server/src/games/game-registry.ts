/**
 * Game Registry - Central registry for all game modules
 * Maps gameId → GameModule implementation
 */

import type { PluggableGameModule, GameId } from '@jkbox/shared'
import { createUnimplementedGame } from './unimplemented-game'
import { Scratchpad1Game } from './scratchpad1'
import { CinemaPippinGameModule } from './cinema-pippin'

class GameRegistryImpl {
	private games: Map<GameId, PluggableGameModule> = new Map()

	constructor() {
		// Register all games
		this.register(createUnimplementedGame('fake-facts', 'Fake Facts'))
		this.register(createUnimplementedGame('cinephile', 'Cinephile'))
		this.register(CinemaPippinGameModule)
		this.register(Scratchpad1Game)

		// 'test' game - maps to currently-under-testing module (Scratchpad1)
		this.register({ ...Scratchpad1Game, id: 'test', name: 'Test' })
	}

	register(module: PluggableGameModule): void {
		if (this.games.has(module.id)) {
			// Game already registered, overwriting
		}

		this.games.set(module.id, module)
		// Registered game
	}

	get(gameId: GameId): PluggableGameModule | undefined {
		return this.games.get(gameId)
	}

	list(): PluggableGameModule[] {
		return Array.from(this.games.values())
	}

	has(gameId: GameId): boolean {
		return this.games.has(gameId)
	}
}

// Singleton instance
export const gameRegistry = new GameRegistryImpl()
