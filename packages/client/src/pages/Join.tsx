import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../lib/use-socket'
import { useGameStore } from '../store/game-store'
import { getSavedNickname, saveNickname } from '../utils/cookies'
import { getDeviceId } from '../lib/device-id'
import type { JoinSuccessMessage, ErrorMessage } from '@jkbox/shared'

export function Join() {
	const { roomId } = useParams<{ roomId: string }>()
	const navigate = useNavigate()
	const { socket, isConnected } = useSocket()
	const { setCurrentPlayer, setSessionToken, setRoom } = useGameStore()

	const [nickname, setNickname] = useState('')
	const [isJoining, setIsJoining] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Load saved nickname from cookie on mount
	useEffect(() => {
		const savedNickname = getSavedNickname()
		if (savedNickname) {
			setNickname(savedNickname)
		}
	}, [])

	useEffect(() => {
		if (!socket) return

		// Listen for join success
		const handleJoinSuccess = (message: JoinSuccessMessage) => {
			// Store player data and session token
			setCurrentPlayer(message.player)
			setSessionToken(message.player.sessionToken)
			setRoom(message.state)

			// Navigate to player view
			navigate(`/play/${roomId}`)
		}

		// Listen for errors
		const handleError = (message: ErrorMessage) => {
			setError(message.message)
			setIsJoining(false)
		}

		socket.on('join:success', handleJoinSuccess)
		socket.on('error', handleError)

		return () => {
			socket.off('join:success', handleJoinSuccess)
			socket.off('error', handleError)
		}
	}, [socket, roomId, navigate, setCurrentPlayer, setSessionToken, setRoom])

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()

		if (!socket || !roomId || !nickname.trim()) {
			return
		}

		setIsJoining(true)
		setError(null)

		// Save nickname to cookie BEFORE sending to server
		// This preserves the trailing ~ for admin users, since the server strips it
		saveNickname(nickname.trim())

		// Send join message with persistent device ID
		const deviceId = getDeviceId()

		socket.emit('join', {
			type: 'join',
			roomId,
			nickname: nickname.trim(),
			deviceId
		})
	}

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h1 style={styles.title}>Join Party</h1>
				{roomId && (
					<div style={styles.roomCode}>
						Room: <span style={styles.roomCodeValue}>{roomId}</span>
					</div>
				)}
			</div>

			<form onSubmit={handleSubmit} style={styles.form}>
				<div style={styles.inputGroup}>
					<label htmlFor="nickname" style={styles.label}>
						Choose your nickname
					</label>
					<input
						id="nickname"
						type="text"
						value={nickname}
						onChange={(e) => setNickname(e.target.value)}
						placeholder="Enter nickname..."
						maxLength={20}
						autoFocus
						disabled={isJoining}
						style={styles.input}
					/>
				</div>

				<button
					type="submit"
					disabled={!isConnected || isJoining || !nickname.trim()}
					style={{
						...styles.button,
						...((!isConnected || isJoining || !nickname.trim()) && styles.buttonDisabled)
					}}
				>
					{isJoining ? 'Joining...' : 'Join Party'}
				</button>

				{error && <div style={styles.error}>{error}</div>}

				{!isConnected && <div style={styles.connectionWarning}>Connecting to server...</div>}
			</form>

			<div style={styles.footer}>
				<p>Make sure you're on the same network as the TV</p>
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
		padding: '20px',
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		backgroundColor: '#1a1a1a',
		color: '#ffffff'
	},
	header: {
		textAlign: 'center' as const,
		marginBottom: '40px'
	},
	title: {
		fontSize: '48px',
		margin: '0 0 20px 0',
		fontWeight: 'bold'
	},
	roomCode: {
		fontSize: '18px',
		color: '#aaaaaa'
	},
	roomCodeValue: {
		color: '#3b82f6',
		fontWeight: 'bold',
		fontSize: '24px'
	},
	form: {
		width: '100%',
		maxWidth: '400px',
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '20px'
	},
	inputGroup: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '8px'
	},
	label: {
		fontSize: '16px',
		color: '#aaaaaa'
	},
	input: {
		fontSize: '20px',
		padding: '16px',
		backgroundColor: '#2a2a2a',
		color: '#ffffff',
		border: '2px solid #3a3a3a',
		borderRadius: '8px',
		outline: 'none'
	},
	button: {
		fontSize: '24px',
		padding: '20px',
		backgroundColor: '#3b82f6',
		color: '#ffffff',
		border: 'none',
		borderRadius: '12px',
		cursor: 'pointer',
		fontWeight: 'bold',
		transition: 'background-color 0.2s'
	},
	buttonDisabled: {
		backgroundColor: '#4b5563',
		cursor: 'not-allowed'
	},
	error: {
		padding: '12px',
		backgroundColor: '#7f1d1d',
		color: '#fca5a5',
		borderRadius: '8px',
		textAlign: 'center' as const
	},
	connectionWarning: {
		padding: '12px',
		backgroundColor: '#78350f',
		color: '#fcd34d',
		borderRadius: '8px',
		textAlign: 'center' as const,
		fontSize: '14px'
	},
	footer: {
		marginTop: '40px',
		textAlign: 'center' as const,
		fontSize: '14px',
		color: '#666666'
	}
}
