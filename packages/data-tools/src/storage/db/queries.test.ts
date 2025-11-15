import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Pool } from 'pg'
import { DatabaseQueries } from './queries'
import type { ArticleInsert } from '../../types/article'
import type { FakeFactsQuestionInsert, FakeFactsAnswerInsert } from '../../types/fake-facts'

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

describeDb('DatabaseQueries - Fake Facts (Integration)', () => {
  let pool: Pool
  let db: DatabaseQueries
  let testArticleId: string

  beforeEach(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    db = new DatabaseQueries(pool)

    // Ensure tables exist (schema should be applied)
    // Insert a test article for FK relationships
    const article: ArticleInsert = {
      sourceType: 'rss',
      sourceId: 'test-feed',
      sourceUrl: 'https://example.com/feed.xml',
      title: 'Court Says Bees Are Fish',
      description: 'California court rules bees are legally fish',
      content: null,
      link: 'https://example.com/bees-fish',
      author: null,
      pubDate: new Date(),
      collectedAt: new Date(),
      isWeird: true,
      weirdConfidence: 95,
      categories: ['weird', 'legal'],
      engagementScore: null,
      qualityScore: null,
      language: 'en',
      country: 'US',
      contentHash: null,
    }

    testArticleId = await db.insertArticle(article) as string
  })

  afterEach(async () => {
    // Clean up in reverse dependency order
    await pool.query('DELETE FROM fake_facts_answers')
    await pool.query('DELETE FROM fake_facts_questions')
    await pool.query('DELETE FROM articles')
    await pool.end()
  })

  describe('getUnprocessedArticles', () => {
    it('should return articles where fake_facts_processed is false', async () => {
      // testArticleId should be unprocessed by default
      const unprocessed = await db.getUnprocessedArticles(10)

      expect(unprocessed.length).toBeGreaterThan(0)
      expect(unprocessed[0]?.id).toBe(testArticleId)
      expect(unprocessed[0]?.fakeFactsProcessed).toBe(false)
    })

    it('should not return processed articles', async () => {
      // Mark article as processed
      await db.markArticleAsProcessed(testArticleId, true, null)

      const unprocessed = await db.getUnprocessedArticles(10)

      expect(unprocessed.every((a) => a.id !== testArticleId)).toBe(true)
    })

    it('should respect limit parameter', async () => {
      // Insert more articles
      await db.insertArticles([
        {
          sourceType: 'rss',
          sourceId: 'test-feed',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Article 2',
          description: 'Desc 2',
          content: null,
          link: 'https://example.com/2',
          author: null,
          pubDate: new Date(),
          collectedAt: new Date(),
          isWeird: true,
          weirdConfidence: 80,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
        {
          sourceType: 'rss',
          sourceId: 'test-feed',
          sourceUrl: 'https://example.com/feed.xml',
          title: 'Article 3',
          description: 'Desc 3',
          content: null,
          link: 'https://example.com/3',
          author: null,
          pubDate: new Date(),
          collectedAt: new Date(),
          isWeird: true,
          weirdConfidence: 85,
          categories: [],
          engagementScore: null,
          qualityScore: null,
          language: 'en',
          country: null,
          contentHash: null,
        },
      ])

      const limited = await db.getUnprocessedArticles(2)

      expect(limited.length).toBeLessThanOrEqual(2)
    })

    it('should prioritize articles with null last_considered first', async () => {
      // Insert articles with different last_considered values
      const article2: ArticleInsert = {
        sourceType: 'rss',
        sourceId: 'test-feed',
        sourceUrl: 'https://example.com/feed.xml',
        title: 'Article with old last_considered',
        description: 'Old consideration',
        content: null,
        link: 'https://example.com/old',
        author: null,
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 80,
        categories: [],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: null,
        contentHash: null,
      }

      const article3: ArticleInsert = {
        sourceType: 'rss',
        sourceId: 'test-feed',
        sourceUrl: 'https://example.com/feed.xml',
        title: 'Article with recent last_considered',
        description: 'Recent consideration',
        content: null,
        link: 'https://example.com/recent',
        author: null,
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: [],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: null,
        contentHash: null,
      }

      const oldId = await db.insertArticle(article2) as string
      const recentId = await db.insertArticle(article3) as string

      // Set last_considered timestamps
      await pool.query(`UPDATE articles SET last_considered = NOW() - INTERVAL '2 days' WHERE id = $1`, [oldId])
      await pool.query(`UPDATE articles SET last_considered = NOW() - INTERVAL '1 hour' WHERE id = $1`, [recentId])

      // testArticleId has NULL last_considered

      const unprocessed = await db.getUnprocessedArticles(10)

      // Articles with NULL last_considered should come first
      const nullConsideredArticles = unprocessed.filter(a => a.lastConsidered === null)
      expect(nullConsideredArticles.length).toBeGreaterThan(0)

      // After NULL articles, should be sorted by last_considered ASC (oldest first)
      const nonNullArticles = unprocessed.filter(a => a.lastConsidered !== null)
      if (nonNullArticles.length >= 2) {
        for (let i = 0; i < nonNullArticles.length - 1; i++) {
          const current = nonNullArticles[i]!.lastConsidered!
          const next = nonNullArticles[i + 1]!.lastConsidered!
          expect(new Date(current).getTime()).toBeLessThanOrEqual(new Date(next).getTime())
        }
      }
    })

    it('should only return weird articles', async () => {
      // Insert non-weird article
      await db.insertArticle({
        sourceType: 'rss',
        sourceId: 'test-feed',
        sourceUrl: 'https://example.com/feed.xml',
        title: 'Not weird article',
        description: 'Boring',
        content: null,
        link: 'https://example.com/boring',
        author: null,
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: false,
        weirdConfidence: 10,
        categories: [],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: null,
        contentHash: null,
      })

      const unprocessed = await db.getUnprocessedArticles(10)

      // All returned articles should be weird
      expect(unprocessed.every(a => a.isWeird === true)).toBe(true)
    })
  })

  describe('updateLastConsidered', () => {
    it('should update last_considered timestamp for single article', async () => {
      const beforeUpdate = new Date()

      await db.updateLastConsidered([testArticleId])

      const result = await pool.query('SELECT last_considered FROM articles WHERE id = $1', [testArticleId])
      const lastConsidered = result.rows[0]?.last_considered

      expect(lastConsidered).toBeTruthy()
      expect(new Date(lastConsidered).getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
    })

    it('should update last_considered for multiple articles', async () => {
      // Insert additional articles
      const article2: ArticleInsert = {
        sourceType: 'rss',
        sourceId: 'test-feed',
        sourceUrl: 'https://example.com/feed.xml',
        title: 'Article 2',
        description: 'Desc 2',
        content: null,
        link: 'https://example.com/2',
        author: null,
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 80,
        categories: [],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: null,
        contentHash: null,
      }

      const article3: ArticleInsert = {
        sourceType: 'rss',
        sourceId: 'test-feed',
        sourceUrl: 'https://example.com/feed.xml',
        title: 'Article 3',
        description: 'Desc 3',
        content: null,
        link: 'https://example.com/3',
        author: null,
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: [],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: null,
        contentHash: null,
      }

      const id2 = await db.insertArticle(article2) as string
      const id3 = await db.insertArticle(article3) as string

      const beforeUpdate = new Date()

      await db.updateLastConsidered([testArticleId, id2, id3])

      const result = await pool.query(
        'SELECT id, last_considered FROM articles WHERE id = ANY($1::uuid[])',
        [[testArticleId, id2, id3]]
      )

      expect(result.rows.length).toBe(3)
      result.rows.forEach(row => {
        expect(row.last_considered).toBeTruthy()
        expect(new Date(row.last_considered).getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      })
    })

    it('should handle empty array gracefully', async () => {
      await expect(db.updateLastConsidered([])).resolves.not.toThrow()
    })

    it('should update timestamp even if article was previously considered', async () => {
      // Set initial last_considered
      await pool.query(`UPDATE articles SET last_considered = NOW() - INTERVAL '1 day' WHERE id = $1`, [testArticleId])

      const beforeResult = await pool.query('SELECT last_considered FROM articles WHERE id = $1', [testArticleId])
      const beforeTimestamp = beforeResult.rows[0]?.last_considered

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      await db.updateLastConsidered([testArticleId])

      const afterResult = await pool.query('SELECT last_considered FROM articles WHERE id = $1', [testArticleId])
      const afterTimestamp = afterResult.rows[0]?.last_considered

      expect(new Date(afterTimestamp).getTime()).toBeGreaterThan(new Date(beforeTimestamp).getTime())
    })
  })

  describe('markArticleAsProcessed', () => {
    it('should mark article as processed with eligibility true', async () => {
      await db.markArticleAsProcessed(testArticleId, true, null)

      const articles = await db.getUnprocessedArticles(10)
      expect(articles.every((a) => a.id !== testArticleId)).toBe(true)
    })

    it('should mark article as processed with eligibility false and reason', async () => {
      await db.markArticleAsProcessed(testArticleId, false, 'Too generic')

      // Verify article is marked processed
      const result = await pool.query(
        'SELECT fake_facts_processed, fake_facts_eligible, fake_facts_rejection_reason FROM articles WHERE id = $1',
        [testArticleId]
      )

      expect(result.rows[0]?.fake_facts_processed).toBe(true)
      expect(result.rows[0]?.fake_facts_eligible).toBe(false)
      expect(result.rows[0]?.fake_facts_rejection_reason).toBe('Too generic')
    })
  })

  describe('insertQuestion', () => {
    it('should insert a new question', async () => {
      const question: FakeFactsQuestionInsert = {
        articleId: testArticleId,
        questionText: 'In California, _____ are legally classified as fish.',
        blankText: 'bees',
        generatorModel: 'claude-3-5-haiku-20241022',
        generationCost: 0.003,
      }

      const questionId = await db.insertQuestion(question)

      expect(questionId).toBeTruthy()
      expect(questionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('should reject question with invalid article_id', async () => {
      const question: FakeFactsQuestionInsert = {
        articleId: '00000000-0000-0000-0000-000000000000',
        questionText: 'Test question with _____ blank.',
        blankText: 'invalid',
        generatorModel: 'claude-3-5-haiku-20241022',
      }

      await expect(db.insertQuestion(question)).rejects.toThrow()
    })
  })

  describe('insertAnswers', () => {
    let questionId: string

    beforeEach(async () => {
      const question: FakeFactsQuestionInsert = {
        articleId: testArticleId,
        questionText: 'In California, _____ are legally classified as fish.',
        blankText: 'bees',
        generatorModel: 'claude-3-5-haiku-20241022',
      }

      questionId = await db.insertQuestion(question)
    })

    it('should insert real answer', async () => {
      const answer: FakeFactsAnswerInsert = {
        questionId,
        answerText: 'bees',
        isReal: true,
        answerOrder: null,
        generatorModel: null,
      }

      const answerId = await db.insertAnswer(answer)

      expect(answerId).toBeTruthy()

      // Verify answer is marked as real
      const result = await pool.query('SELECT is_real, answer_order FROM fake_facts_answers WHERE id = $1', [answerId])
      expect(result.rows[0]?.is_real).toBe(true)
      expect(result.rows[0]?.answer_order).toBeNull()
    })

    it('should insert house answers with order', async () => {
      const houseAnswers: FakeFactsAnswerInsert[] = [
        {
          questionId,
          answerText: 'wasps',
          isReal: false,
          answerOrder: 1,
          generatorModel: 'claude-3-5-haiku-20241022',
        },
        {
          questionId,
          answerText: 'coral',
          isReal: false,
          answerOrder: 2,
          generatorModel: 'claude-3-5-haiku-20241022',
        },
      ]

      const ids = await db.insertAnswers(houseAnswers)

      expect(ids.length).toBe(2)
      expect(ids.every((id) => id.match(/^[0-9a-f-]{36}$/))).toBe(true)
    })

    it('should insert complete question with 1 real + 5 house answers', async () => {
      const realAnswer: FakeFactsAnswerInsert = {
        questionId,
        answerText: 'bees',
        isReal: true,
      }

      const houseAnswers: FakeFactsAnswerInsert[] = Array.from({ length: 5 }, (_, i) => ({
        questionId,
        answerText: `house answer ${i + 1}`,
        isReal: false,
        answerOrder: i + 1,
        generatorModel: 'claude-3-5-haiku-20241022',
      }))

      const realId = await db.insertAnswer(realAnswer)
      const houseIds = await db.insertAnswers(houseAnswers)

      expect(realId).toBeTruthy()
      expect(houseIds.length).toBe(5)

      // Verify total answer count
      const result = await pool.query('SELECT COUNT(*) FROM fake_facts_answers WHERE question_id = $1', [questionId])
      expect(parseInt(result.rows[0]?.count)).toBe(6)
    })
  })

  describe('getQuestionWithAnswers', () => {
    let questionId: string

    beforeEach(async () => {
      // Create complete question with answers
      const question: FakeFactsQuestionInsert = {
        articleId: testArticleId,
        questionText: 'In California, _____ are legally classified as fish.',
        blankText: 'bees',
        generatorModel: 'claude-3-5-haiku-20241022',
      }

      questionId = await db.insertQuestion(question)

      // Insert real answer
      await db.insertAnswer({
        questionId,
        answerText: 'bees',
        isReal: true,
      })

      // Insert house answers
      await db.insertAnswers(
        Array.from({ length: 5 }, (_, i) => ({
          questionId,
          answerText: `house answer ${i + 1}`,
          isReal: false,
          answerOrder: i + 1,
          generatorModel: 'claude-3-5-haiku-20241022',
        }))
      )
    })

    it('should retrieve question with all answers', async () => {
      const gameQuestion = await db.getQuestionWithAnswers(questionId)

      expect(gameQuestion).toBeTruthy()
      expect(gameQuestion?.question.id).toBe(questionId)
      expect(gameQuestion?.realAnswer.isReal).toBe(true)
      expect(gameQuestion?.houseAnswers.length).toBe(5)
      expect(gameQuestion?.houseAnswers.every((a) => !a.isReal)).toBe(true)
    })

    it('should return null for non-existent question', async () => {
      const gameQuestion = await db.getQuestionWithAnswers('00000000-0000-0000-0000-000000000000')

      expect(gameQuestion).toBeNull()
    })
  })

  describe('Spacetime Metadata', () => {
    let articleId: string

    beforeEach(async () => {
      // Insert a test article
      const article: ArticleInsert = {
        sourceType: 'rss',
        sourceId: 'test-feed',
        sourceUrl: 'https://example.com/feed',
        title: 'Test Article for Spacetime',
        description: 'A test article',
        content: 'Test content',
        link: 'https://example.com/article',
        author: 'Test Author',
        pubDate: new Date('2004-08-22'),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 90,
        categories: ['test'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'us',
        contentHash: null,
      }

      articleId = (await db.insertArticle(article)) as string
    })

    it('should update spacetime metadata for article', async () => {
      await db.updateSpacetimeMetadata(articleId, {
        eventYear: 2004,
        locationCity: 'Annapolis',
        locationState: 'Maryland',
      })

      const result = await pool.query(
        'SELECT event_year, location_city, location_state FROM articles WHERE id = $1',
        [articleId]
      )
      const article = result.rows[0]

      expect(article).toBeTruthy()
      expect(article?.event_year).toBe(2004)
      expect(article?.location_city).toBe('Annapolis')
      expect(article?.location_state).toBe('Maryland')
    })

    it('should handle partial spacetime metadata (year only)', async () => {
      await db.updateSpacetimeMetadata(articleId, {
        eventYear: 1996,
        locationCity: null,
        locationState: null,
      })

      const result = await pool.query(
        'SELECT event_year, location_city, location_state FROM articles WHERE id = $1',
        [articleId]
      )
      const article = result.rows[0]

      expect(article?.event_year).toBe(1996)
      expect(article?.location_city).toBeNull()
      expect(article?.location_state).toBeNull()
    })

    it('should handle partial spacetime metadata (state only)', async () => {
      await db.updateSpacetimeMetadata(articleId, {
        eventYear: null,
        locationCity: null,
        locationState: 'Colorado',
      })

      const result = await pool.query(
        'SELECT event_year, location_city, location_state FROM articles WHERE id = $1',
        [articleId]
      )
      const article = result.rows[0]

      expect(article?.event_year).toBeNull()
      expect(article?.location_city).toBeNull()
      expect(article?.location_state).toBe('Colorado')
    })

    it('should handle city + state without year', async () => {
      await db.updateSpacetimeMetadata(articleId, {
        eventYear: null,
        locationCity: 'Brisbane',
        locationState: 'Queensland',
      })

      const result = await pool.query(
        'SELECT event_year, location_city, location_state FROM articles WHERE id = $1',
        [articleId]
      )
      const article = result.rows[0]

      expect(article?.event_year).toBeNull()
      expect(article?.location_city).toBe('Brisbane')
      expect(article?.location_state).toBe('Queensland')
    })

    it('should handle all NULL spacetime metadata', async () => {
      await db.updateSpacetimeMetadata(articleId, {
        eventYear: null,
        locationCity: null,
        locationState: null,
      })

      const result = await pool.query(
        'SELECT event_year, location_city, location_state FROM articles WHERE id = $1',
        [articleId]
      )
      const article = result.rows[0]

      expect(article?.event_year).toBeNull()
      expect(article?.location_city).toBeNull()
      expect(article?.location_state).toBeNull()
    })

    it('should allow updating spacetime metadata multiple times', async () => {
      // First update
      await db.updateSpacetimeMetadata(articleId, {
        eventYear: 2000,
        locationCity: 'Wrong City',
        locationState: 'Wrong State',
      })

      // Second update (correction)
      await db.updateSpacetimeMetadata(articleId, {
        eventYear: 2004,
        locationCity: 'Annapolis',
        locationState: 'Maryland',
      })

      const result = await pool.query(
        'SELECT event_year, location_city, location_state FROM articles WHERE id = $1',
        [articleId]
      )
      const article = result.rows[0]

      // Should have the latest values
      expect(article?.event_year).toBe(2004)
      expect(article?.location_city).toBe('Annapolis')
      expect(article?.location_state).toBe('Maryland')
    })
  })
})
