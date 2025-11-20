import { useState, useEffect } from 'react'
import { useSocket } from '../lib/use-socket'
import type { GameId, RoomVotingState } from '@jkbox/shared'

interface LobbyVotingProps {
  roomId: string
  playerId: string
}

const GAME_OPTIONS: Array<{ id: GameId; name: string; description: string }> = [
  {
    id: 'fake-facts',
    name: 'Fake Facts',
    description: 'Fool your friends with fake trivia answers!',
  },
  {
    id: 'cinephile',
    name: 'Cinephile',
    description: 'Coming soon!',
  },
  {
    id: 'joker-poker',
    name: 'Joker Poker',
    description: 'Coming soon!',
  },
]

export function LobbyVoting({ roomId: _roomId, playerId: _playerId }: LobbyVotingProps) {
  const { socket } = useSocket()
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [votingState, setVotingState] = useState<RoomVotingState | null>(null)

  // Listen for voting updates from server
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

  const handleVoteChange = (gameId: GameId) => {
    if (isReady) {
      // Can't change vote when ready
      return
    }

    setSelectedGame(gameId)

    // Send vote to server
    if (socket) {
      socket.emit('lobby:vote-game', {
        type: 'lobby:vote-game',
        gameId,
      })
    }
  }

  const handleReadyToggle = () => {
    if (!selectedGame) {
      // Can't toggle ready without voting
      return
    }

    const newReadyState = !isReady

    // If toggling off, prompt to vote again
    if (!newReadyState) {
      setSelectedGame(null)
    }

    setIsReady(newReadyState)

    // Send ready toggle to server
    if (socket) {
      socket.emit('lobby:ready-toggle', {
        type: 'lobby:ready-toggle',
        isReady: newReadyState,
      })
    }
  }

  // Calculate vote tallies
  const voteTallies: Record<GameId, number> = votingState
    ? Object.values(votingState.votes).reduce(
        (acc, vote) => {
          acc[vote.gameId] = (acc[vote.gameId] ?? 0) + 1
          return acc
        },
        {} as Record<GameId, number>
      )
    : {} as Record<GameId, number>

  // Count ready players
  const readyCount = votingState
    ? Object.values(votingState.readyStates).filter((state) => state.isReady).length
    : 0

  const totalPlayers = votingState ? Object.keys(votingState.readyStates).length : 0

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Choose Your Game</h2>
        <div style={styles.subtitle}>
          {readyCount}/{totalPlayers} players ready
        </div>
      </div>

      <div style={styles.gameList}>
        {GAME_OPTIONS.map((game) => (
          <label
            key={game.id}
            style={{
              ...styles.gameOption,
              ...(selectedGame === game.id && styles.gameOptionSelected),
              ...(isReady && styles.gameOptionDisabled),
            }}
          >
            <input
              type="radio"
              name="game"
              value={game.id}
              checked={selectedGame === game.id}
              onChange={() => handleVoteChange(game.id)}
              disabled={isReady}
              style={styles.radio}
            />
            <div style={styles.gameInfo}>
              <div style={styles.gameName}>{game.name}</div>
              <div style={styles.gameDescription}>{game.description}</div>
              <div style={styles.voteCount}>
                {voteTallies[game.id] ?? 0} {voteTallies[game.id] === 1 ? 'vote' : 'votes'}
              </div>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={handleReadyToggle}
        disabled={!selectedGame && !isReady}
        style={{
          ...styles.readyButton,
          ...(isReady && styles.readyButtonActive),
          ...((!selectedGame && !isReady) && styles.readyButtonDisabled),
        }}
      >
        {isReady ? '✓ Good to Go!' : 'Good to Go?'}
      </button>

      {isReady && (
        <div style={styles.waitingMessage}>
          Waiting for others... Click again to change your vote
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-xl)',
    padding: 'var(--space-xl)',
    maxWidth: '500px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center' as const,
  },
  title: {
    fontSize: 'var(--font-size-3xl)',
    fontWeight: 'bold',
    marginBottom: 'var(--space-sm)',
    color: 'var(--color-primary-yellow)',
  },
  subtitle: {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-secondary)',
  },
  gameList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-md)',
  },
  gameOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-lg)',
    padding: 'var(--space-lg)',
    backgroundColor: 'var(--color-bg-medium)',
    border: '2px solid var(--color-bg-light)',
    borderRadius: 'var(--radius-lg)',
    cursor: 'pointer',
    transition: `all var(--transition-fast)`,
  },
  gameOptionSelected: {
    backgroundColor: '#3a2a00',
    borderColor: 'var(--color-primary-yellow)',
  },
  gameOptionDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  radio: {
    width: '24px',
    height: '24px',
    cursor: 'pointer',
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'bold',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-xs)',
  },
  gameDescription: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-sm)',
  },
  voteCount: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-status-voted)',
    fontWeight: 'bold',
  },
  readyButton: {
    padding: 'var(--space-xl)',
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'bold',
    backgroundColor: 'var(--color-primary-red)',
    color: 'var(--color-text-primary)',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    cursor: 'pointer',
    transition: `all var(--transition-fast)`,
  },
  readyButtonActive: {
    backgroundColor: 'var(--color-status-ready)',
  },
  readyButtonDisabled: {
    backgroundColor: '#4b5563',
    cursor: 'not-allowed',
  },
  waitingMessage: {
    textAlign: 'center' as const,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
  },
}
