/**
 * Player Sound Assignment Utilities
 *
 * Assigns unique sound effects to players for audio feedback.
 */

/** Pool of available player sound IDs */
export const PLAYER_SOUND_POOL = [
	'player-boing',
	'player-whoosh',
	'player-pop',
	'player-ding',
	'player-honk',
	'player-squeak',
	'player-slide-whistle',
	'player-spring',
	'player-kazoo',
	'player-quack',
	'player-cowbell',
	'player-airhorn'
] as const

export type PlayerSoundId = (typeof PLAYER_SOUND_POOL)[number]

/**
 * Generate a deterministic hash from a string
 * Used to consistently assign sounds to players
 */
function hashString(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32-bit integer
	}
	return Math.abs(hash)
}

/**
 * Assign a sound to a player based on their ID
 *
 * Uses deterministic hashing so the same player always gets the same sound
 * (useful for reconnection scenarios)
 *
 * @param playerId - The player's unique ID
 * @returns The assigned sound ID
 */
export function assignPlayerSound(playerId: string): PlayerSoundId {
	const hash = hashString(playerId)
	const index = hash % PLAYER_SOUND_POOL.length
	return PLAYER_SOUND_POOL[index]!
}

/**
 * Get a random sound from the pool
 * (Alternative to deterministic assignment)
 */
export function getRandomPlayerSound(): PlayerSoundId {
	const index = Math.floor(Math.random() * PLAYER_SOUND_POOL.length)
	return PLAYER_SOUND_POOL[index]!
}
