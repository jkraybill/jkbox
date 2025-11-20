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

    // Hide scrollbars globally
    const style = document.createElement('style')
    style.id = 'jumbotron-no-scroll'
    style.textContent = `
      html, body {
        overflow: hidden !important;
        height: 100vh !important;
        width: 100vw !important;
      }
      * {
        scrollbar-width: none !important; /* Firefox */
        -ms-overflow-style: none !important; /* IE and Edge */
      }
      *::-webkit-scrollbar {
        display: none !important; /* Chrome, Safari, Opera */
      }
    `
    document.head.appendChild(style)

    enterFullscreen()

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
              <QRCodeSVG
                value={joinUrl}
                size={Math.min(window.innerHeight * 0.25, window.innerWidth * 0.15)}
                level="M"
              />
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
        <JumbotronVoting players={room.players} roomId={room.roomId} />
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
    width: '100vw',
    height: '100vh',
    padding: '2vh 2vw',
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
  roomCode: {
    fontSize: '2.5vh',
    color: 'var(--color-text-secondary)'
  },
  roomCodeValue: {
    color: 'var(--color-accent-blue)',
    fontWeight: 'bold',
    fontSize: '4vh'
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
  footer: {
    position: 'absolute' as const,
    bottom: '1vh',
    left: '1vw',
    fontSize: '1.5vh',
    color: 'var(--color-text-disabled)',
    flexShrink: 0
  }
}
