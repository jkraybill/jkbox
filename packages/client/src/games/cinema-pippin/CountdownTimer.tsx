/**
 * CountdownTimer - Displays countdown timer in top-right corner of jumbotron
 * Syncs with player phone timers using server timestamps
 */

import { useEffect, useState } from 'react'

interface CountdownTimerProps {
	startTime: number // Server timestamp when countdown started
	timeout: number // Total timeout in seconds
	label?: string // Optional label (e.g., "Answer" or "Vote")
}

export function CountdownTimer({ startTime, timeout, label }: CountdownTimerProps) {
	const [timeRemaining, setTimeRemaining] = useState(timeout)

	useEffect(() => {
		const updateTimer = () => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000)
			const remaining = Math.max(0, timeout - elapsed)
			setTimeRemaining(remaining)
		}

		updateTimer() // Update immediately
		const interval = setInterval(updateTimer, 1000)
		return () => clearInterval(interval)
	}, [startTime, timeout])

	const isTimeLow = timeRemaining <= 10
	const isTimeCritical = timeRemaining <= 5

	return (
		<div style={styles.container}>
			{label && <div style={styles.label}>{label}</div>}
			<div
				style={{
					...styles.timer,
					...(isTimeCritical ? styles.timerCritical : isTimeLow ? styles.timerWarning : {})
				}}
			>
				{timeRemaining}s
			</div>
		</div>
	)
}

const styles = {
	container: {
		position: 'absolute' as const,
		top: '20px',
		right: '30px',
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'flex-end',
		gap: '4px',
		zIndex: 100
	},
	label: {
		fontSize: '14px',
		color: 'rgba(255, 255, 255, 0.6)',
		textTransform: 'uppercase' as const,
		letterSpacing: '1px'
	},
	timer: {
		fontSize: '48px',
		fontWeight: 'bold' as const,
		fontFamily: 'monospace',
		color: '#4CAF50',
		textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
		transition: 'color 0.3s ease'
	},
	timerWarning: {
		color: '#FFA500', // Orange
		animation: 'pulse 1s infinite'
	},
	timerCritical: {
		color: '#ff4444', // Red
		animation: 'pulse 0.5s infinite'
	}
}

// Add CSS animation for pulsing effect
const styleSheet = document.createElement('style')
styleSheet.textContent = `
	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.8; transform: scale(1.05); }
	}
`
if (!document.head.querySelector('style[data-countdown-timer]')) {
	styleSheet.setAttribute('data-countdown-timer', 'true')
	document.head.appendChild(styleSheet)
}
