/**
 * Cinema Pippin - Controller Component (Player Phone)
 * Handles answer submission for C1/C2/C3 clips
 */

import { useState, useEffect, useCallback } from 'react'
import type { ControllerProps } from '@jkbox/shared'
import { AnswerInput } from './AnswerInput'
import { VotingUI } from './VotingUI'

interface Answer {
	id: string
	text: string
	authorId: string
	votedBy: string[]
}

interface PlayerError {
	playerId: string
	message: string
	code: string
}

interface CinemaPippinGameState {
	phase: string
	currentClipIndex?: number
	answerTimeout?: number
	answerCollectionStartTime?: number
	playerAnswers?: Map<string, string> | Record<string, string>
	allAnswers?: Answer[]
	playerErrors?: Map<string, PlayerError> | Record<string, PlayerError>
}

export function CinemaPippinController({ playerId, state, sendToServer }: ControllerProps) {
	const gameState = state as CinemaPippinGameState
	const [timeRemaining, setTimeRemaining] = useState(60)
	const [hasSubmitted, setHasSubmitted] = useState(false)

	// Check if player has already submitted an answer
	useEffect(() => {
		if (gameState.playerAnswers) {
			// Handle both Map (server-side) and plain object (after WebSocket serialization)
			const hasAnswer =
				gameState.playerAnswers instanceof Map
					? gameState.playerAnswers.has(playerId)
					: playerId in gameState.playerAnswers
			setHasSubmitted(hasAnswer)
		}
	}, [gameState.playerAnswers, playerId])

	// Countdown timer - sync with server timestamp
	useEffect(() => {
		if (gameState.phase !== 'answer_collection') {
			return
		}

		// Reset submitted state when entering answer collection phase
		setHasSubmitted(false)

		// Calculate time remaining based on server timestamp
		const updateTimer = () => {
			if (gameState.answerCollectionStartTime) {
				const elapsed = Math.floor((Date.now() - gameState.answerCollectionStartTime) / 1000)
				const remaining = Math.max(0, (gameState.answerTimeout ?? 60) - elapsed)
				setTimeRemaining(remaining)
			} else {
				// Fallback if no timestamp
				setTimeRemaining(gameState.answerTimeout ?? 60)
			}
		}

		// Update immediately
		updateTimer()

		// Then update every second
		const interval = setInterval(updateTimer, 1000)

		return () => clearInterval(interval)
	}, [gameState.phase, gameState.answerTimeout, gameState.answerCollectionStartTime])

	const handleSubmitAnswer = useCallback(
		(answer: string) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			sendToServer({
				playerId,
				type: 'SUBMIT_ANSWER',
				payload: {
					answer
				}
			})
			setHasSubmitted(true)
		},
		[sendToServer, playerId]
	)

	// Render different views based on game phase
	const renderPhaseContent = () => {
		switch (gameState.phase) {
			case 'film_select':
			case 'clip_intro':
			case 'clip_playback':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Cinema Pippin</h1>
						<p style={styles.message}>Watch the jumbotron...</p>
					</div>
				)

			case 'answer_collection': {
				// Get error for this player if any
				const playerError =
					gameState.playerErrors instanceof Map
						? gameState.playerErrors.get(playerId)
						: gameState.playerErrors?.[playerId]

				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Submit Your Answer!</h1>
						<AnswerInput
							clipNumber={((gameState.currentClipIndex ?? 0) + 1) as 1 | 2 | 3}
							timeRemaining={timeRemaining}
							onSubmit={handleSubmitAnswer}
							submitted={hasSubmitted}
							error={playerError}
						/>
					</div>
				)
			}

			case 'voting_playback':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Watch the Answers!</h1>
						<p style={styles.message}>Get ready to vote...</p>
					</div>
				)

			case 'voting_collection':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Vote for the Funniest!</h1>
						<VotingUI
							playerId={playerId}
							allAnswers={gameState.allAnswers}
							onVote={(answerId) => {
								sendToServer({
									playerId,
									type: 'SUBMIT_VOTE',
									payload: { answerId }
								})
							}}
						/>
					</div>
				)

			case 'results_display':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Results</h1>
						<p style={styles.message}>Check the jumbotron for results!</p>
					</div>
				)

			case 'film_title_collection':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Name This Film!</h1>
						<p style={styles.message}>Film title submission coming soon...</p>
					</div>
				)

			case 'film_title_voting':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Vote for Film Title!</h1>
						<p style={styles.message}>Voting UI coming soon...</p>
					</div>
				)

			case 'final_scores':
			case 'end_game_vote':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Game Complete!</h1>
						<p style={styles.message}>Check final scores on jumbotron</p>
					</div>
				)

			default:
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Cinema Pippin</h1>
						<p style={styles.message}>Waiting for game...</p>
					</div>
				)
		}
	}

	return <div style={styles.fullscreen}>{renderPhaseContent()}</div>
}

const styles = {
	fullscreen: {
		minHeight: '100vh',
		backgroundColor: '#0a0a0a',
		color: '#fff',
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		padding: '20px'
	},
	container: {
		width: '100%',
		maxWidth: '600px',
		textAlign: 'center' as const
	},
	title: {
		fontSize: '32px',
		fontWeight: 'bold' as const,
		marginBottom: '30px'
	},
	message: {
		fontSize: '18px',
		color: '#aaa'
	}
}
