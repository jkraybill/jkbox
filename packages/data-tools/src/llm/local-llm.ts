import { Ollama } from 'ollama'
import type { LocalLLMConfig, ClassificationResult } from './types'

/**
 * Local LLM abstraction layer for content classification
 * Currently supports Ollama, designed for future extensibility
 */
export class LocalLLM {
  private client: Ollama
  private config: LocalLLMConfig

  constructor(config: LocalLLMConfig) {
    this.config = config
    this.client = new Ollama({ host: config.endpoint })
  }

  /**
   * Classify a single article as weird/not weird
   */
  async classify(title: string, description: string): Promise<ClassificationResult> {
    const prompt = this.buildPrompt(title, description)

    try {
      const response = await this.client.generate({
        model: this.config.model,
        prompt,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
        },
      })

      return this.parseResponse(response.response)
    } catch (error) {
      throw new Error(`Ollama classification failed: ${error}`)
    }
  }

  /**
   * Batch classify multiple articles
   */
  async batchClassify(
    articles: Array<{ title: string; description: string }>
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = []

    for (const article of articles) {
      const result = await this.classify(article.title, article.description)
      results.push(result)
    }

    return results
  }

  private buildPrompt(title: string, description: string): string {
    return `You are classifying news articles as "weird/offbeat/unusual" or "normal news".

Examples of WEIRD news:
- "Man arrested for trying to pay for McDonald's with marijuana"
- "Florida woman calls 911 because McDonald's ran out of McNuggets"
- "Escaped emu spotted riding city bus"
- "Woman marries 300-year-old ghost pirate"

Examples of NORMAL news:
- "President announces new economic policy"
- "Local school adds STEM program"
- "City council approves budget increase"
- "Stock market reaches new high"

Article: ${title} - ${description}

Is this weird/offbeat news? Answer in this exact format:
VERDICT: YES or NO
CONFIDENCE: <number 0-100>
REASONING: <brief explanation>`
  }

  private parseResponse(response: string): ClassificationResult {
    // Parse the structured response
    const verdictMatch = response.match(/VERDICT:\s*(YES|NO)/i)
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/i)
    const reasoningMatch = response.match(/REASONING:\s*(.+?)(?:\n|$)/is)

    const isWeird = verdictMatch?.[1]?.toUpperCase() === 'YES'
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1] || '0', 10) : 50
    const reasoning = reasoningMatch?.[1]?.trim() || 'No reasoning provided'

    return {
      isWeird,
      confidence: Math.min(100, Math.max(0, confidence)),
      reasoning,
    }
  }
}
