import { Pool } from 'pg'
import { createHash } from 'crypto'
import type { FeedSource, FeedCategory } from '../../types/feed'
import type { DomainDiscovery, DiscoverySession } from '../../types/domain'
import type { Article, ArticleInsert } from '../../types/article'
import type {
  FakeFactsQuestion,
  FakeFactsQuestionInsert,
  FakeFactsAnswer,
  FakeFactsAnswerInsert,
  FakeFactsGameQuestion,
} from '../../types/fake-facts'

/**
 * Type-safe PostgreSQL query layer
 */
export class DatabaseQueries {
  constructor(private pool: Pool) {}

  // ============ Feed Sources ============

  async insertFeedSource(feed: Omit<FeedSource, 'id'>): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO feed_sources (
        url, newspaper_name, domain, country, language, category, keywords,
        title, description, last_build_date,
        discovered_at, last_checked_at, last_successful_fetch_at,
        article_count, update_frequency, quality_score,
        is_active, is_validated, errors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id`,
      [
        feed.url,
        feed.newspaperName,
        feed.domain,
        feed.country,
        feed.language,
        feed.category,
        JSON.stringify(feed.keywords),
        feed.title,
        feed.description,
        feed.lastBuildDate,
        feed.discoveredAt,
        feed.lastCheckedAt,
        feed.lastSuccessfulFetchAt,
        feed.articleCount,
        feed.updateFrequency,
        feed.qualityScore,
        feed.isActive,
        feed.isValidated,
        JSON.stringify(feed.errors),
      ]
    )
    return result.rows[0]!.id
  }

  async getFeedsByLanguage(language: string, limit?: number): Promise<FeedSource[]> {
    const query = limit
      ? 'SELECT * FROM feed_sources WHERE language = $1 ORDER BY quality_score DESC LIMIT $2'
      : 'SELECT * FROM feed_sources WHERE language = $1 ORDER BY quality_score DESC'

    const result = await this.pool.query(query, limit ? [language, limit] : [language])
    return result.rows.map(this.mapFeedSourceRow)
  }

  async getFeedsByCategory(
    category: FeedCategory,
    language?: string
  ): Promise<FeedSource[]> {
    const query = language
      ? 'SELECT * FROM feed_sources WHERE category = $1 AND language = $2 ORDER BY quality_score DESC'
      : 'SELECT * FROM feed_sources WHERE category = $1 ORDER BY quality_score DESC'

    const result = await this.pool.query(
      query,
      language ? [category, language] : [category]
    )
    return result.rows.map(this.mapFeedSourceRow)
  }

  async getFeedById(id: number): Promise<FeedSource | null> {
    const result = await this.pool.query('SELECT * FROM feed_sources WHERE id = $1', [id])
    return result.rows.length > 0 ? this.mapFeedSourceRow(result.rows[0]) : null
  }

  async getAllValidatedFeeds(): Promise<FeedSource[]> {
    const result = await this.pool.query(
      'SELECT * FROM feed_sources WHERE is_validated = true ORDER BY quality_score DESC'
    )
    return result.rows.map(this.mapFeedSourceRow)
  }

  // ============ Domain Discovery ============

  async insertDomainDiscovery(
    discovery: Omit<DomainDiscovery, 'id'>
  ): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO domain_discovery (
        domain, checked_at, authority_rank, has_ssl, domain_age, feeds_found,
        sample_articles_tested, weird_articles_found,
        feeds_added, rejection_reason, content_types, notes, session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        discovery.domain,
        discovery.checkedAt,
        discovery.authorityRank,
        discovery.hasSSL,
        discovery.domainAge,
        discovery.feedsFound,
        discovery.sampleArticlesTested,
        discovery.weirdArticlesFound,
        JSON.stringify(discovery.feedsAdded),
        discovery.rejectionReason,
        JSON.stringify(discovery.contentTypes),
        discovery.notes,
        discovery.sessionId,
      ]
    )
    return result.rows[0]!.id
  }

  // ============ Discovery Sessions ============

  async createDiscoverySession(seedDomains: string[]): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO discovery_sessions (seed_domains, stats)
       VALUES ($1, $2)
       RETURNING id`,
      [JSON.stringify(seedDomains), JSON.stringify({ totalRequests: 0, successfulRequests: 0, failedRequests: 0, averageResponseTime: 0, ollamaClassifications: 0 })]
    )
    return result.rows[0]!.id
  }

  async updateDiscoverySession(
    sessionId: string,
    updates: Partial<DiscoverySession>
  ): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []
    let paramCount = 1

    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramCount++}`)
      values.push(updates.completedAt)
    }
    if (updates.domainsEvaluated !== undefined) {
      fields.push(`domains_evaluated = $${paramCount++}`)
      values.push(updates.domainsEvaluated)
    }
    if (updates.feedsDiscovered !== undefined) {
      fields.push(`feeds_discovered = $${paramCount++}`)
      values.push(updates.feedsDiscovered)
    }
    if (updates.feedsValidated !== undefined) {
      fields.push(`feeds_validated = $${paramCount++}`)
      values.push(updates.feedsValidated)
    }
    if (updates.feedsFailed !== undefined) {
      fields.push(`feeds_failed = $${paramCount++}`)
      values.push(updates.feedsFailed)
    }
    if (updates.errors !== undefined) {
      fields.push(`errors = $${paramCount++}`)
      values.push(JSON.stringify(updates.errors))
    }
    if (updates.stats !== undefined) {
      fields.push(`stats = $${paramCount++}`)
      values.push(JSON.stringify(updates.stats))
    }

    fields.push(`updated_at = NOW()`)
    values.push(sessionId)

    await this.pool.query(
      `UPDATE discovery_sessions SET ${fields.join(', ')} WHERE id = $${paramCount}`,
      values
    )
  }

  /**
   * Get domains checked within the last N hours
   */
  async getRecentlyCheckedDomains(hoursAgo: number = 24): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT domain
       FROM domain_discovery
       WHERE checked_at > NOW() - INTERVAL '${hoursAgo} hours'`,
      []
    )
    return result.rows.map((row) => row.domain)
  }

  /**
   * Get domain last check time
   */
  async getDomainLastChecked(domain: string): Promise<Date | null> {
    const result = await this.pool.query(
      `SELECT MAX(checked_at) as last_checked
       FROM domain_discovery
       WHERE domain = $1`,
      [domain]
    )
    return result.rows[0]?.last_checked ? new Date(result.rows[0].last_checked) : null
  }

  // ============ Articles ============

  /**
   * Insert article with deduplication
   * Uses content_hash (SHA256 of title+description) to prevent duplicates
   */
  async insertArticle(article: ArticleInsert): Promise<string | null> {
    // Generate content hash for deduplication
    const contentHash = this.generateContentHash(article.title, article.description ?? '')

    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO articles (
          source_type, source_id, source_url,
          title, description, content, link,
          author, pub_date, collected_at,
          is_weird, weird_confidence, categories,
          engagement_score, quality_score,
          language, country, content_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (content_hash) DO NOTHING
        RETURNING id`,
        [
          article.sourceType,
          article.sourceId,
          article.sourceUrl,
          article.title,
          article.description,
          article.content,
          article.link,
          article.author,
          article.pubDate,
          article.collectedAt,
          article.isWeird,
          article.weirdConfidence,
          article.categories, // PostgreSQL handles arrays natively
          article.engagementScore,
          article.qualityScore,
          article.language,
          article.country,
          contentHash,
        ]
      )
      // Returns null if duplicate (ON CONFLICT DO NOTHING)
      return result.rows[0]?.id ?? null
    } catch (error) {
      console.error(`Failed to insert article: ${error}`)
      return null
    }
  }

  /**
   * Bulk insert articles with deduplication
   * Returns count of successfully inserted (non-duplicate) articles
   */
  async insertArticles(articles: ArticleInsert[]): Promise<number> {
    let inserted = 0
    for (const article of articles) {
      const id = await this.insertArticle(article)
      if (id) inserted++
    }
    return inserted
  }

  /**
   * Check if article exists by source URL
   */
  async articleExistsByUrl(sourceUrl: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT EXISTS(SELECT 1 FROM articles WHERE source_url = $1) as exists',
      [sourceUrl]
    )
    return result.rows[0]?.exists ?? false
  }

  /**
   * Get articles by source
   */
  async getArticlesBySource(
    sourceType: 'rss' | 'historical' | 'reddit',
    sourceId: string,
    limit?: number
  ): Promise<Article[]> {
    const query = limit
      ? `SELECT * FROM articles WHERE source_type = $1 AND source_id = $2
         ORDER BY pub_date DESC LIMIT $3`
      : `SELECT * FROM articles WHERE source_type = $1 AND source_id = $2
         ORDER BY pub_date DESC`

    const result = await this.pool.query(
      query,
      limit ? [sourceType, sourceId, limit] : [sourceType, sourceId]
    )
    return result.rows.map(this.mapArticleRow)
  }

  /**
   * Get weird articles
   */
  async getWeirdArticles(limit?: number): Promise<Article[]> {
    const query = limit
      ? `SELECT * FROM articles WHERE is_weird = true
         ORDER BY pub_date DESC LIMIT $1`
      : `SELECT * FROM articles WHERE is_weird = true
         ORDER BY pub_date DESC`

    const result = await this.pool.query(query, limit ? [limit] : [])
    return result.rows.map(this.mapArticleRow)
  }

  // ============ Helper Methods ============

  private generateContentHash(title: string, description: string): string {
    const content = `${title}|${description}`.toLowerCase().trim()
    return createHash('sha256').update(content).digest('hex')
  }

  private mapFeedSourceRow(row: any): FeedSource {
    // Handle keywords - might be array, JSON string, or CSV string
    let keywords: string[]
    if (Array.isArray(row.keywords)) {
      keywords = row.keywords
    } else if (typeof row.keywords === 'string') {
      try {
        keywords = JSON.parse(row.keywords)
      } catch {
        // If JSON parse fails, treat as comma-separated values
        keywords = row.keywords.split(',').map((k: string) => k.trim())
      }
    } else {
      keywords = []
    }

    // Handle errors - might be array or JSON string
    let errors: string[]
    if (Array.isArray(row.errors)) {
      errors = row.errors
    } else if (typeof row.errors === 'string') {
      try {
        errors = JSON.parse(row.errors)
      } catch {
        errors = []
      }
    } else {
      errors = []
    }

    return {
      id: row.id,
      url: row.url,
      newspaperName: row.newspaper_name,
      domain: row.domain,
      country: row.country,
      language: row.language,
      category: row.category,
      keywords,
      title: row.title,
      description: row.description,
      lastBuildDate: row.last_build_date ? new Date(row.last_build_date) : null,
      discoveredAt: new Date(row.discovered_at),
      lastCheckedAt: new Date(row.last_checked_at),
      lastSuccessfulFetchAt: row.last_successful_fetch_at
        ? new Date(row.last_successful_fetch_at)
        : null,
      articleCount: row.article_count,
      updateFrequency: parseFloat(row.update_frequency),
      qualityScore: row.quality_score,
      isActive: row.is_active,
      isValidated: row.is_validated,
      errors,
    }
  }

  // ============ Fake Facts ============

  /**
   * Get unprocessed articles for Fake Facts generation
   * Sorted by last_considered (nulls first), then random
   */
  async getUnprocessedArticles(limit: number = 10): Promise<Article[]> {
    const result = await this.pool.query(
      `SELECT * FROM articles
       WHERE (fake_facts_processed = false OR fake_facts_processed IS NULL)
       AND is_weird = true
       ORDER BY last_considered ASC NULLS FIRST, RANDOM()
       LIMIT $1`,
      [limit]
    )
    return result.rows.map(this.mapArticleRow)
  }

  /**
   * Update last_considered timestamp for multiple articles
   */
  async updateLastConsidered(articleIds: string[]): Promise<void> {
    if (articleIds.length === 0) return

    await this.pool.query(
      `UPDATE articles
       SET last_considered = NOW()
       WHERE id = ANY($1::uuid[])`,
      [articleIds]
    )
  }

  /**
   * Mark article as processed for Fake Facts
   */
  async markArticleAsProcessed(
    articleId: string,
    eligible: boolean,
    rejectionReason: string | null
  ): Promise<void> {
    await this.pool.query(
      `UPDATE articles
       SET fake_facts_processed = true,
           fake_facts_processed_at = NOW(),
           fake_facts_eligible = $2,
           fake_facts_rejection_reason = $3
       WHERE id = $1`,
      [articleId, eligible, rejectionReason]
    )
  }

  /**
   * Update article summary (cache for reuse)
   */
  async updateArticleSummary(articleId: string, summary: string): Promise<void> {
    await this.pool.query(
      `UPDATE articles
       SET article_summary = $2
       WHERE id = $1`,
      [articleId, summary]
    )
  }

  /**
   * Update spacetime metadata for an article
   */
  async updateSpacetimeMetadata(
    articleId: string,
    metadata: { eventYear?: number | null; locationCity?: string | null; locationState?: string | null }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE articles
       SET event_year = $2,
           location_city = $3,
           location_state = $4
       WHERE id = $1`,
      [articleId, metadata.eventYear, metadata.locationCity, metadata.locationState]
    )
  }

  /**
   * Insert a new Fake Facts question
   */
  async insertQuestion(question: FakeFactsQuestionInsert): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO fake_facts_questions (
        article_id, question_text, blank_text, postscript, generator_model, generation_cost
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [
        question.articleId,
        question.questionText,
        question.blankText,
        question.postscript ?? null,
        question.generatorModel,
        question.generationCost ?? null,
      ]
    )
    return result.rows[0]!.id
  }

  /**
   * Insert a single answer
   */
  async insertAnswer(answer: FakeFactsAnswerInsert): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO fake_facts_answers (
        question_id, answer_text, is_real, answer_order, generator_model
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        answer.questionId,
        answer.answerText,
        answer.isReal,
        answer.answerOrder ?? null,
        answer.generatorModel ?? null,
      ]
    )
    return result.rows[0]!.id
  }

  /**
   * Insert multiple answers
   */
  async insertAnswers(answers: FakeFactsAnswerInsert[]): Promise<string[]> {
    const ids: string[] = []
    for (const answer of answers) {
      const id = await this.insertAnswer(answer)
      ids.push(id)
    }
    return ids
  }

  /**
   * Get a complete question with all answers for gameplay
   */
  async getQuestionWithAnswers(questionId: string): Promise<FakeFactsGameQuestion | null> {
    // Get question
    const questionResult = await this.pool.query(
      'SELECT * FROM fake_facts_questions WHERE id = $1',
      [questionId]
    )

    if (questionResult.rows.length === 0) {
      return null
    }

    // Get all answers
    const answersResult = await this.pool.query(
      'SELECT * FROM fake_facts_answers WHERE question_id = $1 ORDER BY answer_order',
      [questionId]
    )

    const question = this.mapQuestionRow(questionResult.rows[0])
    const allAnswers = answersResult.rows.map(this.mapAnswerRow)

    const realAnswer = allAnswers.find((a) => a.isReal)
    const houseAnswers = allAnswers.filter((a) => !a.isReal)

    if (!realAnswer) {
      return null
    }

    return {
      question,
      realAnswer,
      houseAnswers,
    }
  }

  private mapArticleRow(row: any): Article {
    return {
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      title: row.title,
      description: row.description,
      content: row.content,
      link: row.link,
      author: row.author,
      pubDate: row.pub_date ? new Date(row.pub_date) : null,
      collectedAt: new Date(row.collected_at),
      isWeird: row.is_weird,
      weirdConfidence: row.weird_confidence,
      categories: Array.isArray(row.categories) ? row.categories : [],
      engagementScore: row.engagement_score,
      qualityScore: row.quality_score,
      language: row.language,
      country: row.country,
      contentHash: row.content_hash,
      // Fake Facts fields
      fakeFactsProcessed: row.fake_facts_processed ?? false,
      fakeFactsProcessedAt: row.fake_facts_processed_at
        ? new Date(row.fake_facts_processed_at)
        : null,
      fakeFactsEligible: row.fake_facts_eligible,
      fakeFactsRejectionReason: row.fake_facts_rejection_reason,
      articleSummary: row.article_summary,
      fullContentFetched: row.full_content_fetched ?? false,
      fullContentFetchedAt: row.full_content_fetched_at
        ? new Date(row.full_content_fetched_at)
        : null,
      // Spacetime metadata
      eventYear: row.event_year,
      locationCity: row.location_city,
      locationState: row.location_state,
    }
  }

  private mapQuestionRow(row: any): FakeFactsQuestion {
    return {
      id: row.id,
      articleId: row.article_id,
      questionText: row.question_text,
      blankText: row.blank_text,
      generatedAt: new Date(row.generated_at),
      generatorModel: row.generator_model,
      generationCost: row.generation_cost ? parseFloat(row.generation_cost) : null,
      timesUsed: row.times_used,
      timesCorrect: row.times_correct,
      difficultyScore: row.difficulty_score ? parseFloat(row.difficulty_score) : null,
      isActive: row.is_active,
      isReviewed: row.is_reviewed,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private mapAnswerRow(row: any): FakeFactsAnswer {
    return {
      id: row.id,
      questionId: row.question_id,
      answerText: row.answer_text,
      isReal: row.is_real,
      answerOrder: row.answer_order,
      generatedAt: new Date(row.generated_at),
      generatorModel: row.generator_model,
      timesSelected: row.times_selected,
      createdAt: new Date(row.created_at),
    }
  }
}
