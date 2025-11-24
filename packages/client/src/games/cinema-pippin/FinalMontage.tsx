/**
 * Final Montage Component
 * Plays all 3 clips sequentially with winning answers merged into subtitles
 */

import { useState, useEffect } from 'react'
import { VideoPlayer, Subtitle } from './VideoPlayer'

interface ClipData {
	clipNumber: 1 | 2 | 3
	videoUrl: string
	subtitles: Subtitle[]
}

interface FinalMontageProps {
	filmTitle: string
	clips: ClipData[]
	onComplete: () => void
}

export function FinalMontage({ filmTitle, clips, onComplete }: FinalMontageProps) {
	const [currentClipIndex, setCurrentClipIndex] = useState(0)
	const [showTitleCard, setShowTitleCard] = useState(true)

	// Auto-hide title card after 3 seconds
	useEffect(() => {
		const timer = setTimeout(() => {
			setShowTitleCard(false)
		}, 3000)
		return () => clearTimeout(timer)
	}, [])

	const handleVideoComplete = () => {
		if (currentClipIndex < clips.length - 1) {
			// Move to next clip
			setCurrentClipIndex(currentClipIndex + 1)
		} else {
			// All clips complete
			onComplete()
		}
	}

	const currentClip = clips[currentClipIndex]

	if (!currentClip) {
		return (
			<div style={styles.container}>
				<h1 style={styles.title}>Loading montage...</h1>
			</div>
		)
	}

	// Show full-screen title card for 3 seconds before starting playback
	if (showTitleCard && currentClipIndex === 0) {
		return (
			<div style={styles.titleCardContainer}>
				<h1 style={styles.titleCardText}>{filmTitle}</h1>
			</div>
		)
	}

	return (
		<div style={{ width: '100%', height: '100%' }}>
			<VideoPlayer
				key={`montage-clip-${currentClipIndex}`}
				videoUrl={currentClip.videoUrl}
				subtitles={currentClip.subtitles}
				onComplete={handleVideoComplete}
				fadeInDuration={currentClipIndex === 0 ? 2000 : 1000}
				fadeOutDuration={1000}
				isPaused={false}
			/>
		</div>
	)
}

const styles = {
	container: {
		width: '100%',
		height: '100%',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#000'
	},
	title: {
		fontSize: '48px',
		color: '#fff'
	},
	titleCardContainer: {
		width: '100%',
		height: '100%',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#000'
	},
	titleCardText: {
		fontSize: '72px',
		fontWeight: 'bold' as const,
		color: '#FFD700',
		textShadow: '0 0 30px rgba(255, 215, 0, 0.6)',
		margin: 0,
		padding: '0 60px',
		textAlign: 'center' as const
	}
}
