/**
 * UnimplementedGameController - Placeholder controller for players
 * Shows a simple waiting message since there's nothing to interact with
 */

import type { ControllerProps } from '@jkbox/shared'

export function UnimplementedGameController(_props: ControllerProps) {
	return (
		<div style={styles.container}>
			<div style={styles.iconContainer}>
				<span style={styles.icon}>🚧</span>
			</div>

			<h1 style={styles.title}>Coming Soon!</h1>

			<p style={styles.message}>
				This game hasn't been built yet.
				<br />
				Check the big screen for more info.
			</p>

			<div style={styles.footer}>
				<p style={styles.hint}>Returning to lobby soon...</p>
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
		backgroundColor: '#1a1a1a',
		color: '#ffffff',
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		padding: '40px',
		textAlign: 'center' as const
	},
	iconContainer: {
		marginBottom: '40px'
	},
	icon: {
		fontSize: '120px'
	},
	title: {
		fontSize: '48px',
		fontWeight: 'bold',
		marginBottom: '20px',
		color: '#f59e0b'
	},
	message: {
		fontSize: '24px',
		color: '#aaaaaa',
		lineHeight: 1.8,
		marginBottom: '60px'
	},
	footer: {
		marginTop: 'auto'
	},
	hint: {
		fontSize: '16px',
		color: '#666666',
		fontStyle: 'italic'
	}
}
