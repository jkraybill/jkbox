import React, { useState, useEffect } from 'react'

export interface AnswerInputProps {
	clipNumber?: 1 | 2 | 3 // Optional: omit for film title round
	timeRemaining: number
	onSubmit: (answer: string) => void
	submitted: boolean
	error?: { message: string; code: string }
}

const ACT_LABELS = {
	1: 'Act I',
	2: 'Act II',
	3: 'Act III'
}

export function AnswerInput({
	clipNumber,
	timeRemaining,
	onSubmit,
	submitted,
	error
}: AnswerInputProps) {
	const [answer, setAnswer] = useState('')
	const isC1 = clipNumber === 1
	const isFilmTitle = clipNumber === undefined

	// Auto-submit when time reaches 0
	// Only depends on timeRemaining to avoid triggering on every keystroke
	useEffect(() => {
		if (timeRemaining === 0 && !submitted && answer.trim()) {
			onSubmit(answer.trim())
		}
	}, [timeRemaining, submitted, answer, onSubmit])

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value

		if (isC1) {
			// C1: Strip spaces, only allow alphanumeric + ' + -
			const sanitized = value.replace(/\s/g, '').replace(/[^a-zA-Z0-9'-]/g, '')
			setAnswer(sanitized)
		} else {
			// C2/C3: Allow spaces and most characters
			setAnswer(value)
		}
	}

	const handleSubmit = () => {
		const trimmed = answer.trim()
		if (trimmed) {
			onSubmit(trimmed)
		}
	}

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			handleSubmit()
		}
	}

	const isTimeLow = timeRemaining <= 10
	const placeholder = isC1
		? 'Enter single word...'
		: isFilmTitle
			? 'Enter film title...'
			: 'Enter your answer...'
	const label = isFilmTitle ? 'Film Title' : clipNumber && ACT_LABELS[clipNumber]

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h2 style={styles.actLabel}>{label}</h2>
				<div style={{ ...styles.timer, ...(isTimeLow ? styles.timerWarning : {}) }}>
					{timeRemaining}s
				</div>
			</div>

			{isC1 && <p style={styles.hint}>Single word only (no spaces)</p>}

			<input
				type="text"
				value={answer}
				onChange={handleChange}
				onKeyPress={handleKeyPress}
				placeholder={placeholder}
				disabled={submitted}
				style={{
					...styles.input,
					...(submitted ? styles.inputDisabled : {})
				}}
			/>

			<button
				onClick={handleSubmit}
				disabled={submitted || !answer.trim()}
				style={{
					...styles.button,
					...(submitted || !answer.trim() ? styles.buttonDisabled : {})
				}}
			>
				{submitted ? 'Submitted ✓' : 'Submit'}
			</button>

			{error && <p style={styles.error}>{error.message}</p>}

			{submitted && (
				<p style={styles.confirmation}>Answer submitted! Waiting for other players...</p>
			)}
		</div>
	)
}

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '15px',
		padding: '20px',
		backgroundColor: '#1a1a1a',
		borderRadius: '8px',
		maxWidth: '500px',
		margin: '0 auto'
	},
	header: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	actLabel: {
		fontSize: '24px',
		fontWeight: 'bold' as const,
		color: '#fff',
		margin: 0
	},
	timer: {
		fontSize: '32px',
		fontWeight: 'bold' as const,
		color: '#4CAF50',
		padding: '5px 15px',
		backgroundColor: 'rgba(76, 175, 80, 0.1)',
		borderRadius: '4px'
	},
	timerWarning: {
		color: '#ff4444',
		backgroundColor: 'rgba(255, 68, 68, 0.1)',
		animation: 'pulse 1s infinite'
	},
	hint: {
		fontSize: '14px',
		color: '#aaa',
		margin: 0
	},
	input: {
		fontSize: '18px',
		padding: '12px',
		borderRadius: '4px',
		border: '2px solid #333',
		backgroundColor: '#2a2a2a',
		color: '#fff',
		outline: 'none'
	},
	inputDisabled: {
		opacity: 0.5,
		cursor: 'not-allowed'
	},
	button: {
		fontSize: '18px',
		fontWeight: 'bold' as const,
		padding: '12px 24px',
		borderRadius: '4px',
		border: 'none',
		backgroundColor: '#4CAF50',
		color: '#fff',
		cursor: 'pointer',
		transition: 'background-color 0.2s'
	},
	buttonDisabled: {
		backgroundColor: '#666',
		cursor: 'not-allowed',
		opacity: 0.6
	},
	confirmation: {
		fontSize: '16px',
		color: '#4CAF50',
		textAlign: 'center' as const,
		margin: 0
	},
	error: {
		fontSize: '16px',
		color: '#ff4444',
		textAlign: 'center' as const,
		margin: 0,
		fontWeight: 'bold' as const
	}
}
