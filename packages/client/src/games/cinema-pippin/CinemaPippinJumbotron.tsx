/**
 * Cinema Pippin - Jumbotron Component (TV Display)
 * Displays video playback, voting screens, and results
 */

import { useEffect } from 'react'
import type { JumbotronProps } from '@jkbox/shared'
import { VideoPlayer } from './VideoPlayer'
import type { Subtitle } from './VideoPlayer'
import { ResultsDisplay } from './ResultsDisplay'

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

interface CinemaPippinGameState {
	phase: string
	currentClipIndex?: number
	currentClip?: {
		clipNumber: 1 | 2 | 3
		videoUrl: string
		subtitles: Subtitle[]
	}
	sortedResults?: ResultEntry[]
	scores?: Record<string, number>
}

export function CinemaPippinJumbotron({ state, sendToServer }: JumbotronProps) {
	const gameState = state as CinemaPippinGameState

	// Auto-advance from film_select to clip_intro after 2 seconds
	useEffect(() => {
		if (gameState.phase !== 'film_select') {
			return
		}

		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'FILM_SELECT_COMPLETE',
				payload: {}
			})
		}, 2000) // 2 second delay to show "Selecting films..."

		return () => clearTimeout(timer)
	}, [gameState.phase, sendToServer])

	// Auto-advance from clip_intro to clip_playback after 3 seconds
	useEffect(() => {
		if (gameState.phase !== 'clip_intro') {
			return
		}

		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'INTRO_COMPLETE',
				payload: {}
			})
		}, 3000) // 3 second intro delay

		return () => clearTimeout(timer)
	}, [gameState.phase, sendToServer])

	// Auto-advance from results_display after 5 seconds
	useEffect(() => {
		if (gameState.phase !== 'results_display') {
			return
		}

		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'RESULTS_COMPLETE',
				payload: {}
			})
		}, 5000)

		return () => clearTimeout(timer)
	}, [gameState.phase, sendToServer])

	// Auto-advance from film_title_results after 5 seconds
	useEffect(() => {
		if (gameState.phase !== 'film_title_results') {
			return
		}

		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'FILM_TITLE_RESULTS_COMPLETE',
				payload: {}
			})
		}, 5000)

		return () => clearTimeout(timer)
	}, [gameState.phase, sendToServer])

	// Auto-advance from final_scores after 5 seconds
	useEffect(() => {
		if (gameState.phase !== 'final_scores') {
			return
		}

		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'FINAL_SCORES_COMPLETE',
				payload: {}
			})
		}, 5000)

		return () => clearTimeout(timer)
	}, [gameState.phase, sendToServer])

	// Auto-advance from final_montage after 3 seconds
	useEffect(() => {
		if (gameState.phase !== 'final_montage') {
			return
		}

		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'MONTAGE_COMPLETE',
				payload: {}
			})
		}, 3000)

		return () => clearTimeout(timer)
	}, [gameState.phase, sendToServer])

	// Auto-advance from next_film_or_end after 2 seconds
	useEffect(() => {
		if (gameState.phase !== 'next_film_or_end') {
			return
		}

		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'NEXT_FILM_CHECK',
				payload: {}
			})
		}, 2000)

		return () => clearTimeout(timer)
	}, [gameState.phase, sendToServer])

	// Handle video completion
	const handleVideoComplete = () => {
		// Notify server that video has completed
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		sendToServer({
			playerId: 'jumbotron',
			type: 'VIDEO_COMPLETE',
			payload: {}
		})
	}

	// Render different views based on game phase
	const renderPhaseContent = () => {
		switch (gameState.phase) {
			case 'film_select':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Cinema Pippin</h1>
						<p style={styles.subtitle}>Selecting films...</p>
					</div>
				)

			case 'clip_intro':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Get Ready!</h1>
						<p style={styles.subtitle}>Next clip starting soon...</p>
					</div>
				)

			case 'clip_playback':
				if (gameState.currentClip) {
					return (
						<VideoPlayer
							videoUrl={gameState.currentClip.videoUrl}
							subtitles={gameState.currentClip.subtitles}
							onComplete={handleVideoComplete}
							fadeInDuration={1000}
							fadeOutDuration={1000}
							preRollText={`Act ${gameState.currentClip.clipNumber}`}
							preRollDuration={2000}
						/>
					)
				}
				return (
					<div style={styles.container}>
						<p style={styles.subtitle}>Loading video...</p>
					</div>
				)

			case 'answer_collection':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Submit Your Answer!</h1>
						<p style={styles.subtitle}>Players are writing their answers...</p>
					</div>
				)

			case 'voting_playback':
				if (gameState.currentClip) {
					// Add key based on currentAnswerIndex to force VideoPlayer remount
					// This ensures video plays from beginning for each answer
					const currentAnswerIndex =
						(state as { currentAnswerIndex?: number }).currentAnswerIndex ?? 0
					return (
						<VideoPlayer
							key={`voting-answer-${currentAnswerIndex}`}
							videoUrl={gameState.currentClip.videoUrl}
							subtitles={gameState.currentClip.subtitles}
							onComplete={handleVideoComplete}
							fadeInDuration={1000}
							fadeOutDuration={1000}
						/>
					)
				}
				return (
					<div style={styles.container}>
						<p style={styles.subtitle}>Loading voting video...</p>
					</div>
				)

			case 'voting_collection':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Vote for the Funniest!</h1>
						<p style={styles.subtitle}>Players are voting...</p>
					</div>
				)

			case 'results_display':
				if (gameState.sortedResults && gameState.scores) {
					return (
						<ResultsDisplay
							sortedResults={gameState.sortedResults}
							scores={gameState.scores}
							onComplete={() => {
								// Results animation complete, no action needed
								// Auto-advance will be handled by timer
							}}
						/>
					)
				}
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Results</h1>
						<p style={styles.subtitle}>Calculating scores...</p>
					</div>
				)

			case 'film_title_collection':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Name This Film!</h1>
						<p style={styles.subtitle}>Players are creating titles...</p>
					</div>
				)

			case 'film_title_voting':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Vote for Best Title!</h1>
						<p style={styles.subtitle}>Choose the funniest film title...</p>
					</div>
				)

			case 'film_title_results':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Film Title Winner!</h1>
						<p style={styles.subtitle}>Results coming up...</p>
					</div>
				)

			case 'final_montage':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Final Montage</h1>
						<p style={styles.subtitle}>Enjoy the highlights!</p>
					</div>
				)

			case 'next_film_or_end':
				return (
					<div style={styles.container}>
						<p style={styles.subtitle}>Loading next film...</p>
					</div>
				)

			case 'final_scores':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Final Scores</h1>
						<p style={styles.subtitle}>Game complete!</p>
					</div>
				)

			case 'end_game_vote':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Play Again?</h1>
						<p style={styles.subtitle}>Vote to return to lobby or play another round</p>
					</div>
				)

			default:
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Cinema Pippin</h1>
						<p style={styles.subtitle}>Unknown phase: {gameState.phase}</p>
					</div>
				)
		}
	}

	return <div style={styles.fullscreen}>{renderPhaseContent()}</div>
}

const styles = {
	fullscreen: {
		width: '100vw',
		height: '100vh',
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#000',
		color: '#fff'
	},
	container: {
		textAlign: 'center' as const,
		padding: '20px'
	},
	title: {
		fontSize: '48px',
		fontWeight: 'bold' as const,
		marginBottom: '20px'
	},
	subtitle: {
		fontSize: '24px',
		opacity: 0.8
	}
}
