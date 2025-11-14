import { useEffect, useState } from 'react'
import { useSocket } from '../lib/use-socket'
import type { RoomVotingState, GameId, Player } from '@jkbox/shared'

interface JumbotronVotingProps {
  players: Player[]
}

const GAME_NAMES: Record<GameId, string> = {
  'fake-facts': 'Fake Facts',
  'cinephile': 'Cinephile',
  'joker-poker': 'Joker Poker',
}

export function JumbotronVoting({ players }: JumbotronVotingProps) {
  const { socket } = useSocket()
  const [votingState, setVotingState] = useState<RoomVotingState | null>(null)

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
  const voteTallies = votingState
    ? Array.from(votingState.votes.values()).reduce(
        (acc, vote) => {
          acc[vote.gameId] = (acc[vote.gameId] ?? 0) + 1
          return acc
        },
        {} as Record<GameId, number>
      )
    : {}

  const maxVotes = Math.max(...Object.values(voteTallies), 1)
  const selectedGame = votingState?.selectedGame

  // Get player ready states
  const playerStates = players.map((player) => {
    const readyState = votingState?.readyStates.get(player.id)
    const vote = votingState?.votes.get(player.id)
    return {
      player,
      hasVoted: readyState?.hasVoted ?? false,
      isReady: readyState?.isReady ?? false,
      votedFor: vote?.gameId ?? null,
    }
  })

  const readyCount = playerStates.filter((p) => p.isReady).length
  const allReady = votingState?.allReady ?? false

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Vote for Next Game!</h1>
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
                        backgroundColor: isWinning ? '#FFD600' : '#FF1744',
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
                  ...(hasVoted && !isReady && styles.playerCardVoted),
                }}
              >
                <div style={styles.playerName}>{player.nickname}</div>
                <div style={styles.playerStatus}>
                  {!hasVoted && <span style={styles.statusPending}>⏳ Voting...</span>}
                  {hasVoted && !isReady && <span style={styles.statusVoted}>✓ Voted</span>}
                  {isReady && <span style={styles.statusReady}>✓✓ Ready!</span>}
                </div>
                {votedFor && (
                  <div style={styles.playerVote}>{GAME_NAMES[votedFor]}</div>
                )}
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
    padding: '40px',
    minHeight: '100vh',
    backgroundColor: '#0A0A0A',
    color: '#ffffff',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '40px',
  },
  title: {
    fontSize: '64px',
    fontWeight: 'bold',
    color: '#FFD600',
    marginBottom: '16px',
  },
  subtitle: {
    fontSize: '32px',
    color: '#aaaaaa',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  votingSection: {
    backgroundColor: '#1A1A1A',
    padding: '40px',
    borderRadius: '16px',
    border: '3px solid #FFD600',
  },
  sectionTitle: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#FFD600',
    marginBottom: '30px',
  },
  voteList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  voteItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  voteName: {
    fontSize: '28px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  winningBadge: {
    fontSize: '16px',
    padding: '4px 12px',
    backgroundColor: '#FFD600',
    color: '#0A0A0A',
    borderRadius: '8px',
    fontWeight: 'bold',
  },
  voteBar: {
    position: 'relative' as const,
    height: '60px',
    backgroundColor: '#2A2A2A',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  voteBarFill: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    height: '100%',
    transition: 'width 0.5s ease',
  },
  voteCount: {
    position: 'absolute' as const,
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffffff',
    zIndex: 10,
  },
  playersSection: {
    backgroundColor: '#1A1A1A',
    padding: '40px',
    borderRadius: '16px',
    border: '3px solid #FF1744',
  },
  playerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  playerCard: {
    padding: '20px',
    backgroundColor: '#2A2A2A',
    borderRadius: '12px',
    border: '2px solid #3A3A3A',
    transition: 'all 0.3s',
  },
  playerCardVoted: {
    borderColor: '#FFD600',
  },
  playerCardReady: {
    borderColor: '#4ade80',
    backgroundColor: '#1a3a1a',
  },
  playerName: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  playerStatus: {
    fontSize: '18px',
    marginBottom: '4px',
  },
  statusPending: {
    color: '#aaaaaa',
  },
  statusVoted: {
    color: '#FFD600',
  },
  statusReady: {
    color: '#4ade80',
  },
  playerVote: {
    fontSize: '16px',
    color: '#888888',
    fontStyle: 'italic' as const,
  },
}
