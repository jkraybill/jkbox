/**
 * AudioManager - Core audio engine for jkbox
 *
 * Provides:
 * - Music playback with crossfade transitions
 * - SFX playback with preloaded AudioBuffers
 * - FFT analysis for visualizations
 * - Volume controls
 */

import type {
	MusicId,
	SFXId,
	MusicOptions,
	SFXOptions,
	AudioState,
	PlayerSoundTrigger
} from './types'
import { SOUND_DEFINITIONS, getAudioUrl, getPlayerSoundId } from './sounds'

/** FFT configuration */
const FFT_SIZE = 256
const SMOOTHING_TIME_CONSTANT = 0.3
const NUM_BANDS = 8

/** Default volumes */
const DEFAULT_MASTER_VOLUME = 1.0
const DEFAULT_MUSIC_VOLUME = 0.7
const DEFAULT_SFX_VOLUME = 1.0

/** Crossfade duration in seconds */
const DEFAULT_CROSSFADE_DURATION = 1.0

/**
 * AudioManager singleton class
 */
class AudioManagerClass {
	private audioContext: AudioContext | null = null
	private masterGain: GainNode | null = null
	private musicGain: GainNode | null = null
	private sfxGain: GainNode | null = null
	private analyser: AnalyserNode | null = null

	// Music state
	private currentMusicElement: HTMLAudioElement | null = null
	private currentMusicSource: MediaElementAudioSourceNode | null = null
	private currentMusicId: MusicId | null = null
	private crossfadeTimeout: ReturnType<typeof setTimeout> | null = null

	// SFX buffers (preloaded)
	private sfxBuffers: Map<SFXId, AudioBuffer> = new Map()

	// FFT data
	private frequencyBands: number[] = Array.from({ length: NUM_BANDS }, () => 0)
	private previousBands: number[] = Array.from({ length: NUM_BANDS }, () => 0)
	private animationFrameId: number | null = null
	private lastSampleTime = 0
	private fftUpdateCallback: ((bands: number[]) => void) | null = null

	// State
	private _isInitialized = false
	private _isMuted = false
	private _masterVolume = DEFAULT_MASTER_VOLUME
	private _musicVolume = DEFAULT_MUSIC_VOLUME
	private _sfxVolume = DEFAULT_SFX_VOLUME

	/**
	 * Initialize the audio system
	 */
	async initialize(): Promise<void> {
		if (this._isInitialized) {
			console.log('[AudioManager] Already initialized')
			return
		}

		console.log('[AudioManager] Initializing...')

		try {
			// Create AudioContext
			const AudioContextClass =
				window.AudioContext ||
				(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

			this.audioContext = new AudioContextClass()

			// Create gain nodes
			this.masterGain = this.audioContext.createGain()
			this.musicGain = this.audioContext.createGain()
			this.sfxGain = this.audioContext.createGain()

			// Create analyser for FFT
			this.analyser = this.audioContext.createAnalyser()
			this.analyser.fftSize = FFT_SIZE
			this.analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT

			// Connect: music/sfx -> master -> analyser -> destination
			this.musicGain.connect(this.masterGain)
			this.sfxGain.connect(this.masterGain)
			this.masterGain.connect(this.analyser)
			this.analyser.connect(this.audioContext.destination)

			// Set initial volumes
			this.masterGain.gain.value = this._masterVolume
			this.musicGain.gain.value = this._musicVolume
			this.sfxGain.gain.value = this._sfxVolume

			// Preload SFX
			await this.preloadSFX()

			this._isInitialized = true
			console.log('[AudioManager] Initialized successfully')
		} catch (error) {
			console.error('[AudioManager] Failed to initialize:', error)
			throw error
		}
	}

	/**
	 * Resume audio context (required after user interaction due to autoplay policy)
	 */
	async resume(): Promise<void> {
		if (this.audioContext?.state === 'suspended') {
			await this.audioContext.resume()
			console.log('[AudioManager] AudioContext resumed')
		}
	}

	/**
	 * Preload all SFX as AudioBuffers for instant playback
	 */
	private async preloadSFX(): Promise<void> {
		const sfxToPreload = SOUND_DEFINITIONS.filter((s) => s.type === 'sfx' && s.preload)

		console.log(`[AudioManager] Preloading ${sfxToPreload.length} SFX...`)

		const loadPromises = sfxToPreload.map(async (sound) => {
			try {
				const url = `${getAudioUrl()}${sound.path}`
				const response = await fetch(url)

				if (!response.ok) {
					console.warn(`[AudioManager] Failed to fetch ${sound.id}: ${response.status}`)
					return
				}

				const arrayBuffer = await response.arrayBuffer()
				const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
				this.sfxBuffers.set(sound.id as SFXId, audioBuffer)
			} catch (error) {
				console.warn(`[AudioManager] Failed to preload ${sound.id}:`, error)
			}
		})

		await Promise.all(loadPromises)
		console.log(`[AudioManager] Preloaded ${this.sfxBuffers.size} SFX`)
	}

	/**
	 * Play music track with optional crossfade
	 */
	playMusic(id: MusicId, options: MusicOptions = {}): void {
		if (!this._isInitialized || !this.audioContext || !this.musicGain) {
			console.warn('[AudioManager] Not initialized, cannot play music')
			return
		}

		const { crossfadeDuration = DEFAULT_CROSSFADE_DURATION, volume = 1, loop = true } = options

		// If same track is already playing, do nothing
		if (this.currentMusicId === id && this.currentMusicElement) {
			console.log(`[AudioManager] Music ${id} already playing`)
			return
		}

		console.log(`[AudioManager] Playing music: ${id}`)

		// Find sound definition
		const sound = SOUND_DEFINITIONS.find((s) => s.id === id)
		if (!sound) {
			console.warn(`[AudioManager] Unknown music ID: ${id}`)
			return
		}

		const url = `${getAudioUrl()}${sound.path}`

		// Create new audio element
		const newAudio = new Audio(url)
		newAudio.loop = loop
		newAudio.volume = 0 // Start at 0 for crossfade

		// Create source node
		const newSource = this.audioContext.createMediaElementSource(newAudio)
		newSource.connect(this.musicGain)

		// Handle crossfade if music is currently playing
		if (this.currentMusicElement && this.currentMusicSource) {
			const oldAudio = this.currentMusicElement
			const oldVolume = oldAudio.volume

			// Fade out old, fade in new
			const fadeStep = 50 // ms
			const fadeSteps = Math.ceil((crossfadeDuration * 1000) / fadeStep)
			const oldVolumeStep = oldVolume / fadeSteps
			const newVolumeStep = volume / fadeSteps
			let step = 0

			const fadeInterval = setInterval(() => {
				step++
				oldAudio.volume = Math.max(0, oldVolume - oldVolumeStep * step)
				newAudio.volume = Math.min(volume, newVolumeStep * step)

				if (step >= fadeSteps) {
					clearInterval(fadeInterval)
					oldAudio.pause()
					oldAudio.src = ''
				}
			}, fadeStep)

			// Clear any pending crossfade
			if (this.crossfadeTimeout) {
				clearTimeout(this.crossfadeTimeout)
			}
		} else {
			// No current music, just set volume directly
			newAudio.volume = volume
		}

		// Start playback
		newAudio
			.play()
			.then(() => {
				console.log(`[AudioManager] Music ${id} started`)
			})
			.catch((error) => {
				console.warn(`[AudioManager] Failed to play music ${id}:`, error)
			})

		// Update current music references
		this.currentMusicElement = newAudio
		this.currentMusicSource = newSource
		this.currentMusicId = id
	}

	/**
	 * Stop music with optional fade out
	 */
	stopMusic(fadeOutDuration = 0.5): void {
		if (!this.currentMusicElement) return

		const audio = this.currentMusicElement
		const startVolume = audio.volume

		if (fadeOutDuration > 0) {
			const fadeStep = 50
			const fadeSteps = Math.ceil((fadeOutDuration * 1000) / fadeStep)
			const volumeStep = startVolume / fadeSteps
			let step = 0

			const fadeInterval = setInterval(() => {
				step++
				audio.volume = Math.max(0, startVolume - volumeStep * step)

				if (step >= fadeSteps) {
					clearInterval(fadeInterval)
					audio.pause()
					audio.src = ''
					this.currentMusicElement = null
					this.currentMusicSource = null
					this.currentMusicId = null
				}
			}, fadeStep)
		} else {
			audio.pause()
			audio.src = ''
			this.currentMusicElement = null
			this.currentMusicSource = null
			this.currentMusicId = null
		}
	}

	/**
	 * Play a sound effect (uses preloaded AudioBuffer for instant playback)
	 */
	playSFX(id: SFXId, options: SFXOptions = {}): void {
		if (!this._isInitialized || !this.audioContext || !this.sfxGain) {
			console.warn('[AudioManager] Not initialized, cannot play SFX')
			return
		}

		const { volume = 1 } = options

		const buffer = this.sfxBuffers.get(id)
		if (!buffer) {
			console.warn(`[AudioManager] SFX not loaded: ${id}`)
			return
		}

		// Resume context if suspended
		if (this.audioContext.state === 'suspended') {
			void this.audioContext.resume()
		}

		// Create buffer source for one-shot playback
		const source = this.audioContext.createBufferSource()
		source.buffer = buffer

		// Create gain node for this sound's volume
		const gainNode = this.audioContext.createGain()
		gainNode.gain.value = volume

		// Connect: source -> gain -> sfxGain
		source.connect(gainNode)
		gainNode.connect(this.sfxGain)

		// Play
		source.start(0)
	}

	/**
	 * Play a player's assigned sound effect
	 */
	playPlayerSound(playerId: string, trigger: PlayerSoundTrigger, soundId?: string): void {
		const sfxId = getPlayerSoundId(playerId, soundId)
		console.log(`[AudioManager] Player ${playerId} ${trigger} -> ${sfxId}`)
		this.playSFX(sfxId)
	}

	/**
	 * Set master volume
	 */
	setMasterVolume(volume: number): void {
		this._masterVolume = Math.max(0, Math.min(1, volume))
		if (this.masterGain) {
			this.masterGain.gain.value = this._masterVolume
		}
	}

	/**
	 * Set music volume
	 */
	setMusicVolume(volume: number): void {
		this._musicVolume = Math.max(0, Math.min(1, volume))
		if (this.musicGain) {
			this.musicGain.gain.value = this._musicVolume
		}
	}

	/**
	 * Set SFX volume
	 */
	setSFXVolume(volume: number): void {
		this._sfxVolume = Math.max(0, Math.min(1, volume))
		if (this.sfxGain) {
			this.sfxGain.gain.value = this._sfxVolume
		}
	}

	/**
	 * Toggle mute
	 */
	toggleMute(): boolean {
		this._isMuted = !this._isMuted
		if (this.masterGain) {
			this.masterGain.gain.value = this._isMuted ? 0 : this._masterVolume
		}
		return this._isMuted
	}

	/**
	 * Start FFT analysis loop
	 */
	startFFTAnalysis(callback: (bands: number[]) => void): void {
		this.fftUpdateCallback = callback

		if (this.animationFrameId) return // Already running

		const updateFFT = () => {
			const now = performance.now()
			if (now - this.lastSampleTime >= 16) {
				// ~60fps
				this.lastSampleTime = now
				this.updateFrequencyBands()
			}
			this.animationFrameId = requestAnimationFrame(updateFFT)
		}

		this.animationFrameId = requestAnimationFrame(updateFFT)
	}

	/**
	 * Stop FFT analysis loop
	 */
	stopFFTAnalysis(): void {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId)
			this.animationFrameId = null
		}
		this.fftUpdateCallback = null
	}

	/**
	 * Update frequency bands from FFT data
	 */
	private updateFrequencyBands(): void {
		if (!this.analyser) return

		const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
		this.analyser.getByteFrequencyData(dataArray)

		// Extract bands
		const binCount = dataArray.length
		const binsPerBand = Math.floor(binCount / NUM_BANDS)
		const newBands: number[] = []

		for (let i = 0; i < NUM_BANDS; i++) {
			const start = i * binsPerBand
			const end = start + binsPerBand
			let sum = 0

			for (let j = start; j < end && j < binCount; j++) {
				sum += dataArray[j] || 0
			}

			const avg = sum / binsPerBand
			newBands.push(avg / 255) // Normalize to 0-1
		}

		// Smooth with previous values (LERP)
		const LERP_FACTOR = 0.7
		this.frequencyBands = newBands.map((val, i) => {
			const prev = this.previousBands[i] ?? 0
			return prev + (val - prev) * LERP_FACTOR
		})
		this.previousBands = [...this.frequencyBands]

		// Notify callback
		if (this.fftUpdateCallback) {
			this.fftUpdateCallback(this.frequencyBands)
		}
	}

	/**
	 * Get current frequency bands
	 */
	getFrequencyBands(): number[] {
		return [...this.frequencyBands]
	}

	/**
	 * Get current audio state
	 */
	getState(): AudioState {
		return {
			isInitialized: this._isInitialized,
			isMuted: this._isMuted,
			masterVolume: this._masterVolume,
			musicVolume: this._musicVolume,
			sfxVolume: this._sfxVolume,
			currentMusic: this.currentMusicId,
			isPlaying: this.currentMusicElement?.paused === false
		}
	}

	/**
	 * Check if initialized
	 */
	get isInitialized(): boolean {
		return this._isInitialized
	}

	/**
	 * Cleanup all resources
	 */
	cleanup(): void {
		this.stopMusic(0)
		this.stopFFTAnalysis()

		if (this.audioContext) {
			void this.audioContext.close()
			this.audioContext = null
		}

		this.sfxBuffers.clear()
		this._isInitialized = false
		console.log('[AudioManager] Cleaned up')
	}
}

// Export singleton instance
export const AudioManager = new AudioManagerClass()
