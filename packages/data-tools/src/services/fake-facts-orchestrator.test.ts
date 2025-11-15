import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Pool } from 'pg'
import { FakeFactsOrchestrator, extractCommonPrefix } from './fake-facts-orchestrator'
import { DatabaseQueries } from '../storage/db/queries'
import { LocalLLM } from '../llm/local-llm'
import { ClaudeService } from '../llm/claude-service'
import type { ArticleInsert } from '../types/article'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const OLLAMA_AVAILABLE = process.env.SKIP_OLLAMA_TESTS !== 'true'

// Skip these tests if no database or Ollama configured
const describeDb = TEST_DATABASE_URL && OLLAMA_AVAILABLE ? describe : describe.skip

describeDb('FakeFactsOrchestrator - Competitive Pipeline (Integration)', () => {
  let pool: Pool
  let db: DatabaseQueries
  let ollama: LocalLLM
  let claude: ClaudeService
  let orchestrator: FakeFactsOrchestrator

  beforeEach(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    db = new DatabaseQueries(pool)

    // Initialize Ollama
    const llmConfig: LocalLLMConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
    )
    ollama = new LocalLLM(llmConfig)

    // Initialize Claude
    const claudeConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'config/claude.json'), 'utf-8')
    )
    claude = new ClaudeService(claudeConfig)

    orchestrator = new FakeFactsOrchestrator(pool, ollama, claude, 1)
  })

  afterEach(async () => {
    // Clean up in reverse dependency order
    await pool.query('DELETE FROM fake_facts_answers')
    await pool.query('DELETE FROM fake_facts_questions')
    await pool.query('DELETE FROM articles')
    await pool.end()
  })

  describe('processBatch - Competitive Pipeline', () => {
    it('should fetch 10 candidates and process competitive pipeline', async () => {
      // Insert 15 weird articles (more than batch size)
      const articles: ArticleInsert[] = Array.from({ length: 15 }, (_, i) => ({
        sourceType: 'news-of-weird' as const,
        sourceId: 'test-feed',
        sourceUrl: `https://example.com/feed-${i}`,
        title: `Weird Article ${i + 1}`,
        description: `Description ${i + 1}`,
        content: `This is a weird news story about something absurd happening in Florida. Story number ${i + 1}.`,
        link: `https://example.com/article-${i + 1}`,
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85 + i,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }))

      await db.insertArticles(articles)

      // Run batch processing
      const stats = await orchestrator.processBatch(10, false)

      // Should process exactly 10 candidates (batchSize parameter)
      expect(stats.articlesProcessed).toBe(10)

      // Should generate exactly 1 question (winner of 2 finalists)
      expect(stats.questionsGenerated).toBe(1)

      // Should have used Ollama for scoring and judging
      // 1 for scoring 10 candidates + 1 for judging 2 questions = 2
      expect(stats.ollamaInferences).toBeGreaterThanOrEqual(2)

      // Should have no errors
      expect(stats.errors).toBe(0)
    }, 60000) // 60 second timeout for full pipeline

    it('should update last_considered for all 10 candidates', async () => {
      // Insert 10 weird articles
      const articles: ArticleInsert[] = Array.from({ length: 10 }, (_, i) => ({
        sourceType: 'news-of-weird' as const,
        sourceId: 'test-feed',
        sourceUrl: `https://example.com/feed-${i}`,
        title: `Weird Article ${i + 1}`,
        description: `Description ${i + 1}`,
        content: `This is a weird news story. Story number ${i + 1}.`,
        link: `https://example.com/article-${i + 1}`,
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }))

      await db.insertArticles(articles)

      const beforeRun = new Date()

      await orchestrator.processBatch(10, false)

      // Check that all 10 articles have last_considered updated
      const result = await pool.query(
        `SELECT id, last_considered FROM articles WHERE is_weird = true`
      )

      expect(result.rows.length).toBe(10)
      result.rows.forEach(row => {
        expect(row.last_considered).toBeTruthy()
        expect(new Date(row.last_considered).getTime()).toBeGreaterThanOrEqual(beforeRun.getTime())
      })
    }, 60000)

    it('should prioritize articles with null last_considered', async () => {
      // Insert 5 articles with old last_considered
      const oldArticles: ArticleInsert[] = Array.from({ length: 5 }, (_, i) => ({
        sourceType: 'news-of-weird' as const,
        sourceId: 'test-feed',
        sourceUrl: `https://example.com/old-${i}`,
        title: `Old Article ${i + 1}`,
        description: `Old ${i + 1}`,
        content: `Old weird story ${i + 1}.`,
        link: `https://example.com/old-${i + 1}`,
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }))

      const oldIds = []
      for (const article of oldArticles) {
        const id = await db.insertArticle(article) as string
        oldIds.push(id)
        // Set old last_considered
        await pool.query(`UPDATE articles SET last_considered = NOW() - INTERVAL '1 day' WHERE id = $1`, [id])
      }

      // Insert 10 new articles with null last_considered
      const newArticles: ArticleInsert[] = Array.from({ length: 10 }, (_, i) => ({
        sourceType: 'news-of-weird' as const,
        sourceId: 'test-feed',
        sourceUrl: `https://example.com/new-${i}`,
        title: `New Article ${i + 1}`,
        description: `New ${i + 1}`,
        content: `New weird story ${i + 1}.`,
        link: `https://example.com/new-${i + 1}`,
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }))

      await db.insertArticles(newArticles)

      await orchestrator.processBatch(10, false)

      // Check that the 10 new articles (with null last_considered) were processed
      // by verifying they now have last_considered set
      const result = await pool.query(
        `SELECT last_considered FROM articles WHERE source_url LIKE 'https://example.com/new-%'`
      )

      expect(result.rows.length).toBe(10)
      expect(result.rows.every(row => row.last_considered !== null)).toBe(true)
    }, 60000)

    it('should mark winning article as processed', async () => {
      // Insert 10 weird articles
      const articles: ArticleInsert[] = Array.from({ length: 10 }, (_, i) => ({
        sourceType: 'news-of-weird' as const,
        sourceId: 'test-feed',
        sourceUrl: `https://example.com/feed-${i}`,
        title: `Weird Article ${i + 1}`,
        description: `Description ${i + 1}`,
        content: `This is a weird news story. Story number ${i + 1}.`,
        link: `https://example.com/article-${i + 1}`,
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }))

      await db.insertArticles(articles)

      await orchestrator.processBatch(10, false)

      // Exactly 1 article should be marked as processed (the winner)
      const result = await pool.query(
        `SELECT id FROM articles WHERE fake_facts_processed = true`
      )

      expect(result.rows.length).toBe(1)

      // The winning article should have fake_facts_eligible = true
      const winnerResult = await pool.query(
        `SELECT fake_facts_eligible FROM articles WHERE id = $1`,
        [result.rows[0]?.id]
      )

      expect(winnerResult.rows[0]?.fake_facts_eligible).toBe(true)
    }, 60000)

    it('should create question and answers for winner', async () => {
      // Insert 10 weird articles
      const articles: ArticleInsert[] = Array.from({ length: 10 }, (_, i) => ({
        sourceType: 'news-of-weird' as const,
        sourceId: 'test-feed',
        sourceUrl: `https://example.com/feed-${i}`,
        title: `Weird Article ${i + 1}`,
        description: `Description ${i + 1}`,
        content: `This is a weird news story about something absurd. Story number ${i + 1}.`,
        link: `https://example.com/article-${i + 1}`,
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }))

      await db.insertArticles(articles)

      await orchestrator.processBatch(10, false)

      // Should have exactly 1 question
      const questionResult = await pool.query('SELECT * FROM fake_facts_questions')
      expect(questionResult.rows.length).toBe(1)

      const question = questionResult.rows[0]

      // Should have exactly 6 answers (1 real + 5 house)
      const answerResult = await pool.query(
        'SELECT * FROM fake_facts_answers WHERE question_id = $1',
        [question?.id]
      )
      expect(answerResult.rows.length).toBe(6)

      // Should have exactly 1 real answer
      const realAnswers = answerResult.rows.filter(a => a.is_real)
      expect(realAnswers.length).toBe(1)

      // Should have exactly 5 house answers
      const houseAnswers = answerResult.rows.filter(a => !a.is_real)
      expect(houseAnswers.length).toBe(5)
    }, 60000)

    it('should handle case with fewer than 10 candidates', async () => {
      // Insert only 5 weird articles
      const articles: ArticleInsert[] = Array.from({ length: 5 }, (_, i) => ({
        sourceType: 'news-of-weird' as const,
        sourceId: 'test-feed',
        sourceUrl: `https://example.com/feed-${i}`,
        title: `Weird Article ${i + 1}`,
        description: `Description ${i + 1}`,
        content: `This is a weird news story. Story number ${i + 1}.`,
        link: `https://example.com/article-${i + 1}`,
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }))

      await db.insertArticles(articles)

      const stats = await orchestrator.processBatch(10, false)

      // Should process all available candidates (5)
      expect(stats.articlesProcessed).toBe(5)

      // Should still generate 1 question from top 2
      expect(stats.questionsGenerated).toBe(1)

      // All 5 should have last_considered updated
      const result = await pool.query(
        'SELECT last_considered FROM articles WHERE is_weird = true'
      )
      expect(result.rows.length).toBe(5)
      expect(result.rows.every(row => row.last_considered !== null)).toBe(true)
    }, 60000)

    it('should handle no candidates gracefully', async () => {
      // Don't insert any articles
      const stats = await orchestrator.processBatch(10, false)

      expect(stats.articlesProcessed).toBe(0)
      expect(stats.questionsGenerated).toBe(0)
      expect(stats.errors).toBe(0)
    }, 10000)

    it('should NOT update last_considered if pipeline fails', async () => {
      // Insert 10 weird articles
      const articles: ArticleInsert[] = Array.from({ length: 10 }, (_, i) => ({
        sourceType: 'news-of-weird' as const,
        sourceId: 'test-feed',
        sourceUrl: `https://example.com/feed-${i}`,
        title: `Weird Article ${i + 1}`,
        description: `Description ${i + 1}`,
        content: `This is a weird news story. Story number ${i + 1}.`,
        link: `https://example.com/article-${i + 1}`,
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }))

      await db.insertArticles(articles)

      // Mock Claude to throw an error
      const originalGenerateQuestion = claude.generateQuestion.bind(claude)
      vi.spyOn(claude, 'generateQuestion').mockImplementation(async () => {
        throw new Error('Simulated Claude failure')
      })

      await orchestrator.processBatch(10, false)

      // Restore original
      vi.spyOn(claude, 'generateQuestion').mockImplementation(originalGenerateQuestion)

      // last_considered should NOT be updated (all should still be NULL)
      const result = await pool.query(
        'SELECT last_considered FROM articles WHERE is_weird = true'
      )

      expect(result.rows.length).toBe(10)
      expect(result.rows.every(row => row.last_considered === null)).toBe(true)
    }, 60000)

    it('should generate summaries for articles without cached summaries', async () => {
      // Insert article without summary
      const article: ArticleInsert = {
        sourceType: 'news-of-weird',
        sourceId: 'test-feed',
        sourceUrl: 'https://example.com/feed',
        title: 'Article Without Summary',
        description: 'No summary',
        content: 'This is a long article about something weird happening.',
        link: 'https://example.com/article',
        author: 'Test Author',
        pubDate: new Date(),
        collectedAt: new Date(),
        isWeird: true,
        weirdConfidence: 85,
        categories: ['weird'],
        engagementScore: null,
        qualityScore: null,
        language: 'en',
        country: 'US',
        contentHash: null,
      }

      const articleId = await db.insertArticle(article) as string

      // Verify no summary initially
      const beforeResult = await pool.query(
        'SELECT article_summary FROM articles WHERE id = $1',
        [articleId]
      )
      expect(beforeResult.rows[0]?.article_summary).toBeFalsy()

      await orchestrator.processBatch(10, false)

      // Verify summary was generated and cached
      const afterResult = await pool.query(
        'SELECT article_summary FROM articles WHERE id = $1',
        [articleId]
      )
      expect(afterResult.rows[0]?.article_summary).toBeTruthy()
      expect(afterResult.rows[0]?.article_summary.length).toBeGreaterThan(20)
    }, 60000)
  })

  describe('getStats', () => {
    it('should return current processing statistics', () => {
      const stats = orchestrator.getStats()

      expect(stats).toHaveProperty('articlesProcessed')
      expect(stats).toHaveProperty('questionsGenerated')
      expect(stats).toHaveProperty('candidatesRejected')
      expect(stats).toHaveProperty('errors')
      expect(stats).toHaveProperty('totalCost')
      expect(stats).toHaveProperty('ollamaInferences')
      expect(stats).toHaveProperty('errorDetails')
      expect(stats).toHaveProperty('rejectionReasons')
    })
  })
})

// Unit tests for common prefix extraction (no DB required)
describe('FakeFactsOrchestrator - extractCommonPrefix (Unit)', () => {

  it('should move common prefix "a " from all answers to question', () => {
    const question = 'learned to fly _____'
    const realAnswer = 'a Cessna'
    const houseAnswers = ['a Boeing 747', 'a helicopter', 'a drone', 'a spaceship', 'a glider']

    const result = extractCommonPrefix(question, realAnswer, houseAnswers)

    expect(result.question).toBe('learned to fly a _____')
    expect(result.realAnswer).toBe('Cessna')
    expect(result.houseAnswers).toEqual(['Boeing 747', 'helicopter', 'drone', 'spaceship', 'glider'])
  })

  it('should move common prefix "the " from all answers to question', () => {
    const question = 'was arrested by _____'
    const realAnswer = 'the police'
    const houseAnswers = ['the FBI', 'the sheriff', 'the coast guard', 'the military', 'the rangers']

    const result = extractCommonPrefix(question, realAnswer, houseAnswers)

    expect(result.question).toBe('was arrested by the _____')
    expect(result.realAnswer).toBe('police')
    expect(result.houseAnswers).toEqual(['FBI', 'sheriff', 'coast guard', 'military', 'rangers'])
  })

  it('should NOT move prefix if not all answers have it', () => {
    const question = 'was found with _____'
    const realAnswer = 'a cobra'
    const houseAnswers = ['a python', 'snakes', 'his pet', 'stolen goods', 'a gun']

    const result = extractCommonPrefix(question, realAnswer, houseAnswers)

    // Should remain unchanged since not all answers start with "a "
    expect(result.question).toBe('was found with _____')
    expect(result.realAnswer).toBe('a cobra')
    expect(result.houseAnswers).toEqual(['a python', 'snakes', 'his pet', 'stolen goods', 'a gun'])
  })

  it('should handle no common prefix', () => {
    const question = 'was caught _____'
    const realAnswer = 'stealing'
    const houseAnswers = ['running', 'hiding', 'escaping', 'lying', 'cheating']

    const result = extractCommonPrefix(question, realAnswer, houseAnswers)

    expect(result.question).toBe('was caught _____')
    expect(result.realAnswer).toBe('stealing')
    expect(result.houseAnswers).toEqual(['running', 'hiding', 'escaping', 'lying', 'cheating'])
  })

  it('should handle answers with only one word (no space after prefix)', () => {
    const question = 'was using _____'
    const realAnswer = 'cocaine'
    const houseAnswers = ['heroin', 'meth', 'drugs', 'steroids', 'marijuana']

    const result = extractCommonPrefix(question, realAnswer, houseAnswers)

    // No prefix to extract since no space after first word
    expect(result.question).toBe('was using _____')
    expect(result.realAnswer).toBe('cocaine')
    expect(result.houseAnswers).toEqual(['heroin', 'meth', 'drugs', 'steroids', 'marijuana'])
  })

  it('should handle empty strings gracefully', () => {
    const question = 'did something with _____'
    const realAnswer = ''
    const houseAnswers = ['', '', '', '', '']

    const result = extractCommonPrefix(question, realAnswer, houseAnswers)

    expect(result.question).toBe('did something with _____')
    expect(result.realAnswer).toBe('')
    expect(result.houseAnswers).toEqual(['', '', '', '', ''])
  })

  it('should handle multi-word prefixes correctly (only extract first word)', () => {
    const question = 'was riding _____'
    const realAnswer = 'a stolen car'
    const houseAnswers = ['a stolen bike', 'a red car', 'a motorcycle', 'a skateboard', 'a scooter']

    const result = extractCommonPrefix(question, realAnswer, houseAnswers)

    // Should only extract "a " not "a stolen "
    expect(result.question).toBe('was riding a _____')
    expect(result.realAnswer).toBe('stolen car')
    expect(result.houseAnswers).toEqual(['stolen bike', 'red car', 'motorcycle', 'skateboard', 'scooter'])
  })
})
