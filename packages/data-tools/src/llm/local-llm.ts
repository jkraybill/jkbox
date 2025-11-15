import { Ollama } from 'ollama'
import type { LocalLLMConfig, ClassificationResult } from './types'
import type { CandidateEvaluation } from '../types/fake-facts'

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
    return `You are classifying news articles for a trivia game that uses WEIRD/OFFBEAT/SURPRISING stories.

=== WHAT MAKES A GOOD "WEIRD" ARTICLE ===

✅ ACCEPT if it has:
1. BIZARRE and oddly specific details (not just "unusual for the context")
2. UNEXPECTED and surprising (not predictable consequences)
3. Absurd visuals or situations (makes you laugh or say "what?!")
4. Clear, concrete factual hook (NOT vague or generic)
5. Little-known story (NOT famous events everyone knows)

Key test: Is this INHERENTLY weird, or just "ironic given context"?
- "Cow in swimming pool" = WEIRD (inherently absurd)
- "Hunter killed by animal he was hunting" = NOT WEIRD (expected risk)

❌ REJECT if it's:
1. Generic/vague headlines ("Assorted Stupidity #118", "Florida Man Does Something")
2. Well-known events (famous trials, viral stories everyone heard about)
3. Celebrity news that's boring (unless truly bizarre)
4. Political news (UNLESS genuinely absurd, like "Mayor arrested for impersonating Elvis")
5. Sad/tragic stories without comedy angle
6. Lists without specific focus
7. Opinion pieces or think pieces

=== EXAMPLES OF GREAT "WEIRD" ARTICLES ===

✅ "Woman found dead on bus with 26 iPhones glued to her body"
   → GOOD: Bizarre, oddly specific, unexpected

✅ "Firefighters rescue cow from Oklahoma swimming pool"
   → GOOD: Surprising, funny, weird, absurd visual

=== EXAMPLES OF MEDIOCRE ARTICLES (BORDERLINE) ===

⚠️ "Ring doorbell camera footage sparks alien speculation"
   → OK: A bit funny, a bit surprising, but pedestrian

=== EXAMPLES OF BAD ARTICLES (REJECT) ===

❌ "Texas trophy hunter killed by buffalo he was stalking in South Africa"
   → BAD: Hunter killed by wild animal is not unexpected or inherently funny (even though it has irony)

❌ "Shelter dog named Chase caught on camera scaling kennel door"
   → BAD: Not surprising, not weird (even though open-ended)

❌ "Assorted Stupidity #118"
   → BAD: Too generic, no specific fact

❌ "O.J. Simpson Bronco chase"
   → BAD: Too famous, everyone knows this

❌ "Trump says controversial thing at rally"
   → BAD: Political, boring, happens daily

❌ "Five weird facts about pandas"
   → BAD: List article, too vague

=== YOUR TASK ===

Article Title: "${title}"
Description: "${description || 'No description'}"

Classify this article. Ask yourself:
- Is there a BIZARRE, oddly specific detail?
- Is it INHERENTLY weird (not just "ironic given context")?
- Does it create an absurd visual or situation?
- Would someone say "WHAT?!" when they hear it?
- Is it truly UNEXPECTED (not a predictable consequence)?

Answer in this EXACT format:
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

  /**
   * Summarize article content for question generation
   * Target: ~50 words, focusing on the weird/funny details
   */
  async summarize(title: string, content: string): Promise<string> {
    const prompt = `Summarize this weird news article in about 50 words. Focus on the most interesting, funny, or surprising details that would make good trivia questions. Be concise but capture the essence of what makes this story weird.

Article Title: ${title}

Content: ${content.substring(0, 2000)}

Write a ~50 word summary:`

    try {
      const response = await this.client.generate({
        model: this.config.model,
        prompt,
        options: {
          temperature: 0.7,
          num_predict: 100,
        },
      })

      return response.response.trim()
    } catch (error) {
      throw new Error(`Ollama summarization failed: ${error}`)
    }
  }

  /**
   * Evaluate if article is a good candidate for Fake Facts questions
   */
  async evaluateCandidate(title: string, summary: string): Promise<CandidateEvaluation> {
    const prompt = `Evaluate if this weird news article would make a good trivia question for a game called "Fake Facts".

Article Title: ${title}
Summary: ${summary}

GOOD candidates have:
✓ Open-ended facts (blank can be filled multiple ways)
✓ Multiple comedy angles
✓ Little-known, specific facts
✓ Non-obvious details (not well-known people or events)
✓ High replayability
✓ Inherently funny or absurd

BAD candidates have:
✗ Generic titles like "Assorted Stupidity #118"
✗ Well-known people or events (e.g., "O.J. Simpson")
✗ Too broad or vague
✗ No specific surprising detail
✗ Lists without a specific focus

EXAMPLES:
GOOD: "United States v. 1855.6 Pounds of American Paddlefish Meat" - specific, unusual legal case
GOOD: "Court Says Bees Are Fish" - surprising classification, unexpected
BAD: "Assorted Stupidity #118" - too generic, no specific fact
BAD: "O.J. Simpson Embarks on Long, Slow Bronco Ride" - too well-known

Evaluate this article and respond in this EXACT format:
VERDICT: YES or NO
CONFIDENCE: <number 0-100>
REASON: <brief explanation>`

    try {
      const response = await this.client.generate({
        model: this.config.model,
        prompt,
        options: {
          temperature: 0.5,
          num_predict: 150,
        },
      })

      return this.parseCandidateResponse(response.response)
    } catch (error) {
      throw new Error(`Ollama candidate evaluation failed: ${error}`)
    }
  }

  private parseCandidateResponse(response: string): CandidateEvaluation {
    const verdictMatch = response.match(/VERDICT:\s*(YES|NO)/i)
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/i)
    const reasonMatch = response.match(/REASON:\s*(.+?)(?:\n|$)/is)

    const isGoodCandidate = verdictMatch?.[1]?.toUpperCase() === 'YES'
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1] || '0', 10) : 50
    const reason = reasonMatch?.[1]?.trim() || 'No reason provided'

    return {
      isGoodCandidate,
      confidence: Math.min(100, Math.max(0, confidence)),
      reason,
    }
  }
}
