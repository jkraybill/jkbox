import { Pool } from 'pg'
import type { FeedSource, FeedCategory } from '../../types/feed'
import type { DomainDiscovery, DiscoverySession } from '../../types/domain'

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

  // ============ Helper Methods ============

  private mapFeedSourceRow(row: any): FeedSource {
    return {
      id: row.id,
      url: row.url,
      newspaperName: row.newspaper_name,
      domain: row.domain,
      country: row.country,
      language: row.language,
      category: row.category,
      keywords: JSON.parse(row.keywords),
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
      errors: JSON.parse(row.errors),
    }
  }
}
