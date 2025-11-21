/**
 * Scratchpad1 Client Game Module
 */

import type { PluggableGameModule } from '@jkbox/shared'

export const Scratchpad1Game: PluggableGameModule = {
	id: 'scratchpad1',
	name: 'Scratchpad1',
	minPlayers: 1,
	maxPlayers: 12,

	async initialize() {
		throw new Error('Client should not call initialize - server-side only')
	},

	async handleAction() {
		throw new Error('Client should not call handleAction - server-side only')
	},

	async loadJumbotronComponent() {
		const { Scratchpad1Jumbotron } = await import('./Scratchpad1Jumbotron')
		return Scratchpad1Jumbotron
	},

	async loadControllerComponent() {
		const { Scratchpad1Controller } = await import('./Scratchpad1Controller')
		return Scratchpad1Controller
	},

	async cleanup() {
		// No cleanup needed on client
	}
}
