/**
 * Retry handler with configurable backoff strategies
 * Handles transient failures with exponential or linear backoff
 */

export interface RetryOptions {
  maxRetries: number
  initialDelay: number // milliseconds
  maxDelay?: number // milliseconds, caps exponential growth
  backoffStrategy?: 'exponential' | 'linear'
  isRetryable?: (error: unknown) => boolean
  onRetry?: (error: unknown, attempt: number, delay: number) => void
}

export class RetryHandler {
  private options: Required<RetryOptions>

  constructor(options: RetryOptions) {
    this.options = {
      maxRetries: options.maxRetries,
      initialDelay: options.initialDelay,
      maxDelay: options.maxDelay ?? Infinity,
      backoffStrategy: options.backoffStrategy ?? 'exponential',
      isRetryable: options.isRetryable ?? (() => true),
      onRetry: options.onRetry ?? (() => {}),
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown
    let attempt = 0

    while (attempt <= this.options.maxRetries) {
      try {
        return await fn()
      } catch (error) {
        lastError = error

        // Check if we should retry
        if (attempt >= this.options.maxRetries || !this.options.isRetryable(error)) {
          throw error
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt)

        // Call onRetry callback
        this.options.onRetry(error, attempt + 1, delay)

        // Wait before retry
        await this.sleep(delay)

        attempt++
      }
    }

    throw lastError
  }

  private calculateDelay(attempt: number): number {
    let delay: number

    if (this.options.backoffStrategy === 'exponential') {
      // Exponential: initialDelay * 2^attempt
      delay = this.options.initialDelay * Math.pow(2, attempt)
    } else {
      // Linear: constant delay
      delay = this.options.initialDelay
    }

    // Cap at maxDelay
    return Math.min(delay, this.options.maxDelay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
