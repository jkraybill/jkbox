import robotsParser from 'robots-parser'
import axios from 'axios'

/**
 * Checks robots.txt compliance before scraping
 * Caches robots.txt for 24 hours per domain
 */
export class RobotsChecker {
  private cache: Map<string, CachedRobots> = new Map()
  private cacheT

TL: number = 24 * 60 * 60 * 1000 // 24 hours

  constructor(private userAgent: string) {}

  /**
   * Check if we can fetch a URL according to robots.txt
   */
  async canFetch(url: string): Promise<boolean> {
    const domain = this.extractDomain(url)
    const robots = await this.getRobots(domain)

    if (!robots) {
      // If robots.txt doesn't exist or fails to load, default to deny
      return false
    }

    return robots.isAllowed(url, this.userAgent) ?? false
  }

  /**
   * Get crawl delay for a domain (in milliseconds)
   */
  async getCrawlDelay(domain: string): Promise<number> {
    const robots = await this.getRobots(domain)

    if (!robots) {
      return 1000 // Default 1 second
    }

    const delaySec = robots.getCrawlDelay(this.userAgent)
    return delaySec ? delaySec * 1000 : 1000
  }

  private async getRobots(domain: string): Promise<robotsParser.Robot | null> {
    const cached = this.cache.get(domain)

    // Check cache
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.robots
    }

    // Fetch robots.txt
    try {
      const robotsUrl = `https://${domain}/robots.txt`
      const response = await axios.get(robotsUrl, {
        timeout: 5000,
        validateStatus: (status) => status === 200,
      })

      const robots = robotsParser(robotsUrl, response.data)
      this.cache.set(domain, { robots, timestamp: Date.now() })
      return robots
    } catch (error) {
      // robots.txt doesn't exist or failed to load
      // Cache null result to avoid repeated requests
      this.cache.set(domain, { robots: null, timestamp: Date.now() })
      return null
    }
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url)
      return parsed.hostname
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }
  }
}

interface CachedRobots {
  robots: robotsParser.Robot | null
  timestamp: number
}
