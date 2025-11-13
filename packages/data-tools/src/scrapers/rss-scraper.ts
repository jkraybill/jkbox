import Parser from 'rss-parser'
import axios from 'axios'
import { load } from 'cheerio'

/**
 * RSS/Atom feed scraper service
 * Discovers and parses RSS feeds from news sources
 */
export class RSSScraperService {
  private parser: Parser

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'jkbox-data-collector/0.1.0 (+https://github.com/jkraybill/jkbox; data@jkbox.party)',
      },
    })
  }

  /**
   * Parse an RSS/Atom feed from URL
   */
  async parseFeed(url: string): Promise<ParsedFeed> {
    try {
      const feed = await this.parser.parseURL(url)

      return {
        title: feed.title ?? '',
        description: feed.description,
        link: feed.link ?? url,
        lastBuildDate: feed.lastBuildDate,
        items: feed.items.map((item) => ({
          title: item.title ?? '',
          link: item.link ?? '',
          description: item.contentSnippet ?? item.content,
          content: item.content,
          author: item.creator ?? item.author,
          pubDate: item.pubDate ? new Date(item.pubDate) : undefined,
          categories: item.categories ?? [],
        })),
      }
    } catch (error) {
      throw new Error(`Failed to parse feed ${url}: ${error}`)
    }
  }

  /**
   * Discover RSS feed links on a webpage
   * Looks for <link rel="alternate" type="application/rss+xml"> tags
   */
  async discoverFeeds(url: string): Promise<DiscoveredFeed[]> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'jkbox-data-collector/0.1.0',
        },
      })

      const $ = load(response.data)
      const feeds: DiscoveredFeed[] = []

      // Find RSS and Atom feed links
      $('link[rel="alternate"]').each((_, element) => {
        const type = $(element).attr('type')
        const href = $(element).attr('href')
        const title = $(element).attr('title')

        if (
          href &&
          (type === 'application/rss+xml' || type === 'application/atom+xml')
        ) {
          // Resolve relative URLs
          const feedUrl = new URL(href, url).toString()
          feeds.push({
            url: feedUrl,
            title: title ?? undefined,
          })
        }
      })

      return feeds
    } catch (error) {
      throw new Error(`Failed to discover feeds on ${url}: ${error}`)
    }
  }

  /**
   * Check if feed has been updated within the last 30 days
   */
  async isRecentlyUpdated(feedUrl: string, daysThreshold = 30): Promise<boolean> {
    try {
      const feed = await this.parseFeed(feedUrl)

      if (feed.items.length === 0) {
        return false
      }

      // Check most recent article
      const mostRecent = feed.items[0]
      if (!mostRecent?.pubDate) {
        return false
      }

      const now = new Date()
      const daysSinceUpdate =
        (now.getTime() - mostRecent.pubDate.getTime()) / (1000 * 60 * 60 * 24)

      return daysSinceUpdate <= daysThreshold
    } catch {
      return false
    }
  }
}

export interface ParsedFeed {
  title: string
  description?: string
  link: string
  lastBuildDate?: string
  items: FeedItem[]
}

export interface FeedItem {
  title: string
  link: string
  description?: string
  content?: string
  author?: string
  pubDate?: Date
  categories: string[]
}

export interface DiscoveredFeed {
  url: string
  title?: string
}
