import { useEffect, useRef, useState } from 'react'

export interface Subtitle {
	index: number
	startTime: string // "00:00:01,000"
	endTime: string // "00:00:04,000"
	text: string
}

export interface VideoPlayerProps {
	videoUrl: string
	subtitles: Subtitle[]
	onComplete: () => void
	fadeInDuration: number
	fadeOutDuration: number
	preRollText?: string
	preRollDuration?: number
	isPaused?: boolean
}

/**
 * Convert SRT timestamp to seconds
 * Format: "00:01:30,500" → 90.5
 */
function srtTimestampToSeconds(timestamp: string): number {
	const parts = timestamp.split(',')
	const time = parts[0]
	const ms = parts[1]
	if (!time || !ms) return 0

	const timeParts = time.split(':').map(Number)
	const hours = timeParts[0] ?? 0
	const minutes = timeParts[1] ?? 0
	const seconds = timeParts[2] ?? 0

	return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000
}

export function VideoPlayer({
	videoUrl,
	subtitles,
	onComplete,
	fadeInDuration,
	fadeOutDuration,
	preRollText,
	preRollDuration = 2000,
	isPaused = false
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null)
	const [opacity, setOpacity] = useState(0)
	const [showPreRoll, setShowPreRoll] = useState(!!preRollText)
	const previousPausedRef = useRef<boolean>(isPaused)

	// Fade in on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			setOpacity(1)
		}, 50)
		return () => clearTimeout(timer)
	}, [])

	// Hide pre-roll after duration
	useEffect(() => {
		if (!preRollText) {
			return
		}

		const timer = setTimeout(() => {
			setShowPreRoll(false)
		}, preRollDuration)
		return () => clearTimeout(timer)
	}, [preRollText, preRollDuration])

	// Handle pause/play based on isPaused prop (only when it changes)
	useEffect(() => {
		if (!videoRef.current) return

		// Only act on changes to isPaused, not initial mount (autoPlay handles that)
		if (previousPausedRef.current === isPaused) return
		previousPausedRef.current = isPaused

		if (isPaused) {
			// Only call pause if it's implemented (not in test environment)
			if (typeof videoRef.current.pause === 'function') {
				videoRef.current.pause()
			}
		} else {
			// Only call play if it's implemented (not in test environment)
			const playPromise = videoRef.current.play?.()
			void playPromise?.catch((error) => {
				console.warn('[VideoPlayer] Failed to play video:', error)
			})
		}
	}, [isPaused])

	// Handle video time updates for subtitle display
	const handleTimeUpdate = () => {
		if (!videoRef.current) return

		const currentTime = videoRef.current.currentTime
		const activeSubtitle = subtitles.find((sub) => {
			const start = srtTimestampToSeconds(sub.startTime)
			const end = srtTimestampToSeconds(sub.endTime)
			return currentTime >= start && currentTime < end
		})

		setCurrentSubtitle(activeSubtitle || null)
	}

	// Handle video end
	const handleEnded = () => {
		// Fade out, then call onComplete
		setOpacity(0)
		setTimeout(() => {
			onComplete()
		}, fadeOutDuration)
	}

	return (
		<div
			data-testid="video-container"
			style={{
				position: 'relative',
				width: '100%',
				height: '100%',
				backgroundColor: '#000',
				opacity,
				transition: `opacity ${Math.max(fadeInDuration, fadeOutDuration)}ms ease-in-out`
			}}
		>
			<video
				ref={videoRef}
				data-testid="video-player"
				src={videoUrl}
				onTimeUpdate={handleTimeUpdate}
				onEnded={handleEnded}
				autoPlay
				style={{
					width: '100%',
					height: 'calc(100% - 4em)',
					objectFit: 'contain'
				}}
			/>

			{currentSubtitle && (
				<div
					data-testid="subtitle-text"
					style={{
						position: 'absolute',
						bottom: 'calc(10% - 0.5em)',
						left: '50%',
						transform: 'translateX(-50%)',
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						color: '#fff',
						padding: '10px 20px',
						borderRadius: '4px',
						fontSize: '51px',
						textAlign: 'center',
						maxWidth: '95%',
						whiteSpace: 'nowrap'
					}}
					dangerouslySetInnerHTML={{
						__html: currentSubtitle.text.replace(/\n/g, '<br />')
					}}
				/>
			)}

			{showPreRoll && preRollText && (
				<div
					data-testid="preroll-overlay"
					style={{
						position: 'absolute',
						top: '50%',
						left: '50%',
						transform: 'translate(-50%, -50%)',
						fontSize: '48px',
						fontWeight: 'bold',
						color: '#fff',
						textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
						zIndex: 10
					}}
				>
					{preRollText}
				</div>
			)}
		</div>
	)
}
