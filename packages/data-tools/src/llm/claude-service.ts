import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { QuestionGenerationResult, HouseAnswersResult } from '../types/fake-facts'

export interface ClaudeConfig {
  model: string
  maxTokens: number
  defaultTemperature: number
  questionGeneration: {
    temperature: number
    maxTokens: number
    systemPrompt: string
  }
  houseAnswers: {
    temperature: number
    maxTokens: number
    systemPrompt: string
  }
}

export class ClaudeService {
  private client: Anthropic
  private config: ClaudeConfig

  constructor(apiKey?: string, configPath?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set')
    }

    this.client = new Anthropic({ apiKey: key })

    // Load config
    const cfgPath = configPath || join(process.cwd(), 'config/claude.json')
    this.config = JSON.parse(readFileSync(cfgPath, 'utf-8'))
  }

  /**
   * Generate a blanked-out question from article title and summary
   */
  async generateQuestion(
    title: string,
    summary: string
  ): Promise<QuestionGenerationResult> {
    const prompt = `Given this weird news article, create a fun trivia question with a blanked-out word or phrase.

Article Title: "${title}"
Summary: ${summary}

Instructions:
1. Identify the most interesting/funny/surprising element in the article
2. Create a question that blanks out that element using "_____ "
3. Make the question conversational and natural (not too formal)
4. The blank should be grammatically correct
5. Return ONLY valid JSON in this format:

{
  "question": "The question text with _____  blank",
  "realAnswer": "the exact word/phrase that fills the blank",
  "blank": "the exact word/phrase that fills the blank"
}

Examples:
- Title: "Court Says Bees Are Fish"
- Output: {"question": "In California, _____ are legally classified as fish.", "realAnswer": "bees", "blank": "bees"}

Generate the question now:`

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.questionGeneration.maxTokens,
      temperature: this.config.questionGeneration.temperature,
      system: this.config.questionGeneration.systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract JSON from response
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Parse JSON response
    try {
      const result = JSON.parse(text)
      return {
        question: result.question,
        realAnswer: result.realAnswer,
        blank: result.blank,
      }
    } catch (error) {
      throw new Error(`Failed to parse Claude response as JSON: ${text}`)
    }
  }

  /**
   * Generate 5 fake "house answers" for a question
   */
  async generateHouseAnswers(
    title: string,
    summary: string,
    question: string,
    realAnswer: string
  ): Promise<HouseAnswersResult> {
    const prompt = `Generate 5 plausible but wrong answers for this trivia question.

Article Title: "${title}"
Summary: ${summary}
Question: "${question}"
Real Answer: "${realAnswer}"

Instructions:
1. Create 5 fake answers that are:
   - Funny and entertaining
   - Plausible (could sound reasonable if you didn't know better)
   - Diverse (vary the types of answers, don't just use synonyms)
   - NOT synonyms or near-synonyms of the real answer
   - Natural language (things a human might guess)

2. Wrong answers can be different categories than the real answer (e.g., if real is a person, fake could be places)

3. Return ONLY valid JSON in this format:

{
  "houseAnswers": ["answer1", "answer2", "answer3", "answer4", "answer5"]
}

Examples:
- Real answer: "bees"
- Good house answers: ["wasps", "coral", "seahorses", "plankton", "starfish"]
- Bad house answers: ["honeybees", "bumblebees", "killer bees"] (too synonymous)

Generate the 5 house answers now:`

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.houseAnswers.maxTokens,
      temperature: this.config.houseAnswers.temperature,
      system: this.config.houseAnswers.systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract JSON from response
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Parse JSON response
    try {
      const result = JSON.parse(text)
      return {
        houseAnswers: result.houseAnswers,
      }
    } catch (error) {
      throw new Error(`Failed to parse Claude response as JSON: ${text}`)
    }
  }

  /**
   * Get approximate cost for a response
   */
  calculateCost(inputTokens: number, outputTokens: number): number {
    // Claude 3.5 Haiku pricing: $0.25/MTok input, $1.25/MTok output
    const INPUT_COST_PER_MILLION = 0.25
    const OUTPUT_COST_PER_MILLION = 1.25

    const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION
    const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION

    return inputCost + outputCost
  }
}
