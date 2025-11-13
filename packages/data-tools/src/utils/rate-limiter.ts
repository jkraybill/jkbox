/**
 * Rate limiter that throttles requests per domain
 * Respects robots.txt Crawl-delay and custom rate limits
 */
export class RateLimiter {
  private queues: Map<string, RequestQueue> = new Map()
  private defaultDelay: number

  constructor(defaultDelayMs: number = 1000) {
    this.defaultDelay = defaultDelayMs
  }

  /**
   * Throttle a function call for a specific domain
   * Queues requests and enforces rate limit
   */
  async throttle<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    const queue = this.getOrCreateQueue(domain)
    return queue.enqueue(fn)
  }

  /**
   * Set custom delay for a specific domain
   * Useful for respecting Crawl-delay from robots.txt
   */
  setDomainDelay(domain: string, delayMs: number): void {
    const queue = this.getOrCreateQueue(domain)
    queue.setDelay(delayMs)
  }

  private getOrCreateQueue(domain: string): RequestQueue {
    if (!this.queues.has(domain)) {
      this.queues.set(domain, new RequestQueue(this.defaultDelay))
    }
    return this.queues.get(domain)!
  }
}

/**
 * Queue for managing requests to a single domain
 */
class RequestQueue {
  private queue: Array<QueuedRequest<unknown>> = []
  private lastRequestTime: number = 0
  private delay: number
  private processing: boolean = false

  constructor(delay: number) {
    this.delay = delay
  }

  setDelay(delayMs: number): void {
    this.delay = delayMs
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject })
      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      const timeToWait = Math.max(0, this.delay - timeSinceLastRequest)

      if (timeToWait > 0) {
        await this.sleep(timeToWait)
      }

      const request = this.queue.shift()!
      this.lastRequestTime = Date.now()

      try {
        const result = await request.fn()
        request.resolve(result)
      } catch (error) {
        request.reject(error)
      }
    }

    this.processing = false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

interface QueuedRequest<T> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}
