/**
 * Cinema Pippin - Film Countdown Component
 * Old-timey film countdown with rotating circle
 * Shows 5, 4, 3, 2, 1 countdown
 */

import { useState, useEffect } from 'react'

interface FilmCountdownProps {
	duration: number // Total duration in milliseconds (usually 5000)
	onComplete: () => void
}

export function FilmCountdown({ duration, onComplete }: FilmCountdownProps) {
	const [count, setCount] = useState(5)
	const [rotation, setRotation] = useState(0)

	useEffect(() => {
		// Calculate interval for each number (duration / 5)
		const interval = duration / 5

		// Start countdown
		const countdownTimer = setInterval(() => {
			setCount((prev) => {
				if (prev <= 1) {
					clearInterval(countdownTimer)
					// Call onComplete after showing "1"
					setTimeout(onComplete, interval)
					return 1
				}
				return prev - 1
			})
		}, interval)

		// Rotate the circle continuously
		const rotationTimer = setInterval(() => {
			setRotation((prev) => (prev + 10) % 360)
		}, 50)

		return () => {
			clearInterval(countdownTimer)
			clearInterval(rotationTimer)
		}
	}, [duration, onComplete])

	return (
		<div style={styles.container}>
			{/* Old film grain effect */}
			<div style={styles.filmGrain} />

			{/* Countdown circle with rotating line */}
			<div style={styles.countdownCircle}>
				{/* Outer circle */}
				<svg width="300" height="300" style={styles.svg}>
					<circle
						cx="150"
						cy="150"
						r="140"
						fill="none"
						stroke="white"
						strokeWidth="3"
						opacity="0.9"
					/>
					<circle
						cx="150"
						cy="150"
						r="120"
						fill="none"
						stroke="white"
						strokeWidth="2"
						opacity="0.7"
					/>

					{/* Rotating line */}
					<line
						x1="150"
						y1="150"
						x2="150"
						y2="30"
						stroke="white"
						strokeWidth="4"
						transform={`rotate(${rotation} 150 150)`}
						opacity="0.8"
					/>

					{/* Center dot */}
					<circle cx="150" cy="150" r="8" fill="white" />
				</svg>

				{/* Number in center */}
				<div style={styles.number}>{count}</div>
			</div>

			{/* Film scratches overlay */}
			<div style={styles.scratches} />
		</div>
	)
}

const styles = {
	container: {
		position: 'relative' as const,
		width: '100%',
		height: '100%',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#000',
		overflow: 'hidden'
	},
	filmGrain: {
		position: 'absolute' as const,
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		background: `
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 2px,
				rgba(255, 255, 255, 0.03) 2px,
				rgba(255, 255, 255, 0.03) 4px
			)
		`,
		opacity: 0.5,
		pointerEvents: 'none' as const
	},
	svg: {
		filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))'
	},
	countdownCircle: {
		position: 'relative' as const,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1
	},
	number: {
		position: 'absolute' as const,
		fontSize: '120px',
		fontWeight: 'bold' as const,
		color: '#fff',
		fontFamily: 'monospace',
		textShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
		userSelect: 'none' as const
	},
	scratches: {
		position: 'absolute' as const,
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		background: `
			repeating-linear-gradient(
				90deg,
				transparent,
				transparent 50px,
				rgba(255, 255, 255, 0.02) 50px,
				rgba(255, 255, 255, 0.02) 51px
			)
		`,
		opacity: 0.3,
		pointerEvents: 'none' as const
	}
}
