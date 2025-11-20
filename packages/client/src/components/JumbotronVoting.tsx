import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useSocket } from '../lib/use-socket'
import { getJoinUrl } from '../lib/network-url'
import type { RoomVotingState, GameId, Player } from '@jkbox/shared'

interface JumbotronVotingProps {
	players: Player[]
	roomId: string
}

const GAME_NAMES: Record<GameId, string> = {
	cinephile: 'Cinema Pippin',
	'fake-facts': 'Fake Facts',
	'cinema-pippin': 'Cinema Pippin'
}

export function JumbotronVoting({ players, roomId }: JumbotronVotingProps) {
	const { socket } = useSocket()
	const [votingState, setVotingState] = useState<RoomVotingState | null>(null)
	const [joinUrl, setJoinUrl] = useState<string>('')

	// Fetch join URL on mount
	useEffect(() => {
		void getJoinUrl(roomId).then(setJoinUrl)
	}, [roomId])

	// Listen for voting updates
	useEffect(() => {
		if (!socket) return

		const handleVotingUpdate = (message: { votingState: RoomVotingState }) => {
			setVotingState(message.votingState)
		}

		socket.on('lobby:voting-update', handleVotingUpdate)

		return () => {
			socket.off('lobby:voting-update', handleVotingUpdate)
		}
	}, [socket])

	// Calculate vote tallies
	const voteTallies: Record<GameId, number> = votingState
		? Object.values(votingState.votes).reduce(
				(acc, vote) => {
					acc[vote.gameId] = (acc[vote.gameId] ?? 0) + 1
					return acc
				},
				{} as Record<GameId, number>
			)
		: ({} as Record<GameId, number>)

	const maxVotes = Math.max(...Object.values(voteTallies), 1)
	const selectedGame = votingState?.selectedGame

	// Get player ready states
	const playerStates = players.map((player) => {
		const readyState = votingState?.readyStates[player.id]
		const vote = votingState?.votes[player.id]
		return {
			player,
			hasVoted: readyState?.hasVoted ?? false,
			isReady: readyState?.isReady ?? false,
			votedFor: vote?.gameId ?? null
		}
	})

	const readyCount = playerStates.filter((p) => p.isReady).length
	const allReady = votingState?.allReady ?? false

	return (
		<div style={styles.container}>
			{/* QR Code - Floating on left */}
			<div style={styles.qrContainer}>
				<div style={styles.qrCode}>
					<QRCodeSVG
						value={joinUrl}
						size={Math.min(window.innerHeight * 0.15, window.innerWidth * 0.08)}
						level="M"
					/>
				</div>
				<div style={styles.joinUrl}>{joinUrl}</div>
			</div>

			{/* Titles - Absolutely centered */}
			<div style={styles.headerArea}>
				<h1 style={styles.mainTitle}>Pippin's Playhouse</h1>
				<h2 style={styles.title}>Vote for Next Game!</h2>
				<div style={styles.subtitle}>
					{readyCount}/{players.length} players ready
					{allReady && ' - Starting soon! 🎉'}
				</div>
			</div>

			<div style={styles.content}>
				{/* Vote Tallies */}
				<div style={styles.votingSection}>
					<h2 style={styles.sectionTitle}>Vote Tallies</h2>
					<div style={styles.voteList}>
						{Object.entries(GAME_NAMES).map(([gameId, name]) => {
							const votes = voteTallies[gameId as GameId] ?? 0
							const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0
							const isWinning = selectedGame === gameId

							return (
								<div key={gameId} style={styles.voteItem}>
									<div style={styles.voteName}>
										{name}
										{isWinning && <span style={styles.winningBadge}>LEADING</span>}
									</div>
									<div style={styles.voteBar}>
										<div
											style={{
												...styles.voteBarFill,
												width: `${percentage}%`,
												backgroundColor: isWinning ? '#FFD600' : '#FF1744'
											}}
										/>
										<div style={styles.voteCount}>{votes} votes</div>
									</div>
								</div>
							)
						})}
					</div>
				</div>

				{/* Player Grid */}
				<div style={styles.playersSection}>
					<h2 style={styles.sectionTitle}>Players</h2>
					<div style={styles.playerGrid}>
						{playerStates.map(({ player, hasVoted, isReady, votedFor }) => (
							<div
								key={player.id}
								style={{
									...styles.playerCard,
									...(isReady && styles.playerCardReady),
									...(hasVoted && !isReady && styles.playerCardVoted)
								}}
							>
								<div style={styles.playerName}>{player.nickname}</div>
								<div style={styles.playerStatus}>
									{!hasVoted && <span style={styles.statusPending}>⏳ Voting...</span>}
									{hasVoted && !isReady && <span style={styles.statusVoted}>✓ Voted</span>}
									{isReady && <span style={styles.statusReady}>✓✓ Ready!</span>}
								</div>
								{votedFor && <div style={styles.playerVote}>{GAME_NAMES[votedFor]}</div>}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

const styles = {
	container: {
		height: '100%',
		width: '100%',
		display: 'flex',
		flexDirection: 'column' as const,
		overflow: 'hidden',
		backgroundColor: 'var(--color-bg-darkest)',
		color: 'var(--color-text-primary)',
		position: 'relative' as const
	},
	qrContainer: {
		position: 'absolute' as const,
		top: 0,
		left: 0,
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		gap: '0.5vh',
		padding: '1.5vh 1vw',
		zIndex: 10
	},
	qrCode: {
		padding: '1vh',
		backgroundColor: '#ffffff',
		borderRadius: 'var(--radius-md)'
	},
	joinUrl: {
		fontSize: '1.2vh',
		color: 'var(--color-text-muted)',
		textAlign: 'center' as const,
		maxWidth: '15vw',
		wordBreak: 'break-all' as const
	},
	headerArea: {
		textAlign: 'center' as const,
		marginBottom: '2vh',
		flexShrink: 0
	},
	mainTitle: {
		fontSize: '6vh',
		fontWeight: 'bold',
		color: 'var(--color-text-primary)',
		margin: 0,
		marginBottom: '1vh'
	},
	title: {
		fontSize: '5vh',
		fontWeight: 'bold',
		color: 'var(--color-primary-yellow)',
		margin: 0,
		marginBottom: '1vh'
	},
	subtitle: {
		fontSize: '2.5vh',
		color: 'var(--color-text-secondary)'
	},
	content: {
		display: 'grid',
		gridTemplateColumns: '1fr 1fr',
		gap: '3vw',
		flex: 1,
		overflow: 'hidden'
	},
	votingSection: {
		backgroundColor: 'var(--color-bg-dark)',
		padding: '2vh 1.5vw',
		borderRadius: 'var(--radius-xl)',
		border: '0.3vh solid var(--color-primary-yellow)',
		overflow: 'hidden',
		display: 'flex',
		flexDirection: 'column' as const
	},
	sectionTitle: {
		fontSize: '3.5vh',
		fontWeight: 'bold',
		color: 'var(--color-primary-yellow)',
		marginBottom: '2vh',
		margin: 0,
		flexShrink: 0
	},
	voteList: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '2vh',
		flex: 1,
		overflow: 'hidden'
	},
	voteItem: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '1vh'
	},
	voteName: {
		fontSize: '2.5vh',
		fontWeight: 'bold',
		display: 'flex',
		alignItems: 'center',
		gap: '1vw'
	},
	winningBadge: {
		fontSize: '1.5vh',
		padding: '0.5vh 1vw',
		backgroundColor: 'var(--color-primary-yellow)',
		color: 'var(--color-bg-darkest)',
		borderRadius: 'var(--radius-md)',
		fontWeight: 'bold'
	},
	voteBar: {
		position: 'relative' as const,
		height: '6vh',
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-md)',
		overflow: 'hidden'
	},
	voteBarFill: {
		position: 'absolute' as const,
		left: 0,
		top: 0,
		height: '100%',
		transition: `width var(--transition-slow) ease`
	},
	voteCount: {
		position: 'absolute' as const,
		right: '1vw',
		top: '50%',
		transform: 'translateY(-50%)',
		fontSize: '2.5vh',
		fontWeight: 'bold',
		color: 'var(--color-text-primary)',
		zIndex: 10
	},
	playersSection: {
		backgroundColor: 'var(--color-bg-dark)',
		padding: '2vh 1.5vw',
		borderRadius: 'var(--radius-xl)',
		border: '0.3vh solid var(--color-primary-red)',
		overflow: 'hidden',
		display: 'flex',
		flexDirection: 'column' as const
	},
	playerGrid: {
		display: 'grid',
		gridTemplateColumns: 'repeat(2, 1fr)',
		gap: '1.5vh 1vw',
		flex: 1,
		overflow: 'auto',
		alignContent: 'start'
	},
	playerCard: {
		padding: '1.5vh 1vw',
		backgroundColor: 'var(--color-bg-medium)',
		borderRadius: 'var(--radius-lg)',
		border: '0.2vh solid var(--color-bg-light)',
		transition: `all var(--transition-normal)`
	},
	playerCardVoted: {
		borderColor: 'var(--color-status-voted)'
	},
	playerCardReady: {
		borderColor: 'var(--color-status-ready)',
		backgroundColor: '#1a3a1a'
	},
	playerName: {
		fontSize: '2.5vh',
		fontWeight: 'bold',
		marginBottom: '0.5vh'
	},
	playerStatus: {
		fontSize: '2vh',
		marginBottom: '0.5vh'
	},
	statusPending: {
		color: 'var(--color-status-pending)'
	},
	statusVoted: {
		color: 'var(--color-status-voted)'
	},
	statusReady: {
		color: 'var(--color-status-ready)'
	},
	playerVote: {
		fontSize: '1.8vh',
		color: 'var(--color-text-muted)',
		fontStyle: 'italic' as const
	}
}
