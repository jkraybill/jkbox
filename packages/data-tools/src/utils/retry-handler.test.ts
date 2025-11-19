import { describe, it, expect, vi } from 'vitest'
import { RetryHandler } from './retry-handler'

describe('RetryHandler', () => {
  it('should return result on first success', async () => {
    const handler = new RetryHandler({ maxRetries: 3, initialDelay: 100 })
    const fn = vi.fn(async () => 'success')

    const result = await handler.execute(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('should retry on failure and eventually succeed', async () => {
    const handler = new RetryHandler({ maxRetries: 3, initialDelay: 100 })
    let attempts = 0
    const fn = vi.fn(async () => {
      attempts++
      if (attempts < 3) throw new Error('temporary failure')
      return 'success'
    })

    const result = await handler.execute(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after max retries exceeded', async () => {
    const handler = new RetryHandler({ maxRetries: 2, initialDelay: 10 })
    const error = new Error('persistent failure')
    const fn = vi.fn(async () => {
      throw error
    })

    await expect(handler.execute(fn)).rejects.toThrow('persistent failure')
    expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('should use exponential backoff', async () => {
    const handler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 100,
      backoffStrategy: 'exponential',
    })

    let attempts = 0
    const timestamps: number[] = []

    const fn = vi.fn(async () => {
      timestamps.push(Date.now())
      attempts++
      if (attempts < 4) throw new Error('retry')
      return 'done'
    })

    await handler.execute(fn)

    // Check delays: should be ~100ms, ~200ms, ~400ms
    expect(timestamps.length).toBe(4)
    const delay1 = timestamps[1]! - timestamps[0]!
    const delay2 = timestamps[2]! - timestamps[1]!
    const delay3 = timestamps[3]! - timestamps[2]!

    expect(delay1).toBeGreaterThanOrEqual(90)
    expect(delay1).toBeLessThanOrEqual(150)

    expect(delay2).toBeGreaterThanOrEqual(180)
    expect(delay2).toBeLessThanOrEqual(250)

    expect(delay3).toBeGreaterThanOrEqual(350)
    expect(delay3).toBeLessThanOrEqual(500)
  })

  it('should use linear backoff', async () => {
    vi.useFakeTimers()

    const handler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 100,
      backoffStrategy: 'linear',
    })

    let attempts = 0
    const timestamps: number[] = []

    const fn = vi.fn(async () => {
      timestamps.push(Date.now())
      attempts++
      if (attempts < 4) throw new Error('retry')
      return 'done'
    })

    const executePromise = handler.execute(fn)

    // Advance time through each retry
    await vi.advanceTimersByTimeAsync(100) // First retry
    await vi.advanceTimersByTimeAsync(100) // Second retry
    await vi.advanceTimersByTimeAsync(100) // Third retry

    await executePromise

    // Check delays: should all be exactly 100ms (with fake timers)
    expect(timestamps.length).toBe(4)
    const delay1 = timestamps[1]! - timestamps[0]!
    const delay2 = timestamps[2]! - timestamps[1]!
    const delay3 = timestamps[3]! - timestamps[2]!

    expect(delay1).toBe(100)
    expect(delay2).toBe(100)
    expect(delay3).toBe(100)

    vi.useRealTimers()
  })

  it('should only retry on retryable errors', async () => {
    const handler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 10,
      isRetryable: (error) => {
        return error instanceof Error && error.message.includes('RETRY')
      },
    })

    const fn = vi.fn(async () => {
      throw new Error('FATAL: do not retry')
    })

    await expect(handler.execute(fn)).rejects.toThrow('FATAL')
    expect(fn).toHaveBeenCalledOnce() // No retries
  })

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn()
    const handler = new RetryHandler({
      maxRetries: 2,
      initialDelay: 10,
      onRetry,
    })

    let attempts = 0
    const fn = vi.fn(async () => {
      attempts++
      if (attempts < 3) throw new Error(`attempt ${attempts}`)
      return 'success'
    })

    await handler.execute(fn)

    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: 'attempt 1' }),
      1,
      expect.any(Number)
    )
    expect(onRetry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: 'attempt 2' }),
      2,
      expect.any(Number)
    )
  })

  it('should respect max delay cap', async () => {
    vi.useFakeTimers()

    const handler = new RetryHandler({
      maxRetries: 5,
      initialDelay: 50,
      maxDelay: 100,
      backoffStrategy: 'exponential',
    })

    let attempts = 0
    const timestamps: number[] = []

    const fn = vi.fn(async () => {
      timestamps.push(Date.now())
      attempts++
      if (attempts < 6) throw new Error('retry')
      return 'done'
    })

    const executePromise = handler.execute(fn)

    // Advance through delays: 50, 100, 100 (capped), 100 (capped), 100 (capped)
    await vi.advanceTimersByTimeAsync(50)  // First retry
    await vi.advanceTimersByTimeAsync(100) // Second retry
    await vi.advanceTimersByTimeAsync(100) // Third retry (capped)
    await vi.advanceTimersByTimeAsync(100) // Fourth retry (capped)
    await vi.advanceTimersByTimeAsync(100) // Fifth retry (capped)

    await executePromise

    // Later delays should be capped at maxDelay (100ms)
    // exponential would be: 50, 100, 200, 400, 800
    // but capped at:       50, 100, 100, 100, 100
    const delay1 = timestamps[1]! - timestamps[0]!
    const delay2 = timestamps[2]! - timestamps[1]!
    const delay3 = timestamps[3]! - timestamps[2]!
    const delay4 = timestamps[4]! - timestamps[3]!
    const delay5 = timestamps[5]! - timestamps[4]!

    expect(delay1).toBe(50)  // First delay uncapped
    expect(delay2).toBe(100) // Second delay at cap
    expect(delay3).toBe(100) // Capped
    expect(delay4).toBe(100) // Capped
    expect(delay5).toBe(100) // Capped

    vi.useRealTimers()
  })
})
