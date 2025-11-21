/**
 * Scratchpad1 Controller - Player phone view
 *
 * For this validation game, players just watch the jumbotron
 * No interactive controls needed
 */

import type { ControllerProps } from '@jkbox/shared'

interface Scratchpad1State {
	phase: 'pre-transition' | 'first-play' | 'mid-transition' | 'second-play' | 'post-transition'
	videoUrl: string
	subtitle1Url: string
	subtitle2Url: string
	phaseStartedAt: number
	transitionDuration: number
}

export function Scratchpad1Controller({ gameState }: ControllerProps) {
	const state = gameState as Scratchpad1State

	const getPhaseMessage = () => {
		switch (state.phase) {
			case 'pre-transition':
				return '🎬 Video starting soon...'
			case 'first-play':
				return '📺 Watch the jumbotron!'
			case 'mid-transition':
				return '🔄 Watch again with different subtitles...'
			case 'second-play':
				return '📺 Watch the jumbotron!'
			case 'post-transition':
				return '✅ Complete!'
			default:
				return '👀 Watch the jumbotron'
		}
	}

	return (
		<div style={styles.container}>
			<div style={styles.content}>
				<div style={styles.icon}>👀</div>
				<div style={styles.message}>{getPhaseMessage()}</div>
				<div style={styles.hint}>This is a video playback test</div>
			</div>
		</div>
	)
}

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: '100vh',
		padding: 'var(--space-xl)',
		fontFamily: 'var(--font-family)',
		backgroundColor: 'var(--color-bg-dark)',
		color: 'var(--color-text-primary)',
		textAlign: 'center' as const
	},
	content: {
		maxWidth: '400px'
	},
	icon: {
		fontSize: '120px',
		marginBottom: 'var(--space-xl)'
	},
	message: {
		fontSize: 'var(--font-size-3xl)',
		fontWeight: 'bold',
		marginBottom: 'var(--space-lg)'
	},
	hint: {
		fontSize: 'var(--font-size-base)',
		color: 'var(--color-text-secondary)'
	}
}
