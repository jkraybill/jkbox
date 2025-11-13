import { z } from 'zod'

export const DomainDiscoverySchema = z.object({
  id: z.string().uuid(),
  domain: z.string(),
  checkedAt: z.date(),

  // Validation results
  authorityRank: z.number().int().positive().nullable(),
  hasSSL: z.boolean(),
  domainAge: z.number().nonnegative().nullable(), // Years
  feedsFound: z.number().int().nonnegative(),

  // Content classification (Ollama)
  sampleArticlesTested: z.number().int().nonnegative(),
  weirdArticlesFound: z.number().int().nonnegative(),

  // Outcome
  feedsAdded: z.array(z.string().uuid()),
  rejectionReason: z.string().nullable(),

  // Future reuse
  contentTypes: z.array(z.string()),
  notes: z.string().nullable(),

  // Discovery session tracking
  sessionId: z.string().uuid(),
})

export type DomainDiscovery = z.infer<typeof DomainDiscoverySchema>

export const DiscoverySessionSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.date(),
  completedAt: z.date().nullable(),

  seedDomains: z.array(z.string()),
  domainsEvaluated: z.number().int().nonnegative(),
  feedsDiscovered: z.number().int().nonnegative(),
  feedsValidated: z.number().int().nonnegative(),
  feedsFailed: z.number().int().nonnegative(),

  errors: z.array(z.string()),
  stats: z.object({
    totalRequests: z.number().int().nonnegative(),
    successfulRequests: z.number().int().nonnegative(),
    failedRequests: z.number().int().nonnegative(),
    averageResponseTime: z.number().nonnegative(),
    ollamaClassifications: z.number().int().nonnegative(),
  }),
})

export type DiscoverySession = z.infer<typeof DiscoverySessionSchema>
