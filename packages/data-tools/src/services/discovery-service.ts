import { Pool } from 'pg'
import { RSSScraperService } from '../scrapers/rss-scraper'
import { CategoryDetector } from '../scrapers/category-detector'
import { LocalLLM } from '../llm/local-llm'
import { DatabaseQueries } from '../storage/db/queries'
import { RateLimiter } from '../utils/rate-limiter'
import { RetryHandler } from '../utils/retry-handler'
import { RobotsChecker } from '../utils/robots-checker'
import { getUserAgent } from '../utils/user-agent'
import { WaybackFetcher } from '../scrapers/wayback-fetcher'
import type { FeedSource } from '../types/feed'
import type { LocalLLMConfig } from '../llm/types'

export interface DiscoveryConfig {
  keywords: Record<string, string[]>
  llmConfig: LocalLLMConfig
  databaseUrl: string
  sampleSize?: number // Number of articles to sample for classification
  weirdThreshold?: number // Minimum number of weird articles to approve feed
  enableHistorical?: boolean // Fetch historical data via Wayback Machine (default: true)
  historicalYears?: number // Years of history to fetch (default: 10)
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
  private wayback: WaybackFetcher
  private pool: Pool

  constructor(private config: DiscoveryConfig) {
    this.rssScr = new RSSScraperService()
    this.categoryDetector = new CategoryDetector(config.keywords)
    this.llm = new LocalLLM(config.llmConfig)
    this.pool = new Pool({ connectionString: config.databaseUrl })
    this.db = new DatabaseQueries(this.pool)
    this.rateLimiter = new RateLimiter(2000, true) // 2 sec + random jitter
    this.retryHandler = new RetryHandler({
      maxRetries: 2, // Reduced retries to fail faster on 401s
      initialDelay: 500,
      backoffStrategy: 'exponential',
    })
    this.robotsChecker = new RobotsChecker(getUserAgent())
    this.wayback = new WaybackFetcher()
  }

  /**
   * Discover feeds from a domain
   */
  async discoverFromDomain(
    domain: string,
    language: string,
    country: string,
    sessionId?: string
  ): Promise<FeedSource[]> {
    const discoveredFeeds: FeedSource[] = []
    const baseUrl = `https://${domain}`
    let rejectionReason: string | null = null
    let sampleArticlesTested = 0
    let weirdArticlesFound = 0

    try {
      // Skip robots.txt check for content collection
      // We use respectful rate limiting and human-like behavior instead

      // Discover feed links
      console.log(`  Discovering RSS feeds...`)
      const feeds = await this.rateLimiter.throttle(domain, async () => {
        return await this.retryHandler.execute(async () => {
          return await this.rssScr.discoverFeeds(baseUrl)
        })
      })

      console.log(`  Found ${feeds.length} potential feeds, validating...`)

      if (feeds.length === 0) {
        rejectionReason = 'No RSS feeds found on homepage'
      }

      // Process each discovered feed
      for (let i = 0; i < feeds.length; i++) {
        const discoveredFeed = feeds[i]!
        try {
          console.log(`  [${i + 1}/${feeds.length}] Checking ${discoveredFeed.url}...`)
          const result = await this.processFeed(
            discoveredFeed.url,
            domain,
            language,
            country
          )

          if (result) {
            const { feedSource, stats } = result
            sampleArticlesTested += stats.tested
            weirdArticlesFound += stats.weird
            console.log(`    ✓ Validated (${feedSource.qualityScore}% weird content)`)
            discoveredFeeds.push(feedSource)
          } else {
            console.log(`    ✗ Not enough weird content`)
            if (!rejectionReason) {
              rejectionReason = 'Insufficient weird content in feeds'
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.log(`    ✗ Failed: ${errorMsg}`)
          if (!rejectionReason) {
            rejectionReason = errorMsg
          }
        }
      }

      // Log domain discovery attempt
      await this.db.insertDomainDiscovery({
        domain,
        hasSSL: baseUrl.startsWith('https'),
        feedsFound: feeds.length,
        sampleArticlesTested,
        weirdArticlesFound,
        feedsAdded: discoveredFeeds.map((f) => f.url),
        rejectionReason: discoveredFeeds.length === 0 ? rejectionReason : null,
        sessionId: sessionId ?? null,
      })
    } catch (error) {
      // Log failed discovery attempt
      await this.db.insertDomainDiscovery({
        domain,
        hasSSL: baseUrl.startsWith('https'),
        feedsFound: 0,
        sampleArticlesTested,
        weirdArticlesFound,
        feedsAdded: [],
        rejectionReason: error instanceof Error ? error.message : String(error),
        sessionId: sessionId ?? null,
      })
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
  ): Promise<{ feedSource: FeedSource; stats: { tested: number; weird: number } } | null> {
    // Parse feed
    console.log(`      Parsing RSS feed...`)
    const parsedFeed = await this.rateLimiter.throttle(domain, async () => {
      return await this.rssScr.parseFeed(feedUrl)
    })
    console.log(
      `      Found ${parsedFeed.items.length} articles (title: "${parsedFeed.title}")`
    )

    // Check if recently updated
    const isRecent = await this.rssScr.isRecentlyUpdated(feedUrl)
    if (!isRecent) {
      console.log(`      Feed is stale (no updates in 30 days)`)
      return null // Skip stale feeds
    }

    // Detect category from metadata
    const category = this.categoryDetector.detectFromFeedMetadata(parsedFeed, language)
    console.log(`      Category detected: ${category}`)

    // Sample articles for Ollama classification
    const sampleSize = this.config.sampleSize ?? 5
    const articlesToSample = parsedFeed.items.slice(0, sampleSize)
    let weirdCount = 0

    console.log(`      Classifying ${articlesToSample.length} articles with Ollama...`)
    for (let i = 0; i < articlesToSample.length; i++) {
      const article = articlesToSample[i]!
      try {
        const classification = await this.llm.classify(
          article.title,
          article.description ?? ''
        )

        const weirdMarker = classification.isWeird ? '🎭' : '📰'
        console.log(
          `        [${i + 1}/${articlesToSample.length}] ${weirdMarker} "${article.title.substring(0, 60)}..." (${classification.confidence}% confident)`
        )

        if (classification.isWeird && classification.confidence > 60) {
          weirdCount++
        }
      } catch (error) {
        console.log(
          `        [${i + 1}/${articlesToSample.length}] ❌ Classification failed: ${error instanceof Error ? error.message : error}`
        )
      }
    }

    console.log(`      Result: ${weirdCount}/${articlesToSample.length} weird articles`)

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

    // Collect historical data if enabled (default: true)
    const enableHistorical = this.config.enableHistorical ?? true
    const historicalYears = this.config.historicalYears ?? 10

    if (enableHistorical) {
      console.log(`      📚 Fetching ${historicalYears} years of historical data...`)
      try {
        const snapshots = await this.wayback.getYearlySnapshots(feedUrl, historicalYears)
        console.log(`      Found ${snapshots.length} yearly snapshots`)

        // TODO: Process and store historical articles
        // For now, just report the availability
        if (snapshots.length > 0) {
          console.log(`      ✓ Historical data available (${snapshots.length} snapshots)`)
        }
      } catch (error) {
        console.log(`      ⚠️  Historical fetch failed: ${error}`)
      }
    }

    return {
      feedSource: {
        id: feedId,
        ...feedSource,
      },
      stats: {
        tested: articlesToSample.length,
        weird: weirdCount,
      },
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

    for (let i = 0; i < domains.length; i++) {
      const { domain, language, country } = domains[i]!
      console.log(`\n[${i + 1}/${domains.length}] Processing ${domain}...`)

      try {
        const feeds = await this.discoverFromDomain(domain, language, country, sessionId)
        console.log(`  ✓ Found ${feeds.length} validated feeds`)
        allFeeds.push(...feeds)
      } catch (error) {
        console.log(`  ✗ Failed: ${error}`)
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

  /**
   * Get domain last check time for prioritization
   */
  async getDomainLastChecked(domain: string): Promise<Date | null> {
    return await this.db.getDomainLastChecked(domain)
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
