/**
 * Audio Module - Public API
 */

export { AudioManager } from './AudioManager'
export { AudioProvider, useAudio, useAudioOptional } from './AudioProvider'
export { PLAYER_SOUND_POOL, getSoundUrl, getPlayerSoundId } from './sounds'
export type {
	MusicId,
	SFXId,
	SoundId,
	MusicOptions,
	SFXOptions,
	AudioState,
	PlayerSoundTrigger
} from './types'
