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
  const voteTallies: Record<GameId, number> = votingState
    ? Object.values(votingState.votes).reduce(
        (acc, vote) => {
          acc[vote.gameId] = (acc[vote.gameId] ?? 0) + 1
          return acc
        },
        {} as Record<GameId, number>
      )
    : {} as Record<GameId, number>

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
    padding: 'var(--space-3xl)',
    minHeight: '100vh',
    backgroundColor: 'var(--color-bg-darkest)',
    color: 'var(--color-text-primary)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: 'var(--space-3xl)',
  },
  title: {
    fontSize: 'var(--font-size-jumbo-4xl)',
    fontWeight: 'bold',
    color: 'var(--color-primary-yellow)',
    marginBottom: 'var(--space-lg)',
  },
  subtitle: {
    fontSize: 'var(--font-size-jumbo-xl)',
    color: 'var(--color-text-secondary)',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-3xl)',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  votingSection: {
    backgroundColor: 'var(--color-bg-dark)',
    padding: 'var(--space-3xl)',
    borderRadius: 'var(--radius-xl)',
    border: '3px solid var(--color-primary-yellow)',
  },
  sectionTitle: {
    fontSize: 'var(--font-size-jumbo-2xl)',
    fontWeight: 'bold',
    color: 'var(--color-primary-yellow)',
    marginBottom: 'var(--space-2xl)',
  },
  voteList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-2xl)',
  },
  voteItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-md)',
  },
  voteName: {
    fontSize: 'var(--font-size-jumbo-lg)',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  winningBadge: {
    fontSize: 'var(--font-size-base)',
    padding: 'var(--space-xs) var(--space-md)',
    backgroundColor: 'var(--color-primary-yellow)',
    color: 'var(--color-bg-darkest)',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'bold',
  },
  voteBar: {
    position: 'relative' as const,
    height: '60px',
    backgroundColor: 'var(--color-bg-medium)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  voteBarFill: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    height: '100%',
    transition: `width var(--transition-slow) ease`,
  },
  voteCount: {
    position: 'absolute' as const,
    right: 'var(--space-lg)',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 'var(--font-size-jumbo-base)',
    fontWeight: 'bold',
    color: 'var(--color-text-primary)',
    zIndex: 10,
  },
  playersSection: {
    backgroundColor: 'var(--color-bg-dark)',
    padding: 'var(--space-3xl)',
    borderRadius: 'var(--radius-xl)',
    border: '3px solid var(--color-primary-red)',
  },
  playerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--space-lg)',
  },
  playerCard: {
    padding: 'var(--space-xl)',
    backgroundColor: 'var(--color-bg-medium)',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid var(--color-bg-light)',
    transition: `all var(--transition-normal)`,
  },
  playerCardVoted: {
    borderColor: 'var(--color-status-voted)',
  },
  playerCardReady: {
    borderColor: 'var(--color-status-ready)',
    backgroundColor: '#1a3a1a',
  },
  playerName: {
    fontSize: 'var(--font-size-jumbo-base)',
    fontWeight: 'bold',
    marginBottom: 'var(--space-sm)',
  },
  playerStatus: {
    fontSize: 'var(--font-size-lg)',
    marginBottom: 'var(--space-xs)',
  },
  statusPending: {
    color: 'var(--color-status-pending)',
  },
  statusVoted: {
    color: 'var(--color-status-voted)',
  },
  statusReady: {
    color: 'var(--color-status-ready)',
  },
  playerVote: {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-muted)',
    fontStyle: 'italic' as const,
  },
}
