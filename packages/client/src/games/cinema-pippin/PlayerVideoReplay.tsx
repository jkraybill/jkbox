/**
 * PlayerVideoReplay - Video replay overlay for player phone
 * Muted playback with seek controls and back button
 */

import { useRef, useState, useEffect } from 'react'
import type { Subtitle } from './VideoPlayer'

interface PlayerVideoReplayProps {
	videoUrl: string
	subtitles: Subtitle[]
	onClose: () => void
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

	const [hours, minutes, seconds] = time.split(':').map(Number)
	return (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0) + parseInt(ms, 10) / 1000
}

export function PlayerVideoReplay({ videoUrl, subtitles, onClose }: PlayerVideoReplayProps) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [currentSubtitle, setCurrentSubtitle] = useState<string>('')

	// Update current time and subtitle display
	useEffect(() => {
		const video = videoRef.current
		if (!video) return

		const handleTimeUpdate = () => {
			setCurrentTime(video.currentTime)

			// Find current subtitle (convert SRT timestamps to seconds)
			const currentSub = subtitles.find((sub) => {
				const startSec = srtTimestampToSeconds(sub.startTime)
				const endSec = srtTimestampToSeconds(sub.endTime)
				return video.currentTime >= startSec && video.currentTime <= endSec
			})
			setCurrentSubtitle(currentSub?.text || '')
		}

		const handleLoadedMetadata = () => {
			setDuration(video.duration)
		}

		video.addEventListener('timeupdate', handleTimeUpdate)
		video.addEventListener('loadedmetadata', handleLoadedMetadata)

		return () => {
			video.removeEventListener('timeupdate', handleTimeUpdate)
			video.removeEventListener('loadedmetadata', handleLoadedMetadata)
		}
	}, [subtitles])

	const seek = (seconds: number) => {
		const video = videoRef.current
		if (!video) return

		const newTime = Math.max(0, Math.min(duration, video.currentTime + seconds))
		video.currentTime = newTime
	}

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${mins}:${secs.toString().padStart(2, '0')}`
	}

	return (
		<div style={styles.overlay}>
			<div style={styles.container}>
				{/* Video */}
				<div style={styles.videoContainer}>
					<video
						ref={videoRef}
						src={videoUrl}
						style={styles.video}
						autoPlay
						muted
						playsInline
					/>

					{/* Subtitle overlay */}
					{currentSubtitle && (
						<div style={styles.subtitleContainer}>
							<span style={styles.subtitle}>{currentSubtitle}</span>
						</div>
					)}
				</div>

				{/* Progress bar */}
				<div style={styles.progressContainer}>
					<span style={styles.time}>{formatTime(currentTime)}</span>
					<div style={styles.progressBar}>
						<div
							style={{
								...styles.progressFill,
								width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
							}}
						/>
					</div>
					<span style={styles.time}>{formatTime(duration)}</span>
				</div>

				{/* Controls */}
				<div style={styles.controls}>
					<button onClick={() => seek(-15)} style={styles.seekButton}>
						-15s
					</button>
					<button onClick={onClose} style={styles.backButton}>
						Back to Answer
					</button>
					<button onClick={() => seek(15)} style={styles.seekButton}>
						+15s
					</button>
				</div>
			</div>
		</div>
	)
}

const styles = {
	overlay: {
		position: 'fixed' as const,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: '#000',
		zIndex: 2000,
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center'
	},
	container: {
		width: '100%',
		maxWidth: '100vw',
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '16px',
		padding: '16px'
	},
	videoContainer: {
		position: 'relative' as const,
		width: '100%',
		aspectRatio: '16/9',
		backgroundColor: '#000',
		borderRadius: '8px',
		overflow: 'hidden'
	},
	video: {
		width: '100%',
		height: '100%',
		objectFit: 'contain' as const
	},
	subtitleContainer: {
		position: 'absolute' as const,
		bottom: '10%',
		left: '5%',
		right: '5%',
		textAlign: 'center' as const,
		pointerEvents: 'none' as const
	},
	subtitle: {
		backgroundColor: 'rgba(0, 0, 0, 0.75)',
		color: '#fff',
		fontSize: '16px',
		padding: '8px 12px',
		borderRadius: '4px',
		display: 'inline-block',
		maxWidth: '100%',
		wordWrap: 'break-word' as const
	},
	progressContainer: {
		display: 'flex',
		alignItems: 'center',
		gap: '12px',
		padding: '0 8px'
	},
	time: {
		color: '#aaa',
		fontSize: '14px',
		fontFamily: 'monospace',
		minWidth: '45px'
	},
	progressBar: {
		flex: 1,
		height: '8px',
		backgroundColor: '#333',
		borderRadius: '4px',
		overflow: 'hidden'
	},
	progressFill: {
		height: '100%',
		backgroundColor: '#4CAF50',
		transition: 'width 0.1s linear'
	},
	controls: {
		display: 'flex',
		gap: '12px',
		justifyContent: 'center',
		alignItems: 'center',
		padding: '8px'
	},
	seekButton: {
		padding: '16px 24px',
		fontSize: '18px',
		fontWeight: 'bold' as const,
		backgroundColor: '#333',
		color: '#fff',
		border: 'none',
		borderRadius: '8px',
		cursor: 'pointer',
		touchAction: 'manipulation' as const
	},
	backButton: {
		padding: '16px 32px',
		fontSize: '18px',
		fontWeight: 'bold' as const,
		backgroundColor: '#4CAF50',
		color: '#fff',
		border: 'none',
		borderRadius: '8px',
		cursor: 'pointer',
		touchAction: 'manipulation' as const
	}
}
