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

export function LobbyVoting({ roomId, playerId }: LobbyVotingProps) {
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
  const voteTallies = votingState
    ? Array.from(votingState.votes.values()).reduce(
        (acc, vote) => {
          acc[vote.gameId] = (acc[vote.gameId] ?? 0) + 1
          return acc
        },
        {} as Record<GameId, number>
      )
    : {}

  // Count ready players
  const readyCount = votingState
    ? Array.from(votingState.readyStates.values()).filter((state) => state.isReady).length
    : 0

  const totalPlayers = votingState ? votingState.readyStates.size : 0

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
    gap: '20px',
    padding: '20px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#FFD600', // Yellow
  },
  subtitle: {
    fontSize: '16px',
    color: '#aaaaaa',
  },
  gameList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  gameOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#2a2a2a',
    border: '2px solid #3a3a3a',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  gameOptionSelected: {
    backgroundColor: '#3a2a00',
    borderColor: '#FFD600',
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
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '4px',
  },
  gameDescription: {
    fontSize: '14px',
    color: '#aaaaaa',
    marginBottom: '8px',
  },
  voteCount: {
    fontSize: '14px',
    color: '#FFD600',
    fontWeight: 'bold',
  },
  readyButton: {
    padding: '20px',
    fontSize: '24px',
    fontWeight: 'bold',
    backgroundColor: '#FF1744', // Red
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  readyButtonActive: {
    backgroundColor: '#4ade80', // Green
  },
  readyButtonDisabled: {
    backgroundColor: '#4b5563',
    cursor: 'not-allowed',
  },
  waitingMessage: {
    textAlign: 'center' as const,
    fontSize: '16px',
    color: '#aaaaaa',
    fontStyle: 'italic',
  },
}
