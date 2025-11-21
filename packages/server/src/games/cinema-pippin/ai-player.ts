/**
 * Cinema Pippin - AI Player Management
 * Create, configure, and manage AI players with constraints
 */

import * as fs from 'fs'
import * as path from 'path'

export interface AIPlayer {
	playerId: string
	nickname: string
	isAI: boolean
	generationConstraint: string
	judgingConstraint: string
}

/**
 * Create a new AI player with default values
 */
export function createAIPlayer(index: number): AIPlayer {
	return {
		playerId: `ai-${index}`,
		nickname: `AI ${index}`,
		isAI: true,
		generationConstraint: '',
		judgingConstraint: ''
	}
}

/**
 * Load constraints from constraints.txt
 */
export function loadConstraints(): string[] {
	// Look for constraints.txt in project root
	const possiblePaths = [
		path.join(__dirname, '../../../..', 'constraints.txt'), // From packages/server/src/games/cinema-pippin
		path.join(process.cwd(), 'constraints.txt'), // From project root
		'/home/jk/jkbox/constraints.txt' // Absolute path
	]

	for (const constraintsPath of possiblePaths) {
		if (fs.existsSync(constraintsPath)) {
			const content = fs.readFileSync(constraintsPath, 'utf-8')
			return content
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0)
		}
	}

	throw new Error(`constraints.txt not found. Tried paths: ${possiblePaths.join(', ')}`)
}

/**
 * Shuffle constraints array (Fisher-Yates)
 */
export function shuffleConstraints(constraints: string[]): string[] {
	const shuffled = [...constraints]

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}

	return shuffled
}

/**
 * Assign 2 constraints per AI player (generation + judging)
 */
export function assignConstraints(aiPlayers: AIPlayer[], constraints: string[]): void {
	aiPlayers.forEach((ai, index) => {
		const generationIndex = index * 2
		const judgingIndex = index * 2 + 1

		ai.generationConstraint = constraints[generationIndex]
		ai.judgingConstraint = constraints[judgingIndex]
	})
}
