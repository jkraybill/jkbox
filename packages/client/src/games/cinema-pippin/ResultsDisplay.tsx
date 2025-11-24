/**
 * Cinema Pippin - Results Display Component
 * Shows answers sequentially from lowest to highest votes
 * with animations for reveals and score updates
 */

import { useState, useEffect, useMemo } from 'react'
import type { Player } from '@jkbox/shared'

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
	players: Player[]
	scores?: Record<string, number> // For future use (displaying updated scores)
	onComplete: () => void
}

enum DisplayState {
	ShowAnswer,
	ShowVoters,
	ShowAuthorAndScore,
	ShowWinner,
	Complete
}

export function ResultsDisplay({ sortedResults, players, onComplete }: ResultsDisplayProps) {
	const [currentIndex, setCurrentIndex] = useState(0)
	const [displayState, setDisplayState] = useState<DisplayState>(DisplayState.ShowAnswer)
	const [revealedVoters, setRevealedVoters] = useState<string[]>([])
	const [shuffledVoters, setShuffledVoters] = useState<string[]>([])

	// Create player ID to nickname mapping
	const playerNicknames = useMemo(() => {
		const map = new Map<string, string>()
		for (const player of players) {
			map.set(player.id, player.nickname)
		}
		return map
	}, [players])

	// Helper to get display name for a player ID
	const getPlayerName = (playerId: string): string => {
		if (playerId === 'house') {
			return '🤖 AI'
		}
		return playerNicknames.get(playerId) || playerId
	}

	const currentResult = sortedResults[currentIndex]
	const isLastResult = currentIndex === sortedResults.length - 1

	// Shuffle voters when transitioning to a new answer
	useEffect(() => {
		if (displayState === DisplayState.ShowAnswer && currentResult) {
			// Shuffle voters for random reveal order
			const shuffled = [...currentResult.voters].sort(() => Math.random() - 0.5)
			setShuffledVoters(shuffled)
			setRevealedVoters([])
		}
	}, [currentIndex, displayState, currentResult])

	// State machine for result display
	useEffect(() => {
		if (sortedResults.length === 0) {
			setDisplayState(DisplayState.Complete)
			return
		}

		// Guard against undefined currentResult
		if (!currentResult) {
			return
		}

		let timer: ReturnType<typeof setTimeout> | undefined

		switch (displayState) {
			case DisplayState.ShowAnswer:
				// Show answer alone for 1 second
				timer = setTimeout(() => {
					if (currentResult.voters.length === 0) {
						// No voters, skip to author/score
						setDisplayState(DisplayState.ShowAuthorAndScore)
					} else {
						// Start revealing voters
						setDisplayState(DisplayState.ShowVoters)
					}
				}, 1000)
				break

			case DisplayState.ShowVoters:
				// Reveal one voter at a time (500ms each)
				if (revealedVoters.length < shuffledVoters.length) {
					timer = setTimeout(() => {
						setRevealedVoters([...revealedVoters, shuffledVoters[revealedVoters.length] as string])
					}, 500)
				} else {
					// All voters revealed, show author and score
					setDisplayState(DisplayState.ShowAuthorAndScore)
				}
				break

			case DisplayState.ShowAuthorAndScore:
				// Show author + points for 1.5 seconds
				timer = setTimeout(() => {
					if (isLastResult) {
						setDisplayState(DisplayState.ShowWinner)
					} else {
						// Move to next answer
						setCurrentIndex(currentIndex + 1)
						setDisplayState(DisplayState.ShowAnswer)
					}
				}, 1500)
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
	}, [
		displayState,
		currentIndex,
		revealedVoters,
		shuffledVoters,
		isLastResult,
		currentResult,
		sortedResults.length,
		onComplete
	])

	if (sortedResults.length === 0) {
		return (
			<div style={styles.container}>
				<h1 style={styles.title}>No Results</h1>
				<p style={styles.authorText}>Nobody voted!</p>
			</div>
		)
	}

	// Guard against undefined currentResult
	if (!currentResult) {
		return null
	}

	if (displayState === DisplayState.ShowWinner) {
		const winner = sortedResults[sortedResults.length - 1]
		if (!winner) {
			return null
		}

		// Helper to get author display text for winner
		const getWinnerAuthorText = (authorId: string): string => {
			if (authorId === 'house') {
				// Find who this house answer is for
				const voter = winner.voters[0]
				if (voter) {
					return `🤖 House Answer for ${getPlayerName(voter)}`
				}
				return '🤖 House Answer'
			}
			return `👤 ${getPlayerName(authorId)}`
		}

		return (
			<div style={styles.container}>
				<h1 style={styles.winnerText}>WINNER!</h1>
				<div style={styles.answerCard}>
					<p style={styles.answerText}>"{winner.answer.text}"</p>
					{winner.voters.length > 0 && (
						<p style={styles.votersText}>
							Voted by: {winner.voters.map((id) => getPlayerName(id)).join(', ')}
						</p>
					)}
					<p style={styles.authorText}>by {getWinnerAuthorText(winner.answer.authorId)}</p>
					<p style={styles.scoreText}>
						+{winner.voteCount} {winner.voteCount === 1 ? 'point' : 'points'}
					</p>
				</div>
			</div>
		)
	}

	if (displayState === DisplayState.Complete) {
		return null
	}

	// Helper to get author display text
	const getAuthorText = (authorId: string): string => {
		if (authorId === 'house') {
			// Find who this house answer is for
			const voter = currentResult.voters[0]
			if (voter) {
				return `🤖 House Answer for ${getPlayerName(voter)}`
			}
			return '🤖 House Answer'
		}
		return `👤 ${getPlayerName(authorId)}`
	}

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Results</h1>

			<div style={styles.answerCard}>
				<p style={styles.answerText}>"{currentResult.answer.text}"</p>

				{/* Show voters one by one */}
				{displayState === DisplayState.ShowVoters && revealedVoters.length > 0 && (
					<p style={styles.votersText}>
						Voted by: {revealedVoters.map((id) => getPlayerName(id)).join(', ')}
					</p>
				)}

				{/* Show author and score after all voters revealed */}
				{displayState === DisplayState.ShowAuthorAndScore && (
					<>
						{currentResult.voters.length > 0 && (
							<p style={styles.votersText}>
								Voted by: {currentResult.voters.map((id) => getPlayerName(id)).join(', ')}
							</p>
						)}
						<p style={styles.authorText}>by {getAuthorText(currentResult.answer.authorId)}</p>
						<p style={styles.scoreText}>
							+{currentResult.voteCount} {currentResult.voteCount === 1 ? 'point' : 'points'}
						</p>
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
