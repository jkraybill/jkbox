import axios from 'axios'
import { parseStringPromise } from 'xml2js'

/**
 * RSS-focused web search service
 * Searches for direct RSS/feed URLs instead of just domains
 */
export class RSSSearchService {
  private readonly serpApiKey: string | undefined

  constructor() {
    this.serpApiKey = process.env.SERPAPI_KEY
  }

  /**
   * Generate RSS-specific search queries for a language
   */
  generateRSSQueries(languageConfig: {
    language: string
    country: string
    weirdKeywords: string[]
  }): string[] {
    const { language, country, weirdKeywords } = languageConfig
    const queries: string[] = []

    // Direct RSS searches
    for (const keyword of weirdKeywords) {
      queries.push(`"${keyword}" rss feed ${country}`)
      queries.push(`"${keyword}" news feed ${country}`)
      queries.push(`"${keyword}" atom feed`)
    }

    // inurl: searches (highly targeted)
    queries.push(`inurl:rss ${weirdKeywords[0]} news ${country}`)
    queries.push(`inurl:feed ${weirdKeywords[0]} ${country}`)
    queries.push(`inurl:atom ${weirdKeywords[0]} ${country}`)

    // File extension searches
    queries.push(`filetype:xml ${weirdKeywords[0]} news ${country}`)
    queries.push(`site:${country.toLowerCase()} "rss feed" ${weirdKeywords.join(' OR ')}`)

    return queries
  }

  /**
   * Extract potential RSS URLs from text
   */
  extractRSSUrls(text: string, baseUrl?: string): string[] {
    const urls = new Set<string>()

    // Match URLs that look like RSS feeds
    const patterns = [
      /https?:\/\/[^\s<>"]+?\/rss\/?(?:[^\s<>"]*)?/gi,
      /https?:\/\/[^\s<>"]+?\/feed\/?(?:[^\s<>"]*)?/gi,
      /https?:\/\/[^\s<>"]+?\/atom\/?(?:[^\s<>"]*)?/gi,
      /https?:\/\/[^\s<>"]+?\.xml(?:[^\s<>"]*)?/gi,
      /https?:\/\/rss\.[^\s<>"]+/gi,
      /https?:\/\/feeds?\.[^\s<>"]+/gi,
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        let url = match[0]
        // Clean up trailing characters
        url = url.replace(/[,;.)\]]+$/, '')
        urls.add(url)
      }
    }

    return Array.from(urls)
  }

  /**
   * Validate if a URL is actually an RSS/Atom feed
   */
  async isValidRSSFeed(url: string): Promise<boolean> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        maxRedirects: 5,
      })

      const content = response.data

      // Check if it's XML
      if (!content.includes('<?xml') && !content.includes('<rss') && !content.includes('<feed')) {
        return false
      }

      // Try to parse as XML
      const parsed = await parseStringPromise(content)

      // Check for RSS or Atom structure
      if (parsed.rss || parsed.feed || parsed['rdf:RDF']) {
        return true
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Search Google for RSS feeds (using custom search if available)
   */
  async searchGoogle(query: string, limit: number = 10): Promise<string[]> {
    // For now, return empty - user will need to run manual searches
    // This can be enhanced with Google Custom Search API if needed
    return []
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url: string): string {
    try {
      const parsed = new URL(url)
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  }

  /**
   * Score RSS feed URL quality based on patterns
   */
  scoreRSSUrl(url: string): number {
    let score = 50 // Base score

    const lower = url.toLowerCase()

    // Good patterns
    if (lower.includes('/rss')) score += 20
    if (lower.includes('/feed')) score += 20
    if (lower.includes('/atom')) score += 15
    if (lower.includes('.xml')) score += 10
    if (lower.match(/rss\d*/)) score += 10
    if (lower.includes('news')) score += 5

    // Bad patterns
    if (lower.includes('comment')) score -= 20
    if (lower.includes('spam')) score -= 30
    if (lower.includes('ads')) score -= 20
    if (lower.includes('tracking')) score -= 20

    return Math.max(0, Math.min(100, score))
  }
}
