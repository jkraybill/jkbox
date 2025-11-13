import axios from 'axios'
import * as cheerio from 'cheerio'
import { RateLimiter } from '../utils/rate-limiter'

export interface ArticleContent {
  url: string
  title: string
  mainText: string
  htmlLength: number
  textLength: number
  fetchedAt: Date
}

export class ArticleFetcher {
  private rateLimiter: RateLimiter

  constructor(requestsPerSecond: number = 1) {
    this.rateLimiter = new RateLimiter(requestsPerSecond)
  }

  /**
   * Fetch full article content from URL
   */
  async fetchArticleContent(url: string): Promise<ArticleContent> {
    // Rate limit requests
    await this.rateLimiter.acquire()

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; JKBox-Data-Tools/0.1.0; +https://github.com/jkraybill/jkbox)',
        },
      })

      const html = response.data
      const $ = cheerio.load(html)

      // Remove unwanted elements
      $('script').remove()
      $('style').remove()
      $('nav').remove()
      $('header').remove()
      $('footer').remove()
      $('.advertisement').remove()
      $('.ads').remove()
      $('.social-share').remove()
      $('.comments').remove()

      // Try common article selectors
      let mainText = ''
      const selectors = [
        'article',
        '[role="main"]',
        '.article-content',
        '.post-content',
        '.entry-content',
        '#article-body',
        '.story-body',
        'main',
      ]

      for (const selector of selectors) {
        const content = $(selector).text()
        if (content.length > mainText.length) {
          mainText = content
        }
      }

      // Fallback to body if no article found
      if (mainText.length < 100) {
        mainText = $('body').text()
      }

      // Clean up whitespace
      mainText = mainText
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()

      // Extract title
      let title = $('h1').first().text().trim()
      if (!title) {
        title = $('title').text().trim()
      }

      return {
        url,
        title,
        mainText,
        htmlLength: html.length,
        textLength: mainText.length,
        fetchedAt: new Date(),
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Article not found (404): ${url}`)
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error(`Timeout fetching article: ${url}`)
        }
      }
      throw new Error(`Failed to fetch article: ${error}`)
    }
  }

  /**
   * Fetch multiple articles with rate limiting
   */
  async fetchArticles(urls: string[]): Promise<ArticleContent[]> {
    const results: ArticleContent[] = []

    for (const url of urls) {
      try {
        const content = await this.fetchArticleContent(url)
        results.push(content)
      } catch (error) {
        console.error(`Error fetching ${url}: ${error}`)
        // Continue with other URLs even if one fails
      }
    }

    return results
  }
}
