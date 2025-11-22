/**
 * Cinema Pippin - Voting UI Component
 * Displays voting buttons for player answers
 */

import { useState } from 'react'

interface Answer {
	id: string
	text: string
	authorId: string
	votedBy: string[]
}

interface VotingUIProps {
	playerId: string
	allAnswers?: Answer[]
	onVote: (answerId: string) => void
}

export function VotingUI({ playerId, allAnswers = [], onVote }: VotingUIProps) {
	const [hasVoted, setHasVoted] = useState(false)

	// Filter out player's own answer
	const votableAnswers = allAnswers.filter((answer) => answer.authorId !== playerId)

	const handleVote = (answerId: string) => {
		setHasVoted(true)
		onVote(answerId)
	}

	if (hasVoted) {
		return (
			<div style={styles.container}>
				<p style={styles.votedMessage}>✓ Voted!</p>
				<p style={styles.subtitle}>Waiting for other players...</p>
			</div>
		)
	}

	if (votableAnswers.length === 0) {
		return (
			<div style={styles.container}>
				<p style={styles.subtitle}>No answers to vote on</p>
			</div>
		)
	}

	return (
		<div style={styles.container}>
			{votableAnswers.map((answer) => (
				<button key={answer.id} onClick={() => handleVote(answer.id)} style={styles.button}>
					{answer.text}
				</button>
			))}
		</div>
	)
}

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '15px',
		width: '100%',
		marginTop: '20px'
	},
	button: {
		fontSize: '20px',
		fontWeight: 'bold' as const,
		padding: '20px',
		backgroundColor: '#2196F3',
		color: '#fff',
		border: 'none',
		borderRadius: '8px',
		cursor: 'pointer',
		minHeight: '60px',
		transition: 'background-color 0.2s'
	},
	votedMessage: {
		fontSize: '24px',
		fontWeight: 'bold' as const,
		color: '#4CAF50',
		textAlign: 'center' as const
	},
	subtitle: {
		fontSize: '18px',
		color: '#aaa',
		textAlign: 'center' as const
	}
}
