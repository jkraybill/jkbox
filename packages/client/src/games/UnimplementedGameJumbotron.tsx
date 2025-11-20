/**
 * UnimplementedGameJumbotron - Placeholder game display
 * Shows countdown + message about game not being implemented
 */

import { useEffect, useState } from 'react'
import type { JumbotronProps } from '@jkbox/shared'

interface UnimplementedGameState {
	startedAt: number
	countdown: number
}

export function UnimplementedGameJumbotron({ gameState }: JumbotronProps) {
	const state = gameState as UnimplementedGameState
	const [countdown, setCountdown] = useState(5)

	// Client-side countdown (synced with server timer)
	useEffect(() => {
		const elapsed = Math.floor((Date.now() - state.startedAt) / 1000)
		const remaining = Math.max(0, 5 - elapsed)
		setCountdown(remaining)

		const timer = setInterval(() => {
			setCountdown((prev) => Math.max(0, prev - 1))
		}, 1000)

		return () => clearInterval(timer)
	}, [state.startedAt])

	return (
		<div style={styles.container}>
			{/* Large countdown circle */}
			<div style={styles.countdownCircle}>
				<span style={styles.countdownNumber}>{countdown}</span>
			</div>

			{/* Message */}
			<div style={styles.messageBox}>
				<h1 style={styles.title}>Game Not Implemented Yet</h1>
				<p style={styles.message}>Talk to JK to get this game working!</p>
			</div>

			{/* Footer hint */}
			<div style={styles.footer}>
				<p>
					Returning to lobby in {countdown} second{countdown !== 1 ? 's' : ''}...
				</p>
			</div>
		</div>
	)
}

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: '100vh',
		backgroundColor: '#1a1a1a',
		color: '#ffffff',
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		padding: '40px'
	},
	countdownCircle: {
		width: '300px',
		height: '300px',
		borderRadius: '50%',
		backgroundColor: '#3b82f6',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: '60px',
		boxShadow: '0 20px 60px rgba(59, 130, 246, 0.4)',
		animation: 'pulse 2s ease-in-out infinite'
	},
	countdownNumber: {
		fontSize: '120px',
		fontWeight: 'bold',
		color: '#ffffff'
	},
	messageBox: {
		textAlign: 'center' as const,
		maxWidth: '800px',
		marginBottom: '40px'
	},
	title: {
		fontSize: '64px',
		fontWeight: 'bold',
		marginBottom: '20px',
		color: '#f59e0b'
	},
	message: {
		fontSize: '32px',
		color: '#aaaaaa',
		lineHeight: 1.6
	},
	footer: {
		fontSize: '24px',
		color: '#666666',
		fontStyle: 'italic'
	}
}

// Add pulse animation via global style injection
if (typeof document !== 'undefined') {
	const styleSheet = document.createElement('style')
	styleSheet.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
  `
	document.head.appendChild(styleSheet)
}
