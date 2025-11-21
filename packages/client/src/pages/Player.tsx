import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../lib/use-socket'
import { useGameStore } from '../store/game-store'
import { LobbyVoting } from '../components/LobbyVoting'
import { Pippin } from '../components/Pippin'
import { Countdown } from '../components/Countdown'
import { AdminToggleTab } from '../components/AdminToggleTab'
import { AdminTools } from '../components/AdminTools'
import { UnimplementedGameController } from '../games/UnimplementedGameController'
import { Scratchpad1Controller } from '../games/Scratchpad1Controller'
import type {
	LobbyCountdownMessage,
	RestoreSessionMessage,
	JoinSuccessMessage,
	GameId
} from '@jkbox/shared'

const GAME_NAMES: Record<string, string> = {
	cinephile: 'Cinema Pippin',
	'fake-facts': 'Fake Facts',
	'cinema-pippin': 'Cinema Pippin',
	scratchpad1: 'Scratchpad1',
	test: 'Test'
}

// Map game IDs to their Controller components
const GAME_CONTROLLERS: Record<GameId, React.ComponentType<any>> = {
	'fake-facts': UnimplementedGameController,
	cinephile: UnimplementedGameController,
	'cinema-pippin': UnimplementedGameController,
	scratchpad1: Scratchpad1Controller,
	test: Scratchpad1Controller
}

export function Player() {
	const { roomId } = useParams<{ roomId: string }>()
	const navigate = useNavigate()
	const { socket, isConnected } = useSocket()
	const { currentPlayer, room, setCurrentPlayer, setRoom } = useGameStore()
	const [countdown, setCountdown] = useState<{ count: number; game: string } | null>(null)
	const [showAdminTools, setShowAdminTools] = useState(false)
	const [restoring, setRestoring] = useState(true)
	const restorationAttempted = useRef(false)

	// Attempt session restoration on mount
	useEffect(() => {
		if (!socket || !roomId || restorationAttempted.current) {
			return undefined
		}

		// If we already have currentPlayer, no need to restore
		if (currentPlayer) {
			setRestoring(false)
			return undefined
		}

		// Try to restore from localStorage
		const storedPlayerId = localStorage.getItem('jkbox-player-id')
		const storedRoomId = localStorage.getItem('jkbox-room-id')
		const storedSessionToken = localStorage.getItem('jkbox-session-token')

		if (!storedPlayerId || storedRoomId !== roomId || !storedSessionToken) {
			// No stored session, redirect to join immediately
			console.log('[Player] No stored session, redirecting to join...')
			navigate(`/join/${roomId}`)
			return undefined
		}

		// Attempt restoration
		console.log('[Player] Attempting session restoration...')
		restorationAttempted.current = true

		const restoreMessage: RestoreSessionMessage = {
			type: 'restore-session',
			roomId,
			playerId: storedPlayerId,
			sessionToken: storedSessionToken
		}

		// Set timeout to redirect if restoration fails
		const redirectTimer = setTimeout(() => {
			console.log('[Player] Session restoration timed out, redirecting to join...')
			navigate(`/join/${roomId}`)
		}, 3000)

		// Listen for successful restoration
		const handleJoinSuccess = (message: JoinSuccessMessage) => {
			console.log('[Player] Session restored successfully!')
			clearTimeout(redirectTimer)
			setCurrentPlayer(message.player)
			setRoom(message.state)
			setRestoring(false)
		}

		// Listen for errors
		const handleError = () => {
			clearTimeout(redirectTimer)
			console.log('[Player] Session restoration failed, redirecting to join...')
			navigate(`/join/${roomId}`)
		}

		socket.once('join:success', handleJoinSuccess)
		socket.once('error', handleError)

		// Emit restore request
		socket.emit('restore-session', restoreMessage)

		// Clean up on unmount
		return () => {
			clearTimeout(redirectTimer)
			socket.off('join:success', handleJoinSuccess)
			socket.off('error', handleError)
		}
	}, [socket, roomId, currentPlayer, navigate, setCurrentPlayer, setRoom])

	// Listen for countdown messages
	useEffect(() => {
		if (!socket) return

		const handleCountdown = (message: LobbyCountdownMessage) => {
			const gameName = GAME_NAMES[message.selectedGame] || message.selectedGame
			setCountdown({ count: message.countdown, game: gameName })
		}

		socket.on('lobby:countdown', handleCountdown)

		return () => {
			socket.off('lobby:countdown', handleCountdown)
		}
	}, [socket])

	if (restoring) {
		return (
			<div style={styles.container}>
				<div style={styles.loading}>Restoring session...</div>
			</div>
		)
	}

	if (!currentPlayer) {
		return (
			<div style={styles.container}>
				<div style={styles.error}>Not joined to a room</div>
			</div>
		)
	}

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<div style={styles.nickname}>{currentPlayer.nickname}</div>
			</div>

			<div style={styles.content}>
				{room?.phase === 'lobby' && roomId && currentPlayer && (
					<LobbyVoting roomId={roomId} playerId={currentPlayer.id} />
				)}

				{room?.phase === 'playing' && (() => {
					const GameController = GAME_CONTROLLERS[room.gameId as GameId]
					if (!GameController) {
						return (
							<div style={styles.gameCard}>
								<div style={styles.gameText}>Unknown game: {room.gameId}</div>
							</div>
						)
					}
					return (
						<GameController
							gameState={room.gameState}
							playerId={currentPlayer.id}
							onAction={(action: any) => {
								if (socket) {
									socket.emit('game:action', action)
								}
							}}
						/>
					)
				})()}

				{room?.phase === 'results' && (
					<div style={styles.gameCard}>
						<div style={styles.gameText}>Game finished!</div>
					</div>
				)}

				<div style={styles.scoreCard}>
					<div style={styles.scoreLabel}>Your Score</div>
					<div style={styles.scoreValue}>{currentPlayer.score}</div>
				</div>
			</div>

			<div style={styles.footer}>
				<div style={styles.statusRow}>
					<span>Connection:</span>
					{isConnected ? (
						<span style={styles.statusConnected}>● Connected</span>
					) : (
						<span style={styles.statusDisconnected}>● Reconnecting...</span>
					)}
				</div>
			</div>

			{/* Pippin corner mascot (smaller for mobile) */}
			{!countdown && <Pippin variant="corner" />}

			{/* Countdown overlay */}
			{countdown && (
				<Countdown count={countdown.count} gameName={countdown.game} variant="player" />
			)}

			{/* Pause modal (for non-admin players) */}
			{room &&
				(room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'results') &&
				room.pauseState.isPaused &&
				!currentPlayer.isAdmin && (
				<div style={styles.pauseOverlay}>
					<div style={styles.pauseModal}>
						<div style={styles.pauseIcon}>⏸️</div>
						<div style={styles.pauseTitle}>GAME PAUSED</div>
						<div style={styles.pauseBy}>BY {room.pauseState.pausedByName}</div>
					</div>
				</div>
			)}

			{/* Admin UI (only for admin players) */}
			{currentPlayer.isAdmin && (
				<>
					<AdminToggleTab
						isOpen={showAdminTools}
						onClick={() => setShowAdminTools(!showAdminTools)}
					/>
					{showAdminTools && <AdminTools />}
				</>
			)}
		</div>
	)
}

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column' as const,
		minHeight: '100vh',
		padding: 'var(--space-xl)',
		fontFamily: 'var(--font-family)',
		backgroundColor: 'var(--color-bg-dark)',
		color: 'var(--color-text-primary)'
	},
	header: {
		textAlign: 'center' as const,
		marginBottom: 'var(--space-3xl)'
	},
	nickname: {
		fontSize: 'var(--font-size-4xl)',
		fontWeight: 'bold',
		marginBottom: 'var(--space-sm)'
	},
	roomCode: {
		fontSize: 'var(--font-size-sm)',
		color: 'var(--color-text-muted)'
	},
	content: {
		flex: 1,
		display: 'flex',
		flexDirection: 'column' as const,
		gap: 'var(--space-xl)',
		maxWidth: '500px',
		width: '100%',
		margin: '0 auto'
	},
	waitingCard: {
		padding: 'var(--space-3xl) var(--space-xl)',
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-xl)',
		textAlign: 'center' as const
	},
	waitingIcon: {
		fontSize: 'var(--font-size-jumbo-4xl)',
		marginBottom: 'var(--space-xl)'
	},
	waitingText: {
		fontSize: 'var(--font-size-2xl)',
		marginBottom: 'var(--space-md)',
		fontWeight: 'bold'
	},
	waitingSubtext: {
		fontSize: 'var(--font-size-base)',
		color: 'var(--color-text-secondary)'
	},
	gameCard: {
		padding: 'var(--space-3xl) var(--space-xl)',
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-xl)',
		textAlign: 'center' as const
	},
	gameText: {
		fontSize: 'var(--font-size-2xl)',
		fontWeight: 'bold'
	},
	scoreCard: {
		padding: 'var(--space-2xl)',
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-xl)',
		textAlign: 'center' as const
	},
	scoreLabel: {
		fontSize: 'var(--font-size-base)',
		color: 'var(--color-text-secondary)',
		marginBottom: 'var(--space-md)'
	},
	scoreValue: {
		fontSize: 'var(--font-size-5xl)',
		fontWeight: 'bold',
		color: 'var(--color-accent-blue)'
	},
	footer: {
		marginTop: 'var(--space-3xl)',
		paddingTop: 'var(--space-xl)',
		borderTop: '1px solid var(--color-bg-light)'
	},
	statusRow: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		fontSize: 'var(--font-size-sm)',
		color: 'var(--color-text-muted)'
	},
	statusConnected: {
		color: 'var(--color-status-connected)'
	},
	statusDisconnected: {
		color: 'var(--color-status-disconnected)'
	},
	pauseOverlay: {
		position: 'fixed' as const,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.95)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 9999,
		pointerEvents: 'auto' as const
	},
	pauseModal: {
		textAlign: 'center' as const,
		padding: '40px'
	},
	pauseIcon: {
		fontSize: '120px',
		marginBottom: '20px',
		animation: 'pulse 2s ease-in-out infinite'
	},
	pauseTitle: {
		fontSize: '48px',
		fontWeight: 'bold',
		color: '#ffffff',
		marginBottom: '16px',
		letterSpacing: '4px'
	},
	pauseBy: {
		fontSize: '24px',
		color: '#f59e0b',
		fontWeight: 'bold'
	},
	error: {
		padding: 'var(--space-xl)',
		backgroundColor: 'var(--color-error-bg)',
		color: 'var(--color-error-text)',
		borderRadius: 'var(--radius-md)',
		textAlign: 'center' as const,
		fontSize: 'var(--font-size-lg)'
	},
	loading: {
		padding: 'var(--space-xl)',
		backgroundColor: 'var(--color-bg-medium)',
		color: 'var(--color-text-secondary)',
		borderRadius: 'var(--radius-md)',
		textAlign: 'center' as const,
		fontSize: 'var(--font-size-lg)'
	}
}
