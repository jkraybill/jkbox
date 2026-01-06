/**
 * Quit Confirmation Modal
 * Shown when player taps the quit button during gameplay
 */

interface QuitConfirmModalProps {
	onConfirm: () => void
	onCancel: () => void
}

export function QuitConfirmModal({ onConfirm, onCancel }: QuitConfirmModalProps) {
	return (
		<div style={styles.overlay}>
			<div style={styles.modal}>
				<div style={styles.icon}>🚪</div>
				<h2 style={styles.title}>Quit Game?</h2>
				<p style={styles.message}>You won't be able to rejoin this round.</p>
				<div style={styles.buttons}>
					<button onClick={onCancel} style={styles.cancelButton}>
						Cancel
					</button>
					<button onClick={onConfirm} style={styles.quitButton}>
						Yes, Quit
					</button>
				</div>
			</div>
		</div>
	)
}

const styles = {
	overlay: {
		position: 'fixed' as const,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.85)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1000,
		padding: '20px'
	},
	modal: {
		backgroundColor: '#1a1a1a',
		borderRadius: '16px',
		padding: '32px 24px',
		maxWidth: '320px',
		width: '100%',
		textAlign: 'center' as const,
		border: '1px solid #333'
	},
	icon: {
		fontSize: '48px',
		marginBottom: '16px'
	},
	title: {
		fontSize: '24px',
		fontWeight: 'bold' as const,
		color: '#fff',
		marginBottom: '12px'
	},
	message: {
		fontSize: '16px',
		color: '#aaa',
		marginBottom: '28px',
		lineHeight: 1.5
	},
	buttons: {
		display: 'flex',
		gap: '12px',
		justifyContent: 'center'
	},
	cancelButton: {
		flex: 1,
		padding: '14px 20px',
		fontSize: '16px',
		fontWeight: 'bold' as const,
		backgroundColor: '#333',
		color: '#fff',
		border: 'none',
		borderRadius: '8px',
		cursor: 'pointer',
		touchAction: 'manipulation' as const
	},
	quitButton: {
		flex: 1,
		padding: '14px 20px',
		fontSize: '16px',
		fontWeight: 'bold' as const,
		backgroundColor: '#c53030',
		color: '#fff',
		border: 'none',
		borderRadius: '8px',
		cursor: 'pointer',
		touchAction: 'manipulation' as const
	}
}
