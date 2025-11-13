import { describe, it, expect } from 'vitest'
import { CategoryDetector } from './category-detector'
import type { ParsedFeed, DiscoveredFeed } from './rss-scraper'

describe('CategoryDetector', () => {
  const keywords = {
    en: ['weird', 'offbeat', 'oddly', 'strange', 'unusual', 'bizarre'],
    es: ['extraño', 'raro', 'insólito'],
    fr: ['étrange', 'insolite', 'bizarre'],
  }

  describe('detectFromFeedMetadata', () => {
    it('should detect weird category from feed title', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'Weird News Daily',
        link: 'https://example.com',
        items: [],
      }

      const category = detector.detectFromFeedMetadata(feed, 'en')

      expect(category).toBe('weird')
    })

    it('should detect from feed description', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'News Feed',
        description: 'Strange and unusual stories from around the world',
        link: 'https://example.com',
        items: [],
      }

      const category = detector.detectFromFeedMetadata(feed, 'en')

      expect(category).toBe('weird')
    })

    it('should detect from Spanish keywords', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'Lo Insólito del Día', // contains "insólito"
        link: 'https://example.com',
        items: [],
      }

      const category = detector.detectFromFeedMetadata(feed, 'es')

      expect(category).toBe('weird')
    })

    it('should detect from French keywords', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'Les Nouvelles Insolites',
        link: 'https://example.com',
        items: [],
      }

      const category = detector.detectFromFeedMetadata(feed, 'fr')

      expect(category).toBe('weird')
    })

    it('should be case-insensitive', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'WEIRD NEWS',
        link: 'https://example.com',
        items: [],
      }

      const category = detector.detectFromFeedMetadata(feed, 'en')

      expect(category).toBe('weird')
    })

    it('should return unknown when no keywords match', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'Regular News',
        description: 'Normal news stories',
        link: 'https://example.com',
        items: [],
      }

      const category = detector.detectFromFeedMetadata(feed, 'en')

      expect(category).toBe('unknown')
    })

    it('should match partial words', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'Oddly Satisfying News',
        link: 'https://example.com',
        items: [],
      }

      const category = detector.detectFromFeedMetadata(feed, 'en')

      expect(category).toBe('weird')
    })
  })

  describe('detectFromUrl', () => {
    it('should detect weird category from URL path', () => {
      const detector = new CategoryDetector(keywords)
      const discoveredFeed: DiscoveredFeed = {
        url: 'https://example.com/weird/feed.xml',
      }

      const category = detector.detectFromUrl(discoveredFeed, 'en')

      expect(category).toBe('weird')
    })

    it('should detect offbeat from URL', () => {
      const detector = new CategoryDetector(keywords)
      const discoveredFeed: DiscoveredFeed = {
        url: 'https://example.com/offbeat.rss',
      }

      const category = detector.detectFromUrl(discoveredFeed, 'en')

      expect(category).toBe('weird')
    })

    it('should detect from subdomain', () => {
      const detector = new CategoryDetector(keywords)
      const discoveredFeed: DiscoveredFeed = {
        url: 'https://weird.example.com/feed.xml',
      }

      const category = detector.detectFromUrl(discoveredFeed, 'en')

      expect(category).toBe('weird')
    })

    it('should detect from Spanish URL paths', () => {
      const detector = new CategoryDetector(keywords)
      const discoveredFeed: DiscoveredFeed = {
        url: 'https://example.com/noticias/insólito/feed.xml',
      }

      const category = detector.detectFromUrl(discoveredFeed, 'es')

      expect(category).toBe('weird')
    })

    it('should return unknown when URL has no keywords', () => {
      const detector = new CategoryDetector(keywords)
      const discoveredFeed: DiscoveredFeed = {
        url: 'https://example.com/politics/feed.xml',
      }

      const category = detector.detectFromUrl(discoveredFeed, 'en')

      expect(category).toBe('unknown')
    })
  })

  describe('detectFromArticles', () => {
    it('should detect weird category when articles have weird keywords', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'News Feed',
        link: 'https://example.com',
        items: [
          {
            title: 'Bizarre incident at local store',
            link: 'https://example.com/1',
            categories: [],
          },
          {
            title: 'Strange weather pattern observed',
            link: 'https://example.com/2',
            categories: [],
          },
        ],
      }

      const category = detector.detectFromArticles(feed, 'en')

      expect(category).toBe('weird')
    })

    it('should detect from article categories', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'News Feed',
        link: 'https://example.com',
        items: [
          {
            title: 'Article 1',
            link: 'https://example.com/1',
            categories: ['weird', 'news'],
          },
        ],
      }

      const category = detector.detectFromArticles(feed, 'en')

      expect(category).toBe('weird')
    })

    it('should require minimum percentage of weird articles', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'News Feed',
        link: 'https://example.com',
        items: [
          { title: 'Weird story', link: 'https://example.com/1', categories: [] },
          { title: 'Normal story', link: 'https://example.com/2', categories: [] },
          { title: 'Another normal story', link: 'https://example.com/3', categories: [] },
          { title: 'More normal news', link: 'https://example.com/4', categories: [] },
          { title: 'Regular news', link: 'https://example.com/5', categories: [] },
        ],
      }

      // Only 1/5 (20%) is weird, below threshold
      const category = detector.detectFromArticles(feed, 'en', 0.3) // 30% threshold

      expect(category).toBe('unknown')
    })

    it('should detect when above threshold', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'News Feed',
        link: 'https://example.com',
        items: [
          { title: 'Weird story', link: 'https://example.com/1', categories: [] },
          { title: 'Strange news', link: 'https://example.com/2', categories: [] },
          { title: 'Bizarre incident', link: 'https://example.com/3', categories: [] },
          { title: 'Normal story', link: 'https://example.com/4', categories: [] },
        ],
      }

      // 3/4 (75%) is weird, above threshold
      const category = detector.detectFromArticles(feed, 'en', 0.5) // 50% threshold

      expect(category).toBe('weird')
    })

    it('should return unknown for empty feed', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'Empty Feed',
        link: 'https://example.com',
        items: [],
      }

      const category = detector.detectFromArticles(feed, 'en')

      expect(category).toBe('unknown')
    })
  })

  describe('detectCombined', () => {
    it('should combine detection from multiple sources', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'Regular News',
        link: 'https://example.com',
        items: [
          { title: 'Weird story', link: 'https://example.com/1', categories: [] },
          { title: 'Strange news', link: 'https://example.com/2', categories: [] },
        ],
      }
      const discoveredFeed: DiscoveredFeed = {
        url: 'https://example.com/weird/feed.xml',
      }

      const category = detector.detectCombined(feed, discoveredFeed, 'en')

      // Should be weird because URL matches even if title doesn't
      expect(category).toBe('weird')
    })

    it('should prefer stronger signals', () => {
      const detector = new CategoryDetector(keywords)
      const feed: ParsedFeed = {
        title: 'Weird News Feed', // Strong signal
        link: 'https://example.com',
        items: [
          { title: 'Normal story', link: 'https://example.com/1', categories: [] },
        ],
      }
      const discoveredFeed: DiscoveredFeed = {
        url: 'https://example.com/news/feed.xml', // No signal
      }

      const category = detector.detectCombined(feed, discoveredFeed, 'en')

      expect(category).toBe('weird')
    })
  })
})
