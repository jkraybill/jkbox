import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Pool } from 'pg'
import { DatabaseQueries } from './queries'
import type { ArticleInsert } from '../../types/article'

// Note: These tests require a PostgreSQL database
// Set DATABASE_URL environment variable for testing
const TEST_DATABASE_URL = process.env.DATABASE_URL

// Skip these tests if no database configured
const describeDb = TEST_DATABASE_URL ? describe : describe.skip

describeDb('DatabaseQueries - Articles (Integration)', () => {
  let pool: Pool
  let db: DatabaseQueries

  beforeEach(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    db = new DatabaseQueries(pool)

    // Create articles table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type VARCHAR(20) NOT NULL,
        source_id VARCHAR(255),
        source_url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT,
        link TEXT,
        author VARCHAR(255),
        pub_date TIMESTAMP,
        collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
        is_weird BOOLEAN,
        weird_confidence INTEGER,
        categories TEXT[],
        engagement_score INTEGER,
        quality_score INTEGER,
        language VARCHAR(10) NOT NULL,
        country VARCHAR(10),
        content_hash VARCHAR(64),
        CONSTRAINT unique_content UNIQUE (content_hash)
      )
    `)
  })

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM articles')
    await pool.end()
  })

  describe('insertArticle', () => {
    it('should insert a new article', async () => {
      const article: ArticleInsert = {
        sourceType: 'rss',
        sourceId: 'test-feed-123',
        sourceUrl: 'https://example.com/feed.xml',
        title: 'Test Article',
        description: 'Test description',
        content: null,
        link: 'https://example.com/article-1',
        author: 'Test Author',
        pubDate: new Date('2025-01-01'),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird', 'news'],
        engagementScore: null,
        qualityScore: 75,
        language: 'en',
        country: 'US',
        contentHash: null,
      }

      const id = await db.insertArticle(article)

      expect(id).toBeTruthy()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('should prevent duplicate articles based on content hash', async () => {
      const article: ArticleInsert = {
        sourceType: 'rss',
        sourceId: 'test-feed-123',
        sourceUrl: 'https://example.com/feed.xml',
        title: 'Duplicate Article',
        description: 'Same description',
        content: null,
        link: 'https://example.com/article-2',
        author: 'Test Author',
        pubDate: new Date('2025-01-01'),
        collectedAt: new Date(),
        isWeird: false,
        weirdConfidence: null,
        categories: [],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: null,
        contentHash: null,
      }

      // Insert first time
      const id1 = await db.insertArticle(article)
      expect(id1).toBeTruthy()

      // Try to insert duplicate
      const id2 = await db.insertArticle(article)
      expect(id2).toBeNull() // Should return null for duplicate
    })

    it('should handle articles from different sources', async () => {
      const rssArticle: ArticleInsert = {
        sourceType: 'rss',
        sourceId: 'feed-1',
        sourceUrl: 'https://example.com/feed.xml',
        title: 'RSS Article',
        description: 'From RSS feed',
        content: null,
        link: 'https://example.com/rss-1',
        author: null,
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: null,
        weirdConfidence: null,
        categories: [],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: null,
        contentHash: null,
      }

      const historicalArticle: ArticleInsert = {
        ...rssArticle,
        sourceType: 'historical',
        title: 'Historical Article',
        link: 'https://example.com/historical-1',
      }

      const redditArticle: ArticleInsert = {
        ...rssArticle,
        sourceType: 'reddit',
        sourceId: 'nottheonion',
        title: 'Reddit Post',
        link: 'https://reddit.com/r/nottheonion/abc123',
        engagementScore: 15000,
      }

      const id1 = await db.insertArticle(rssArticle)
      const id2 = await db.insertArticle(historicalArticle)
      const id3 = await db.insertArticle(redditArticle)

      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id3).toBeTruthy()
    })
  })

  describe('insertArticles', () => {
    it('should bulk insert multiple articles', async () => {
      const articles: ArticleInsert[] = [
        {
          sourceType: 'rss',
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Article 1',
          description: 'Description 1',
          content: null,
          link: 'https://example.com/1',
          author: null,
          pubDate: new Date(),
          collectedAt: new Date(),
          isWeird: true,
          weirdConfidence: 90,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
        {
          sourceType: 'rss',
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Article 2',
          description: 'Description 2',
          content: null,
          link: 'https://example.com/2',
          author: null,
          pubDate: new Date(),
          collectedAt: new Date(),
          isWeird: false,
          weirdConfidence: 30,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
        {
          sourceType: 'rss',
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Article 3',
          description: 'Description 3',
          content: null,
          link: 'https://example.com/3',
          author: null,
          pubDate: new Date(),
          collectedAt: new Date(),
          isWeird: true,
          weirdConfidence: 75,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
      ]

      const inserted = await db.insertArticles(articles)

      expect(inserted).toBe(3)
    })

    it('should skip duplicates in bulk insert', async () => {
      const articles: ArticleInsert[] = [
        {
          sourceType: 'rss',
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Unique Article',
          description: 'Unique description',
          content: null,
          link: 'https://example.com/1',
          author: null,
          pubDate: new Date(),
          collectedAt: new Date(),
          isWeird: null,
          weirdConfidence: null,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
        {
          sourceType: 'rss',
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Unique Article', // Same title+description = duplicate
          description: 'Unique description',
          content: null,
          link: 'https://example.com/2', // Different link
          author: null,
          pubDate: new Date(),
          collectedAt: new Date(),
          isWeird: null,
          weirdConfidence: null,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
      ]

      const inserted = await db.insertArticles(articles)

      expect(inserted).toBe(1) // Only first one should be inserted
    })
  })

  describe('getWeirdArticles', () => {
    it('should retrieve only weird articles', async () => {
      // Insert mix of weird and normal articles
      await db.insertArticles([
        {
          sourceType: 'rss',
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Weird Article 1',
          description: 'Weird 1',
          content: null,
          link: 'https://example.com/weird-1',
          author: null,
          pubDate: new Date('2025-01-01'),
          collectedAt: new Date(),
          isWeird: true,
          weirdConfidence: 95,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
        {
          sourceType: 'rss',
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Normal Article',
          description: 'Normal',
          content: null,
          link: 'https://example.com/normal-1',
          author: null,
          pubDate: new Date('2025-01-02'),
          collectedAt: new Date(),
          isWeird: false,
          weirdConfidence: 20,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
        {
          sourceType: 'rss',
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Weird Article 2',
          description: 'Weird 2',
          content: null,
          link: 'https://example.com/weird-2',
          author: null,
          pubDate: new Date('2025-01-03'),
          collectedAt: new Date(),
          isWeird: true,
          weirdConfidence: 88,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
      ])

      const weirdArticles = await db.getWeirdArticles()

      expect(weirdArticles).toHaveLength(2)
      expect(weirdArticles.every((a) => a.isWeird === true)).toBe(true)
    })

    it('should limit results when specified', async () => {
      // Insert 5 weird articles
      await db.insertArticles(
        Array.from({ length: 5 }, (_, i) => ({
          sourceType: 'rss' as const,
          sourceId: 'feed-1',
          sourceUrl: 'https://example.com/feed.xml',
          title: `Weird Article ${i}`,
          description: `Weird ${i}`,
          content: null,
          link: `https://example.com/weird-${i}`,
          author: null,
          pubDate: new Date(),
          collectedAt: new Date(),
          isWeird: true,
          weirdConfidence: 90,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        }))
      )

      const limited = await db.getWeirdArticles(3)

      expect(limited).toHaveLength(3)
    })
  })
})
