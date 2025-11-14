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

  /**
   * Add a player to tracking (for allReady calculation)
   */
  addPlayer(playerId: string): void {
    this.playerIds.add(playerId)
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
   */
  getVotingState(): RoomVotingState {
    const allReady = this.computeAllReady()
    const selectedGame = this.computeSelectedGame()

    return {
      votes: new Map(this.votes),
      readyStates: new Map(this.readyStates),
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
   * Compute if all players have voted + toggled ready
   */
  private computeAllReady(): boolean {
    // If no players, not ready
    if (this.playerIds.size === 0) {
      return false
    }

    // All tracked players must have voted + be ready
    for (const playerId of this.playerIds) {
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
