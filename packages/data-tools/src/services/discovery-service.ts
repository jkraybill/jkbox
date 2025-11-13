import { Pool } from 'pg'
import { RSSScraperService } from '../scrapers/rss-scraper'
import { CategoryDetector } from '../scrapers/category-detector'
import { LocalLLM } from '../llm/local-llm'
import { DatabaseQueries } from '../storage/db/queries'
import { RateLimiter } from '../utils/rate-limiter'
import { RetryHandler } from '../utils/retry-handler'
import { RobotsChecker } from '../utils/robots-checker'
import { getUserAgent } from '../utils/user-agent'
import type { FeedSource } from '../types/feed'
import type { LocalLLMConfig } from '../llm/types'

export interface DiscoveryConfig {
  keywords: Record<string, string[]>
  llmConfig: LocalLLMConfig
  databaseUrl: string
  sampleSize?: number // Number of articles to sample for classification
  weirdThreshold?: number // Minimum number of weird articles to approve feed
}

export interface DiscoveryResult {
  sessionId: string
  feedsDiscovered: FeedSource[]
  domainsEvaluated: number
  errors: string[]
}

/**
 * Main discovery orchestrator
 * Coordinates feed discovery, classification, and storage
 */
export class DiscoveryService {
  private rssScr: RSSScraperService
  private categoryDetector: CategoryDetector
  private llm: LocalLLM
  private db: DatabaseQueries
  private rateLimiter: RateLimiter
  private retryHandler: RetryHandler
  private robotsChecker: RobotsChecker
  private pool: Pool

  constructor(private config: DiscoveryConfig) {
    this.rssScr = new RSSScraperService()
    this.categoryDetector = new CategoryDetector(config.keywords)
    this.llm = new LocalLLM(config.llmConfig)
    this.pool = new Pool({ connectionString: config.databaseUrl })
    this.db = new DatabaseQueries(this.pool)
    this.rateLimiter = new RateLimiter(2000, true) // 2 sec + random jitter
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 1000,
      backoffStrategy: 'exponential',
    })
    this.robotsChecker = new RobotsChecker(getUserAgent())
  }

  /**
   * Discover feeds from a domain
   */
  async discoverFromDomain(
    domain: string,
    language: string,
    country: string
  ): Promise<FeedSource[]> {
    const discoveredFeeds: FeedSource[] = []
    const baseUrl = `https://${domain}`

    try {
      // Skip robots.txt check for content collection
      // We use respectful rate limiting and human-like behavior instead

      // Discover feed links
      const feeds = await this.rateLimiter.throttle(domain, async () => {
        return await this.retryHandler.execute(async () => {
          return await this.rssScr.discoverFeeds(baseUrl)
        })
      })

      // Process each discovered feed
      for (const discoveredFeed of feeds) {
        try {
          const feedSource = await this.processFeed(
            discoveredFeed.url,
            domain,
            language,
            country
          )

          if (feedSource) {
            discoveredFeeds.push(feedSource)
          }
        } catch (error) {
          console.error(`Failed to process feed ${discoveredFeed.url}:`, error)
        }
      }
    } catch (error) {
      throw new Error(`Failed to discover feeds on ${domain}: ${error}`)
    }

    return discoveredFeeds
  }

  /**
   * Process a single feed: parse, classify, validate
   */
  private async processFeed(
    feedUrl: string,
    domain: string,
    language: string,
    country: string
  ): Promise<FeedSource | null> {
    // Parse feed
    const parsedFeed = await this.rateLimiter.throttle(domain, async () => {
      return await this.rssScr.parseFeed(feedUrl)
    })

    // Check if recently updated
    const isRecent = await this.rssScr.isRecentlyUpdated(feedUrl)
    if (!isRecent) {
      return null // Skip stale feeds
    }

    // Detect category from metadata
    const category = this.categoryDetector.detectFromFeedMetadata(parsedFeed, language)

    // Sample articles for Ollama classification
    const sampleSize = this.config.sampleSize ?? 5
    const articlesToSample = parsedFeed.items.slice(0, sampleSize)
    let weirdCount = 0

    for (const article of articlesToSample) {
      try {
        const classification = await this.llm.classify(
          article.title,
          article.description ?? ''
        )

        if (classification.isWeird && classification.confidence > 60) {
          weirdCount++
        }
      } catch (error) {
        console.error(`Ollama classification failed for ${article.title}:`, error)
      }
    }

    // Check if feed meets weird threshold
    const weirdThreshold = this.config.weirdThreshold ?? 1 // At least 1 weird article
    const isValidated = weirdCount >= weirdThreshold

    // Only save if validated
    if (!isValidated) {
      return null
    }

    // Create FeedSource object
    const feedSource: Omit<FeedSource, 'id'> = {
      url: feedUrl,
      newspaperName: this.extractNewspaperName(domain),
      domain,
      country,
      language,
      category: category === 'weird' ? 'weird' : 'unknown',
      keywords: this.config.keywords[language] ?? [],
      title: parsedFeed.title,
      description: parsedFeed.description ?? null,
      lastBuildDate: parsedFeed.lastBuildDate ? new Date(parsedFeed.lastBuildDate) : null,
      discoveredAt: new Date(),
      lastCheckedAt: new Date(),
      lastSuccessfulFetchAt: new Date(),
      articleCount: parsedFeed.items.length,
      updateFrequency: 0, // TODO: Calculate from article timestamps
      qualityScore: this.calculateQualityScore(weirdCount, articlesToSample.length),
      isActive: true,
      isValidated,
      errors: [],
    }

    // Save to database
    const feedId = await this.db.insertFeedSource(feedSource)

    return {
      id: feedId,
      ...feedSource,
    }
  }

  /**
   * Run discovery on multiple domains
   */
  async discoverFromDomains(
    domains: Array<{ domain: string; language: string; country: string }>
  ): Promise<DiscoveryResult> {
    const sessionId = await this.db.createDiscoverySession(domains.map((d) => d.domain))
    const allFeeds: FeedSource[] = []
    const errors: string[] = []

    for (const { domain, language, country } of domains) {
      try {
        const feeds = await this.discoverFromDomain(domain, language, country)
        allFeeds.push(...feeds)
      } catch (error) {
        errors.push(`${domain}: ${error}`)
      }
    }

    // Update session stats
    await this.db.updateDiscoverySession(sessionId, {
      completedAt: new Date(),
      domainsEvaluated: domains.length,
      feedsDiscovered: allFeeds.length,
      feedsValidated: allFeeds.filter((f) => f.isValidated).length,
      feedsFailed: errors.length,
      errors,
    })

    return {
      sessionId,
      feedsDiscovered: allFeeds,
      domainsEvaluated: domains.length,
      errors,
    }
  }

  /**
   * Get discovered feeds by language
   */
  async getFeedsByLanguage(language: string, limit?: number): Promise<FeedSource[]> {
    return await this.db.getFeedsByLanguage(language, limit)
  }

  private extractNewspaperName(domain: string): string {
    // Simple heuristic: capitalize domain name without TLD
    return domain
      .split('.')[0]!
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private calculateQualityScore(weirdCount: number, totalSampled: number): number {
    if (totalSampled === 0) return 0
    const ratio = weirdCount / totalSampled
    return Math.round(ratio * 100)
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
