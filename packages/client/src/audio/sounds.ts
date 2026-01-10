/**
 * Sound Manifest and Constants
 *
 * Defines all available sounds and their paths.
 */

import type { SoundManifest, SoundDefinition, SFXId } from './types'
import { getAudioBaseUrl } from '../lib/server-url'

/** Get the base URL for audio files served by the server */
export function getAudioUrl(): string {
	return getAudioBaseUrl()
}

/** Player sound pool - these are randomly assigned to players */
export const PLAYER_SOUND_POOL: SFXId[] = [
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
]

/** All sound definitions */
export const SOUND_DEFINITIONS: SoundDefinition[] = [
	// Music tracks (streamed, not preloaded)
	{ id: 'intro', path: '/music/intro.mp3', type: 'music', preload: false },
	{ id: 'lobby', path: '/music/lobby.mp3', type: 'music', preload: false },
	{ id: 'victory', path: '/music/victory.mp3', type: 'music', preload: false },

	// Game SFX (preloaded for instant playback)
	{ id: 'game-start', path: '/sfx/game-start.mp3', type: 'sfx', preload: true },
	{ id: 'winner-chime', path: '/sfx/winner-chime.mp3', type: 'sfx', preload: true },
	{ id: 'countdown-tick', path: '/sfx/countdown-tick.mp3', type: 'sfx', preload: true },
	{ id: 'countdown-go', path: '/sfx/countdown-go.mp3', type: 'sfx', preload: true },

	// Player sounds (preloaded)
	{ id: 'player-boing', path: '/sfx/players/boing.mp3', type: 'sfx', preload: true },
	{ id: 'player-whoosh', path: '/sfx/players/whoosh.mp3', type: 'sfx', preload: true },
	{ id: 'player-pop', path: '/sfx/players/pop.mp3', type: 'sfx', preload: true },
	{ id: 'player-ding', path: '/sfx/players/ding.mp3', type: 'sfx', preload: true },
	{ id: 'player-honk', path: '/sfx/players/honk.mp3', type: 'sfx', preload: true },
	{ id: 'player-squeak', path: '/sfx/players/squeak.mp3', type: 'sfx', preload: true },
	{
		id: 'player-slide-whistle',
		path: '/sfx/players/slide-whistle.mp3',
		type: 'sfx',
		preload: true
	},
	{ id: 'player-spring', path: '/sfx/players/spring.mp3', type: 'sfx', preload: true },
	{ id: 'player-kazoo', path: '/sfx/players/kazoo.mp3', type: 'sfx', preload: true },
	{ id: 'player-quack', path: '/sfx/players/quack.mp3', type: 'sfx', preload: true },
	{ id: 'player-cowbell', path: '/sfx/players/cowbell.mp3', type: 'sfx', preload: true },
	{ id: 'player-airhorn', path: '/sfx/players/airhorn.mp3', type: 'sfx', preload: true }
]

/** Get the complete sound manifest with dynamic base URL */
export function getSoundManifest(): SoundManifest {
	return {
		baseUrl: getAudioUrl(),
		sounds: SOUND_DEFINITIONS
	}
}

/**
 * Get the full URL for a sound
 */
export function getSoundUrl(id: string): string {
	const sound = SOUND_DEFINITIONS.find((s) => s.id === id)
	if (!sound) {
		console.warn(`[Sounds] Unknown sound ID: ${id}`)
		return ''
	}
	return `${getAudioUrl()}${sound.path}`
}

/**
 * Get player sound ID from player's soundId property
 * Falls back to deterministic assignment if soundId not set
 */
export function getPlayerSoundId(playerId: string, soundId?: string): SFXId {
	// If player has assigned soundId, use it
	if (soundId && PLAYER_SOUND_POOL.includes(soundId as SFXId)) {
		return soundId as SFXId
	}

	// Fallback: deterministic hash-based assignment
	let hash = 0
	for (let i = 0; i < playerId.length; i++) {
		const char = playerId.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32-bit integer
	}
	const index = Math.abs(hash) % PLAYER_SOUND_POOL.length
	return PLAYER_SOUND_POOL[index]!
}
