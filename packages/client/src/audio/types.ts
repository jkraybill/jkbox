/**
 * Audio System Types
 */

/** Music track identifiers */
export type MusicId = 'intro' | 'lobby' | 'victory'

/** Sound effect identifiers */
export type SFXId =
	| 'game-start'
	| 'winner-chime'
	| 'countdown-tick'
	| 'countdown-go'
	// Player sounds
	| 'player-boing'
	| 'player-whoosh'
	| 'player-pop'
	| 'player-ding'
	| 'player-honk'
	| 'player-squeak'
	| 'player-slide-whistle'
	| 'player-spring'
	| 'player-kazoo'
	| 'player-quack'
	| 'player-cowbell'
	| 'player-airhorn'

/** All sound identifiers */
export type SoundId = MusicId | SFXId

/** Sound definition in the manifest */
export interface SoundDefinition {
	id: SoundId
	path: string
	type: 'music' | 'sfx'
	/** Whether to preload this sound on init */
	preload: boolean
}

/** Sound manifest for preloading */
export interface SoundManifest {
	baseUrl: string
	sounds: SoundDefinition[]
}

/** Playback options for music */
export interface MusicOptions {
	/** Crossfade duration in seconds (default: 1) */
	crossfadeDuration?: number
	/** Volume 0-1 (default: 1) */
	volume?: number
	/** Whether to loop (default: true for music) */
	loop?: boolean
}

/** Playback options for SFX */
export interface SFXOptions {
	/** Volume 0-1 (default: 1) */
	volume?: number
}

/** Player sound trigger types */
export type PlayerSoundTrigger = 'submit' | 'score'

/** Audio manager state */
export interface AudioState {
	isInitialized: boolean
	isMuted: boolean
	masterVolume: number
	musicVolume: number
	sfxVolume: number
	currentMusic: MusicId | null
	isPlaying: boolean
}

/** FFT data for visualizations */
export interface FFTData {
	/** 8 normalized frequency band values (0-1) */
	frequencyBands: number[]
}
