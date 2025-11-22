/**
 * Cinema Pippin - Results Display Component
 * Shows answers sequentially from lowest to highest votes
 * with animations for reveals and score updates
 */

import { useState, useEffect } from 'react'

interface Answer {
	id: string
	text: string
	authorId: string
	votedBy: string[]
}

interface ResultEntry {
	answer: Answer
	voteCount: number
	voters: string[]
}

interface ResultsDisplayProps {
	sortedResults: ResultEntry[]
	scores?: Record<string, number> // For future use (displaying updated scores)
	onComplete: () => void
}

enum DisplayState {
	ShowAnswer,
	ShowAuthorAndVoters,
	ShowScoreAnimation,
	ShowWinner,
	Complete
}

export function ResultsDisplay({ sortedResults, onComplete }: ResultsDisplayProps) {
	const [currentIndex, setCurrentIndex] = useState(0)
	const [displayState, setDisplayState] = useState<DisplayState>(DisplayState.ShowAnswer)
	const [animatingScore, setAnimatingScore] = useState(0)

	const currentResult = sortedResults[currentIndex]
	const isLastResult = currentIndex === sortedResults.length - 1

	// State machine for result display
	useEffect(() => {
		if (sortedResults.length === 0) {
			setDisplayState(DisplayState.Complete)
			return
		}

		let timer: ReturnType<typeof setTimeout> | undefined

		switch (displayState) {
			case DisplayState.ShowAnswer:
				// Show answer for 1 second
				timer = setTimeout(() => {
					setDisplayState(DisplayState.ShowAuthorAndVoters)
				}, 1000)
				break

			case DisplayState.ShowAuthorAndVoters:
				// Show author/voters immediately, then start score animation
				setDisplayState(DisplayState.ShowScoreAnimation)
				setAnimatingScore(0)
				break

			case DisplayState.ShowScoreAnimation:
				// Animate score increasing (100ms per point)
				if (animatingScore < currentResult.voteCount) {
					timer = setTimeout(() => {
						setAnimatingScore(animatingScore + 1)
					}, 100)
				} else {
					// Score animation complete
					timer = setTimeout(() => {
						if (isLastResult) {
							setDisplayState(DisplayState.ShowWinner)
						} else {
							// Move to next answer
							setCurrentIndex(currentIndex + 1)
							setDisplayState(DisplayState.ShowAnswer)
						}
					}, 500) // Brief pause before next result
				}
				break

			case DisplayState.ShowWinner:
				// Show winner for 2 seconds, then signal complete
				timer = setTimeout(() => {
					setDisplayState(DisplayState.Complete)
					onComplete()
				}, 2000)
				break
		}

		return () => {
			if (timer) {
				clearTimeout(timer)
			}
		}
	}, [displayState, currentIndex, animatingScore, isLastResult, currentResult, sortedResults.length, onComplete])

	if (sortedResults.length === 0) {
		return (
			<div style={styles.container}>
				<h1 style={styles.title}>No Results</h1>
				<p style={styles.subtitle}>Nobody voted!</p>
			</div>
		)
	}

	if (displayState === DisplayState.ShowWinner) {
		const winner = sortedResults[sortedResults.length - 1]
		if (!winner) {
			return null
		}
		return (
			<div style={styles.container}>
				<h1 style={styles.winnerText}>WINNER!</h1>
				<div style={styles.answerCard}>
					<p style={styles.answerText}>"{winner.answer.text}"</p>
					<p style={styles.authorText}>
						{winner.answer.authorId === 'house' ? '🤖 AI' : `👤 ${winner.answer.authorId}`}
					</p>
					<p style={styles.voteCount}>{winner.voteCount} {winner.voteCount === 1 ? 'vote' : 'votes'}</p>
				</div>
			</div>
		)
	}

	if (displayState === DisplayState.Complete) {
		return null
	}

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Results</h1>

			<div style={styles.answerCard}>
				<p style={styles.answerText}>"{currentResult.answer.text}"</p>

				{displayState !== DisplayState.ShowAnswer && (
					<>
						<p style={styles.authorText}>
							by {currentResult.answer.authorId === 'house' ? '🤖 AI' : `👤 ${currentResult.answer.authorId}`}
						</p>

						<p style={styles.votersText}>
							Voted by: {currentResult.voters.join(', ')}
						</p>

						{displayState === DisplayState.ShowScoreAnimation && (
							<p style={styles.scoreText}>
								+{animatingScore} {animatingScore === 1 ? 'point' : 'points'}
							</p>
						)}
					</>
				)}
			</div>

			<div style={styles.progress}>
				{currentIndex + 1} / {sortedResults.length}
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
		padding: '40px'
	},
	title: {
		fontSize: '48px',
		fontWeight: 'bold' as const,
		marginBottom: '40px',
		color: '#fff'
	},
	answerCard: {
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		borderRadius: '16px',
		padding: '40px',
		minWidth: '600px',
		textAlign: 'center' as const
	},
	answerText: {
		fontSize: '32px',
		fontWeight: 'bold' as const,
		color: '#fff',
		marginBottom: '20px'
	},
	authorText: {
		fontSize: '24px',
		color: '#aaa',
		marginBottom: '10px'
	},
	votersText: {
		fontSize: '20px',
		color: '#888',
		marginBottom: '20px'
	},
	scoreText: {
		fontSize: '48px',
		fontWeight: 'bold' as const,
		color: '#4CAF50',
		animation: 'pulse 0.3s'
	},
	progress: {
		marginTop: '40px',
		fontSize: '20px',
		color: '#666'
	},
	winnerText: {
		fontSize: '96px',
		fontWeight: 'bold' as const,
		color: '#FFD700',
		textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
		marginBottom: '40px',
		animation: 'pulse 1s infinite'
	},
	voteCount: {
		fontSize: '20px',
		color: '#aaa'
	}
}
