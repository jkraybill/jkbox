/**
 * Audio Context Provider
 *
 * Provides audio functionality to React components via context.
 * Handles initialization and cleanup of the AudioManager singleton.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { AudioManager } from './AudioManager'
import type { MusicId, SFXId, AudioState, MusicOptions, PlayerSoundTrigger } from './types'

/** Audio context value */
interface AudioContextValue {
	/** Whether audio system is ready */
	isReady: boolean
	/** Current audio state */
	state: AudioState
	/** Resume audio context (call after user interaction) */
	resume: () => Promise<void>
	/** Play music with optional crossfade */
	playMusic: (id: MusicId, options?: MusicOptions) => void
	/** Stop current music */
	stopMusic: (fadeOutDuration?: number) => void
	/** Play a sound effect */
	playSFX: (id: SFXId) => void
	/** Play a player's assigned sound */
	playPlayerSound: (playerId: string, trigger: PlayerSoundTrigger, soundId?: string) => void
	/** Set master volume (0-1) */
	setMasterVolume: (volume: number) => void
	/** Set music volume (0-1) */
	setMusicVolume: (volume: number) => void
	/** Set SFX volume (0-1) */
	setSFXVolume: (volume: number) => void
	/** Toggle mute */
	toggleMute: () => boolean
	/** Get current frequency bands for FFT visualization */
	frequencyBands: number[]
}

const AudioContext = createContext<AudioContextValue | null>(null)

interface AudioProviderProps {
	children: React.ReactNode
	/** Whether to enable FFT analysis (for visualizations) */
	enableFFT?: boolean
}

/**
 * Audio Provider Component
 *
 * Wrap your app (or Jumbotron) with this to enable audio.
 */
export function AudioProvider({ children, enableFFT = false }: AudioProviderProps) {
	const [isReady, setIsReady] = useState(false)
	const [state, setState] = useState<AudioState>(() => AudioManager.getState())
	const [frequencyBands, setFrequencyBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0])
	const initializingRef = useRef(false)

	// Initialize audio system on mount
	useEffect(() => {
		if (initializingRef.current) return
		initializingRef.current = true

		const init = async () => {
			try {
				await AudioManager.initialize()
				setIsReady(true)
				setState(AudioManager.getState())
				console.log('[AudioProvider] Audio system ready')
			} catch (error) {
				console.error('[AudioProvider] Failed to initialize audio:', error)
			}
		}

		void init()

		return () => {
			// Don't cleanup on unmount - audio should persist across route changes
			// AudioManager.cleanup() would be called on app unload instead
		}
	}, [])

	// Enable FFT analysis when requested
	useEffect(() => {
		if (!isReady || !enableFFT) return

		AudioManager.startFFTAnalysis((bands) => {
			setFrequencyBands(bands)
		})

		return () => {
			AudioManager.stopFFTAnalysis()
		}
	}, [isReady, enableFFT])

	// Resume audio context (for autoplay policy compliance)
	const resume = useCallback(async () => {
		await AudioManager.resume()
		setState(AudioManager.getState())
	}, [])

	// Music controls
	const playMusic = useCallback((id: MusicId, options?: MusicOptions) => {
		AudioManager.playMusic(id, options)
		setState(AudioManager.getState())
	}, [])

	const stopMusic = useCallback((fadeOutDuration?: number) => {
		AudioManager.stopMusic(fadeOutDuration)
		setState(AudioManager.getState())
	}, [])

	// SFX controls
	const playSFX = useCallback((id: SFXId) => {
		AudioManager.playSFX(id)
	}, [])

	const playPlayerSound = useCallback(
		(playerId: string, trigger: PlayerSoundTrigger, soundId?: string) => {
			AudioManager.playPlayerSound(playerId, trigger, soundId)
		},
		[]
	)

	// Volume controls
	const setMasterVolume = useCallback((volume: number) => {
		AudioManager.setMasterVolume(volume)
		setState(AudioManager.getState())
	}, [])

	const setMusicVolume = useCallback((volume: number) => {
		AudioManager.setMusicVolume(volume)
		setState(AudioManager.getState())
	}, [])

	const setSFXVolume = useCallback((volume: number) => {
		AudioManager.setSFXVolume(volume)
		setState(AudioManager.getState())
	}, [])

	const toggleMute = useCallback(() => {
		const muted = AudioManager.toggleMute()
		setState(AudioManager.getState())
		return muted
	}, [])

	const value: AudioContextValue = {
		isReady,
		state,
		resume,
		playMusic,
		stopMusic,
		playSFX,
		playPlayerSound,
		setMasterVolume,
		setMusicVolume,
		setSFXVolume,
		toggleMute,
		frequencyBands
	}

	return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

/**
 * Hook to access audio functionality
 *
 * @throws Error if used outside AudioProvider
 */
export function useAudio(): AudioContextValue {
	const context = useContext(AudioContext)
	if (!context) {
		throw new Error('useAudio must be used within an AudioProvider')
	}
	return context
}

/**
 * Hook to get audio context if available, without throwing
 *
 * Useful for components that may or may not be wrapped in AudioProvider
 */
export function useAudioOptional(): AudioContextValue | null {
	return useContext(AudioContext)
}
