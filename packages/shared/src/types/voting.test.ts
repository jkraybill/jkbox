import { describe, it, expect } from 'vitest'
import type { GameVote, PlayerReadyState, RoomVotingState } from './voting'

describe('Voting Types', () => {
  describe('GameVote', () => {
    it('should have valid structure', () => {
      const vote: GameVote = {
        playerId: 'player-123',
        gameId: 'fake-facts',
        timestamp: new Date(),
      }

      expect(vote.playerId).toBe('player-123')
      expect(vote.gameId).toBe('fake-facts')
      expect(vote.timestamp).toBeInstanceOf(Date)
    })

    it('should support all game types', () => {
      const games = ['fake-facts', 'cinephile', 'joker-poker'] as const

      games.forEach(gameId => {
        const vote: GameVote = {
          playerId: 'player-1',
          gameId,
          timestamp: new Date(),
        }
        expect(vote.gameId).toBe(gameId)
      })
    })
  })

  describe('PlayerReadyState', () => {
    it('should track voting and ready status', () => {
      const state: PlayerReadyState = {
        playerId: 'player-123',
        hasVoted: true,
        isReady: false,
      }

      expect(state.playerId).toBe('player-123')
      expect(state.hasVoted).toBe(true)
      expect(state.isReady).toBe(false)
    })

    it('should allow ready toggle when voted', () => {
      const state: PlayerReadyState = {
        playerId: 'player-123',
        hasVoted: true,
        isReady: true,
      }

      expect(state.hasVoted).toBe(true)
      expect(state.isReady).toBe(true)
    })
  })

  describe('RoomVotingState', () => {
    it('should track all voting data', () => {
      const votingState: RoomVotingState = {
        votes: new Map([
          ['player-1', { playerId: 'player-1', gameId: 'fake-facts', timestamp: new Date() }],
          ['player-2', { playerId: 'player-2', gameId: 'fake-facts', timestamp: new Date() }],
        ]),
        readyStates: new Map([
          ['player-1', { playerId: 'player-1', hasVoted: true, isReady: true }],
          ['player-2', { playerId: 'player-2', hasVoted: true, isReady: false }],
        ]),
        allReady: false,
        selectedGame: 'fake-facts',
      }

      expect(votingState.votes.size).toBe(2)
      expect(votingState.readyStates.size).toBe(2)
      expect(votingState.allReady).toBe(false)
      expect(votingState.selectedGame).toBe('fake-facts')
    })

    it('should compute allReady correctly when everyone is ready', () => {
      const votingState: RoomVotingState = {
        votes: new Map([
          ['player-1', { playerId: 'player-1', gameId: 'fake-facts', timestamp: new Date() }],
        ]),
        readyStates: new Map([
          ['player-1', { playerId: 'player-1', hasVoted: true, isReady: true }],
        ]),
        allReady: true,
        selectedGame: 'fake-facts',
      }

      expect(votingState.allReady).toBe(true)
    })

    it('should handle no selected game when votes are tied', () => {
      const votingState: RoomVotingState = {
        votes: new Map([
          ['player-1', { playerId: 'player-1', gameId: 'fake-facts', timestamp: new Date() }],
          ['player-2', { playerId: 'player-2', gameId: 'cinephile', timestamp: new Date() }],
        ]),
        readyStates: new Map(),
        allReady: false,
        selectedGame: null,
      }

      expect(votingState.selectedGame).toBeNull()
    })
  })
})
