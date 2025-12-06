/**
 * Cinema Pippin - Jumbotron Component (TV Display)
 * Displays video playback, voting screens, and results
 */

import { useEffect, useState, useRef } from 'react'
import type { JumbotronProps, Player, PauseState } from '@jkbox/shared'
import { VideoPlayer } from './VideoPlayer'
import type { Subtitle } from './VideoPlayer'
import { ResultsDisplay } from './ResultsDisplay'
import { FinalMontage } from './FinalMontage'
import { ScoreboardTransition } from './ScoreboardTransition'
import { AutoplayWarning } from './AutoplayWarning'
import { FilmCountdown } from './FilmCountdown'

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

interface PlayerStatus {
	hasSubmittedAnswer?: boolean
	hasVoted?: boolean
}

interface CinemaPippinGameState {
	phase: string
	currentClipIndex?: number
	currentFilmIndex?: number
	currentClip?: {
		clipNumber: 1 | 2 | 3
		videoUrl: string
		subtitles: Subtitle[]
	}
	allAnswers?: Answer[]
	sortedResults?: ResultEntry[]
	scores?: Record<string, number>
	scoresBeforeRound?: Map<string, number> | Record<string, number>
	voteCountsThisRound?: Map<string, number> | Record<string, number>
	playerStatus?: Record<string, PlayerStatus>
	filmTitle?: string
	montageClips?: Array<{
		clipNumber: 1 | 2 | 3
		videoUrl: string
		subtitles: Subtitle[]
	}>
}

// Helper component to display player status
function PlayerStatusList({
	playerStatus,
	scores,
	players,
	mode
}: {
	playerStatus?: Record<string, PlayerStatus>
	scores?: Record<string, number>
	players: Player[]
	mode: 'answering' | 'voting'
}) {
	if (!playerStatus || !scores) {
		return null
	}

	const playerIds = Object.keys(scores)

	// Create player ID to nickname mapping
	const playerNicknames = new Map<string, string>()
	for (const player of players) {
		playerNicknames.set(player.id, player.nickname)
	}

	return (
		<div style={statusStyles.container}>
			{playerIds.map((playerId) => {
				const status = playerStatus[playerId]
				const isComplete = mode === 'answering' ? status?.hasSubmittedAnswer : status?.hasVoted
				const playerName = playerNicknames.get(playerId) || playerId

				return (
					<div
						key={playerId}
						style={{
							...statusStyles.player,
							...(isComplete ? statusStyles.playerComplete : statusStyles.playerIncomplete)
						}}
					>
						<span style={statusStyles.playerName}>{playerName}</span>
						<span style={statusStyles.status}>
							{isComplete
								? mode === 'answering'
									? '✓ Answered'
									: '✓ Voted'
								: mode === 'answering'
									? 'Answering...'
									: 'Voting...'}
						</span>
					</div>
				)
			})}
		</div>
	)
}

const statusStyles = {
	container: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '10px',
		marginTop: '30px',
		maxWidth: '600px'
	},
	player: {
		display: 'flex',
		justifyContent: 'space-between',
		padding: '12px 20px',
		borderRadius: '8px',
		fontSize: '18px'
	},
	playerComplete: {
		backgroundColor: 'rgba(76, 175, 80, 0.2)',
		borderLeft: '4px solid #4CAF50'
	},
	playerIncomplete: {
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		borderLeft: '4px solid #666'
	},
	playerName: {
		fontWeight: 'bold' as const
	},
	status: {
		opacity: 0.8
	}
}

export function CinemaPippinJumbotron({
	state,
	players,
	sendToServer,
	pauseState,
	replayTrigger
}: JumbotronProps) {
	const gameState = state as CinemaPippinGameState
	const typedPauseState: PauseState | undefined = pauseState
	const isPaused: boolean = typedPauseState ? typedPauseState.isPaused : false

	// Replay overlay state
	const [showReplayOverlay, setShowReplayOverlay] = useState(false)
	const lastReplayTrigger = useRef(replayTrigger ?? 0)

	// Handle replay trigger changes
	useEffect(() => {
		// Check if replayTrigger has actually changed
		if (replayTrigger !== undefined && replayTrigger !== lastReplayTrigger.current) {
			lastReplayTrigger.current = replayTrigger

			// Only show replay during answer collection phases when we have a clip
			const canReplay =
				(gameState.phase === 'answer_collection' || gameState.phase === 'film_title_collection') &&
				gameState.currentClip

			if (canReplay) {
				console.log('[CinemaPippinJumbotron] Starting clip replay')
				setShowReplayOverlay(true)
			}
		}
	}, [replayTrigger, gameState.phase, gameState.currentClip])

	// Close replay overlay handler
	const handleReplayComplete = () => {
		console.log('[CinemaPippinJumbotron] Replay complete')
		setShowReplayOverlay(false)
	}

	// Auto-advance from film_select handled by FilmCountdown component
	// (5 second countdown, or longer if prep tasks take longer)

	// Auto-advance from clip_intro handled by FilmCountdown component
	// (5 second countdown, or longer if prep tasks take longer)

	// Results display auto-advance is handled by ResultsDisplay component's onComplete callback
	// (no timer needed here - variable duration based on number of answers/voters)

	// Film title results auto-advance is handled by ResultsDisplay component's onComplete callback
	// (no timer needed here - variable duration based on number of titles/voters)

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

	// Auto-return to lobby from end_game_vote after 5 seconds
	useEffect(() => {
		if (gameState.phase !== 'end_game_vote') {
			return
		}

		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'END_GAME_COMPLETE',
				payload: {}
			})
		}, 5000)

		return () => clearTimeout(timer)
	}, [gameState.phase, sendToServer])

	// Final montage auto-advance is handled by FinalMontage component's onComplete callback
	// (no timer needed here - plays all 3 clips sequentially)

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

	// Auto-advance from film_select immediately (no countdown here - clip_intro handles it)
	useEffect(() => {
		if (gameState.phase !== 'film_select') {
			return
		}

		// Immediate auto-advance - the actual countdown happens in clip_intro
		sendToServer({
			playerId: 'jumbotron',
			type: 'FILM_SELECT_COMPLETE',
			payload: {}
		})
	}, [gameState.phase, sendToServer])

	// Auto-advance from clip_intro for all clips EXCEPT the very first one (Film 1, Clip 1)
	// The first clip uses FilmCountdown component which handles its own timing
	useEffect(() => {
		if (gameState.phase !== 'clip_intro') {
			return
		}

		// Skip auto-advance for the very first clip (Film 1, Clip 1) - FilmCountdown handles it
		const isFirstClipOfGame = gameState.currentFilmIndex === 0 && gameState.currentClipIndex === 0
		if (isFirstClipOfGame) {
			return
		}

		// Show "Act X" slide for 1.5 seconds before advancing to clip playback
		const timer = setTimeout(() => {
			sendToServer({
				playerId: 'jumbotron',
				type: 'INTRO_COMPLETE',
				payload: {}
			})
		}, 1500)

		return () => clearTimeout(timer)
	}, [gameState.phase, gameState.currentFilmIndex, gameState.currentClipIndex, sendToServer])

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
				// film_select is just a transition state
				// Show loading briefly - useEffect below handles auto-advance
				return (
					<div
						style={{
							width: '100%',
							height: '100%',
							backgroundColor: '#000',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<div style={{ color: '#fff', fontSize: '24px', fontFamily: 'monospace' }}>
							Loading...
						</div>
					</div>
				)

			case 'clip_intro':
				// Old-timey countdown ONLY for the very first clip of the game (Film 1, Clip 1)
				// All subsequent clips show "Act X" slide then auto-advance
				if (gameState.currentFilmIndex === 0 && gameState.currentClipIndex === 0) {
					return (
						<FilmCountdown
							duration={5000}
							onComplete={() => {
								sendToServer({
									playerId: 'jumbotron',
									type: 'INTRO_COMPLETE',
									payload: {}
								})
							}}
						/>
					)
				}
				// For all other clips, show "Act X" slide then auto-advance
				// (the useEffect handles the auto-advance timing)
				return (
					<div
						style={{
							width: '100%',
							height: '100%',
							backgroundColor: '#000',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<div
							style={{
								color: '#fff',
								fontSize: '72px',
								fontFamily: 'Georgia, serif',
								fontStyle: 'italic',
								textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
							}}
						>
							Act {(gameState.currentClipIndex ?? 0) + 1}
						</div>
					</div>
				)

			case 'clip_playback':
				if (gameState.currentClip) {
					return (
						<div style={{ width: '100%', height: '90vh' }}>
							<VideoPlayer
								videoUrl={gameState.currentClip.videoUrl}
								subtitles={gameState.currentClip.subtitles}
								onComplete={handleVideoComplete}
								fadeInDuration={1000}
								fadeOutDuration={1000}
								preRollText={`Act ${gameState.currentClip.clipNumber}`}
								preRollDuration={2000}
								isPaused={isPaused}
							/>
						</div>
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
						<PlayerStatusList
							playerStatus={gameState.playerStatus}
							scores={gameState.scores}
							players={players}
							mode="answering"
						/>
					</div>
				)

			case 'voting_playback':
				if (gameState.currentClip) {
					// Add key based on currentAnswerIndex to force VideoPlayer remount
					// This ensures video plays from beginning for each answer
					const currentAnswerIndex =
						(state as { currentAnswerIndex?: number }).currentAnswerIndex ?? 0
					return (
						<div style={{ width: '100%', height: '90vh' }}>
							<VideoPlayer
								key={`voting-answer-${currentAnswerIndex}`}
								videoUrl={gameState.currentClip.videoUrl}
								subtitles={gameState.currentClip.subtitles}
								onComplete={handleVideoComplete}
								fadeInDuration={1000}
								fadeOutDuration={1000}
								isPaused={isPaused}
							/>
						</div>
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
						<PlayerStatusList
							playerStatus={gameState.playerStatus}
							scores={gameState.scores}
							players={players}
							mode="voting"
						/>
					</div>
				)

			case 'results_display':
				if (gameState.sortedResults && gameState.scores) {
					return (
						<ResultsDisplay
							sortedResults={gameState.sortedResults}
							scores={gameState.scores}
							players={players}
							onComplete={() => {
								sendToServer({
									playerId: 'jumbotron',
									type: 'RESULTS_COMPLETE',
									payload: {}
								})
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

			case 'scoreboard_transition':
				if (
					gameState.scoresBeforeRound &&
					gameState.voteCountsThisRound &&
					gameState.currentFilmIndex !== undefined
				) {
					// Convert scores to Map
					let scoresMap: Map<string, number>
					if (gameState.scoresBeforeRound instanceof Map) {
						scoresMap = gameState.scoresBeforeRound
					} else {
						scoresMap = new Map(Object.entries(gameState.scoresBeforeRound))
					}

					// Convert vote counts to Map
					let voteCountsMap: Map<string, number>
					if (gameState.voteCountsThisRound instanceof Map) {
						voteCountsMap = gameState.voteCountsThisRound
					} else {
						voteCountsMap = new Map(Object.entries(gameState.voteCountsThisRound))
					}

					const pointsPerVote = gameState.currentFilmIndex + 1

					return (
						<ScoreboardTransition
							players={players}
							currentScores={scoresMap}
							voteCounts={voteCountsMap}
							pointsPerVote={pointsPerVote}
							onComplete={() => {
								sendToServer({
									playerId: 'jumbotron',
									type: 'SCOREBOARD_COMPLETE',
									payload: {}
								})
							}}
						/>
					)
				}
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Scoreboard</h1>
						<p style={styles.subtitle}>Loading...</p>
					</div>
				)

			case 'film_title_collection':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Create a title for this movie!</h1>
						<p style={styles.subtitle}>Players are submitting film titles...</p>
					</div>
				)

			case 'film_title_voting':
				if (gameState.allAnswers && gameState.allAnswers.length > 0) {
					return (
						<div style={styles.container}>
							<h1 style={styles.title}>Vote for Best Title!</h1>
							<div style={styles.answersGrid}>
								{gameState.allAnswers.map((answer, index) => (
									<div key={answer.id} style={styles.answerCard}>
										<div style={styles.answerNumber}>{index + 1}</div>
										<div style={styles.answerText}>"{answer.text}"</div>
									</div>
								))}
							</div>
						</div>
					)
				}
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Vote for Best Title!</h1>
						<p style={styles.subtitle}>Loading titles...</p>
					</div>
				)

			case 'film_title_results':
				if (gameState.sortedResults && gameState.scores) {
					return (
						<ResultsDisplay
							sortedResults={gameState.sortedResults}
							scores={gameState.scores}
							players={players}
							onComplete={() => {
								sendToServer({
									playerId: 'jumbotron',
									type: 'FILM_TITLE_RESULTS_COMPLETE',
									payload: {}
								})
							}}
						/>
					)
				}
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Film Title Winner!</h1>
						<p style={styles.subtitle}>Calculating votes...</p>
					</div>
				)

			case 'final_montage':
				if (gameState.montageClips && gameState.filmTitle) {
					return (
						<FinalMontage
							filmTitle={gameState.filmTitle}
							clips={gameState.montageClips}
							onComplete={() => {
								sendToServer({
									playerId: 'jumbotron',
									type: 'MONTAGE_COMPLETE',
									payload: {}
								})
							}}
						/>
					)
				}
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Final Montage</h1>
						<p style={styles.subtitle}>Loading clips...</p>
					</div>
				)

			case 'next_film_or_end':
				return (
					<div style={styles.container}>
						<p style={styles.subtitle}>Loading next film...</p>
					</div>
				)

			case 'final_scores':
				if (gameState.scores) {
					// Convert scores Map/Object to sorted array
					const scoresEntries = gameState.scores as Record<string, number> | Map<string, number>
					const scoresArray =
						scoresEntries instanceof Map
							? Array.from(scoresEntries.entries())
							: Object.entries(scoresEntries)

					const sortedScores = scoresArray
						.map(([playerId, score]) => {
							const player = players.find((p) => p.id === playerId)
							return {
								playerId,
								nickname: player?.nickname || 'Unknown',
								score: score
							}
						})
						.sort((a, b) => b.score - a.score) // Sort descending

					return (
						<div style={styles.container}>
							<h1 style={styles.title}>🏆 Final Scores 🏆</h1>
							<div style={styles.scoresContainer}>
								{sortedScores.map((entry, index) => (
									<div
										key={entry.playerId}
										style={{
											...styles.scoreEntry,
											...(index === 0 ? styles.winnerEntry : {})
										}}
									>
										<span style={styles.rank}>{index === 0 ? '👑' : `${index + 1}.`}</span>
										<span style={styles.playerName}>{entry.nickname}</span>
										<span style={styles.scoreValue}>{entry.score} pts</span>
									</div>
								))}
							</div>
							<p style={styles.subtitle}>Thanks for playing!</p>
						</div>
					)
				}
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Final Scores</h1>
						<p style={styles.subtitle}>Calculating final scores...</p>
					</div>
				)

			case 'end_game_vote':
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Game Complete!</h1>
						<p style={styles.subtitle}>Returning to lobby...</p>
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

	return (
		<div style={styles.fullscreen}>
			<AutoplayWarning />
			{renderPhaseContent()}

			{/* Replay overlay - shows video when admin triggers replay during answer collection */}
			{showReplayOverlay && gameState.currentClip && (
				<div style={styles.replayOverlay}>
					<VideoPlayer
						key={`replay-${replayTrigger}`}
						videoUrl={gameState.currentClip.videoUrl}
						subtitles={gameState.currentClip.subtitles}
						onComplete={handleReplayComplete}
						fadeInDuration={500}
						fadeOutDuration={500}
						isPaused={isPaused}
					/>
				</div>
			)}
		</div>
	)
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
		color: '#fff',
		position: 'relative' as const
	},
	replayOverlay: {
		position: 'fixed' as const,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: '#000',
		zIndex: 1000,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center'
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
	},
	answersGrid: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
		gap: '20px',
		padding: '20px',
		maxWidth: '1200px',
		width: '100%'
	},
	answerCard: {
		backgroundColor: '#1a1a1a',
		border: '2px solid #333',
		borderRadius: '8px',
		padding: '20px',
		display: 'flex',
		alignItems: 'center',
		gap: '15px'
	},
	answerNumber: {
		fontSize: '32px',
		fontWeight: 'bold' as const,
		color: '#4CAF50',
		minWidth: '40px'
	},
	answerText: {
		fontSize: '20px',
		flex: 1,
		textAlign: 'left' as const
	},
	scoresContainer: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '20px',
		padding: '40px',
		maxWidth: '600px',
		margin: '0 auto'
	},
	scoreEntry: {
		display: 'flex',
		alignItems: 'center',
		gap: '20px',
		backgroundColor: '#1a1a1a',
		border: '2px solid #333',
		borderRadius: '12px',
		padding: '20px 30px',
		fontSize: '24px',
		transition: 'all 0.3s ease'
	},
	winnerEntry: {
		backgroundColor: '#2a2a1a',
		border: '3px solid #FFD700',
		boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
		fontSize: '28px'
	},
	rank: {
		fontSize: '32px',
		fontWeight: 'bold' as const,
		minWidth: '50px',
		textAlign: 'center' as const
	},
	playerName: {
		flex: 1,
		fontWeight: 'bold' as const,
		textAlign: 'left' as const
	},
	scoreValue: {
		fontSize: '28px',
		fontWeight: 'bold' as const,
		color: '#4CAF50',
		minWidth: '100px',
		textAlign: 'right' as const
	}
}
