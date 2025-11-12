import { describe, it, expect } from 'vitest'
import { generateSessionToken, generatePlayerId } from './session-token'

describe('session token utilities', () => {
  describe('generateSessionToken', () => {
    it('should generate a string token', () => {
      const token = generateSessionToken()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        tokens.add(generateSessionToken())
      }

      // All tokens should be unique
      expect(tokens.size).toBe(1000)
    })

    it('should generate tokens with sufficient entropy', () => {
      const token = generateSessionToken()
      // Should be hex string of at least 32 chars (16 bytes)
      expect(token.length).toBeGreaterThanOrEqual(32)
      expect(token).toMatch(/^[a-f0-9]+$/)
    })
  })

  describe('generatePlayerId', () => {
    it('should generate a string ID', () => {
      const id = generatePlayerId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        ids.add(generatePlayerId())
      }

      // All IDs should be unique
      expect(ids.size).toBe(1000)
    })

    it('should start with player- prefix', () => {
      const id = generatePlayerId()
      expect(id).toMatch(/^player-[a-f0-9]+$/)
    })
  })
})
