import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useGameStore } from '../store/game-store'
import { useSocket } from '../lib/use-socket'
import { JumbotronVoting } from '../components/JumbotronVoting'
import { Pippin } from '../components/Pippin'
import { Countdown } from '../components/Countdown'
import type { LobbyCountdownMessage } from '@jkbox/shared'

const GAME_NAMES: Record<string, string> = {
  'fake-facts': 'Fake Facts',
  'cinephile': 'Cinephile',
  'joker-poker': 'Joker Poker',
}

export function Jumbotron() {
  const { roomId } = useParams<{ roomId: string }>()
  const { room } = useGameStore()
  const { socket, isConnected } = useSocket()
  const [showIntro, setShowIntro] = useState(true)
  const [countdown, setCountdown] = useState<{ count: number; game: string } | null>(null)

  const joinUrl = `${window.location.origin}/join/${roomId}`

  useEffect(() => {
    if (!socket || !roomId || !isConnected) return

    // Send watch message to join the room and receive updates
    socket.emit('watch', {
      type: 'watch',
      roomId
    })

    // Listen for countdown messages
    socket.on('lobby:countdown', (message: LobbyCountdownMessage) => {
      const gameName = GAME_NAMES[message.selectedGame] || message.selectedGame
      setCountdown({ count: message.countdown, game: gameName })
    })

    return () => {
      socket.off('lobby:countdown')
    }
  }, [socket, roomId, isConnected])

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
        <h1 style={styles.title}>Pippin's Playhouse</h1>
        <div style={styles.roomCode}>
          Room Code: <span style={styles.roomCodeValue}>{room.roomId}</span>
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
              Players ({room.players.length}/12)
            </h2>
            <div style={styles.emptyState}>Waiting for players to join...</div>
          </div>
        </div>
      ) : (
        // Show voting UI when players have joined
        <JumbotronVoting players={room.players} />
      )}

      <div style={styles.footer}>
        <div>Phase: {room.phase}</div>
        <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
      </div>

      {/* Pippin intro animation (plays once on load) */}
      {showIntro && <Pippin variant="intro" onIntroComplete={() => setShowIntro(false)} />}

      {/* Pippin corner mascot (persistent, animated) */}
      {!showIntro && !countdown && <Pippin variant="corner" />}

      {/* Countdown overlay */}
      {countdown && (
        <Countdown count={countdown.count} gameName={countdown.game} variant="jumbotron" />
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: 'var(--space-3xl)',
    fontFamily: 'var(--font-family)',
    backgroundColor: 'var(--color-bg-dark)',
    color: 'var(--color-text-primary)'
  },
  loading: {
    fontSize: 'var(--font-size-2xl)',
    textAlign: 'center' as const,
    marginTop: '100px'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: 'var(--space-3xl)'
  },
  title: {
    fontSize: 'var(--font-size-5xl)',
    margin: '0 0 var(--space-xl) 0'
  },
  roomCode: {
    fontSize: 'var(--font-size-2xl)',
    color: 'var(--color-text-secondary)'
  },
  roomCodeValue: {
    color: 'var(--color-accent-blue)',
    fontWeight: 'bold',
    fontSize: 'var(--font-size-jumbo-2xl)'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-3xl)',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: 'var(--space-3xl)',
    backgroundColor: 'var(--color-bg-medium)',
    borderRadius: 'var(--radius-xl)'
  },
  sectionTitle: {
    fontSize: 'var(--font-size-3xl)',
    marginBottom: 'var(--space-2xl)'
  },
  qrCode: {
    padding: 'var(--space-xl)',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 'var(--space-xl)'
  },
  joinUrl: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    wordBreak: 'break-all' as const,
    textAlign: 'center' as const
  },
  playerSection: {
    padding: 'var(--space-3xl)',
    backgroundColor: 'var(--color-bg-medium)',
    borderRadius: 'var(--radius-xl)'
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-md)',
    marginBottom: 'var(--space-2xl)'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: 'var(--space-3xl)',
    color: 'var(--color-text-disabled)',
    fontSize: 'var(--font-size-lg)'
  },
  playerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-lg) var(--space-xl)',
    backgroundColor: 'var(--color-bg-dark)',
    borderRadius: 'var(--radius-md)'
  },
  playerNickname: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'bold'
  },
  playerStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)'
  },
  badge: {
    fontSize: 'var(--font-size-xs)',
    padding: 'var(--space-xs) var(--space-sm)',
    backgroundColor: 'var(--color-accent-blue)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 'bold'
  },
  statusConnected: {
    color: 'var(--color-status-connected)',
    fontSize: 'var(--font-size-xl)'
  },
  statusDisconnected: {
    color: 'var(--color-status-disconnected)',
    fontSize: 'var(--font-size-xl)'
  },
  startButton: {
    width: '100%',
    padding: 'var(--space-lg)',
    fontSize: 'var(--font-size-xl)',
    backgroundColor: '#10b981',
    color: 'var(--color-text-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  footer: {
    position: 'fixed' as const,
    bottom: 'var(--space-xl)',
    left: 'var(--space-xl)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-disabled)'
  }
}
