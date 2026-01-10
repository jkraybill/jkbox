/**
 * Scoreboard Transition Component
 * Shows leaderboard before voting results, then animates score increases
 * with dramatic animations, counting effects, and position changes
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAudioOptional } from '../../audio'

interface Player {
	id: string
	nickname: string
	soundId?: string
}

interface ScoreboardTransitionProps {
	players: Player[]
	currentScores: Map<string, number> // Scores BEFORE this round
	voteCounts: Map<string, number> // How many votes each player got this round
	pointsPerVote: number // 1 for film 1, 2 for film 2, 3 for film 3
	onComplete: () => void
}

interface PlayerScore {
	playerId: string
	nickname: string
	soundId?: string
	score: number
	displayScore: number // For counting animation
	targetScore: number
	isAnimating: boolean
	pointsAdded: number // For "+X" display
	showPlusIndicator: boolean
}

/** Medal icons for top 3 positions */
const MEDAL_ICONS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'] as const // 🥇🥈🥉

/** Get medal for position (0-indexed) */
function getMedal(position: number): string {
	return MEDAL_ICONS[position] || ''
}

/**
 * AnimatedScore - counts up from current to target
 */
function AnimatedScore({
	from,
	to,
	duration = 400,
	onComplete
}: {
	from: number
	to: number
	duration?: number
	onComplete?: () => void
}) {
	const [display, setDisplay] = useState(from)
	const frameRef = useRef<number | null>(null)

	useEffect(() => {
		if (from === to) {
			setDisplay(to)
			return
		}

		const startTime = performance.now()
		const diff = to - from

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime
			const progress = Math.min(elapsed / duration, 1)

			// Ease out cubic for satisfying deceleration
			const eased = 1 - Math.pow(1 - progress, 3)
			const value = Math.round(from + diff * eased)

			setDisplay(value)

			if (progress < 1) {
				frameRef.current = requestAnimationFrame(animate)
			} else {
				setDisplay(to)
				onComplete?.()
			}
		}

		frameRef.current = requestAnimationFrame(animate)

		return () => {
			if (frameRef.current) {
				cancelAnimationFrame(frameRef.current)
			}
		}
	}, [from, to, duration, onComplete])

	return <>{display}</>
}

export function ScoreboardTransition({
	players,
	currentScores,
	voteCounts,
	pointsPerVote,
	onComplete
}: ScoreboardTransitionProps) {
	const audio = useAudioOptional()

	// Convert to array of player scores in PREVIOUS round order (don't sort yet)
	const [playerScores, setPlayerScores] = useState<PlayerScore[]>(() => {
		return Array.from(currentScores.entries())
			.map(([playerId, score]) => {
				const player = players.find((p) => p.id === playerId)
				return {
					playerId,
					nickname: player?.nickname || 'Unknown',
					soundId: player?.soundId,
					score,
					displayScore: score,
					targetScore: score,
					isAnimating: false,
					pointsAdded: 0,
					showPlusIndicator: false
				}
			})
			.sort((a, b) => b.score - a.score) // Sort by PREVIOUS scores
	})

	const [animationQueue, setAnimationQueue] = useState<string[]>([])
	const [animationStarted, setAnimationStarted] = useState(false)
	const [showHeader, setShowHeader] = useState(false)

	// Fade in header on mount
	useEffect(() => {
		const timer = setTimeout(() => setShowHeader(true), 300)
		return () => clearTimeout(timer)
	}, [])

	// Build randomized vote queue on mount
	useEffect(() => {
		const queue: string[] = []

		voteCounts.forEach((voteCount, playerId) => {
			for (let i = 0; i < voteCount; i++) {
				queue.push(playerId)
			}
		})

		// Shuffle the queue
		for (let i = queue.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			;[queue[i], queue[j]] = [queue[j] as string, queue[i] as string]
		}

		setAnimationQueue(queue)

		// Start animation after 2 seconds (let players see initial state)
		const startTimer = setTimeout(() => {
			setAnimationStarted(true)
		}, 2000)

		return () => clearTimeout(startTimer)
	}, [voteCounts])

	// Play player sound effect
	const playScoreSound = useCallback(
		(playerId: string, soundId?: string) => {
			if (audio?.isReady) {
				audio.playPlayerSound(playerId, 'score', soundId)
			}
		},
		[audio]
	)

	// Process vote animation queue
	useEffect(() => {
		if (!animationStarted || animationQueue.length === 0) {
			// Animation complete
			if (animationStarted && animationQueue.length === 0) {
				const completeTimer = setTimeout(() => {
					onComplete()
				}, 2000) // Show final state for 2s before completing
				return () => clearTimeout(completeTimer)
			}
			return
		}

		// Pop one vote from queue
		const timer = setTimeout(() => {
			const playerId = animationQueue[0]
			if (!playerId) return

			// Get player's sound ID for audio
			const player = playerScores.find((p) => p.playerId === playerId)

			// Play sound effect
			playScoreSound(playerId, player?.soundId)

			// Increment this player's score
			setPlayerScores(
				(prev) =>
					prev
						.map((p) => {
							if (p.playerId === playerId) {
								return {
									...p,
									score: p.score + pointsPerVote,
									targetScore: p.targetScore + pointsPerVote,
									isAnimating: true,
									pointsAdded: pointsPerVote,
									showPlusIndicator: true
								}
							}
							return { ...p, isAnimating: false, showPlusIndicator: false }
						})
						.sort((a, b) => b.score - a.score) // Re-sort after increment
			)

			// Hide plus indicator after animation
			setTimeout(() => {
				setPlayerScores((prev) =>
					prev.map((p) => ({
						...p,
						showPlusIndicator: false,
						displayScore: p.targetScore // Sync display to target
					}))
				)
			}, 500)

			// Remove this vote from queue
			setAnimationQueue((prev) => prev.slice(1))
		}, 700) // Time between score reveals

		return () => clearTimeout(timer)
	}, [animationQueue, animationStarted, pointsPerVote, onComplete, playerScores, playScoreSound])

	return (
		<div style={styles.container}>
			{/* Animated header */}
			<h1
				style={{
					...styles.title,
					opacity: showHeader ? 1 : 0,
					transform: showHeader ? 'translateY(0)' : 'translateY(-20px)'
				}}
			>
				Leaderboard
			</h1>

			<div style={styles.scoresContainer}>
				{playerScores.map((entry, index) => {
					const medal = getMedal(index)
					const isLeader = index === 0
					const isTop3 = index < 3

					return (
						<div
							key={entry.playerId}
							style={{
								...styles.scoreEntry,
								...(entry.isAnimating ? styles.animating : {}),
								...(isLeader && !entry.isAnimating ? styles.leader : {}),
								...(isTop3 && !isLeader ? styles.podium : {})
							}}
						>
							{/* Rank with medal */}
							<span style={styles.rank}>
								{medal || `${index + 1}.`}
								{medal && <span style={styles.rankNumber}>{index + 1}</span>}
							</span>

							{/* Player name */}
							<span
								style={{
									...styles.playerName,
									...(isLeader ? styles.leaderName : {})
								}}
							>
								{entry.nickname}
							</span>

							{/* Score with counting animation */}
							<span style={styles.scoreWrapper}>
								{/* Plus indicator */}
								{entry.showPlusIndicator && (
									<span style={styles.plusIndicator}>+{entry.pointsAdded}</span>
								)}

								{/* Main score */}
								<span
									style={{
										...styles.scoreValue,
										...(entry.isAnimating ? styles.scoreAnimating : {})
									}}
								>
									<AnimatedScore from={entry.displayScore} to={entry.targetScore} duration={400} />
									<span style={styles.ptsLabel}> pts</span>
								</span>
							</span>
						</div>
					)
				})}
			</div>

			{/* Decorative elements */}
			<div style={styles.glow} />
		</div>
	)
}

const styles = {
	container: {
		width: '100%',
		height: '100%',
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#000',
		padding: '40px',
		position: 'relative' as const,
		overflow: 'hidden'
	},
	title: {
		fontSize: '72px',
		fontWeight: 'bold' as const,
		color: '#FFD700',
		marginBottom: '50px',
		textShadow: '0 0 30px rgba(255, 215, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.3)',
		transition: 'opacity 0.5s ease, transform 0.5s ease',
		letterSpacing: '4px'
	},
	scoresContainer: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '16px',
		width: '700px',
		maxWidth: '90%'
	},
	scoreEntry: {
		display: 'flex',
		alignItems: 'center',
		gap: '20px',
		padding: '20px 30px',
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
		borderRadius: '16px',
		fontSize: '32px',
		color: '#fff',
		transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
		border: '2px solid rgba(255, 255, 255, 0.1)',
		position: 'relative' as const
	},
	animating: {
		backgroundColor: 'rgba(76, 175, 80, 0.4)',
		border: '2px solid #4CAF50',
		transform: 'scale(1.05)',
		boxShadow: '0 0 40px rgba(76, 175, 80, 0.6), inset 0 0 20px rgba(76, 175, 80, 0.2)',
		zIndex: 10
	},
	leader: {
		backgroundColor: 'rgba(255, 215, 0, 0.15)',
		border: '2px solid rgba(255, 215, 0, 0.5)',
		boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)'
	},
	podium: {
		backgroundColor: 'rgba(255, 255, 255, 0.12)'
	},
	rank: {
		fontSize: '36px',
		fontWeight: 'bold' as const,
		minWidth: '60px',
		color: '#FFD700',
		display: 'flex',
		alignItems: 'center',
		gap: '4px'
	},
	rankNumber: {
		fontSize: '14px',
		opacity: 0.6,
		marginLeft: '2px'
	},
	playerName: {
		flex: 1,
		fontSize: '36px',
		fontWeight: 'bold' as const,
		whiteSpace: 'nowrap' as const,
		overflow: 'hidden',
		textOverflow: 'ellipsis'
	},
	leaderName: {
		color: '#FFD700',
		textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
	},
	scoreWrapper: {
		position: 'relative' as const,
		display: 'flex',
		alignItems: 'center'
	},
	scoreValue: {
		fontSize: '44px',
		fontWeight: 'bold' as const,
		color: '#fff',
		minWidth: '120px',
		textAlign: 'right' as const,
		transition: 'transform 0.2s ease, color 0.2s ease',
		fontVariantNumeric: 'tabular-nums'
	},
	scoreAnimating: {
		color: '#4CAF50',
		transform: 'scale(1.15)',
		textShadow: '0 0 20px rgba(76, 175, 80, 0.8)'
	},
	ptsLabel: {
		fontSize: '20px',
		opacity: 0.7,
		marginLeft: '4px'
	},
	plusIndicator: {
		position: 'absolute' as const,
		right: '100%',
		marginRight: '10px',
		fontSize: '28px',
		fontWeight: 'bold' as const,
		color: '#4CAF50',
		animation: 'floatUp 0.6s ease-out forwards',
		textShadow: '0 0 10px rgba(76, 175, 80, 0.8)',
		whiteSpace: 'nowrap' as const
	},
	glow: {
		position: 'absolute' as const,
		top: '50%',
		left: '50%',
		width: '800px',
		height: '800px',
		background: 'radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0) 70%)',
		transform: 'translate(-50%, -50%)',
		pointerEvents: 'none' as const,
		zIndex: 0
	}
}

// Inject keyframes for float animation
if (typeof document !== 'undefined') {
	const styleId = 'scoreboard-transition-animations'
	if (!document.getElementById(styleId)) {
		const styleSheet = document.createElement('style')
		styleSheet.id = styleId
		styleSheet.textContent = `
			@keyframes floatUp {
				0% {
					opacity: 1;
					transform: translateY(0) scale(1);
				}
				100% {
					opacity: 0;
					transform: translateY(-30px) scale(1.2);
				}
			}
			@keyframes pulse {
				0%, 100% {
					opacity: 1;
				}
				50% {
					opacity: 0.7;
				}
			}
		`
		document.head.appendChild(styleSheet)
	}
}
