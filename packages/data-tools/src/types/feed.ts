import { z } from 'zod'

export const FeedCategorySchema = z.enum(['weird', 'offbeat', 'general', 'unknown'])
export type FeedCategory = z.infer<typeof FeedCategorySchema>

export const FeedSourceSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  newspaperName: z.string(),
  domain: z.string(),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  language: z.string().length(2), // ISO 639-1
  category: FeedCategorySchema,
  keywords: z.array(z.string()),

  // Metadata
  title: z.string(),
  description: z.string().nullable(),
  lastBuildDate: z.date().nullable(),

  // Discovery info
  discoveredAt: z.date(),
  lastCheckedAt: z.date(),
  lastSuccessfulFetchAt: z.date().nullable(),

  // Quality metrics
  articleCount: z.number().int().nonnegative(),
  updateFrequency: z.number().nonnegative(), // Articles per week
  qualityScore: z.number().int().min(0).max(100),

  // Status
  isActive: z.boolean(),
  isValidated: z.boolean(),
  errors: z.array(z.string()),
})

export type FeedSource = z.infer<typeof FeedSourceSchema>
