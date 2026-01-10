/**
 * Cinema Pippin - Controller Component (Player Phone)
 * Handles answer submission for C1/C2/C3 clips
 */

import { useState, useEffect, useCallback } from 'react'
import type { ControllerProps } from '@jkbox/shared'
import { AnswerInput } from './AnswerInput'
import { VotingUI } from './VotingUI'
import { PlayerVideoReplay } from './PlayerVideoReplay'
import { QuitConfirmModal } from './QuitConfirmModal'
import type { Subtitle } from './VideoPlayer'

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
	currentFilmIndex?: number
	answerTimeout?: number
	answerCollectionStartTime?: number
	playerAnswers?: Map<string, string> | Record<string, string>
	allAnswers?: Answer[]
	playerErrors?: Map<string, PlayerError> | Record<string, PlayerError>
	scoresBeforeRound?: Map<string, number> | Record<string, number>
	voteCountsThisRound?: Map<string, number> | Record<string, number>
	currentClip?: {
		clipNumber: 1 | 2 | 3
		videoUrl: string
		subtitles: Subtitle[]
	}
}

export function CinemaPippinController({ playerId, state, sendToServer, onQuit }: ControllerProps) {
	const gameState = state as CinemaPippinGameState
	const [timeRemaining, setTimeRemaining] = useState(60)
	const [hasSubmitted, setHasSubmitted] = useState(false)
	const [showVideoReplay, setShowVideoReplay] = useState(false)
	const [showQuitModal, setShowQuitModal] = useState(false)
	// Track which phase we last submitted in to detect phase transitions
	const [submittedInPhase, setSubmittedInPhase] = useState<string | null>(null)

	// Check if player has already submitted an answer
	// IMPORTANT: Only sync from server on initial load or phase change, not during active typing
	// This prevents server state updates from overriding local submission state mid-typing
	useEffect(() => {
		// If we've already submitted locally in this phase, don't let server state override
		if (hasSubmitted && submittedInPhase === gameState.phase) {
			return
		}

		if (gameState.playerAnswers) {
			// Handle both Map (server-side) and plain object (after WebSocket serialization)
			const hasAnswer =
				gameState.playerAnswers instanceof Map
					? gameState.playerAnswers.has(playerId)
					: playerId in gameState.playerAnswers

			// Only set submitted from server if we haven't locally submitted yet
			// This handles reconnection where server knows we already submitted
			if (hasAnswer && !hasSubmitted) {
				setHasSubmitted(true)
				setSubmittedInPhase(gameState.phase)
			}
		}
	}, [gameState.playerAnswers, gameState.phase, playerId, hasSubmitted, submittedInPhase])

	// Countdown timer - sync with server timestamp
	useEffect(() => {
		if (gameState.phase !== 'answer_collection' && gameState.phase !== 'film_title_collection') {
			return
		}

		// Reset submitted state when entering answer collection phase
		setHasSubmitted(false)
		setSubmittedInPhase(null)

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
			setSubmittedInPhase(gameState.phase)
		},
		[sendToServer, playerId, gameState.phase]
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
						{gameState.currentClip && (
							<button onClick={() => setShowVideoReplay(true)} style={styles.replayButton}>
								📹 Replay Clip
							</button>
						)}
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

			case 'film_title_collection': {
				// Get error for this player if any
				const playerError =
					gameState.playerErrors instanceof Map
						? gameState.playerErrors.get(playerId)
						: gameState.playerErrors?.[playerId]

				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Name This Film!</h1>
						<AnswerInput
							// No clipNumber for film title round
							timeRemaining={timeRemaining}
							onSubmit={handleSubmitAnswer}
							submitted={hasSubmitted}
							error={playerError}
						/>
						{gameState.currentClip && (
							<button onClick={() => setShowVideoReplay(true)} style={styles.replayButton}>
								📹 Replay Clip
							</button>
						)}
					</div>
				)
			}

			case 'film_title_voting':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Vote for the Funniest Title!</h1>
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

	const handleConfirmQuit = useCallback(() => {
		setShowQuitModal(false)
		if (onQuit) {
			onQuit()
		}
	}, [onQuit])

	return (
		<div style={styles.fullscreen}>
			{/* Quit button - persistent in top-right corner */}
			{onQuit && (
				<button
					onClick={() => setShowQuitModal(true)}
					style={styles.quitButton}
					aria-label="Quit game"
				>
					✕
				</button>
			)}

			{renderPhaseContent()}

			{/* Video replay overlay */}
			{showVideoReplay && gameState.currentClip && (
				<PlayerVideoReplay
					videoUrl={gameState.currentClip.videoUrl}
					subtitles={gameState.currentClip.subtitles}
					onClose={() => setShowVideoReplay(false)}
				/>
			)}

			{/* Quit confirmation modal */}
			{showQuitModal && (
				<QuitConfirmModal onConfirm={handleConfirmQuit} onCancel={() => setShowQuitModal(false)} />
			)}
		</div>
	)
}

const styles = {
	fullscreen: {
		minHeight: '100vh',
		width: '100%',
		backgroundColor: '#0a0a0a',
		color: '#fff',
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 0,
		position: 'relative' as const
	},
	quitButton: {
		position: 'absolute' as const,
		top: '12px',
		right: '12px',
		width: '36px',
		height: '36px',
		borderRadius: '50%',
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		border: '1px solid rgba(255, 255, 255, 0.2)',
		color: '#888',
		fontSize: '18px',
		fontWeight: 'bold' as const,
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 100,
		touchAction: 'manipulation' as const,
		transition: 'background-color 0.2s, color 0.2s'
	},
	container: {
		width: '100%',
		maxWidth: '600px',
		textAlign: 'center' as const,
		padding: '20px'
	},
	title: {
		fontSize: '32px',
		fontWeight: 'bold' as const,
		marginBottom: '30px'
	},
	message: {
		fontSize: '18px',
		color: '#aaa'
	},
	replayButton: {
		marginTop: '20px',
		padding: '14px 28px',
		fontSize: '18px',
		fontWeight: 'bold' as const,
		backgroundColor: '#2a2a2a',
		color: '#fff',
		border: '2px solid #444',
		borderRadius: '8px',
		cursor: 'pointer',
		touchAction: 'manipulation' as const,
		transition: 'background-color 0.2s'
	}
}
