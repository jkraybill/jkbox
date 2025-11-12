import { describe, it, expect } from 'vitest'
import type {
  GamePhase,
  RoundTimers,
  GameConfig,
  RoundState,
  RoundResults,
  GameResults
} from './game'

describe('Game module types', () => {
  describe('GamePhase', () => {
    it('should allow valid phases', () => {
      const phases: GamePhase[] = ['submit', 'vote', 'results']

      phases.forEach(phase => {
        expect(['submit', 'vote', 'results']).toContain(phase)
      })
    })
  })

  describe('RoundTimers', () => {
    it('should have correct shape', () => {
      const timers: RoundTimers = {
        submit: 60,
        vote: 45,
        results: 10
      }

      expect(timers.submit).toBe(60)
      expect(timers.vote).toBe(45)
      expect(timers.results).toBe(10)
    })
  })

  describe('GameConfig', () => {
    it('should have correct shape', () => {
      const config: GameConfig = {
        roundTimers: {
          submit: 60,
          vote: 45,
          results: 10
        },
        scoring: {
          pointsPerVote: 100,
          bonusForWinning: 200
        },
        contentPacks: ['1990s-scifi', 'weird-youtube']
      }

      expect(config.roundTimers.submit).toBe(60)
      expect(config.scoring['pointsPerVote']).toBe(100)
      expect(config.contentPacks).toHaveLength(2)
      expect(config.contentPacks).toContain('1990s-scifi')
    })
  })

  describe('RoundState', () => {
    it('should have correct shape', () => {
      const state: RoundState = {
        phase: 'submit',
        timeRemaining: 45,
        isPaused: false,
        submissions: new Map(),
        votes: new Map()
      }

      expect(state.phase).toBe('submit')
      expect(state.timeRemaining).toBe(45)
      expect(state.isPaused).toBe(false)
      expect(state.submissions).toBeInstanceOf(Map)
      expect(state.votes).toBeInstanceOf(Map)
    })

    it('should support paused state', () => {
      const state: RoundState = {
        phase: 'vote',
        timeRemaining: 30,
        isPaused: true,
        submissions: new Map([
          ['player-1', 'answer-1'],
          ['player-2', 'answer-2']
        ]),
        votes: new Map()
      }

      expect(state.isPaused).toBe(true)
      expect(state.submissions.size).toBe(2)
    })

    it('should track votes', () => {
      const state: RoundState = {
        phase: 'vote',
        timeRemaining: 20,
        isPaused: false,
        submissions: new Map(),
        votes: new Map([
          ['voter-1', 'submission-a'],
          ['voter-2', 'submission-a'],
          ['voter-3', 'submission-b']
        ])
      }

      expect(state.votes.size).toBe(3)
      expect(state.votes.get('voter-1')).toBe('submission-a')
    })
  })

  describe('RoundResults', () => {
    it('should have correct shape', () => {
      const results: RoundResults = {
        winner: 'submission-a',
        scores: new Map([
          ['player-1', 300],
          ['player-2', 100],
          ['player-3', 0]
        ]),
        breakdown: {
          winningAnswer: 'banana',
          votesReceived: {
            'submission-a': 2,
            'submission-b': 1
          }
        }
      }

      expect(results.winner).toBe('submission-a')
      expect(results.scores.get('player-1')).toBe(300)
      expect(results.scores.size).toBe(3)
    })
  })

  describe('GameResults', () => {
    it('should have correct shape', () => {
      const results: GameResults = {
        finalScores: new Map([
          ['player-1', 1200],
          ['player-2', 900],
          ['player-3', 600]
        ]),
        winners: ['player-1'],
        stats: {
          totalRounds: 5,
          averageScore: 900
        }
      }

      expect(results.finalScores.get('player-1')).toBe(1200)
      expect(results.winners).toContain('player-1')
      expect(results.winners).toHaveLength(1)
    })

    it('should support tie winners', () => {
      const results: GameResults = {
        finalScores: new Map([
          ['player-1', 1000],
          ['player-2', 1000],
          ['player-3', 600]
        ]),
        winners: ['player-1', 'player-2'],
        stats: {}
      }

      expect(results.winners).toHaveLength(2)
      expect(results.winners).toContain('player-1')
      expect(results.winners).toContain('player-2')
    })
  })
})
