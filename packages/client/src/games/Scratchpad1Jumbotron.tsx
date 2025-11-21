/**
 * Scratchpad1 Jumbotron - Machine Girl clip playback with fades
 *
 * IMPORTANT: Browser autoplay policy may block video playback between clips.
 * For dedicated jumbotron displays, launch Chrome with autoplay enabled:
 *   ./launch-jumbotron.sh (Linux/Mac)
 *   .\launch-jumbotron.ps1 (Windows)
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import srtToVtt from 'srt-webvtt'
import type { JumbotronProps } from '@jkbox/shared'
import { useSocket } from '../lib/use-socket'
import { useGameStore } from '../store/game-store'

interface Scratchpad1State {
	phase:
		| 'fade-in-1-q'
		| 'play-1-q'
		| 'fade-out-1-q'
		| 'fade-in-1-cpu'
		| 'play-1-cpu'
		| 'fade-out-1-cpu'
		| 'fade-in-2-q'
		| 'play-2-q'
		| 'fade-out-2-q'
		| 'fade-in-2-cpu'
		| 'play-2-cpu'
		| 'fade-out-2-cpu'
	currentClip: 1 | 2
	currentSubtitleType: 'question' | 'cpu'
	videoUrl: string
	subtitleUrl: string
	phaseStartedAt: number
}

const FADE_DURATION = 500 // 500ms fade duration

export function Scratchpad1Jumbotron({ state: gameState }: JumbotronProps) {
	const state = gameState as Scratchpad1State
	const { socket } = useSocket()
	const { room } = useGameStore()
	const [subtitleVtt, setSubtitleVtt] = useState<string | null>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [opacity, setOpacity] = useState(0)
	const [currentSubtitle, setCurrentSubtitle] = useState<string>('')
	const videoRef = useRef<HTMLVideoElement>(null)

	console.log('[Scratchpad1Jumbotron] Render:', {
		phase: state.phase,
		videoUrl: state.videoUrl,
		opacity,
		isPlaying,
		roomPhase: room?.phase,
		subtitleVtt
	})

	// Add subtitle styling when component mounts - hide native subtitles
	useEffect(() => {
		const style = document.createElement('style')
		style.id = 'subtitle-styles'
		style.textContent = `
			@import url('https://fonts.googleapis.com/css2?family=Asap+Condensed:wght@500&display=swap');

			video::cue {
				opacity: 0;
				visibility: hidden;
			}
		`
		document.head.appendChild(style)

		return () => {
			const styleEl = document.getElementById('subtitle-styles')
			if (styleEl) {
				styleEl.remove()
			}
		}
	}, [])

	// Listen to text track cue changes and update custom subtitle display
	useEffect(() => {
		const videoElement = videoRef.current
		if (!videoElement || !videoElement.textTracks || videoElement.textTracks.length === 0) {
			return
		}

		const textTrack = videoElement.textTracks[0]
		if (!textTrack) return

		const handleCueChange = () => {
			const activeCues = textTrack.activeCues
			if (activeCues && activeCues.length > 0) {
				const cue = activeCues[0] as VTTCue
				setCurrentSubtitle(cue.text)
			} else {
				setCurrentSubtitle('')
			}
		}

		textTrack.addEventListener('cuechange', handleCueChange)

		return () => {
			textTrack.removeEventListener('cuechange', handleCueChange)
		}
	}, [subtitleVtt])

	// Convert SRT to WebVTT when subtitle changes
	useEffect(() => {
		const loadSubtitle = async () => {
			try {
				console.log('[Scratchpad1] Loading subtitle:', state.subtitleUrl)
				const response = await fetch(state.subtitleUrl)
				console.log('[Scratchpad1] Subtitle fetch response:', response.status, response.statusText)

				if (!response.ok) {
					throw new Error(`Subtitle fetch failed: ${response.status} ${response.statusText}`)
				}

				const blob = await response.blob()
				console.log('[Scratchpad1] Subtitle blob size:', blob.size, 'type:', blob.type)

				const vttUrl = await srtToVtt(blob)
				console.log('[Scratchpad1] WebVTT URL created:', vttUrl)

				// DEBUG: Read the actual VTT content to verify format
				const vttResponse = await fetch(vttUrl)
				const vttText = await vttResponse.text()
				console.log('[Scratchpad1] VTT content preview:', vttText.substring(0, 200))

				setSubtitleVtt(vttUrl)
				console.log('[Scratchpad1] Subtitle loaded successfully')
			} catch (error) {
				console.error('[Scratchpad1] Failed to load subtitle:', error)
			}
		}

		void loadSubtitle()
	}, [state.subtitleUrl])

	const advancePhase = useCallback(() => {
		console.log(
			'[Scratchpad1] advancePhase called, socket:',
			!!socket,
			'current phase:',
			state.phase
		)
		if (!socket) {
			console.error('[Scratchpad1] Cannot advance phase - no socket!')
			return
		}
		console.log('[Scratchpad1] Emitting game:action to advance phase from', state.phase)
		socket.emit('game:action', {
			playerId: 'jumbotron',
			type: 'advance-phase',
			payload: {}
		})
		console.log('[Scratchpad1] game:action emitted successfully')
	}, [socket, state.phase])

	// Handle fade-in phases
	useEffect(() => {
		if (!state.phase.startsWith('fade-in-')) {
			return
		}

		console.log('[Scratchpad1] Starting fade-in animation for phase:', state.phase)
		// Start fade-in animation
		setOpacity(0)
		const startTime = Date.now()
		let animationFrameId: number

		const animate = () => {
			const elapsed = Date.now() - startTime
			const progress = Math.min(elapsed / FADE_DURATION, 1)
			setOpacity(progress)

			if (progress < 1) {
				animationFrameId = requestAnimationFrame(animate)
			} else {
				// Fade complete, advance to play phase
				console.log(
					'[Scratchpad1] Fade-in complete, advancing phase (elapsed:',
					elapsed,
					'progress:',
					progress,
					')'
				)
				// Use setTimeout to ensure this happens outside the animation frame
				setTimeout(() => advancePhase(), 0)
			}
		}
		console.log('[Scratchpad1] Fade-in animation started, first frame scheduled')

		animationFrameId = requestAnimationFrame(animate)

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId)
			}
		}
	}, [state.phase, advancePhase])

	// Handle fade-out phases
	useEffect(() => {
		if (!state.phase.startsWith('fade-out-')) {
			return
		}

		// Start fade-out animation
		setOpacity(1)
		const startTime = Date.now()
		let animationFrameId: number

		const animate = () => {
			const elapsed = Date.now() - startTime
			const progress = Math.min(elapsed / FADE_DURATION, 1)
			setOpacity(1 - progress)

			if (progress < 1) {
				animationFrameId = requestAnimationFrame(animate)
			} else {
				// Fade complete, advance to next phase
				setTimeout(() => advancePhase(), 0)
			}
		}

		animationFrameId = requestAnimationFrame(animate)

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId)
			}
		}
	}, [state.phase, advancePhase])

	// Handle play phases
	useEffect(() => {
		if (state.phase.startsWith('play-')) {
			setOpacity(1)

			// Check pause state
			const isPaused =
				room && (room.phase === 'playing' || room.phase === 'countdown' || room.phase === 'results')
					? room.pauseState.isPaused
					: false

			setIsPlaying(!isPaused)
		} else {
			setIsPlaying(false)
		}
	}, [state.phase, room])

	// Update playing state when pause changes
	useEffect(() => {
		if (state.phase.startsWith('play-')) {
			const isPaused =
				room && (room.phase === 'playing' || room.phase === 'countdown' || room.phase === 'results')
					? room.pauseState.isPaused
					: false

			setIsPlaying(!isPaused)
		}
	}, [room, state.phase])

	// Control video play/pause based on isPlaying state
	useEffect(() => {
		if (videoRef.current) {
			if (isPlaying) {
				videoRef.current.play().catch((err) => {
					console.error('[Scratchpad1] Play failed:', err)
				})
			} else {
				videoRef.current.pause()
			}
		}
	}, [isPlaying])

	const handleVideoEnd = () => {
		console.log('[Scratchpad1] Video ended, advancing to fade-out')
		advancePhase()
	}

	const handleVideoReady = () => {
		console.log('[Scratchpad1] Video ready:', state.videoUrl)

		// Enable text tracks (subtitles) on the video element
		// Wait a bit for tracks to be added to the DOM
		setTimeout(() => {
			const videoElement = document.querySelector('video')
			if (videoElement) {
				console.log('[Scratchpad1] Video element found')

				// Check for track elements in DOM
				const trackElements = videoElement.querySelectorAll('track')
				console.log('[Scratchpad1] Track elements in DOM:', trackElements.length)
				trackElements.forEach((track, i) => {
					console.log(`[Scratchpad1] Track ${i}:`, {
						kind: track.kind,
						src: track.src,
						srclang: track.srclang,
						default: track.default
					})
				})

				// Check textTracks API
				if (videoElement.textTracks) {
					console.log('[Scratchpad1] TextTracks available:', videoElement.textTracks.length)
					// Enable all text tracks
					for (let i = 0; i < videoElement.textTracks.length; i++) {
						const track = videoElement.textTracks[i]
						if (!track) continue

						console.log(`[Scratchpad1] TextTrack ${i} before:`, {
							kind: track.kind,
							language: track.language,
							mode: track.mode
						})
						track.mode = 'showing'
						console.log(`[Scratchpad1] TextTrack ${i} after setting mode:`, track.mode)
					}
				} else {
					console.warn('[Scratchpad1] No textTracks on video element')
				}
			} else {
				console.warn('[Scratchpad1] No video element found')
			}
		}, 200)
	}

	const handleVideoError = (error: unknown) => {
		console.error('[Scratchpad1] Video error:', error, 'URL:', state.videoUrl)
		// Try to fetch the URL to see what the actual error is
		fetch(state.videoUrl)
			.then((response) => {
				console.log('[Scratchpad1] Fetch test response:', response.status, response.statusText)
				return response.headers.get('content-type')
			})
			.then((contentType) => {
				console.log('[Scratchpad1] Video content-type:', contentType)
			})
			.catch((fetchError) => {
				console.error('[Scratchpad1] Fetch test failed:', fetchError)
			})
	}

	const handleVideoStart = () => {
		console.log('[Scratchpad1] Video started playing')
	}

	return (
		<div style={styles.container}>
			<div style={{ ...styles.videoContainer, opacity }}>
				<video
					key={state.videoUrl}
					ref={videoRef}
					src={state.videoUrl}
					crossOrigin="anonymous"
					style={{
						width: '100%',
						height: '100%',
						objectFit: 'contain'
					}}
					onLoadedMetadata={handleVideoReady}
					onError={handleVideoError}
					onPlay={handleVideoStart}
					onEnded={handleVideoEnd}
				>
					{subtitleVtt && (
						<track kind="subtitles" src={subtitleVtt} srcLang="en" label="English" default />
					)}
				</video>
			</div>

			{/* Custom subtitle overlay - fixed position at bottom */}
			{currentSubtitle && (
				<div style={styles.subtitleOverlay}>
					<div style={styles.subtitleText}>{currentSubtitle}</div>
				</div>
			)}

			{/* Debug info */}
			<div style={styles.debug}>
				<div>Phase: {state.phase}</div>
				<div>Clip: {state.currentClip}</div>
				<div>Subtitle: {state.currentSubtitleType}</div>
				<div>Opacity: {opacity.toFixed(2)}</div>
				<div>Playing: {isPlaying ? 'Yes' : 'No'}</div>
				<div>VTT: {subtitleVtt ? 'Loaded' : 'None'}</div>
			</div>
		</div>
	)
}

const styles = {
	container: {
		width: '100vw',
		height: '100vh',
		backgroundColor: '#000000',
		display: 'flex',
		alignItems: 'flex-start',
		justifyContent: 'center',
		paddingTop: '5vh',
		position: 'relative' as const
	},
	videoContainer: {
		width: '100%',
		height: '70vh',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: 'none' // Using manual opacity updates via requestAnimationFrame
	},
	debug: {
		position: 'fixed' as const,
		bottom: '20px',
		right: '20px',
		backgroundColor: 'rgba(0, 0, 0, 0.7)',
		color: '#00ff00',
		padding: '10px',
		borderRadius: '5px',
		fontSize: '14px',
		fontFamily: 'monospace',
		zIndex: 9999
	},
	subtitleOverlay: {
		position: 'fixed' as const,
		top: '77vh',
		left: 0,
		right: 0,
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'flex-start',
		pointerEvents: 'none' as const,
		zIndex: 1000
	},
	subtitleText: {
		fontFamily: "'Asap Condensed', sans-serif",
		fontWeight: 500,
		fontSize: '3vw',
		color: 'white',
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
		padding: '0.5em 1em',
		borderRadius: '4px',
		textAlign: 'center' as const,
		maxWidth: '80%'
	},
	clickOverlay: {
		position: 'fixed' as const,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.9)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 10000,
		cursor: 'pointer'
	},
	clickPrompt: {
		fontSize: '48px',
		color: '#ffffff',
		fontWeight: 'bold',
		textAlign: 'center' as const,
		animation: 'pulse 2s ease-in-out infinite'
	}
}
