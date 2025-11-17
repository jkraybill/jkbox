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

  it('should strip non-alphabetic characters before lookup', async () => {
    // 'TEST123' strips to 'TEST' and looks up TEST's frequency
    const scoreWithNumbers = await scoreWordByFrequency('TEST123')
    const scoreTest = await scoreWordByFrequency('TEST')
    expect(scoreWithNumbers).toBe(scoreTest) // Both should be the same (TEST's frequency)
    expect(scoreWithNumbers).toBeGreaterThan(0) // TEST is in the wordlist

    // Pure numbers return 0 (no alphabetic characters)
    const scoreNumbers = await scoreWordByFrequency('42')
    expect(scoreNumbers).toBe(0)

    // Contractions: "you're" → "youre"
    const scoreContraction = await scoreWordByFrequency("you're")
    const scoreNoApostrophe = await scoreWordByFrequency('youre')
    expect(scoreContraction).toBe(scoreNoApostrophe) // Should be the same

    // Hyphenated words: "test-word" → "testword"
    const scoreHyphen = await scoreWordByFrequency('test-word')
    const scoreNoHyphen = await scoreWordByFrequency('testword')
    expect(scoreHyphen).toBe(scoreNoHyphen) // Should be the same
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
