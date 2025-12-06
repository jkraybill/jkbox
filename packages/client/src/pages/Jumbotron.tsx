import { useEffect, useState, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useGameStore } from '../store/game-store'
import { useSocket } from '../lib/use-socket'
import { JumbotronVoting } from '../components/JumbotronVoting'
import { Pippin } from '../components/Pippin'
import { Countdown } from '../components/Countdown'
import { getJoinUrl } from '../lib/network-url'
import { UnimplementedGameJumbotron } from '../games/UnimplementedGameJumbotron'
import { Scratchpad1Jumbotron } from '../games/Scratchpad1Jumbotron'
import { CinemaPippinJumbotron } from '../games/cinema-pippin/CinemaPippinJumbotron'
import type { LobbyCountdownMessage, ClipReplayMessage, RoomState, GameId, JumbotronProps } from '@jkbox/shared'

const GAME_NAMES: Record<string, string> = {
	'fake-facts': 'Fake Facts',
	'cinema-pippin': 'Cinema Pippin',
	scratchpad1: 'Scratchpad1',
	test: 'Test'
}

// Map game IDs to their Jumbotron components
const GAME_COMPONENTS: Record<GameId, React.ComponentType<JumbotronProps>> = {
	'fake-facts': UnimplementedGameJumbotron,
	'cinema-pippin': CinemaPippinJumbotron,
	scratchpad1: Scratchpad1Jumbotron,
	test: Scratchpad1Jumbotron
}

export function Jumbotron() {
	const { room, setRoom } = useGameStore()
	const { socket, isConnected } = useSocket()
	const [countdown, setCountdown] = useState<{ count: number; game: string } | null>(null)
	const [isLoadingRoom, setIsLoadingRoom] = useState(true)
	const [resetFeedback, setResetFeedback] = useState(false)
	const [joinUrl, setJoinUrl] = useState<string>('')
	const [replayTrigger, setReplayTrigger] = useState(0) // Increments when admin requests clip replay
	const hasJoinedRoom = useRef<string | null>(null) // Track which room we've joined

	// Enter fullscreen mode and hide scrollbars on mount
	useEffect(() => {
		const enterFullscreen = async () => {
			try {
				if (document.documentElement.requestFullscreen) {
					await document.documentElement.requestFullscreen()
					console.log('[Jumbotron] Entered fullscreen mode')
				}
			} catch (error) {
				console.warn('[Jumbotron] Failed to enter fullscreen:', error)
			}
		}

		// Hide scrollbars globally + add fade animation
		const style = document.createElement('style')
		style.id = 'jumbotron-no-scroll'
		style.textContent = `
      html, body, #root {
        overflow: hidden !important;
        height: 100vh !important;
        width: 100vw !important;
        background-color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      * {
        scrollbar-width: none !important; /* Firefox */
        -ms-overflow-style: none !important; /* IE and Edge */
        box-sizing: border-box !important;
      }
      *::-webkit-scrollbar {
        display: none !important; /* Chrome, Safari, Opera */
      }
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(-10px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `
		document.head.appendChild(style)

		void enterFullscreen()

		return () => {
			// Cleanup: remove style and exit fullscreen
			const styleEl = document.getElementById('jumbotron-no-scroll')
			if (styleEl) {
				styleEl.remove()
			}
			if (document.fullscreenElement) {
				document.exitFullscreen().catch(() => {})
			}
		}
	}, [])

	// Keyboard shortcut for hard reset (Ctrl-K)
	useEffect(() => {
		const handleKeyPress = async (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === 'k') {
				e.preventDefault()
				console.log('[Jumbotron] Ctrl-K pressed - hard resetting server...')

				try {
					const response = await fetch('http://localhost:3001/api/room/hard-reset', {
						method: 'POST'
					})

					if (response.ok) {
						const { room: resetRoom } = (await response.json()) as { room: RoomState }
						console.log('[Jumbotron] Hard reset successful:', resetRoom)
						setRoom(resetRoom)

						// Show visual feedback
						setResetFeedback(true)
						setTimeout(() => setResetFeedback(false), 2000)
					} else {
						console.error('[Jumbotron] Hard reset failed:', response.status)
					}
				} catch (error) {
					console.error('[Jumbotron] Hard reset error:', error)
				}
			}
		}

		const handleKeyDownSync = (e: KeyboardEvent) => {
			void handleKeyPress(e)
		}
		window.addEventListener('keydown', handleKeyDownSync)
		return () => window.removeEventListener('keydown', handleKeyDownSync)
	}, [setRoom])

	// Fetch singleton room on mount
	useEffect(() => {
		const fetchRoom = async () => {
			try {
				console.log('[Jumbotron] Fetching singleton room...')
				const response = await fetch('http://localhost:3001/api/room')

				if (!response.ok) {
					throw new Error('Failed to fetch room')
				}

				const { room: fetchedRoom } = (await response.json()) as { room: RoomState }
				console.log('[Jumbotron] Fetched room:', fetchedRoom)
				setRoom(fetchedRoom)
			} catch (error) {
				console.error('[Jumbotron] Failed to fetch room:', error)
			} finally {
				setIsLoadingRoom(false)
			}
		}

		void fetchRoom()
	}, [setRoom])

	// Fetch join URL when room is available
	useEffect(() => {
		if (room) {
			void getJoinUrl(room.roomId).then(setJoinUrl)
		}
	}, [room])

	// Join room via WebSocket when connected (only once per room)
	useEffect(() => {
		if (!socket || !room || !isConnected) {
			return
		}

		// Only join if we haven't already joined this room
		if (hasJoinedRoom.current === room.roomId) {
			return
		}

		console.log('[Jumbotron] Joining room via WebSocket:', room.roomId)
		hasJoinedRoom.current = room.roomId

		// Join the room to receive broadcasts
		socket.emit('watch', {
			type: 'watch',
			roomId: room.roomId
		})

		// Listen for countdown messages
		socket.on('lobby:countdown', (message: LobbyCountdownMessage) => {
			const gameName = GAME_NAMES[message.selectedGame] || message.selectedGame
			setCountdown({ count: message.countdown, game: gameName })
		})

		// Listen for clip replay requests from admin
		socket.on('clip:replay', (_message: ClipReplayMessage) => {
			console.log('[Jumbotron] Received clip:replay request')
			setReplayTrigger((prev) => prev + 1)
		})

		return () => {
			socket.off('lobby:countdown')
			socket.off('clip:replay')
		}
	}, [socket, room, isConnected])

	// Clear countdown when room transitions to playing phase
	useEffect(() => {
		if (room?.phase === 'playing' && countdown) {
			console.log('[Jumbotron] Clearing countdown overlay (game started)')
			setCountdown(null)
		}
	}, [room?.phase, countdown])

	// Handle Pippin intro completion (transition title → lobby)
	// Wrapped in useCallback to prevent infinite re-render loop
	const handleIntroComplete = useCallback(async () => {
		console.log('[Jumbotron] Pippin intro complete, transitioning to lobby...')
		console.log('[Jumbotron] Current room phase:', room?.phase)

		try {
			console.log('[Jumbotron] Calling POST /api/room/transition-to-lobby...')
			const response = await fetch('http://localhost:3001/api/room/transition-to-lobby', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			console.log('[Jumbotron] Response status:', response.status)

			if (!response.ok) {
				const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
					error: string
				}
				console.error('[Jumbotron] Transition failed:', errorData)
				throw new Error(`Failed to transition to lobby: ${errorData.error || response.statusText}`)
			}

			const { room: lobbyRoom } = (await response.json()) as { room: RoomState }
			console.log('[Jumbotron] Successfully transitioned to lobby:', lobbyRoom)
			setRoom(lobbyRoom)
		} catch (error) {
			console.error('[Jumbotron] Failed to transition to lobby:', error)
			// Fallback: try fetching the room again
			console.log('[Jumbotron] Attempting to refetch room as fallback...')
			try {
				const response = await fetch('http://localhost:3001/api/room')
				const { room: fetchedRoom } = (await response.json()) as { room: RoomState }
				console.log('[Jumbotron] Fallback room fetch:', fetchedRoom)
				setRoom(fetchedRoom)
			} catch (fallbackError) {
				console.error('[Jumbotron] Fallback fetch also failed:', fallbackError)
			}
		}
	}, [room?.phase, setRoom]) // Dependencies: only room.phase and setRoom

	if (isLoadingRoom) {
		return (
			<div style={styles.container}>
				<div style={styles.loading}>Initializing Pippin's Playhouse...</div>
			</div>
		)
	}

	if (!room) {
		return (
			<div style={styles.container}>
				<div style={styles.error}>Failed to load room. Please refresh.</div>
			</div>
		)
	}

	// Title screen - show Pippin intro animation
	if (room.phase === 'title') {
		return (
			<div style={styles.container}>
				<Pippin variant="intro" onIntroComplete={() => void handleIntroComplete()} />
			</div>
		)
	}

	// Lobby and beyond - show room state
	return (
		<div
			style={{
				...styles.container,
				padding: room.phase === 'playing' ? 0 : '2vh 2vw'
			}}
		>
			{/* Visual feedback for hard reset (Ctrl-K) */}
			{resetFeedback && <div style={styles.resetFeedback}>🔄 Server Reset!</div>}

			{/* Only show header when NOT in voting mode (voting has its own header) */}
			{!(room.phase === 'lobby' && room.players.length > 0) &&
				room.phase !== 'countdown' &&
				room.phase !== 'playing' && (
					<div style={styles.header}>
						<h1 style={styles.title}>Pippin's Playhouse</h1>
					</div>
				)}

			{/* Phase-based rendering */}
			{room.phase === 'lobby' && room.players.length === 0 ? (
				// Lobby: Show QR code when no players
				<div style={styles.content}>
					<div style={styles.qrSection}>
						<h2 style={styles.sectionTitle}>Scan to Join</h2>
						<div style={styles.qrCode}>
							<QRCodeSVG
								value={joinUrl}
								size={Math.min(window.innerHeight * 0.25, window.innerWidth * 0.15)}
								level="M"
							/>
						</div>
						<div style={styles.joinUrl}>{joinUrl}</div>
					</div>

					<div style={styles.playerSection}>
						<h2 style={styles.sectionTitle}>Players ({room.players.length}/12)</h2>
						<div style={styles.emptyState}>Waiting for players to join...</div>
					</div>
				</div>
			) : room.phase === 'lobby' ? (
				// Lobby: Show voting UI when players have joined
				<JumbotronVoting players={room.players} roomId={room.roomId} />
			) : room.phase === 'countdown' ? (
				// Countdown: Full-screen countdown display
				<div style={styles.countdownPhaseContainer}>
					<div style={styles.countdownNumber}>{room.secondsRemaining}</div>
					<div style={styles.countdownGame}>
						{GAME_NAMES[room.selectedGame] || room.selectedGame}
					</div>
				</div>
			) : room.phase === 'playing' ? (
				// Playing: Render game module's Jumbotron component
				<>
					{(() => {
						const GameComponent = GAME_COMPONENTS[room.gameId as GameId]
						if (!GameComponent) {
							return <div style={styles.error}>Unknown game: {room.gameId}</div>
						}
						if (!socket) {
							return <div style={styles.error}>Connecting...</div>
						}
						return (
							<GameComponent
								state={room.gameState}
								players={room.players}
								sendToServer={(action) => socket.emit('game:action', action)}
								pauseState={room.pauseState}
								replayTrigger={replayTrigger}
							/>
						)
					})()}
				</>
			) : room.phase === 'results' ? (
				// Results: Show winners and scores
				<div style={styles.content}>
					<div style={styles.resultsContainer}>
						<h2 style={styles.resultsTitle}>Game Over!</h2>
						<div style={styles.winnersSection}>
							<h3 style={styles.sectionTitle}>Winners</h3>
							{room.winners.map((winnerId) => {
								const winner = room.players.find((p) => p.id === winnerId)
								return (
									<div key={winnerId} style={styles.winnerName}>
										{winner?.nickname || 'Unknown'}
									</div>
								)
							})}
						</div>
						<div style={styles.scoresSection}>
							<h3 style={styles.sectionTitle}>Final Scores</h3>
							{Object.entries(room.scores)
								.sort(([, a], [, b]) => b - a)
								.map(([playerId, score]) => {
									const player = room.players.find((p) => p.id === playerId)
									return (
										<div key={playerId} style={styles.scoreRow}>
											<span>{player?.nickname || 'Unknown'}</span>
											<span style={styles.scoreValue}>{score}</span>
										</div>
									)
								})}
						</div>
					</div>
				</div>
			) : null}

			{/* Pippin corner mascot (persistent, animated) - hide during countdown phase */}
			{!countdown && room.phase !== 'countdown' && <Pippin variant="corner" />}

			{/* Countdown overlay (from lobby:countdown message, different from countdown phase) */}
			{countdown && (
				<Countdown count={countdown.count} gameName={countdown.game} variant="jumbotron" />
			)}

			{/* Pause modal */}
			{room.pauseState?.isPaused && (
				<div style={styles.pauseOverlay}>
					<div style={styles.pauseModal}>
						<div style={styles.pauseIcon}>⏸️</div>
						<div style={styles.pauseTitle}>GAME PAUSED</div>
						<div style={styles.pauseBy}>BY {room.pauseState.pausedByName}</div>
					</div>
				</div>
			)}
		</div>
	)
}

const styles = {
	container: {
		width: '100vw',
		height: '100vh',
		fontFamily: 'var(--font-family)',
		backgroundColor: 'var(--color-bg-dark)',
		color: 'var(--color-text-primary)',
		overflow: 'hidden',
		position: 'relative' as const,
		display: 'flex',
		flexDirection: 'column' as const,
		boxSizing: 'border-box' as const
	},
	loading: {
		fontSize: '3vh',
		textAlign: 'center' as const,
		marginTop: '10vh',
		flex: 1,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center'
	},
	error: {
		fontSize: '3vh',
		textAlign: 'center' as const,
		marginTop: '10vh',
		color: 'var(--color-error-text)',
		flex: 1,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center'
	},
	header: {
		textAlign: 'center' as const,
		marginBottom: '2vh',
		flexShrink: 0
	},
	title: {
		fontSize: '6vh',
		margin: '0 0 1vh 0'
	},
	content: {
		display: 'grid',
		gridTemplateColumns: '1fr 1fr',
		gap: '3vw',
		flex: 1,
		maxHeight: '100%',
		overflow: 'hidden'
	},
	qrSection: {
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		padding: '3vh 2vw',
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-xl)',
		overflow: 'hidden'
	},
	sectionTitle: {
		fontSize: '4vh',
		marginBottom: '2vh'
	},
	qrCode: {
		padding: '2vh',
		backgroundColor: '#ffffff',
		borderRadius: 'var(--radius-lg)',
		marginBottom: '2vh',
		maxWidth: '30vh',
		maxHeight: '30vh'
	},
	joinUrl: {
		fontSize: '1.5vh',
		color: 'var(--color-text-muted)',
		wordBreak: 'break-all' as const,
		textAlign: 'center' as const,
		maxWidth: '100%'
	},
	playerSection: {
		padding: '3vh 2vw',
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-xl)',
		overflow: 'hidden'
	},
	emptyState: {
		textAlign: 'center' as const,
		padding: '5vh 2vw',
		color: 'var(--color-text-disabled)',
		fontSize: '2.5vh'
	},
	phaseDisplay: {
		fontSize: '4vh',
		textAlign: 'center' as const,
		padding: '5vh 2vw'
	},
	countdownPhaseContainer: {
		flex: 1,
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		gap: '4vh'
	},
	countdownNumber: {
		fontSize: '30vh',
		fontWeight: 'bold' as const,
		color: 'var(--color-primary)',
		textAlign: 'center' as const
	},
	countdownGame: {
		fontSize: '6vh',
		textAlign: 'center' as const,
		color: 'var(--color-text-secondary)'
	},
	resultsContainer: {
		gridColumn: '1 / -1',
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		gap: '4vh',
		padding: '3vh 2vw'
	},
	resultsTitle: {
		fontSize: '8vh',
		marginBottom: '2vh',
		textAlign: 'center' as const
	},
	winnersSection: {
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-xl)',
		padding: '3vh 4vw',
		minWidth: '40vw',
		textAlign: 'center' as const
	},
	winnerName: {
		fontSize: '5vh',
		fontWeight: 'bold' as const,
		color: 'var(--color-primary)',
		marginTop: '2vh'
	},
	scoresSection: {
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-xl)',
		padding: '3vh 4vw',
		minWidth: '40vw'
	},
	scoreRow: {
		display: 'flex',
		justifyContent: 'space-between',
		fontSize: '3vh',
		padding: '1.5vh 0',
		borderBottom: '1px solid var(--color-border)'
	},
	scoreValue: {
		fontWeight: 'bold' as const,
		color: 'var(--color-primary)'
	},
	resetFeedback: {
		position: 'fixed' as const,
		top: '3vh',
		right: '3vw',
		padding: '2vh 3vw',
		backgroundColor: 'var(--color-primary-yellow)',
		color: 'var(--color-bg-dark)',
		fontSize: '3vh',
		fontWeight: 'bold' as const,
		borderRadius: 'var(--radius-lg)',
		boxShadow: 'var(--shadow-glow-yellow)',
		zIndex: 9999,
		animation: 'fadeInOut 2s ease-in-out'
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
		zIndex: 10000,
		pointerEvents: 'auto' as const
	},
	pauseModal: {
		textAlign: 'center' as const,
		padding: '8vh'
	},
	pauseIcon: {
		fontSize: '30vh',
		marginBottom: '4vh',
		animation: 'pulse 2s ease-in-out infinite'
	},
	pauseTitle: {
		fontSize: '12vh',
		fontWeight: 'bold',
		color: '#ffffff',
		marginBottom: '4vh',
		letterSpacing: '1vw'
	},
	pauseBy: {
		fontSize: '6vh',
		color: '#f59e0b',
		fontWeight: 'bold'
	}
}
