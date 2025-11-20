import { useEffect, useState } from 'react'
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
  const { room, setRoom } = useGameStore()
  const { socket, isConnected } = useSocket()
  const [countdown, setCountdown] = useState<{ count: number; game: string } | null>(null)
  const [isLoadingRoom, setIsLoadingRoom] = useState(true)

  // Fetch singleton room on mount
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        console.log('[Jumbotron] Fetching singleton room...')
        const response = await fetch('http://localhost:3001/api/room')

        if (!response.ok) {
          throw new Error('Failed to fetch room')
        }

        const { room: fetchedRoom } = await response.json()
        console.log('[Jumbotron] Fetched room:', fetchedRoom)
        setRoom(fetchedRoom)
      } catch (error) {
        console.error('[Jumbotron] Failed to fetch room:', error)
      } finally {
        setIsLoadingRoom(false)
      }
    }

    fetchRoom()
  }, [setRoom])

  // Join room via WebSocket when connected
  useEffect(() => {
    if (!socket || !room || !isConnected) {
      console.log('[Jumbotron] Waiting for socket/room/connection:', {
        socket: !!socket,
        room: !!room,
        isConnected
      })
      return
    }

    console.log('[Jumbotron] Joining room via WebSocket:', room.roomId)

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

    return () => {
      socket.off('lobby:countdown')
    }
  }, [socket, room, isConnected])

  // Handle Pippin intro completion (transition title → lobby)
  const handleIntroComplete = async () => {
    console.log('[Jumbotron] Pippin intro complete, transitioning to lobby...')

    try {
      const response = await fetch('http://localhost:3001/api/room/transition-to-lobby', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to transition to lobby')
      }

      const { room: lobbyRoom } = await response.json()
      console.log('[Jumbotron] Transitioned to lobby:', lobbyRoom)
      setRoom(lobbyRoom)
    } catch (error) {
      console.error('[Jumbotron] Failed to transition to lobby:', error)
    }
  }

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

  const joinUrl = `${window.location.origin}/join/${room.roomId}`

  // Title screen - show Pippin intro animation
  if (room.phase === 'title') {
    return (
      <div style={styles.container}>
        <Pippin variant="intro" onIntroComplete={handleIntroComplete} />
      </div>
    )
  }

  // Lobby and beyond - show room state
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Pippin's Playhouse</h1>
        <div style={styles.roomCode}>
          Room Code: <span style={styles.roomCodeValue}>{room.roomId}</span>
        </div>
      </div>

      {room.phase === 'lobby' && room.players.length === 0 ? (
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
      ) : room.phase === 'lobby' ? (
        // Show voting UI when players have joined
        <JumbotronVoting players={room.players} />
      ) : (
        // Other phases (countdown, playing, results)
        <div style={styles.content}>
          <div style={styles.phaseDisplay}>
            Phase: {room.phase}
          </div>
        </div>
      )}

      <div style={styles.footer}>
        <div>Phase: {room.phase}</div>
        <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
      </div>

      {/* Pippin corner mascot (persistent, animated) */}
      {!countdown && <Pippin variant="corner" />}

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
  error: {
    fontSize: 'var(--font-size-2xl)',
    textAlign: 'center' as const,
    marginTop: '100px',
    color: 'var(--color-error-text)'
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
  emptyState: {
    textAlign: 'center' as const,
    padding: 'var(--space-3xl)',
    color: 'var(--color-text-disabled)',
    fontSize: 'var(--font-size-lg)'
  },
  phaseDisplay: {
    fontSize: 'var(--font-size-3xl)',
    textAlign: 'center' as const,
    padding: 'var(--space-3xl)'
  },
  footer: {
    position: 'fixed' as const,
    bottom: 'var(--space-xl)',
    left: 'var(--space-xl)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-disabled)'
  }
}
