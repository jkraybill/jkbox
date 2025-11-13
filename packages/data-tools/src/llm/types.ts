import { z } from 'zod'

export const LocalLLMConfigSchema = z.object({
  provider: z.literal('ollama'), // Future: 'llamacpp', 'vllm', etc.
  model: z.string(),
  endpoint: z.string().url(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
})

export type LocalLLMConfig = z.infer<typeof LocalLLMConfigSchema>

export const ClassificationResultSchema = z.object({
  isWeird: z.boolean(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
})

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>
