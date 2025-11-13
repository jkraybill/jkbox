import { z } from 'zod'

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  feedId: z.string().uuid(),

  // Article data
  title: z.string(),
  link: z.string().url(),
  description: z.string().nullable(),
  content: z.string().nullable(), // Full article text
  author: z.string().nullable(),
  pubDate: z.date(),

  // Content analysis
  isWeird: z.boolean().nullable(),
  weirdnessScore: z.number().int().min(0).max(100).nullable(),
  categories: z.array(z.string()),

  // Metadata
  fetchedAt: z.date(),
  language: z.string().length(2), // ISO 639-1
})

export type Article = z.infer<typeof ArticleSchema>
