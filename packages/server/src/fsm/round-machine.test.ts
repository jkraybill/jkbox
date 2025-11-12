import { describe, it, expect, vi } from 'vitest'
import { createActor } from 'xstate'
import { roundMachine } from './round-machine'

describe('roundMachine', () => {
  describe('initial state', () => {
    it('should start in submit phase', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      expect(actor.getSnapshot().value).toBe('submit')
      actor.stop()
    })
  })

  describe('submit → vote transition', () => {
    it('should transition to vote when TIME_UP event fires', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      actor.send({ type: 'TIME_UP' })

      expect(actor.getSnapshot().value).toBe('vote')
      actor.stop()
    })

    it('should transition to vote when ADMIN_SKIP fires', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      actor.send({ type: 'ADMIN_SKIP' })

      expect(actor.getSnapshot().value).toBe('vote')
      actor.stop()
    })

    it('should handle PAUSE and RESUME in submit phase', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      expect(actor.getSnapshot().context.isPaused).toBe(false)

      actor.send({ type: 'PAUSE' })
      expect(actor.getSnapshot().context.isPaused).toBe(true)

      actor.send({ type: 'RESUME' })
      expect(actor.getSnapshot().context.isPaused).toBe(false)

      actor.stop()
    })
  })

  describe('vote → results transition', () => {
    it('should transition to results when TIME_UP fires', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      actor.send({ type: 'TIME_UP' }) // submit → vote
      actor.send({ type: 'TIME_UP' }) // vote → results

      expect(actor.getSnapshot().value).toBe('results')
      actor.stop()
    })

    it('should handle PAUSE and RESUME in vote phase', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      actor.send({ type: 'TIME_UP' }) // Move to vote
      expect(actor.getSnapshot().value).toBe('vote')

      actor.send({ type: 'PAUSE' })
      expect(actor.getSnapshot().context.isPaused).toBe(true)

      actor.send({ type: 'RESUME' })
      expect(actor.getSnapshot().context.isPaused).toBe(false)

      actor.stop()
    })
  })

  describe('results → complete transition', () => {
    it('should transition to complete when TIME_UP fires', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      actor.send({ type: 'TIME_UP' }) // submit → vote
      actor.send({ type: 'TIME_UP' }) // vote → results
      actor.send({ type: 'TIME_UP' }) // results → complete

      expect(actor.getSnapshot().value).toBe('complete')
      actor.stop()
    })

    it('should handle ADMIN_SKIP in results phase', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      actor.send({ type: 'TIME_UP' }) // submit → vote
      actor.send({ type: 'TIME_UP' }) // vote → results
      actor.send({ type: 'ADMIN_SKIP' }) // results → complete

      expect(actor.getSnapshot().value).toBe('complete')
      actor.stop()
    })
  })

  describe('timer context', () => {
    it('should store timer durations in context', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 90, voteTimer: 60, resultsTimer: 15 }
      })
      actor.start()

      const context = actor.getSnapshot().context
      expect(context.submitTimer).toBe(90)
      expect(context.voteTimer).toBe(60)
      expect(context.resultsTimer).toBe(15)

      actor.stop()
    })
  })

  describe('pause state', () => {
    it('should not accept TIME_UP when paused', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      actor.send({ type: 'PAUSE' })
      expect(actor.getSnapshot().context.isPaused).toBe(true)

      // Try to advance while paused
      actor.send({ type: 'TIME_UP' })

      // Should still be in submit phase
      expect(actor.getSnapshot().value).toBe('submit')

      actor.stop()
    })

    it('should allow TIME_UP after resume', () => {
      const actor = createActor(roundMachine, {
        input: { submitTimer: 60, voteTimer: 45, resultsTimer: 10 }
      })
      actor.start()

      actor.send({ type: 'PAUSE' })
      actor.send({ type: 'RESUME' })

      // Now should advance
      actor.send({ type: 'TIME_UP' })
      expect(actor.getSnapshot().value).toBe('vote')

      actor.stop()
    })
  })
})
