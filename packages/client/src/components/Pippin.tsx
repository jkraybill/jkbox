import { useState, useEffect } from 'react'

interface PippinProps {
	variant?: 'intro' | 'corner' | 'fullscreen'
	onIntroComplete?: () => void
	/** Duration in milliseconds for intro animation (default: 4000ms / 4 seconds) */
	introDuration?: number
}

export function Pippin({
	variant = 'corner',
	onIntroComplete,
	introDuration = 4000 // 4 seconds default
}: PippinProps) {
	const [showIntro, setShowIntro] = useState(variant === 'intro')

	useEffect(() => {
		if (variant === 'intro') {
			console.log(`[Pippin] Starting intro display (${introDuration}ms)...`)
			const timer = setTimeout(() => {
				console.log('[Pippin] Intro complete, calling onIntroComplete')
				setShowIntro(false)
				onIntroComplete?.()
			}, introDuration)
			return () => clearTimeout(timer)
		}
		return undefined
	}, [variant, onIntroComplete, introDuration])

	// Title screen - show Pippin intro
	if (showIntro && variant === 'intro') {
		return (
			<div style={styles.introContainer}>
				<div style={styles.introBox}>
					<img src="/pippin.png" alt="Pippin the Moodle" style={styles.introImage} />
					<div style={styles.introText}>
						<h1 style={styles.introTitle}>WELCOME TO PIPPIN'S PLAYHOUSE!</h1>
						<p style={styles.introSubtitle}>Let's get this party started! 🐾</p>
					</div>
				</div>
			</div>
		)
	}

	// Corner mascot - static image
	if (variant === 'corner') {
		return (
			<div style={styles.cornerContainer}>
				<img src="/pippin.png" alt="Pippin the Moodle" style={styles.cornerImage} />
			</div>
		)
	}

	// Fullscreen variant (for future use)
	if (variant === 'fullscreen') {
		return (
			<div style={styles.fullscreenContainer}>
				<img src="/pippin.png" alt="Pippin the Moodle" style={styles.fullscreenImage} />
			</div>
		)
	}

	return null
}

const styles = {
	introContainer: {
		position: 'fixed' as const,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: '100vw',
		height: '100vh',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.95)',
		zIndex: 9999,
		overflow: 'hidden'
	},
	introBox: {
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		gap: '5vh'
	},
	introImage: {
		width: '40vh',
		height: '40vh',
		maxWidth: '30vw',
		maxHeight: '30vw',
		objectFit: 'contain' as const,
		filter: 'drop-shadow(var(--shadow-glow-yellow-soft))'
	},
	introText: {
		textAlign: 'center' as const
	},
	introTitle: {
		fontSize: '8vh',
		fontWeight: 'bold',
		color: 'var(--color-primary-yellow)',
		textShadow: 'var(--shadow-glow-yellow)',
		margin: 0,
		marginBottom: '2vh'
	},
	introSubtitle: {
		fontSize: '4vh',
		color: 'var(--color-primary-red)',
		margin: 0
	},
	cornerContainer: {
		position: 'fixed' as const,
		bottom: '3vh',
		right: '3vw',
		zIndex: 100
	},
	cornerImage: {
		width: '15vh',
		height: '15vh',
		maxWidth: '10vw',
		maxHeight: '10vw',
		objectFit: 'contain' as const,
		filter: 'drop-shadow(var(--shadow-default))',
		cursor: 'pointer'
	},
	fullscreenContainer: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		height: '100%'
	},
	fullscreenImage: {
		width: '60vh',
		height: '60vh',
		maxWidth: '40vw',
		maxHeight: '40vw',
		objectFit: 'contain' as const,
		filter: 'drop-shadow(var(--shadow-glow-yellow-soft))'
	}
}
