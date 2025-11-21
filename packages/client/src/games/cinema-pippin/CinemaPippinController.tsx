/**
 * Cinema Pippin - Controller Component (Player Phone)
 * Handles answer submission for C1/C2/C3 clips
 */

import React, { useState, useEffect } from 'react'
import type { ControllerProps, GameState } from '@jkbox/shared'
import { AnswerInput } from './AnswerInput'

interface CinemaPippinGameState extends GameState {
	phase: string
	currentClipIndex?: number
	answerTimeout?: number
	playerAnswers?: Map<string, string>
}

export function CinemaPippinController({ playerId, state, sendToServer }: ControllerProps) {
	const gameState = state as CinemaPippinGameState
	const [timeRemaining, setTimeRemaining] = useState(60)
	const [hasSubmitted, setHasSubmitted] = useState(false)

	// Check if player has already submitted an answer
	useEffect(() => {
		if (gameState.playerAnswers) {
			setHasSubmitted(gameState.playerAnswers.has(playerId))
		}
	}, [gameState.playerAnswers, playerId])

	// Countdown timer
	useEffect(() => {
		if (gameState.phase === 'answer_collection') {
			// Reset timer when entering answer collection phase
			setTimeRemaining(gameState.answerTimeout ?? 60)
			setHasSubmitted(false)

			const interval = setInterval(() => {
				setTimeRemaining((prev) => {
					if (prev <= 0) {
						clearInterval(interval)
						return 0
					}
					return prev - 1
				})
			}, 1000)

			return () => clearInterval(interval)
		}
	}, [gameState.phase, gameState.answerTimeout])

	const handleSubmitAnswer = (answer: string) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		sendToServer({
			type: 'SUBMIT_ANSWER',
			payload: {
				playerId,
				answer
			}
		})
		setHasSubmitted(true)
	}

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

			case 'answer_collection':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Submit Your Answer!</h1>
						<AnswerInput
							clipNumber={((gameState.currentClipIndex ?? 0) + 1) as 1 | 2 | 3}
							timeRemaining={timeRemaining}
							onSubmit={handleSubmitAnswer}
							submitted={hasSubmitted}
						/>
					</div>
				)

			case 'voting_playback':
			case 'voting_collection':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Voting Time!</h1>
						<p style={styles.message}>Get ready to vote...</p>
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
