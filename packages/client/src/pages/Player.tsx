import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../lib/use-socket'
import { useGameStore } from '../store/game-store'
import { LobbyVoting } from '../components/LobbyVoting'
import { EvilJK } from '../components/EvilJK'
import type { RoomUpdateMessage } from '@jkbox/shared'

export function Player() {
  const { roomId } = useParams<{ roomId: string }>()
  const { socket, isConnected } = useSocket()
  const { currentPlayer, room, setRoom } = useGameStore()

  useEffect(() => {
    if (!socket) return

    // Listen for room updates
    const handleRoomUpdate = (message: RoomUpdateMessage) => {
      setRoom(message.room)
    }

    socket.on('room:update', handleRoomUpdate)

    return () => {
      socket.off('room:update', handleRoomUpdate)
    }
  }, [socket, setRoom])

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
        <div style={styles.roomCode}>Room: {roomId}</div>
      </div>

      <div style={styles.content}>
        {room?.state === 'lobby' && roomId && currentPlayer && (
          <LobbyVoting roomId={roomId} playerId={currentPlayer.id} />
        )}

        {room?.state === 'playing' && (
          <div style={styles.gameCard}>
            <div style={styles.gameText}>Game in progress!</div>
          </div>
        )}

        {room?.state === 'finished' && (
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

      {/* Evil JK corner mascot (smaller for mobile) */}
      <EvilJK variant="corner" />
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
  error: {
    padding: 'var(--space-xl)',
    backgroundColor: 'var(--color-error-bg)',
    color: 'var(--color-error-text)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center' as const,
    fontSize: 'var(--font-size-lg)'
  }
}
