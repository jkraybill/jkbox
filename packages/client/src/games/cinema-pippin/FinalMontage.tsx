/**
 * Final Montage Component
 * Plays all 3 clips sequentially with winning answers merged into subtitles
 */

import { useState } from 'react'
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

	return (
		<div style={{ width: '100%', height: '100%' }}>
			{/* Show film title before first clip */}
			{currentClipIndex === 0 && (
				<div style={styles.titleOverlay}>
					<h1 style={styles.filmTitle}>{filmTitle}</h1>
				</div>
			)}

			<VideoPlayer
				key={`montage-clip-${currentClipIndex}`}
				videoUrl={currentClip.videoUrl}
				subtitles={currentClip.subtitles}
				onComplete={handleVideoComplete}
				fadeInDuration={currentClipIndex === 0 ? 2000 : 1000}
				fadeOutDuration={1000}
				preRollText={`Act ${currentClip.clipNumber}`}
				preRollDuration={1500}
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
	titleOverlay: {
		position: 'absolute' as const,
		top: 0,
		left: 0,
		right: 0,
		padding: '40px',
		textAlign: 'center' as const,
		zIndex: 1000,
		background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
		pointerEvents: 'none' as const
	},
	filmTitle: {
		fontSize: '64px',
		fontWeight: 'bold' as const,
		color: '#FFD700',
		textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
		margin: 0
	}
}
