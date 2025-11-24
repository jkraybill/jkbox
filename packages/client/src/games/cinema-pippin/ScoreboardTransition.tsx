/**
 * Scoreboard Transition Component
 * Shows leaderboard before voting results, then animates score increases
 */

import { useState, useEffect } from 'react'

interface Player {
	id: string
	nickname: string
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
	score: number
	isAnimating: boolean
}

export function ScoreboardTransition({
	players,
	currentScores,
	voteCounts,
	pointsPerVote,
	onComplete
}: ScoreboardTransitionProps) {
	// Convert to sorted array of player scores
	const [playerScores, setPlayerScores] = useState<PlayerScore[]>(() => {
		return Array.from(currentScores.entries())
			.map(([playerId, score]) => {
				const player = players.find((p) => p.id === playerId)
				return {
					playerId,
					nickname: player?.nickname || 'Unknown',
					score,
					isAnimating: false
				}
			})
			.sort((a, b) => b.score - a.score)
	})

	const [animationQueue, setAnimationQueue] = useState<string[]>([])
	const [animationStarted, setAnimationStarted] = useState(false)

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

	// Process vote animation queue
	useEffect(() => {
		if (!animationStarted || animationQueue.length === 0) {
			// Animation complete
			if (animationStarted && animationQueue.length === 0) {
				const completeTimer = setTimeout(() => {
					onComplete()
				}, 1500) // Show final state for 1.5s before completing
				return () => clearTimeout(completeTimer)
			}
			return
		}

		// Pop one vote from queue after 600ms
		const timer = setTimeout(() => {
			const playerId = animationQueue[0]
			if (!playerId) return

			// Increment this player's score
			setPlayerScores(
				(prev) =>
					prev
						.map((p) => {
							if (p.playerId === playerId) {
								return {
									...p,
									score: p.score + pointsPerVote,
									isAnimating: true
								}
							}
							return { ...p, isAnimating: false }
						})
						.sort((a, b) => b.score - a.score) // Re-sort after increment
			)

			// Remove this vote from queue
			setAnimationQueue((prev) => prev.slice(1))
		}, 600)

		return () => clearTimeout(timer)
	}, [animationQueue, animationStarted, pointsPerVote, onComplete])

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Leaderboard</h1>
			<div style={styles.scoresContainer}>
				{playerScores.map((entry, index) => (
					<div
						key={entry.playerId}
						style={{
							...styles.scoreEntry,
							...(index === 0 ? styles.firstPlace : {}),
							...(entry.isAnimating ? styles.animating : {})
						}}
					>
						<span style={styles.rank}>{index === 0 ? '👑' : `${index + 1}.`}</span>
						<span style={styles.playerName}>{entry.nickname}</span>
						<span style={styles.scoreValue}>{entry.score} pts</span>
					</div>
				))}
			</div>
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
		padding: '40px'
	},
	title: {
		fontSize: '64px',
		fontWeight: 'bold' as const,
		color: '#FFD700',
		marginBottom: '40px',
		textShadow: '0 0 20px rgba(255, 215, 0, 0.5)'
	},
	scoresContainer: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '20px',
		width: '600px',
		maxWidth: '90%'
	},
	scoreEntry: {
		display: 'flex',
		alignItems: 'center',
		gap: '20px',
		padding: '20px 30px',
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		borderRadius: '12px',
		fontSize: '32px',
		color: '#fff',
		transition: 'all 0.3s ease',
		border: '2px solid transparent'
	},
	firstPlace: {
		backgroundColor: 'rgba(255, 215, 0, 0.2)',
		border: '2px solid #FFD700'
	},
	animating: {
		backgroundColor: 'rgba(0, 255, 0, 0.3)',
		border: '2px solid #00ff00',
		transform: 'scale(1.05)',
		boxShadow: '0 0 30px rgba(0, 255, 0, 0.5)'
	},
	rank: {
		fontSize: '28px',
		fontWeight: 'bold' as const,
		minWidth: '50px',
		color: '#FFD700'
	},
	playerName: {
		flex: 1,
		fontSize: '36px',
		fontWeight: 'bold' as const
	},
	scoreValue: {
		fontSize: '40px',
		fontWeight: 'bold' as const,
		color: '#FFD700'
	}
}
