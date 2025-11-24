/**
 * Autoplay Warning Banner
 * Detects if Chrome is running with --autoplay-policy=no-user-gesture-required
 * and shows a warning banner with instructions if not
 */

import { useState, useEffect } from 'react'

export function AutoplayWarning() {
	const [showWarning, setShowWarning] = useState(false)

	useEffect(() => {
		// Test if unmuted autoplay is allowed
		const testAutoplay = async () => {
			try {
				// Create a test audio context to check autoplay policy
				// Audio contexts are simpler and more reliable than video elements for this test
				const AudioContextClass =
					window.AudioContext ||
					(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
				if (!AudioContextClass) {
					console.warn('[AutoplayWarning] AudioContext not supported')
					setShowWarning(false)
					return
				}
				const audioContext = new AudioContextClass()

				console.log('[AutoplayWarning] Testing unmuted autoplay via AudioContext...')
				console.log('[AutoplayWarning] AudioContext state:', audioContext.state)

				// In Chrome, if autoplay is blocked, audioContext.state will be 'suspended'
				// If --autoplay-policy=no-user-gesture-required is set, it will be 'running'
				if (audioContext.state === 'running') {
					console.log('[AutoplayWarning] ✅ Unmuted autoplay SUCCESS - Chrome flag detected')
					setShowWarning(false)
				} else {
					console.warn('[AutoplayWarning] ⚠️ AudioContext suspended - Chrome flag likely missing')
					setShowWarning(true)
				}

				// Clean up
				await audioContext.close()
			} catch (error) {
				// If AudioContext fails, fall back to assuming autoplay is blocked
				console.error('[AutoplayWarning] ❌ AudioContext test failed')
				console.error('[AutoplayWarning] Error details:', error)
				setShowWarning(true)
			}
		}

		void testAutoplay()
	}, [])

	if (!showWarning) return null

	return (
		<div style={styles.banner}>
			<div style={styles.content}>
				<div style={styles.icon}>⚠️</div>
				<div style={styles.text}>
					<div style={styles.title}>Chrome Autoplay Flag Required</div>
					<div style={styles.instructions}>
						<div>For the best experience, launch Chrome with the autoplay flag:</div>
						<code style={styles.code}>
							chrome --autoplay-policy=no-user-gesture-required http://localhost:3000/
						</code>
						<div style={styles.note}>
							Without this flag, videos may not autoplay and you'll need to click to start each
							clip.
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

const styles = {
	banner: {
		position: 'fixed' as const,
		top: 0,
		left: 0,
		right: 0,
		backgroundColor: '#ff9800',
		color: '#000',
		zIndex: 9999,
		boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
		borderBottom: '3px solid #f57c00'
	},
	content: {
		display: 'flex',
		alignItems: 'flex-start',
		padding: '16px 24px',
		maxWidth: '1200px',
		margin: '0 auto',
		gap: '16px'
	},
	icon: {
		fontSize: '32px',
		flexShrink: 0
	},
	text: {
		flex: 1,
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '8px'
	},
	title: {
		fontSize: '20px',
		fontWeight: 'bold' as const
	},
	instructions: {
		fontSize: '14px',
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '8px'
	},
	code: {
		backgroundColor: 'rgba(0, 0, 0, 0.1)',
		padding: '8px 12px',
		borderRadius: '4px',
		fontFamily: 'monospace',
		fontSize: '13px',
		display: 'block',
		overflowX: 'auto' as const
	},
	note: {
		fontSize: '12px',
		fontStyle: 'italic' as const,
		opacity: 0.9
	}
}
