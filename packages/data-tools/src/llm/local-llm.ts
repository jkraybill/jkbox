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
8. Depressing corporate/workplace dystopia (even if unusual, not funny)
9. Simple misunderstandings or mistakes (unless the outcome is absurd)
10. Crime stories that are just crimes (assault, theft, etc. - not inherently weird)

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

❌ "Woman accidentally goes on date with 97-year-old man"
   → BAD: Simple misunderstanding/mistake, not inherently absurd or funny

❌ "Amazon workers peeing in bottles to meet quotas"
   → BAD: Depressing workplace dystopia, not funny (even if unusual)

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
- Is it FUNNY or absurd (not just depressing/sad)?
- Is it more than just a simple mistake or misunderstanding?

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
    const prompt = `Extract the key bizarre details from this weird news article for a trivia game.

Focus on:
1. SPECIFIC details (exact objects, animals, numbers, actions)
2. The ABSURD/UNEXPECTED element (what makes this weird)
3. WHO did WHAT (concrete actions, not vague descriptions)
4. WHERE and WHEN (location, timeframe)

DO NOT include:
- Vague generalizations
- Background context
- Opinions or commentary
- Unnecessary adjectives

Examples of GOOD summaries:
- "A woman was found dead on a bus in Brazil with 26 iPhones glued to her body. Police arrested two suspects in the smuggling operation."
- "Firefighters in Oklahoma rescued a cow that fell into a backyard swimming pool."
- "A shelter dog named Chase was caught on security cameras repeatedly escaping his kennel by scaling the door."

Article Title: ${title}

Content: ${content.substring(0, 2000)}

Write a concise 40-60 word summary with SPECIFIC details:`

    try {
      const response = await this.client.generate({
        model: this.config.model,
        prompt,
        options: {
          temperature: 0.3, // Lower temp for factual extraction
          num_predict: 120, // Slightly more tokens for detailed summary
        },
      })

      return response.response.trim()
    } catch (error) {
      throw new Error(`Ollama summarization failed: ${error}`)
    }
  }

  /**
   * Extract individual weird news stories from a News of the Weird compilation
   * Returns array of {title, content} for each story
   */
  /**
   * Estimate reasonable story count from input content structure
   */
  private estimateStoryCount(content: string): { min: number; max: number } {
    // Count paragraph breaks (double newlines)
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50).length

    // Count section headers (all-caps lines)
    const sectionHeaders = content.split('\n')
      .filter(line => {
        const trimmed = line.trim()
        return trimmed.length > 5 &&
               trimmed.length < 100 &&
               trimmed === trimmed.toUpperCase() &&
               /^[A-Z\s-]+$/.test(trimmed)
      }).length

    // Use the higher of the two as baseline
    const baseline = Math.max(paragraphs, sectionHeaders)

    // Reasonable range: baseline to 2x baseline
    // (Some stories might be multi-paragraph, some single)
    return {
      min: Math.max(1, Math.floor(baseline * 0.3)),
      max: Math.max(baseline * 2, 15) // At least 15 max
    }
  }

  async extractStories(compilationContent: string): Promise<{
    stories: Array<{ title: string; content: string }>
    valid: boolean
    validationError?: string
  }> {
    const prompt = `You are extracting individual weird news stories from a "News of the Weird" weekly compilation.

Each weekly column contains multiple individual weird news stories. Your task is to:
1. Identify each distinct weird news story
2. Generate a punchy, specific headline for each story (like a tabloid headline)
3. Extract the full text of that story

Guidelines for headlines:
- Be SPECIFIC and CONCRETE (include key details like numbers, animals, objects, locations)
- Make it punchy and attention-grabbing (like "63-year-old predicts future by throwing asparagus")
- Include the WEIRD element in the headline
- Keep it concise (aim for 8-15 words)
- DON'T use generic phrases like "Man does weird thing"
- DON'T repeat the same story multiple times
- DON'T make up stories that aren't in the text

Compilation text:
${compilationContent.substring(0, 10000)}

IMPORTANT: Extract ONLY the distinct stories present in the compilation. Most columns have 8-12 stories. Don't hallucinate or repeat!

Extract ALL individual stories and respond in this EXACT format:

STORY 1
TITLE: <punchy headline here>
CONTENT: <full story text here>

STORY 2
TITLE: <punchy headline here>
CONTENT: <full story text here>

(continue for all stories found)`

    try {
      const response = await this.client.generate({
        model: this.config.model,
        prompt,
        options: {
          temperature: 0.4,
          num_predict: 4000, // Increased for 8-12 stories
        },
      })

      const stories = this.parseStoriesResponse(response.response)

      // Validate against input content structure
      const expectedRange = this.estimateStoryCount(compilationContent)
      if (stories.length > expectedRange.max) {
        return {
          stories,
          valid: false,
          validationError: `Extracted ${stories.length} stories but input suggests ${expectedRange.min}-${expectedRange.max} (likely hallucination)`,
        }
      }

      // Validate for other hallucination patterns
      const validation = this.validateStoryExtraction(stories)

      return {
        stories,
        valid: validation.valid,
        validationError: validation.reason,
      }
    } catch (error) {
      throw new Error(`Ollama story extraction failed: ${error}`)
    }
  }

  private parseStoriesResponse(response: string): Array<{ title: string; content: string }> {
    const stories: Array<{ title: string; content: string }> = []

    // Split by STORY markers
    const storyBlocks = response.split(/STORY \d+/i).filter(block => block.trim())

    for (const block of storyBlocks) {
      const titleMatch = block.match(/TITLE:\s*(.+?)(?:\n|CONTENT:)/is)
      const contentMatch = block.match(/CONTENT:\s*(.+?)(?:\n\n|$)/is)

      if (titleMatch && contentMatch) {
        stories.push({
          title: titleMatch[1].trim(),
          content: contentMatch[1].trim(),
        })
      }
    }

    return stories
  }

  /**
   * Validate extracted stories to detect hallucinations/errors
   * Returns true if extraction looks valid, false if suspicious
   */
  private validateStoryExtraction(stories: Array<{ title: string; content: string }>): {
    valid: boolean
    reason?: string
  } {
    // Check 1: At least one story
    if (stories.length === 0) {
      return { valid: false, reason: 'No stories extracted' }
    }

    // NOTE: Story count is now validated against input in extractStories()
    // No hard cap here anymore

    // Check 2: Detect repetitive/duplicate titles (sign of hallucination)
    const titleSimilarities = new Map<number, number>() // index -> count of similar titles

    for (let i = 0; i < stories.length; i++) {
      const title1 = stories[i]!.title.toLowerCase()
      let similarCount = 0

      for (let j = 0; j < stories.length; j++) {
        if (i === j) continue
        const title2 = stories[j]!.title.toLowerCase()

        // Check for high similarity (starts with same words, or shares many words)
        const words1 = title1.split(/\s+/).slice(0, 5) // First 5 words
        const words2 = title2.split(/\s+/).slice(0, 5)
        const overlap = words1.filter(w => words2.includes(w)).length

        if (overlap >= 3) { // Lowered from 4 to catch "Man Survives...", "Man dies after..." patterns
          similarCount++
        }
      }

      titleSimilarities.set(i, similarCount)
    }

    // If more than 25% of titles are very similar, likely hallucination (lowered from 30%)
    const maxSimilar = Math.max(...titleSimilarities.values())
    if (maxSimilar > stories.length * 0.25) {
      return {
        valid: false,
        reason: `Too many repetitive titles detected (${maxSimilar}/${stories.length}), likely hallucination`,
      }
    }

    // Check 2b: Detect common title prefixes (hallucination pattern)
    // Flag if: (1) 2 back-to-back with same prefix, OR (2) 3+ total with same prefix
    const prefixCounts = new Map<string, number>()
    const prefixes: string[] = []

    for (const story of stories) {
      const prefix = story.title.toLowerCase().split(/\s+/).slice(0, 2).join(' ') // First 2 words
      prefixes.push(prefix)
      prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1)
    }

    // Check for back-to-back duplicates
    for (let i = 0; i < prefixes.length - 1; i++) {
      if (prefixes[i] === prefixes[i + 1]) {
        return {
          valid: false,
          reason: `Back-to-back duplicate titles with prefix "${prefixes[i]}" (positions ${i + 1}, ${i + 2}), likely hallucination`,
        }
      }
    }

    // Check for 3+ occurrences of same prefix
    for (const [prefix, count] of prefixCounts.entries()) {
      if (count >= 3) {
        return {
          valid: false,
          reason: `Too many titles with same prefix "${prefix}" (${count} occurrences), likely hallucination`,
        }
      }
    }

    // Check 3: Detect if titles are suspiciously short/long
    const avgTitleLength = stories.reduce((sum, s) => sum + s.title.length, 0) / stories.length
    if (avgTitleLength < 10) {
      return { valid: false, reason: 'Titles suspiciously short' }
    }

    // Check 4: Detect if content is suspiciously short (likely incomplete extraction)
    const avgContentLength = stories.reduce((sum, s) => sum + s.content.length, 0) / stories.length
    if (avgContentLength < 20) {
      return { valid: false, reason: 'Story content too short, likely incomplete extraction' }
    }

    return { valid: true }
  }

  /**
   * Score multiple article candidates for question generation potential
   * Returns scores 0-100 with reasoning for each
   */
  async scoreArticleCandidates(
    candidates: Array<{ id: string; title: string; summary: string }>
  ): Promise<Array<{ id: string; score: number; reasoning: string }>> {
    const prompt = `You are evaluating weird news articles for a trivia game called "Fake Facts".

This is an ADULTS-ONLY game. Dark humor, sexual content, violence, and controversial topics are ENCOURAGED as long as they're funny.

For each article, FIRST provide critical analysis, THEN score on multiple dimensions.

GOOD candidates have:
✓ Oddly SPECIFIC details (numbers, names, objects, animals, locations)
✓ Multiple comedy angles
✓ Open-ended facts (blank can be filled multiple ways)
✓ Little-known, unexpected facts
✓ Inherently funny or absurd
✓ Dark humor (death, violence, sex, drugs, crime - all fair game if funny!)

BAD candidates have:
✗ Generic or vague (no specific details)
✗ Well-known people or events
✗ Depressing/sad without ANY humor
✗ Too simple or obvious

CRITICAL: Do NOT penalize articles for adult/dark content. "A man was arrested for [sexual act]" or "Woman killed [bizarre thing]" are GREAT if they have specific, absurd details. The game embraces dark comedy.

Articles to score:
${candidates.map((c, i) => `
[${i + 1}] ${c.title}
Summary: ${c.summary}
`).join('\n')}

For EACH article, respond in this EXACT format:

ARTICLE 1
ANALYSIS: <1-2 sentences of critical analysis - what makes this good/bad for trivia?>
SCORES:
{
  "specificity": <0-100, how specific/concrete are the details?>,
  "surprise": <0-100, how unexpected/surprising is this?>,
  "openEndedness": <0-100, how many ways could a blank be filled?>,
  "humor": <0-100, how funny/absurd is this?>,
  "overall": <0-100, overall score for question generation potential>
}

ARTICLE 2
ANALYSIS: <1-2 sentences of critical analysis>
SCORES:
{
  "specificity": <0-100>,
  "surprise": <0-100>,
  "openEndedness": <0-100>,
  "humor": <0-100>,
  "overall": <0-100>
}

(continue for all articles)`

    try {
      console.log('\n' + '='.repeat(80))
      console.log('🤖 OLLAMA SCORING REQUEST')
      console.log('='.repeat(80))
      console.log('Model:', this.config.model)
      console.log('Temperature:', 0.35)
      console.log('Max Tokens:', 3000)
      console.log('\nPrompt:')
      console.log(prompt)
      console.log('='.repeat(80) + '\n')

      const response = await this.client.generate({
        model: this.config.model,
        prompt,
        options: {
          temperature: 0.35,
          num_predict: 3000,
        },
      })

      console.log('\n' + '='.repeat(80))
      console.log('📥 OLLAMA SCORING RESPONSE')
      console.log('='.repeat(80))
      console.log(response.response)
      console.log('='.repeat(80) + '\n')

      return this.parseArticleScores(response.response, candidates)
    } catch (error) {
      console.error('\n❌ OLLAMA SCORING ERROR:', error)
      throw new Error(`Ollama candidate scoring failed: ${error}`)
    }
  }

  private parseArticleScores(
    response: string,
    candidates: Array<{ id: string }>
  ): Array<{ id: string; score: number; reasoning: string }> {
    const scores: Array<{ id: string; score: number; reasoning: string }> = []
    const articleBlocks = response.split(/ARTICLE \d+/i).filter(b => b.trim())

    for (let i = 0; i < Math.min(articleBlocks.length, candidates.length); i++) {
      const block = articleBlocks[i]!
      const candidate = candidates[i]!

      // Extract analysis
      const analysisMatch = block.match(/ANALYSIS:\s*(.+?)(?=SCORES:|$)/is)
      const analysis = analysisMatch?.[1]?.trim() || 'No analysis provided'

      // Extract JSON scores
      const scoresMatch = block.match(/SCORES:\s*(\{[\s\S]*?\})/i)
      let overallScore = 0

      if (scoresMatch) {
        try {
          // Clean up the JSON (remove comments)
          const jsonStr = scoresMatch[1]!.replace(/,\s*\/\/[^\n]*/g, '').replace(/\/\/[^\n]*/g, '')
          const scoreObj = JSON.parse(jsonStr)
          overallScore = scoreObj.overall || 0
        } catch {
          // Fallback: try to find overall score directly
          const overallMatch = block.match(/"overall":\s*(\d+)/i)
          overallScore = overallMatch ? parseInt(overallMatch[1]!, 10) : 0
        }
      }

      scores.push({
        id: candidate.id,
        score: overallScore,
        reasoning: analysis,
      })
    }

    return scores
  }

  /**
   * Judge two questions head-to-head, pick the better one
   */
  async judgeQuestions(
    question1: { question: string; correctAnswer: string; houseAnswers: string[] },
    question2: { question: string; correctAnswer: string; houseAnswers: string[] }
  ): Promise<{ winner: 1 | 2; reasoning: string }> {
    const prompt = `You are judging two trivia questions for "Fake Facts" game.

This is an ADULTS-ONLY game. Dark humor, sexual content, violence, and controversial topics are ENCOURAGED as long as they're funny.

FIRST critically analyze EACH question. THEN score each on multiple dimensions. FINALLY pick the winner.

Criteria for a GREAT question:
✓ SPECIFIC and concrete (not vague)
✓ SURPRISING and unexpected
✓ Open-ended (multiple plausible answers)
✓ Funny/absurd (dark humor is GOOD - death, sex, violence, drugs all fair game!)
✓ Clear and easy to understand
✓ House answers are creative, funny, AND grammatically correct

CRITICAL: Do NOT penalize questions for adult/dark content. Questions about death, sex, violence, drugs, crime, etc. are ENCOURAGED if they're funny and specific. This is comedy for adults.

CRITICAL: All house answers MUST be grammatically compatible with the question.
Examples:
- Question: "In Texas, a man was arrested for stealing _____"
  ✓ GOOD: "a fire truck" (article included, grammatically fits)
  ✗ BAD: "fire truck" (missing article "a", grammatically wrong)

- Question: "In 2024, researchers discovered that _____ can recognize themselves in mirrors"
  ✓ GOOD: "dolphins" (plural, fits)
  ✗ BAD: "a dolphin" (singular doesn't fit with "themselves")

Question 1:
Q: ${question1.question}
Correct: ${question1.correctAnswer}
House: ${question1.houseAnswers.join(', ')}

Question 2:
Q: ${question2.question}
Correct: ${question2.correctAnswer}
House: ${question2.houseAnswers.join(', ')}

Respond in this EXACT format:

QUESTION 1 ANALYSIS:
<2-3 sentences critically analyzing this question - strengths, weaknesses, grammar issues>

QUESTION 1 SCORES:
{
  "specificity": <0-100, how specific/concrete?>,
  "surprise": <0-100, how unexpected/surprising?>,
  "openEndedness": <0-100, how many plausible answers?>,
  "humor": <0-100, how funny/absurd?>,
  "clarity": <0-100, how clear/easy to understand?>,
  "houseAnswerQuality": <0-100, are house answers creative AND grammatically correct?>,
  "overall": <0-100, overall quality>
}

QUESTION 2 ANALYSIS:
<2-3 sentences critically analyzing this question>

QUESTION 2 SCORES:
{
  "specificity": <0-100>,
  "surprise": <0-100>,
  "openEndedness": <0-100>,
  "humor": <0-100>,
  "clarity": <0-100>,
  "houseAnswerQuality": <0-100>,
  "overall": <0-100>
}

WINNER: 1 or 2
REASONING: <2-3 sentences explaining why based on the scores above>`

    try {
      console.log('\n' + '='.repeat(80))
      console.log('⚖️  OLLAMA JUDGING REQUEST')
      console.log('='.repeat(80))
      console.log('Model:', this.config.model)
      console.log('Temperature:', 0.35)
      console.log('Max Tokens:', 1500)
      console.log('\nPrompt:')
      console.log(prompt)
      console.log('='.repeat(80) + '\n')

      const response = await this.client.generate({
        model: this.config.model,
        prompt,
        options: {
          temperature: 0.35,
          num_predict: 1500,
        },
      })

      console.log('\n' + '='.repeat(80))
      console.log('📥 OLLAMA JUDGING RESPONSE')
      console.log('='.repeat(80))
      console.log(response.response)
      console.log('='.repeat(80) + '\n')

      return this.parseQuestionJudgment(response.response)
    } catch (error) {
      console.error('\n❌ OLLAMA JUDGING ERROR:', error)
      throw new Error(`Ollama question judging failed: ${error}`)
    }
  }

  private parseQuestionJudgment(response: string): { winner: 1 | 2; reasoning: string } {
    // Extract analyses
    const q1AnalysisMatch = response.match(/QUESTION 1 ANALYSIS:\s*(.+?)(?=QUESTION 1 SCORES:|$)/is)
    const q2AnalysisMatch = response.match(/QUESTION 2 ANALYSIS:\s*(.+?)(?=QUESTION 2 SCORES:|$)/is)

    // Extract scores to determine winner based on overall scores
    const q1ScoresMatch = response.match(/QUESTION 1 SCORES:\s*(\{[\s\S]*?\})/i)
    const q2ScoresMatch = response.match(/QUESTION 2 SCORES:\s*(\{[\s\S]*?\})/i)

    let q1Overall = 0
    let q2Overall = 0

    if (q1ScoresMatch) {
      try {
        const jsonStr = q1ScoresMatch[1]!.replace(/,\s*\/\/[^\n]*/g, '').replace(/\/\/[^\n]*/g, '')
        const scoreObj = JSON.parse(jsonStr)
        q1Overall = scoreObj.overall || 0
      } catch {
        const overallMatch = q1ScoresMatch[1]!.match(/"overall":\s*(\d+)/i)
        q1Overall = overallMatch ? parseInt(overallMatch[1]!, 10) : 0
      }
    }

    if (q2ScoresMatch) {
      try {
        const jsonStr = q2ScoresMatch[1]!.replace(/,\s*\/\/[^\n]*/g, '').replace(/\/\/[^\n]*/g, '')
        const scoreObj = JSON.parse(jsonStr)
        q2Overall = scoreObj.overall || 0
      } catch {
        const overallMatch = q2ScoresMatch[1]!.match(/"overall":\s*(\d+)/i)
        q2Overall = overallMatch ? parseInt(overallMatch[1]!, 10) : 0
      }
    }

    // Extract explicit winner
    const winnerMatch = response.match(/WINNER:\s*([12])/i)
    const explicitWinner = winnerMatch?.[1] === '2' ? 2 : 1

    // Use explicit winner, but validate against scores
    let winner: 1 | 2 = explicitWinner

    // If scores strongly disagree with explicit winner, use score-based winner
    if (Math.abs(q1Overall - q2Overall) > 20) {
      const scoreBasedWinner = q2Overall > q1Overall ? 2 : 1
      if (scoreBasedWinner !== explicitWinner) {
        // Trust the scores more than the explicit winner if they strongly disagree
        winner = scoreBasedWinner
      }
    }

    // Extract reasoning
    const reasoningMatch = response.match(/REASONING:\s*(.+?)$/is)
    const explicitReasoning = reasoningMatch?.[1]?.trim()

    // Build comprehensive reasoning from analyses and explicit reasoning
    const q1Analysis = q1AnalysisMatch?.[1]?.trim() || ''
    const q2Analysis = q2AnalysisMatch?.[1]?.trim() || ''

    let reasoning = ''
    if (explicitReasoning) {
      reasoning = explicitReasoning
    } else {
      // Fallback: use analysis of winner
      reasoning = winner === 1 ? q1Analysis : q2Analysis
    }

    if (!reasoning) {
      reasoning = `Winner scored ${winner === 1 ? q1Overall : q2Overall} vs ${winner === 1 ? q2Overall : q1Overall}`
    }

    return { winner, reasoning }
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
