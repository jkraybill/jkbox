import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { connectionMachine } from './connection-machine'

describe('connectionMachine', () => {
  describe('initial state', () => {
    it('should start in disconnected state', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      expect(actor.getSnapshot().value).toBe('disconnected')
      actor.stop()
    })
  })

  describe('disconnected → connecting transition', () => {
    it('should transition to connecting when CONNECT event fires', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })

      expect(actor.getSnapshot().value).toBe('connecting')
      actor.stop()
    })
  })

  describe('connecting → connected transition', () => {
    it('should transition to connected when CONNECTED event fires', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECTED' })

      expect(actor.getSnapshot().value).toBe('connected')
      actor.stop()
    })

    it('should reset retry count when connected', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECT_ERROR' }) // Increment retry
      expect(actor.getSnapshot().context.retryCount).toBe(1)

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECTED' })

      // Retry count should reset
      expect(actor.getSnapshot().context.retryCount).toBe(0)
      actor.stop()
    })
  })

  describe('connecting → reconnecting transition (on error)', () => {
    it('should transition to reconnecting when CONNECT_ERROR fires', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECT_ERROR' })

      expect(actor.getSnapshot().value).toBe('reconnecting')
      actor.stop()
    })

    it('should increment retry count on error', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      expect(actor.getSnapshot().context.retryCount).toBe(0)

      actor.send({ type: 'CONNECT_ERROR' })
      expect(actor.getSnapshot().context.retryCount).toBe(1)

      actor.stop()
    })

    it('should not exceed max retries', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      // Try to connect and fail 10 times
      for (let i = 0; i < 10; i++) {
        actor.send({ type: 'CONNECT' })
        actor.send({ type: 'CONNECT_ERROR' })
      }

      // Retry count should cap at max (5)
      expect(actor.getSnapshot().context.retryCount).toBeLessThanOrEqual(5)
      actor.stop()
    })
  })

  describe('connected → disconnected transition', () => {
    it('should transition to disconnected when DISCONNECT fires', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECTED' })
      actor.send({ type: 'DISCONNECT' })

      expect(actor.getSnapshot().value).toBe('disconnected')
      actor.stop()
    })
  })

  describe('connected → reconnecting transition (unexpected disconnect)', () => {
    it('should transition to reconnecting when CONNECTION_LOST fires', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECTED' })
      actor.send({ type: 'CONNECTION_LOST' })

      expect(actor.getSnapshot().value).toBe('reconnecting')
      actor.stop()
    })

    it('should increment retry count on unexpected disconnect', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECTED' })

      expect(actor.getSnapshot().context.retryCount).toBe(0)

      actor.send({ type: 'CONNECTION_LOST' })
      expect(actor.getSnapshot().context.retryCount).toBe(1)

      actor.stop()
    })
  })

  describe('reconnecting → connecting transition', () => {
    it('should transition to connecting when RETRY fires', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECT_ERROR' })

      expect(actor.getSnapshot().value).toBe('reconnecting')

      actor.send({ type: 'RETRY' })
      expect(actor.getSnapshot().value).toBe('connecting')

      actor.stop()
    })
  })

  describe('reconnecting → disconnected transition (give up)', () => {
    it('should transition to disconnected when GIVE_UP fires', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECT_ERROR' })
      actor.send({ type: 'GIVE_UP' })

      expect(actor.getSnapshot().value).toBe('disconnected')
      actor.stop()
    })
  })

  describe('retry delay calculation', () => {
    it('should calculate exponential backoff delay', () => {
      const actor = createActor(connectionMachine)
      actor.start()

      // First retry: 1s
      actor.send({ type: 'CONNECT' })
      actor.send({ type: 'CONNECT_ERROR' })
      expect(actor.getSnapshot().context.retryDelay).toBe(1000)

      // Second retry: 2s
      actor.send({ type: 'RETRY' })
      actor.send({ type: 'CONNECT_ERROR' })
      expect(actor.getSnapshot().context.retryDelay).toBe(2000)

      // Third retry: 4s
      actor.send({ type: 'RETRY' })
      actor.send({ type: 'CONNECT_ERROR' })
      expect(actor.getSnapshot().context.retryDelay).toBe(4000)

      actor.stop()
    })
  })
})
