/**
 * Cinema Pippin - Jumbotron Component (TV Display)
 * Displays video playback, voting screens, and results
 */

import React, { useEffect, useState } from 'react'
import type { JumbotronProps, GameState } from '@jkbox/shared'
import { VideoPlayer } from './VideoPlayer'
import type { Subtitle } from './VideoPlayer'

interface CinemaPippinGameState extends GameState {
	phase: string
	currentClipIndex?: number
}

export function CinemaPippinJumbotron({ state, sendToServer }: JumbotronProps) {
	const gameState = state as CinemaPippinGameState
	const [isPlayingVideo, setIsPlayingVideo] = useState(false)
	const [videoUrl, setVideoUrl] = useState<string>('')
	const [subtitles, setSubtitles] = useState<Subtitle[]>([])

	// Handle video completion
	const handleVideoComplete = () => {
		setIsPlayingVideo(false)
		// Notify server that video has completed
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		sendToServer({
			type: 'VIDEO_COMPLETE',
			payload: {}
		})
	}

	// Load video and subtitles when phase changes to clip_playback
	useEffect(() => {
		if (gameState.phase === 'clip_playback') {
			// For now, use placeholder data
			// In full implementation, this will come from server state
			setVideoUrl('/placeholder-video.mp4')
			setSubtitles([])
			setIsPlayingVideo(true)
		}
	}, [gameState.phase])

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
				if (isPlayingVideo && videoUrl) {
					return (
						<VideoPlayer
							videoUrl={videoUrl}
							subtitles={subtitles}
							onComplete={handleVideoComplete}
							fadeInDuration={1000}
							fadeOutDuration={1000}
							preRollText={`Act ${(gameState.currentClipIndex ?? 0) + 1}`}
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
				if (isPlayingVideo && videoUrl) {
					return (
						<VideoPlayer
							videoUrl={videoUrl}
							subtitles={subtitles}
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
				return (
					<div style={styles.container}>
						<h1 style={styles.title}>Results</h1>
						<p style={styles.subtitle}>And the winner is...</p>
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
