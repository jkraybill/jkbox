import type { GameId, GameVote, PlayerReadyState, RoomVotingState } from '@jkbox/shared'

/**
 * Handles lobby voting logic for game selection
 * Players vote for which game to play next, then toggle "Good to Go"
 * When all players voted + ready, countdown triggers
 */
export class VotingHandler {
  private votes: Map<string, GameVote> = new Map()
  private readyStates: Map<string, PlayerReadyState> = new Map()
  private playerIds: Set<string> = new Set()
  private aiPlayerIds: Set<string> = new Set()

  /**
   * Add a player to tracking (for allReady calculation)
   * AI players are tracked separately and excluded from voting requirements
   */
  addPlayer(playerId: string, isAI: boolean = false): void {
    this.playerIds.add(playerId)
    if (isAI) {
      this.aiPlayerIds.add(playerId)
    }
  }

  /**
   * Submit or change vote for a game
   */
  submitVote(playerId: string, gameId: GameId): GameVote {
    const vote: GameVote = {
      playerId,
      gameId,
      timestamp: new Date(),
    }

    this.votes.set(playerId, vote)

    // Update ready state to reflect hasVoted
    const existingReady = this.readyStates.get(playerId)
    this.readyStates.set(playerId, {
      playerId,
      hasVoted: true,
      isReady: existingReady?.isReady ?? false,
    })

    this.playerIds.add(playerId)
    return vote
  }

  /**
   * Toggle "Good to Go" ready state
   * Requires player to have voted first
   */
  toggleReady(playerId: string, isReady: boolean): PlayerReadyState {
    const readyState = this.readyStates.get(playerId)

    if (!readyState || !readyState.hasVoted) {
      throw new Error('Must vote before going ready')
    }

    const updatedState: PlayerReadyState = {
      playerId,
      hasVoted: true,
      isReady,
    }

    this.readyStates.set(playerId, updatedState)
    return updatedState
  }

  /**
   * Get current voting state with computed fields
   * Converts Maps to Records for JSON serialization over WebSocket
   */
  getVotingState(): RoomVotingState {
    const allReady = this.computeAllReady()
    const selectedGame = this.computeSelectedGame()

    return {
      votes: Object.fromEntries(this.votes),  // Map → Record for JSON
      readyStates: Object.fromEntries(this.readyStates),  // Map → Record for JSON
      allReady,
      selectedGame,
    }
  }

  /**
   * Remove player (on disconnect)
   */
  removePlayer(playerId: string): void {
    this.votes.delete(playerId)
    this.readyStates.delete(playerId)
    this.playerIds.delete(playerId)
    this.aiPlayerIds.delete(playerId)
  }

  /**
   * Reset voting state (for new round of voting)
   */
  reset(): void {
    this.votes.clear()
    this.readyStates.clear()
    // Keep playerIds for tracking
  }

  /**
   * Compute if all HUMAN players have voted + toggled ready
   * AI players are excluded from voting requirements
   * Requires at least 1 human player to be ready
   */
  private computeAllReady(): boolean {
    // Get human players only (exclude AI)
    const humanPlayerIds = Array.from(this.playerIds).filter(id => !this.aiPlayerIds.has(id))

    // Must have at least 1 human player
    if (humanPlayerIds.length === 0) {
      return false
    }

    // All human players must have voted + be ready
    for (const playerId of humanPlayerIds) {
      const readyState = this.readyStates.get(playerId)
      if (!readyState || !readyState.hasVoted || !readyState.isReady) {
        return false
      }
    }

    return true
  }

  /**
   * Compute selected game (most votes, null if tied)
   */
  private computeSelectedGame(): GameId | null {
    if (this.votes.size === 0) {
      return null
    }

    // Count votes per game
    const tallies = new Map<GameId, number>()
    for (const vote of this.votes.values()) {
      tallies.set(vote.gameId, (tallies.get(vote.gameId) ?? 0) + 1)
    }

    // Find max vote count
    let maxVotes = 0
    let winners: GameId[] = []

    for (const [gameId, count] of tallies) {
      if (count > maxVotes) {
        maxVotes = count
        winners = [gameId]
      } else if (count === maxVotes) {
        winners.push(gameId)
      }
    }

    // Return null if tied
    return winners.length === 1 ? winners[0]! : null
  }
}
