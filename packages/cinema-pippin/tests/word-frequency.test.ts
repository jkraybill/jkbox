import { describe, it, expect, beforeEach } from 'vitest'
import { scoreWordByFrequency, clearWordFrequencyCache } from '../src/word-frequency'

describe('Word Frequency Module', () => {
  beforeEach(() => {
    // Clear cache between tests to ensure clean state
    clearWordFrequencyCache()
  })

  it('should return frequency score for common word (THE)', async () => {
    const score = await scoreWordByFrequency('THE')
    expect(score).toBe(2287073)
  })

  it('should return frequency score for lowercase common word (the)', async () => {
    const score = await scoreWordByFrequency('the')
    expect(score).toBe(2287073)
  })

  it('should return frequency score for mid-frequency word', async () => {
    const score = await scoreWordByFrequency('WITH')
    expect(score).toBe(355036)
  })

  it('should return 0 for word not in list', async () => {
    const score = await scoreWordByFrequency('XYZABC123NOTREAL')
    expect(score).toBe(0)
  })

  it('should return 0 for empty string', async () => {
    const score = await scoreWordByFrequency('')
    expect(score).toBe(0)
  })

  it('should lazy-load wordlist on first call', async () => {
    // First call should trigger load
    const score1 = await scoreWordByFrequency('TO')
    expect(score1).toBe(1751592)

    // Second call should use cached map
    const score2 = await scoreWordByFrequency('A')
    expect(score2).toBe(1533597)
  })

  it('should handle words with numbers', async () => {
    const score = await scoreWordByFrequency('TEST123')
    expect(score).toBe(0) // Assuming not in wordlist
  })

  it('should normalize case (uppercase all lookups)', async () => {
    const upper = await scoreWordByFrequency('AND')
    const lower = await scoreWordByFrequency('and')
    const mixed = await scoreWordByFrequency('AnD')

    expect(upper).toBe(1383230)
    expect(lower).toBe(1383230)
    expect(mixed).toBe(1383230)
  })
})
