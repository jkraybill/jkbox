import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { roomMachine } from './room-machine'

describe('roomMachine', () => {
  describe('initial state', () => {
    it('should start in lobby state', () => {
      const actor = createActor(roomMachine)
      actor.start()

      expect(actor.getSnapshot().value).toBe('lobby')
      actor.stop()
    })
  })

  describe('lobby → playing transition', () => {
    it('should transition to playing when START_GAME event fires with enough players', () => {
      const actor = createActor(roomMachine, {
        input: { playerCount: 3 }
      })
      actor.start()

      actor.send({ type: 'START_GAME' })

      expect(actor.getSnapshot().value).toBe('playing')
      actor.stop()
    })

    it('should NOT transition if less than 3 players', () => {
      const actor = createActor(roomMachine, {
        input: { playerCount: 2 }
      })
      actor.start()

      actor.send({ type: 'START_GAME' })

      // Should remain in lobby
      expect(actor.getSnapshot().value).toBe('lobby')
      actor.stop()
    })

    it('should handle dynamic player count updates', () => {
      const actor = createActor(roomMachine, {
        input: { playerCount: 2 }
      })
      actor.start()

      // Try to start with 2 players - should fail
      actor.send({ type: 'START_GAME' })
      expect(actor.getSnapshot().value).toBe('lobby')

      // Update player count
      actor.send({ type: 'UPDATE_PLAYER_COUNT', count: 4 })

      // Now should succeed
      actor.send({ type: 'START_GAME' })
      expect(actor.getSnapshot().value).toBe('playing')
      actor.stop()
    })
  })

  describe('playing → finished transition', () => {
    it('should transition to finished when GAME_END event fires', () => {
      const actor = createActor(roomMachine, {
        input: { playerCount: 3 }
      })
      actor.start()

      actor.send({ type: 'START_GAME' })
      expect(actor.getSnapshot().value).toBe('playing')

      actor.send({ type: 'GAME_END' })
      expect(actor.getSnapshot().value).toBe('finished')
      actor.stop()
    })

    it('should not accept START_GAME when playing', () => {
      const actor = createActor(roomMachine, {
        input: { playerCount: 3 }
      })
      actor.start()

      actor.send({ type: 'START_GAME' })
      expect(actor.getSnapshot().value).toBe('playing')

      // Try to start again - should be ignored
      actor.send({ type: 'START_GAME' })
      expect(actor.getSnapshot().value).toBe('playing')
      actor.stop()
    })
  })

  describe('finished → lobby transition', () => {
    it('should transition back to lobby when RESET event fires', () => {
      const actor = createActor(roomMachine, {
        input: { playerCount: 3 }
      })
      actor.start()

      actor.send({ type: 'START_GAME' })
      actor.send({ type: 'GAME_END' })
      expect(actor.getSnapshot().value).toBe('finished')

      actor.send({ type: 'RESET' })
      expect(actor.getSnapshot().value).toBe('lobby')
      actor.stop()
    })
  })

  describe('context management', () => {
    it('should track player count in context', () => {
      const actor = createActor(roomMachine, {
        input: { playerCount: 5 }
      })
      actor.start()

      expect(actor.getSnapshot().context.playerCount).toBe(5)
      actor.stop()
    })

    it('should update player count on UPDATE_PLAYER_COUNT event', () => {
      const actor = createActor(roomMachine, {
        input: { playerCount: 3 }
      })
      actor.start()

      actor.send({ type: 'UPDATE_PLAYER_COUNT', count: 8 })

      expect(actor.getSnapshot().context.playerCount).toBe(8)
      actor.stop()
    })
  })
})
