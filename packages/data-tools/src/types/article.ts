import { z } from 'zod'

/**
 * Unified article type for all content sources:
 * - RSS feeds (current)
 * - Historical snapshots (Wayback Machine)
 * - Reddit posts
 */

export const SourceTypeSchema = z.enum(['rss', 'historical', 'reddit'])
export type SourceType = z.infer<typeof SourceTypeSchema>

export const ArticleSchema = z.object({
  id: z.string().uuid().optional(),

  // Source information
  sourceType: SourceTypeSchema,
  sourceId: z.string().nullable(), // feed_id for RSS, subreddit for Reddit
  sourceUrl: z.string(), // Feed URL, Reddit permalink, etc.

  // Core content (the noun: question inspiration / weird news item)
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(), // Full HTML/text content
  link: z.string().nullable(),

  // Metadata
  author: z.string().nullable(),
  pubDate: z.date().nullable(),
  collectedAt: z.date(),

  // Classification
  isWeird: z.boolean().nullable(),
  weirdConfidence: z.number().int().min(0).max(100).nullable(), // 0-100
  categories: z.array(z.string()),

  // Quality metrics
  engagementScore: z.number().nullable(), // Reddit upvotes, etc.
  qualityScore: z.number().nullable(),

  // Language/region
  language: z.string().length(2), // ISO 639-1
  country: z.string().length(2).nullable(), // ISO 3166-1

  // Deduplication
  contentHash: z.string().nullable(), // SHA256(title + description)
})

export type Article = z.infer<typeof ArticleSchema>
export type ArticleInsert = Omit<Article, 'id'>
