import { describe, it, expect, beforeEach } from 'vitest'
import { VotingHandler } from './voting-handler'
import type { GameVote, PlayerReadyState, RoomVotingState } from '@jkbox/shared'

describe('VotingHandler', () => {
  let handler: VotingHandler

  beforeEach(() => {
    handler = new VotingHandler()
  })

  describe('submitVote', () => {
    it('should record player vote', () => {
      const vote = handler.submitVote('player-1', 'fake-facts')

      expect(vote.playerId).toBe('player-1')
      expect(vote.gameId).toBe('fake-facts')
      expect(vote.timestamp).toBeInstanceOf(Date)
    })

    it('should allow changing vote', () => {
      handler.submitVote('player-1', 'fake-facts')
      const newVote = handler.submitVote('player-1', 'cinephile')

      expect(newVote.gameId).toBe('cinephile')

      const state = handler.getVotingState()
      expect(state.votes.get('player-1')?.gameId).toBe('cinephile')
    })

    it('should track multiple player votes', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.submitVote('player-2', 'cinephile')
      handler.submitVote('player-3', 'fake-facts')

      const state = handler.getVotingState()
      expect(state.votes.size).toBe(3)
    })
  })

  describe('toggleReady', () => {
    it('should require vote before ready', () => {
      expect(() => handler.toggleReady('player-1', true)).toThrow('Must vote before going ready')
    })

    it('should allow ready toggle after voting', () => {
      handler.submitVote('player-1', 'fake-facts')
      const readyState = handler.toggleReady('player-1', true)

      expect(readyState.isReady).toBe(true)
      expect(readyState.hasVoted).toBe(true)
    })

    it('should allow toggling ready off', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.toggleReady('player-1', true)
      const readyState = handler.toggleReady('player-1', false)

      expect(readyState.isReady).toBe(false)
      expect(readyState.hasVoted).toBe(true) // Vote persists
    })

    it('should keep vote when toggling ready off', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.toggleReady('player-1', true)
      handler.toggleReady('player-1', false)

      const state = handler.getVotingState()
      expect(state.votes.get('player-1')?.gameId).toBe('fake-facts')
    })
  })

  describe('getVotingState', () => {
    it('should compute allReady correctly when all ready', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.submitVote('player-2', 'fake-facts')
      handler.toggleReady('player-1', true)
      handler.toggleReady('player-2', true)

      const state = handler.getVotingState()
      expect(state.allReady).toBe(true)
    })

    it('should compute allReady false when some not ready', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.submitVote('player-2', 'fake-facts')
      handler.toggleReady('player-1', true)

      const state = handler.getVotingState()
      expect(state.allReady).toBe(false)
    })

    it('should compute allReady false when some not voted', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.toggleReady('player-1', true)

      // Player 2 exists but hasn't voted
      handler.addPlayer('player-2')

      const state = handler.getVotingState()
      expect(state.allReady).toBe(false)
    })

    it('should select game with most votes', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.submitVote('player-2', 'fake-facts')
      handler.submitVote('player-3', 'cinephile')

      const state = handler.getVotingState()
      expect(state.selectedGame).toBe('fake-facts')
    })

    it('should return null when votes are tied', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.submitVote('player-2', 'cinephile')

      const state = handler.getVotingState()
      expect(state.selectedGame).toBeNull()
    })

    it('should handle three-way tie', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.submitVote('player-2', 'cinephile')
      handler.submitVote('player-3', 'joker-poker')

      const state = handler.getVotingState()
      expect(state.selectedGame).toBeNull()
    })
  })

  describe('removePlayer', () => {
    it('should remove player vote and ready state', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.toggleReady('player-1', true)
      handler.removePlayer('player-1')

      const state = handler.getVotingState()
      expect(state.votes.has('player-1')).toBe(false)
      expect(state.readyStates.has('player-1')).toBe(false)
    })

    it('should recalculate selected game after removal', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.submitVote('player-2', 'fake-facts')
      handler.submitVote('player-3', 'cinephile')

      const stateBefore = handler.getVotingState()
      expect(stateBefore.selectedGame).toBe('fake-facts')

      // Remove fake-facts voter
      handler.removePlayer('player-1')

      const stateAfter = handler.getVotingState()
      expect(stateAfter.selectedGame).toBeNull() // Now tied 1-1
    })
  })

  describe('reset', () => {
    it('should clear all votes and ready states', () => {
      handler.submitVote('player-1', 'fake-facts')
      handler.submitVote('player-2', 'cinephile')
      handler.toggleReady('player-1', true)
      handler.reset()

      const state = handler.getVotingState()
      expect(state.votes.size).toBe(0)
      expect(state.readyStates.size).toBe(0)
      expect(state.allReady).toBe(false)
      expect(state.selectedGame).toBeNull()
    })
  })
})
