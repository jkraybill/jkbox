import { useSocket } from '../lib/use-socket'
import { useGameStore } from '../store/game-store'
import type {
	AdminBootPlayerMessage,
	AdminBackToLobbyMessage,
	AdminHardResetMessage,
	AdminUpdateConfigMessage,
	AdminPauseMessage,
	AdminUnpauseMessage
} from '@jkbox/shared'

export function AdminTools() {
	const { socket } = useSocket()
	const { room } = useGameStore()

	if (!room) {
		return null
	}

	const aiGuesses = room.config?.aiGuesses ?? 1
	const cinemaPippinAIPlayers = room.config?.cinemaPippinAIPlayers ?? 1

	const handleBootPlayer = (playerId: string) => {
		if (!socket) return

		const message: AdminBootPlayerMessage = {
			type: 'admin:boot-player',
			playerId
		}

		socket.emit('admin:boot-player', message)
	}

	const handleBackToLobby = () => {
		if (!socket) return
		if (!confirm('Force room back to lobby? This will kill any in-progress game.')) return

		const message: AdminBackToLobbyMessage = {
			type: 'admin:back-to-lobby'
		}

		socket.emit('admin:back-to-lobby', message)
	}

	const handleHardReset = () => {
		if (!socket) return
		if (!confirm('Hard reset? This will clear ALL players and game state!')) return

		const message: AdminHardResetMessage = {
			type: 'admin:hard-reset'
		}

		socket.emit('admin:hard-reset', message)
	}

	const handleAiGuessesChange = (value: number) => {
		if (!socket) return

		const message: AdminUpdateConfigMessage = {
			type: 'admin:update-config',
			config: { aiGuesses: value }
		}

		socket.emit('admin:update-config', message)
	}

	const handleCinemaPippinAIPlayersChange = (value: number) => {
		if (!socket) return

		const message: AdminUpdateConfigMessage = {
			type: 'admin:update-config',
			config: { cinemaPippinAIPlayers: value }
		}

		socket.emit('admin:update-config', message)
	}

	const handlePauseToggle = () => {
		if (!socket) return

		// Only countdown, playing, and results phases have pauseState
		const isPaused =
			room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'results'
				? room.pauseState.isPaused
				: false

		if (isPaused) {
			const message: AdminUnpauseMessage = {
				type: 'admin:unpause'
			}
			socket.emit('admin:unpause', message)
		} else {
			const message: AdminPauseMessage = {
				type: 'admin:pause'
			}
			socket.emit('admin:pause', message)
		}
	}

	return (
		<div style={styles.overlay}>
			<div style={styles.panel}>
				<div style={styles.header}>
					<h2 style={styles.title}>Admin Tools</h2>
					<div style={styles.subtitle}>Room: {room.roomId}</div>
				</div>

				<div style={styles.configSection}>
					<div style={styles.configTitle}>Game Configuration</div>
					<div style={styles.configRow}>
						<label htmlFor="ai-guesses" style={styles.configLabel}>
							AI Guesses
						</label>
						<div style={styles.spinnerContainer}>
							<button
								onClick={() => handleAiGuessesChange(Math.max(0, aiGuesses - 1))}
								disabled={aiGuesses <= 0}
								style={{
									...styles.spinnerButton,
									...(aiGuesses <= 0 ? styles.spinnerButtonDisabled : {})
								}}
								aria-label="Decrease AI guesses"
							>
								−
							</button>
							<div style={styles.spinnerValue}>{aiGuesses}</div>
							<button
								onClick={() => handleAiGuessesChange(Math.min(5, aiGuesses + 1))}
								disabled={aiGuesses >= 5}
								style={{
									...styles.spinnerButton,
									...(aiGuesses >= 5 ? styles.spinnerButtonDisabled : {})
								}}
								aria-label="Increase AI guesses"
							>
								+
							</button>
						</div>
						<div style={styles.configHint}>Number of AI-generated fake answers (0-5)</div>
					</div>
					<div style={{ ...styles.configRow, marginTop: '16px' }}>
						<label htmlFor="cinema-pippin-ai-players" style={styles.configLabel}>
							Cinema Pippin AI Players
						</label>
						<div style={styles.spinnerContainer}>
							<button
								onClick={() =>
									handleCinemaPippinAIPlayersChange(Math.max(0, cinemaPippinAIPlayers - 1))
								}
								disabled={cinemaPippinAIPlayers <= 0}
								style={{
									...styles.spinnerButton,
									...(cinemaPippinAIPlayers <= 0 ? styles.spinnerButtonDisabled : {})
								}}
								aria-label="Decrease Cinema Pippin AI players"
							>
								−
							</button>
							<div style={styles.spinnerValue}>{cinemaPippinAIPlayers}</div>
							<button
								onClick={() =>
									handleCinemaPippinAIPlayersChange(Math.min(5, cinemaPippinAIPlayers + 1))
								}
								disabled={cinemaPippinAIPlayers >= 5}
								style={{
									...styles.spinnerButton,
									...(cinemaPippinAIPlayers >= 5 ? styles.spinnerButtonDisabled : {})
								}}
								aria-label="Increase Cinema Pippin AI players"
							>
								+
							</button>
						</div>
						<div style={styles.configHint}>
							Number of AI players for Cinema Pippin (0-5)
						</div>
					</div>
				</div>

				<div style={styles.adminActions}>
					<button
						onClick={handlePauseToggle}
						style={{
							...styles.actionButton,
							...((room.phase === 'countdown' ||
						room.phase === 'playing' ||
						room.phase === 'results') &&
						room.pauseState.isPaused &&
						styles.pauseButtonActive)
						}}
					>
						{(room.phase === 'countdown' ||
						room.phase === 'playing' ||
						room.phase === 'results') &&
					room.pauseState.isPaused
						? '▶️ Resume'
						: '⏸️ Pause'}
					</button>
					<button onClick={handleBackToLobby} style={styles.actionButton}>
						🔄 Back to Lobby
					</button>
					<button onClick={handleHardReset} style={styles.resetButton}>
						⚠️ Hard Reset
					</button>
				</div>

				<div style={styles.playerList}>
					<div style={styles.listHeader}>
						<span style={styles.headerName}>Player</span>
						<span style={styles.headerStatus}>Status</span>
						<span style={styles.headerAction}>Actions</span>
					</div>

					{room.players.map((player) => (
						<div key={player.id} style={styles.playerRow}>
							<div style={styles.playerInfo}>
								<span style={styles.playerName}>{player.nickname}</span>
								{player.isAdmin && <span style={styles.badge}>ADMIN</span>}
								{player.isHost && <span style={styles.badge}>HOST</span>}
							</div>

							<div style={styles.statusCell}>
								{player.isConnected ? (
									<span style={styles.statusConnected}>● Connected</span>
								) : (
									<span style={styles.statusDisconnected}>● Disconnected</span>
								)}
							</div>

							<div style={styles.actionCell}>
								<button
									onClick={() => handleBootPlayer(player.id)}
									style={styles.bootButton}
									aria-label={`Boot ${player.nickname}`}
								>
									🥾 Boot
								</button>
							</div>
						</div>
					))}

					{room.players.length === 0 && <div style={styles.emptyState}>No players in room</div>}
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
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
		zIndex: 999,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '20px'
	},
	panel: {
		backgroundColor: '#1a1a1a',
		borderRadius: '12px',
		maxWidth: '600px',
		width: '100%',
		maxHeight: '80vh',
		display: 'flex',
		flexDirection: 'column' as const,
		overflow: 'hidden',
		border: '2px solid #eab308'
	},
	header: {
		padding: '24px',
		borderBottom: '1px solid #3a3a3a'
	},
	title: {
		margin: 0,
		fontSize: '24px',
		fontWeight: 'bold',
		color: '#ffffff',
		marginBottom: '8px'
	},
	subtitle: {
		fontSize: '14px',
		color: '#aaaaaa'
	},
	configSection: {
		padding: '16px',
		borderBottom: '1px solid #3a3a3a'
	},
	configTitle: {
		fontSize: '14px',
		fontWeight: 'bold',
		color: '#aaaaaa',
		textTransform: 'uppercase' as const,
		marginBottom: '12px'
	},
	configRow: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '8px'
	},
	configLabel: {
		fontSize: '14px',
		fontWeight: 'bold',
		color: '#ffffff'
	},
	spinnerContainer: {
		display: 'flex',
		alignItems: 'center',
		gap: '12px'
	},
	spinnerButton: {
		width: '48px',
		height: '48px',
		padding: '0',
		fontSize: '24px',
		fontWeight: 'bold',
		backgroundColor: '#3b82f6',
		color: '#ffffff',
		border: 'none',
		borderRadius: '8px',
		cursor: 'pointer',
		transition: 'all 0.2s',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		touchAction: 'manipulation',
		userSelect: 'none' as const,
		WebkitTapHighlightColor: 'transparent'
	},
	spinnerButtonDisabled: {
		opacity: 0.3,
		cursor: 'not-allowed',
		backgroundColor: '#666666'
	},
	spinnerValue: {
		minWidth: '60px',
		padding: '12px 20px',
		fontSize: '20px',
		fontWeight: 'bold',
		backgroundColor: '#2a2a2a',
		color: '#ffffff',
		border: '2px solid #3a3a3a',
		borderRadius: '8px',
		textAlign: 'center' as const
	},
	configHint: {
		fontSize: '12px',
		color: '#888888',
		fontStyle: 'italic' as const
	},
	adminActions: {
		padding: '16px',
		display: 'flex',
		gap: '12px',
		borderBottom: '1px solid #3a3a3a'
	},
	actionButton: {
		flex: 1,
		padding: '12px 16px',
		backgroundColor: '#3b82f6',
		color: '#ffffff',
		border: 'none',
		borderRadius: '6px',
		cursor: 'pointer',
		fontSize: '14px',
		fontWeight: 'bold',
		transition: 'background-color 0.2s'
	},
	pauseButtonActive: {
		backgroundColor: '#f59e0b'
	},
	resetButton: {
		flex: 1,
		padding: '12px 16px',
		backgroundColor: '#ef4444',
		color: '#ffffff',
		border: 'none',
		borderRadius: '6px',
		cursor: 'pointer',
		fontSize: '14px',
		fontWeight: 'bold',
		transition: 'background-color 0.2s'
	},
	playerList: {
		flex: 1,
		overflowY: 'auto' as const,
		padding: '16px'
	},
	listHeader: {
		display: 'grid',
		gridTemplateColumns: '2fr 1fr 1fr',
		gap: '12px',
		padding: '12px 16px',
		borderBottom: '1px solid #3a3a3a',
		fontSize: '12px',
		fontWeight: 'bold',
		color: '#888888',
		textTransform: 'uppercase' as const
	},
	headerName: {
		textAlign: 'left' as const
	},
	headerStatus: {
		textAlign: 'center' as const
	},
	headerAction: {
		textAlign: 'right' as const
	},
	playerRow: {
		display: 'grid',
		gridTemplateColumns: '2fr 1fr 1fr',
		gap: '12px',
		padding: '16px',
		backgroundColor: '#2a2a2a',
		borderRadius: '8px',
		marginBottom: '8px',
		alignItems: 'center'
	},
	playerInfo: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '4px'
	},
	playerName: {
		fontSize: '16px',
		fontWeight: 'bold',
		color: '#ffffff'
	},
	badge: {
		display: 'inline-block',
		fontSize: '10px',
		padding: '2px 8px',
		backgroundColor: '#3b82f6',
		borderRadius: '4px',
		color: '#ffffff',
		fontWeight: 'bold',
		width: 'fit-content'
	},
	statusCell: {
		textAlign: 'center' as const,
		fontSize: '14px'
	},
	statusConnected: {
		color: '#22c55e'
	},
	statusDisconnected: {
		color: '#ef4444'
	},
	actionCell: {
		textAlign: 'right' as const
	},
	bootButton: {
		padding: '8px 16px',
		backgroundColor: '#dc2626',
		color: '#ffffff',
		border: 'none',
		borderRadius: '6px',
		cursor: 'pointer',
		fontSize: '14px',
		fontWeight: 'bold',
		transition: 'background-color 0.2s'
	},
	emptyState: {
		padding: '48px',
		textAlign: 'center' as const,
		fontSize: '16px',
		color: '#666666'
	}
}
