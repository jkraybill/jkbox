import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RateLimiter } from './rate-limiter'

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should allow first request immediately', async () => {
    const limiter = new RateLimiter(1000, false) // 1 req/sec, no jitter for tests
    const start = Date.now()

    await limiter.throttle('example.com', async () => 'result')

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(10) // Should be immediate
  })

  it('should delay second request by rate limit duration', async () => {
    const limiter = new RateLimiter(1000, false) // 1 req/sec, no jitter for tests

    const promise1 = limiter.throttle('example.com', async () => 'first')
    await promise1

    const start = Date.now()
    const promise2 = limiter.throttle('example.com', async () => 'second')

    // Fast-forward time
    await vi.advanceTimersByTimeAsync(1000)
    await promise2

    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(1000)
  })

  it('should track rate limits per domain independently', async () => {
    const limiter = new RateLimiter(1000, false)

    await limiter.throttle('example.com', async () => 'first')

    const start = Date.now()
    // Different domain should not be throttled
    await limiter.throttle('other.com', async () => 'second')

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(10)
  })

  it('should allow custom rate limit per domain', async () => {
    const limiter = new RateLimiter(1000, false)
    limiter.setDomainDelay('fast.com', 500) // 2 req/sec

    await limiter.throttle('fast.com', async () => 'first')

    const start = Date.now()
    const promise = limiter.throttle('fast.com', async () => 'second')
    await vi.advanceTimersByTimeAsync(500)
    await promise

    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(500)
    expect(elapsed).toBeLessThan(1000)
  })

  it('should execute function and return result', async () => {
    const limiter = new RateLimiter(1000, false)
    const fn = vi.fn(async () => 'test result')

    const result = await limiter.throttle('example.com', fn)

    expect(result).toBe('test result')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('should handle errors from throttled function', async () => {
    const limiter = new RateLimiter(1000, false)
    const error = new Error('test error')

    await expect(
      limiter.throttle('example.com', async () => {
        throw error
      })
    ).rejects.toThrow('test error')
  })

  it('should queue multiple requests for same domain', async () => {
    const limiter = new RateLimiter(500, false)
    const results: string[] = []

    const p1 = limiter.throttle('example.com', async () => {
      results.push('first')
      return 'first'
    })

    const p2 = limiter.throttle('example.com', async () => {
      results.push('second')
      return 'second'
    })

    const p3 = limiter.throttle('example.com', async () => {
      results.push('third')
      return 'third'
    })

    await p1
    await vi.advanceTimersByTimeAsync(500)
    await p2
    await vi.advanceTimersByTimeAsync(500)
    await p3

    expect(results).toEqual(['first', 'second', 'third'])
  })
})
