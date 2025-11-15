import axios from 'axios'
import * as cheerio from 'cheerio'
import { RateLimiter } from '../utils/rate-limiter'

export interface NewsOfWeirdArticle {
  url: string
  title: string
  date: Date
  content: string
  author: string
}

/**
 * Scraper for News of the Weird archives
 * https://www.uexpress.com/oddities/news-of-the-weird/
 */
export class NewsOfWeirdScraper {
  private rateLimiter: RateLimiter
  private baseUrl = 'https://www.uexpress.com'

  constructor(rateLimitMs: number = 2000) {
    this.rateLimiter = new RateLimiter(rateLimitMs, true)
  }

  /**
   * Generate News of the Weird article URLs by fetching archive pages
   * Returns URLs from startYear to present by parsing yearly archive pages
   */
  async fetchArticleUrls(startYear: number = 1996): Promise<string[]> {
    const urls: string[] = []
    const currentYear = new Date().getFullYear()

    // Fetch archive page for each year from startYear to current year
    for (let year = startYear; year <= currentYear; year++) {
      await this.rateLimiter.acquire()

      try {
        const archiveUrl = `${this.baseUrl}/oddities/news-of-the-weird/archives/${year}`
        const response = await axios.get(archiveUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; JKBox/1.0; +https://github.com/jkraybill/jkbox)',
          },
        })

        const $ = cheerio.load(response.data)

        // Find all article links on the archive page
        // Archive pages have links like /oddities/news-of-the-weird/YYYY/MM/DD
        $('a[href*="/oddities/news-of-the-weird/"]').each((_, elem) => {
          const href = $(elem).attr('href')
          if (href) {
            // Match URLs like /oddities/news-of-the-weird/YYYY/MM/DD
            const match = href.match(/\/oddities\/news-of-the-weird\/\d{4}\/\d{2}\/\d{2}$/)
            if (match) {
              const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`
              if (!urls.includes(fullUrl)) {
                urls.push(fullUrl)
              }
            }
          }
        })
      } catch (error) {
        console.warn(`Failed to fetch archive for year ${year}: ${error}`)
        // Continue with next year
      }
    }

    return urls
  }

  /**
   * Check if a News of the Weird article exists at a given URL
   */
  async checkArticleExists(url: string): Promise<boolean> {
    await this.rateLimiter.acquire()

    try {
      const response = await axios.head(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JKBox/1.0; +https://github.com/jkraybill/jkbox)',
        },
        timeout: 10000,
      })
      return response.status === 200
    } catch (error) {
      return false
    }
  }

  /**
   * Fetch a specific article by URL
   */
  async fetchArticle(url: string): Promise<NewsOfWeirdArticle> {
    await this.rateLimiter.acquire()

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JKBox/1.0; +https://github.com/jkraybill/jkbox)',
        },
      })

      const $ = cheerio.load(response.data)

      // Extract metadata from JSON-LD schema
      let title = ''
      let dateString = ''
      let author = 'The Editors at Andrews McMeel Syndication'

      const schemaScript = $('script[type="application/ld+json"]').first()
      if (schemaScript.length > 0) {
        try {
          const schema = JSON.parse(schemaScript.html() || '{}')
          if (schema.headline) {
            title = schema.headline
          }
          if (schema.datePublished) {
            dateString = schema.datePublished
          }
          if (schema.author?.name) {
            author = schema.author.name
          }
        } catch (e) {
          // Fall through to HTML parsing
        }
      }

      // Fallback: Extract from HTML
      if (!title) {
        title = $('h1').first().text().trim() || 'Untitled'
      }

      if (!dateString) {
        // Try to parse date from URL: /YYYY/MM/DD
        const urlMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})/)
        if (urlMatch) {
          dateString = `${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}`
        }
      }

      // Extract article content
      // Strategy: Only get content from the FIRST article, stop at preview content
      const contentParagraphs: string[] = []

      // First, try to get content from the first <article> tag only
      const firstArticle = $('article').first()

      if (firstArticle.length > 0) {
        // Get all paragraphs within the first article
        firstArticle.find('p').each((_, elem) => {
          const text = $(elem).text().trim()

          // Stop if we hit a headline for another date (indicates preview section)
          if (text.match(/News of the Weird for \w+ \d+, \d{4}/) && contentParagraphs.length > 0) {
            return false // Break out of .each()
          }

          if (text && text.length > 20) {
            contentParagraphs.push(text)
          }
        })
      } else {
        // Fallback: Get paragraphs but stop at the first "News of the Weird for [different date]" headline
        const allElements = $('h1, h2, h3, p')
        let hitMainHeadline = false

        allElements.each((_, elem) => {
          const text = $(elem).text().trim()

          // Check if this is a "News of the Weird for..." headline
          const isHeadline = text.match(/News of the Weird for \w+ \d+, \d{4}/)

          if (isHeadline) {
            if (!hitMainHeadline) {
              // This is the main headline
              hitMainHeadline = true
            } else {
              // This is a preview headline - stop here
              return false
            }
          } else if (hitMainHeadline && $(elem).is('p') && text.length > 20) {
            // We're past the main headline, collect paragraphs
            contentParagraphs.push(text)
          }
        })
      }

      const content = contentParagraphs.join('\n\n')

      if (!content) {
        throw new Error('No content found in article')
      }

      const date = dateString ? new Date(dateString) : new Date()

      return {
        url,
        title,
        date,
        content,
        author,
      }
    } catch (error) {
      // Handle AggregateError specially to show all underlying errors
      if (error instanceof AggregateError) {
        const errorMessages = error.errors.map((e: Error) => e.message).join('; ')
        throw new Error(`Failed to fetch article ${url}: AggregateError - ${errorMessages}`)
      }

      // For other errors, include the message if available
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to fetch article ${url}: ${errorMessage}`)
    }
  }

  /**
   * Extract individual news items from a News of the Weird article
   * Each weekly column contains multiple weird news stories
   */
  extractNewsItems(article: NewsOfWeirdArticle): Array<{
    title: string
    content: string
    url: string
    date: Date
    author: string
  }> {
    const items: Array<{
      title: string
      content: string
      url: string
      date: Date
      author: string
    }> = []

    // Split content by section headers (LEAD STORY, LEAST COMPETENT CRIMINALS, etc.)
    const sections = article.content.split(/\n\n(?=[A-Z\s-]{10,})/g)

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      if (!section || section.trim().length < 50) continue

      // Try to extract section title
      const lines = section.split('\n')
      const firstLine = lines[0]?.trim() || ''

      let sectionTitle = ''
      let sectionContent = section

      // Check if first line is all caps (section header)
      if (firstLine && firstLine === firstLine.toUpperCase() && firstLine.length < 100) {
        sectionTitle = firstLine
        sectionContent = lines.slice(1).join('\n').trim()
      }

      // Create title for this news item
      const itemTitle = sectionTitle
        ? `${article.title} - ${sectionTitle}`
        : `${article.title} (Part ${i + 1})`

      items.push({
        title: itemTitle,
        content: sectionContent,
        url: `${article.url}#section-${i}`,
        date: article.date,
        author: article.author,
      })
    }

    // If no sections found, return the whole article as one item
    if (items.length === 0) {
      items.push({
        title: article.title,
        content: article.content,
        url: article.url,
        date: article.date,
        author: article.author,
      })
    }

    return items
  }
}
