import { useState, useEffect, useRef, useCallback } from 'react'
import { getAudioBaseUrl, getApiBaseUrl } from '../lib/server-url'

/**
 * Number of frequency bands to extract from FFT analysis.
 * These will be mapped to different Pippin animation channels.
 */
const NUM_BANDS = 8

/**
 * FFT size for the analyser node. Larger = more frequency resolution.
 * Must be power of 2. 256 gives us 128 frequency bins which is plenty.
 */
const FFT_SIZE = 256

/**
 * Smoothing factor for snappy-but-smooth response.
 * 0 = no smoothing (instant), 1 = max smoothing (slow).
 * 0.3 gives snappy response with slight smoothing to prevent jitter.
 */
const SMOOTHING_TIME_CONSTANT = 0.3

/**
 * How often to sample FFT data (ms). 16ms = ~60fps.
 */
const SAMPLE_INTERVAL = 16

interface UseLobbyAudioResult {
	/** 8 normalized frequency band values (0-1), updated in real-time */
	frequencyBands: number[]
	/** Whether audio is currently playing */
	isPlaying: boolean
	/** Current track name (for debugging) */
	currentTrack: string | null
	/** Any error that occurred */
	error: string | null
}

/**
 * Hook that plays random lobby music and provides real-time FFT frequency bands.
 *
 * @param isActive - Whether to play audio (true when in lobby phase)
 * @returns Object with frequencyBands array and playback state
 */
export function useLobbyAudio(isActive: boolean): UseLobbyAudioResult {
	const [frequencyBands, setFrequencyBands] = useState<number[]>(() =>
		Array.from({ length: NUM_BANDS }, () => 0)
	)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTrack, setCurrentTrack] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Refs for audio infrastructure (persist across renders)
	const audioContextRef = useRef<AudioContext | null>(null)
	const analyserRef = useRef<AnalyserNode | null>(null)
	const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
	const audioElementRef = useRef<HTMLAudioElement | null>(null)
	const animationFrameRef = useRef<number | null>(null)
	const lastSampleTimeRef = useRef<number>(0)

	// Store previous bands for smooth interpolation
	const previousBandsRef = useRef<number[]>(Array.from({ length: NUM_BANDS }, () => 0))

	/**
	 * Fetch available tracks and pick a random one
	 */
	const fetchRandomTrack = useCallback(async (): Promise<string | null> => {
		try {
			const response = await fetch(`${getApiBaseUrl()}/audio/lobby-tracks`)
			const { tracks } = (await response.json()) as { tracks: string[] }

			if (tracks.length === 0) {
				console.warn('[LobbyAudio] No tracks available')
				return null
			}

			// Pick random track
			const randomIndex = Math.floor(Math.random() * tracks.length)
			const randomTrack = tracks[randomIndex]
			if (!randomTrack) {
				console.warn('[LobbyAudio] Failed to select random track')
				return null
			}
			console.log(`[LobbyAudio] Selected track: ${randomTrack}`)
			return randomTrack
		} catch (err) {
			console.error('[LobbyAudio] Failed to fetch tracks:', err)
			return null
		}
	}, [])

	/**
	 * Extract frequency bands from raw FFT data.
	 * Uses balanced (linear) band splitting for even frequency response.
	 */
	const extractBands = useCallback((dataArray: Uint8Array): number[] => {
		const binCount = dataArray.length
		const bandsPerBin = Math.floor(binCount / NUM_BANDS)
		const bands: number[] = []

		for (let i = 0; i < NUM_BANDS; i++) {
			const start = i * bandsPerBin
			const end = start + bandsPerBin

			// Average the bins in this band
			let sum = 0
			for (let j = start; j < end && j < binCount; j++) {
				const value = dataArray[j]
				if (value !== undefined) {
					sum += value
				}
			}
			const avg = sum / bandsPerBin

			// Normalize to 0-1 range (raw values are 0-255)
			bands.push(avg / 255)
		}

		return bands
	}, [])

	/**
	 * Smooth interpolation between previous and current bands.
	 * Gives snappy but non-jittery response.
	 */
	const smoothBands = useCallback((current: number[], previous: number[]): number[] => {
		const LERP_FACTOR = 0.7 // Higher = snappier (0.7 = 70% new value)
		return current.map((val, i) => {
			const prev = previous[i] ?? 0
			return prev + (val - prev) * LERP_FACTOR
		})
	}, [])

	/**
	 * Animation loop that samples FFT and updates bands
	 */
	const updateBands = useCallback(() => {
		const now = performance.now()

		// Throttle updates to SAMPLE_INTERVAL
		if (now - lastSampleTimeRef.current < SAMPLE_INTERVAL) {
			animationFrameRef.current = requestAnimationFrame(updateBands)
			return
		}
		lastSampleTimeRef.current = now

		const analyser = analyserRef.current
		if (!analyser) {
			animationFrameRef.current = requestAnimationFrame(updateBands)
			return
		}

		// Get frequency data
		const dataArray = new Uint8Array(analyser.frequencyBinCount)
		analyser.getByteFrequencyData(dataArray)

		// Extract and smooth bands
		const rawBands = extractBands(dataArray)
		const smoothedBands = smoothBands(rawBands, previousBandsRef.current)
		previousBandsRef.current = smoothedBands

		setFrequencyBands(smoothedBands)

		// Continue loop
		animationFrameRef.current = requestAnimationFrame(updateBands)
	}, [extractBands, smoothBands])

	/**
	 * Initialize audio playback with FFT analysis
	 */
	const initAudio = useCallback(async () => {
		// Cleanup any existing audio
		if (audioElementRef.current) {
			audioElementRef.current.pause()
			audioElementRef.current.src = ''
		}
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current)
		}

		// Get random track
		const track = await fetchRandomTrack()
		if (!track) {
			setError('No lobby audio tracks available')
			return
		}

		try {
			// Create audio element
			const audio = new Audio()
			audio.src = `${getAudioBaseUrl()}/lobby/${track}`
			audio.loop = true
			audio.volume = 0.7
			audioElementRef.current = audio

			// Create/reuse AudioContext
			const AudioContextClass =
				window.AudioContext ||
				(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

			if (!audioContextRef.current) {
				audioContextRef.current = new AudioContextClass()
			}
			const ctx = audioContextRef.current

			// Resume context if suspended (autoplay policy)
			if (ctx.state === 'suspended') {
				await ctx.resume()
			}

			// Create analyser node
			const analyser = ctx.createAnalyser()
			analyser.fftSize = FFT_SIZE
			analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT
			analyserRef.current = analyser

			// Create source from audio element
			// Only create new source if we don't have one or if it's disconnected
			const source = ctx.createMediaElementSource(audio)
			source.connect(analyser)
			analyser.connect(ctx.destination)
			sourceRef.current = source

			// Start playback
			await audio.play()
			setIsPlaying(true)
			setCurrentTrack(track)
			setError(null)

			console.log(`[LobbyAudio] Playing: ${track}`)

			// Start FFT sampling loop
			animationFrameRef.current = requestAnimationFrame(updateBands)
		} catch (err) {
			console.error('[LobbyAudio] Failed to initialize audio:', err)
			setError(err instanceof Error ? err.message : 'Audio initialization failed')
		}
	}, [fetchRandomTrack, updateBands])

	/**
	 * Cleanup audio resources
	 */
	const cleanup = useCallback(() => {
		console.log('[LobbyAudio] Cleaning up...')

		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = null
		}

		if (audioElementRef.current) {
			audioElementRef.current.pause()
			audioElementRef.current.src = ''
			audioElementRef.current = null
		}

		// Disconnect nodes but keep context alive for reuse
		if (sourceRef.current) {
			try {
				sourceRef.current.disconnect()
			} catch {
				// Already disconnected
			}
			sourceRef.current = null
		}

		if (analyserRef.current) {
			try {
				analyserRef.current.disconnect()
			} catch {
				// Already disconnected
			}
			analyserRef.current = null
		}

		setIsPlaying(false)
		setCurrentTrack(null)
		setFrequencyBands(Array.from({ length: NUM_BANDS }, () => 0))
		previousBandsRef.current = Array.from({ length: NUM_BANDS }, () => 0)
	}, [])

	// Effect to start/stop audio based on isActive
	useEffect(() => {
		if (isActive) {
			void initAudio()
		} else {
			cleanup()
		}

		return cleanup
	}, [isActive, initAudio, cleanup])

	return {
		frequencyBands,
		isPlaying,
		currentTrack,
		error
	}
}
