import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../lib/use-socket'
import { useGameStore } from '../store/game-store'
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
        {room?.state === 'lobby' && (
          <div style={styles.waitingCard}>
            <div style={styles.waitingIcon}>⏳</div>
            <div style={styles.waitingText}>Waiting for game to start...</div>
            <div style={styles.waitingSubtext}>
              The host will start the game when everyone's ready
            </div>
          </div>
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
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
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
  nickname: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '8px'
  },
  roomCode: {
    fontSize: '14px',
    color: '#888888'
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    maxWidth: '500px',
    width: '100%',
    margin: '0 auto'
  },
  waitingCard: {
    padding: '40px 20px',
    backgroundColor: '#2a2a2a',
    borderRadius: '16px',
    textAlign: 'center' as const
  },
  waitingIcon: {
    fontSize: '64px',
    marginBottom: '20px'
  },
  waitingText: {
    fontSize: '24px',
    marginBottom: '12px',
    fontWeight: 'bold'
  },
  waitingSubtext: {
    fontSize: '16px',
    color: '#aaaaaa'
  },
  gameCard: {
    padding: '40px 20px',
    backgroundColor: '#2a2a2a',
    borderRadius: '16px',
    textAlign: 'center' as const
  },
  gameText: {
    fontSize: '24px',
    fontWeight: 'bold'
  },
  scoreCard: {
    padding: '30px',
    backgroundColor: '#2a2a2a',
    borderRadius: '16px',
    textAlign: 'center' as const
  },
  scoreLabel: {
    fontSize: '16px',
    color: '#aaaaaa',
    marginBottom: '12px'
  },
  scoreValue: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#3b82f6'
  },
  footer: {
    marginTop: '40px',
    paddingTop: '20px',
    borderTop: '1px solid #3a3a3a'
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#888888'
  },
  statusConnected: {
    color: '#4ade80'
  },
  statusDisconnected: {
    color: '#f87171'
  },
  error: {
    padding: '20px',
    backgroundColor: '#7f1d1d',
    color: '#fca5a5',
    borderRadius: '8px',
    textAlign: 'center' as const,
    fontSize: '18px'
  }
}
