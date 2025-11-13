import type { ParsedFeed, DiscoveredFeed } from './rss-scraper'
import type { FeedCategory } from '../types/feed'

/**
 * Detects feed category (weird/offbeat/general) using multiple signals:
 * - Feed title/description keywords
 * - URL patterns
 * - Article content sampling
 * - RSS category tags
 */
export class CategoryDetector {
  constructor(private keywords: Record<string, string[]>) {}

  /**
   * Detect category from feed metadata (title, description)
   */
  detectFromFeedMetadata(feed: ParsedFeed, language: string): FeedCategory {
    const languageKeywords = this.keywords[language] ?? []
    const searchText = `${feed.title} ${feed.description ?? ''}`.toLowerCase()

    for (const keyword of languageKeywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return 'weird'
      }
    }

    return 'unknown'
  }

  /**
   * Detect category from feed URL
   */
  detectFromUrl(discoveredFeed: DiscoveredFeed, language: string): FeedCategory {
    const languageKeywords = this.keywords[language] ?? []
    const urlLower = discoveredFeed.url.toLowerCase()

    for (const keyword of languageKeywords) {
      if (urlLower.includes(keyword.toLowerCase())) {
        return 'weird'
      }
    }

    return 'unknown'
  }

  /**
   * Detect category from article sampling
   * Checks if a minimum percentage of articles contain weird keywords
   */
  detectFromArticles(
    feed: ParsedFeed,
    language: string,
    threshold = 0.3 // 30% of articles must be weird
  ): FeedCategory {
    if (feed.items.length === 0) {
      return 'unknown'
    }

    const languageKeywords = this.keywords[language] ?? []
    let weirdArticles = 0

    for (const item of feed.items) {
      const searchText = `${item.title} ${item.description ?? ''} ${item.categories.join(' ')}`.toLowerCase()

      for (const keyword of languageKeywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          weirdArticles++
          break // Count each article only once
        }
      }
    }

    const weirdRatio = weirdArticles / feed.items.length

    return weirdRatio >= threshold ? 'weird' : 'unknown'
  }

  /**
   * Combined detection using multiple signals
   * Priority: URL > Feed metadata > Article sampling
   */
  detectCombined(
    feed: ParsedFeed,
    discoveredFeed: DiscoveredFeed,
    language: string
  ): FeedCategory {
    // Check URL first (strongest signal)
    const urlCategory = this.detectFromUrl(discoveredFeed, language)
    if (urlCategory === 'weird') {
      return 'weird'
    }

    // Check feed metadata
    const metadataCategory = this.detectFromFeedMetadata(feed, language)
    if (metadataCategory === 'weird') {
      return 'weird'
    }

    // Finally check article sampling
    return this.detectFromArticles(feed, language)
  }
}
