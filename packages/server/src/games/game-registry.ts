/**
 * Game Registry - Central registry for all game modules
 * Maps gameId → GameModule implementation
 */

import type { PluggableGameModule, GameId } from '@jkbox/shared'
import { createUnimplementedGame } from './unimplemented-game'

class GameRegistryImpl {
	private games: Map<GameId, PluggableGameModule> = new Map()

	constructor() {
		// Register all games (currently all use placeholder)
		this.register(createUnimplementedGame('fake-facts', 'Fake Facts'))
		this.register(createUnimplementedGame('cinephile', 'Cinephile'))
		this.register(createUnimplementedGame('cinema-pippin', 'Cinema Pippin'))
	}

	register(module: PluggableGameModule): void {
		if (this.games.has(module.id)) {
			console.warn(`[GameRegistry] Game ${module.id} already registered, overwriting`)
		}

		this.games.set(module.id, module)
		console.log(`[GameRegistry] Registered game: ${module.name} (${module.id})`)
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
