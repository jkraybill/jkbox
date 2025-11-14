import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useGameStore } from '../store/game-store'
import { useSocket } from '../lib/use-socket'
import { JumbotronVoting } from '../components/JumbotronVoting'
import { EvilJK } from '../components/EvilJK'

export function Jumbotron() {
  const { roomId } = useParams<{ roomId: string }>()
  const { room, setRoom } = useGameStore()
  const { socket, isConnected } = useSocket()
  const [showIntro, setShowIntro] = useState(true)

  const joinUrl = `${window.location.origin}/join/${roomId}`

  useEffect(() => {
    if (!socket || !roomId || !isConnected) return

    // Send watch message to join the room and receive updates
    socket.emit('watch', {
      type: 'watch',
      roomId
    })

    // Listen for room updates
    socket.on('room:update', (message: any) => {
      setRoom(message.room)
    })

    return () => {
      socket.off('room:update')
    }
  }, [socket, roomId, isConnected, setRoom])

  if (!room) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading room...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>jkbox Party</h1>
        <div style={styles.roomCode}>
          Room Code: <span style={styles.roomCodeValue}>{room.id}</span>
        </div>
      </div>

      {room.players.length === 0 ? (
        // Show QR code when no players
        <div style={styles.content}>
          <div style={styles.qrSection}>
            <h2 style={styles.sectionTitle}>Scan to Join</h2>
            <div style={styles.qrCode}>
              <QRCodeSVG value={joinUrl} size={256} level="M" />
            </div>
            <div style={styles.joinUrl}>{joinUrl}</div>
          </div>

          <div style={styles.playerSection}>
            <h2 style={styles.sectionTitle}>
              Players ({room.players.length}/{room.config.maxPlayers})
            </h2>
            <div style={styles.emptyState}>Waiting for players to join...</div>
          </div>
        </div>
      ) : (
        // Show voting UI when players have joined
        <JumbotronVoting players={room.players} />
      )}

      <div style={styles.footer}>
        <div>State: {room.state}</div>
        <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
      </div>

      {/* Evil JK intro animation (plays once on load) */}
      {showIntro && <EvilJK variant="intro" onIntroComplete={() => setShowIntro(false)} />}

      {/* Evil JK corner mascot (persistent, animated) */}
      {!showIntro && <EvilJK variant="corner" />}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    backgroundColor: '#1a1a1a',
    color: '#ffffff'
  },
  loading: {
    fontSize: '24px',
    textAlign: 'center' as const,
    marginTop: '100px'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '40px'
  },
  title: {
    fontSize: '48px',
    margin: '0 0 20px 0'
  },
  roomCode: {
    fontSize: '24px',
    color: '#aaaaaa'
  },
  roomCodeValue: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: '36px'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '40px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '40px',
    backgroundColor: '#2a2a2a',
    borderRadius: '16px'
  },
  sectionTitle: {
    fontSize: '28px',
    marginBottom: '30px'
  },
  qrCode: {
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  joinUrl: {
    fontSize: '14px',
    color: '#888888',
    wordBreak: 'break-all' as const,
    textAlign: 'center' as const
  },
  playerSection: {
    padding: '40px',
    backgroundColor: '#2a2a2a',
    borderRadius: '16px'
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginBottom: '30px'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#666666',
    fontSize: '18px'
  },
  playerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px'
  },
  playerNickname: {
    fontSize: '20px',
    fontWeight: 'bold'
  },
  playerStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  badge: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#3b82f6',
    borderRadius: '4px',
    fontWeight: 'bold'
  },
  statusConnected: {
    color: '#4ade80',
    fontSize: '20px'
  },
  statusDisconnected: {
    color: '#f87171',
    fontSize: '20px'
  },
  startButton: {
    width: '100%',
    padding: '16px',
    fontSize: '20px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  footer: {
    position: 'fixed' as const,
    bottom: '20px',
    left: '20px',
    fontSize: '12px',
    color: '#666666'
  }
}
