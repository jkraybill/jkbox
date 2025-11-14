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
   * Extract JSON from text that might have explanatory text after the JSON
   */
  private extractJSON(text: string): unknown {
    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }

    // Find the matching closing brace for the first opening brace
    let depth = 0
    let jsonEnd = -1

    for (let i = jsonMatch.index!; i < text.length; i++) {
      if (text[i] === '{') depth++
      if (text[i] === '}') {
        depth--
        if (depth === 0) {
          jsonEnd = i + 1
          break
        }
      }
    }

    if (jsonEnd === -1) {
      throw new Error('Malformed JSON in response')
    }

    const jsonStr = text.substring(jsonMatch.index!, jsonEnd)
    return JSON.parse(jsonStr)
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
2. Create a question that blanks out that element using "_____"
3. IMPORTANT: Establish spacetime context (where/when the story occurred)
   - Include location whenever possible: "In Cardiff", "In remote England", "A Texas man"
   - Include time when relevant: "In 2024", "Last winter", "In the dead of winter in 2023"
   - Bad: "A husband accidentally won _____" (no context)
   - Good: "In 2024, a Cardiff husband accidentally won _____" (location + time)
   - Good: "Last winter in Texas, a man discovered _____" (time + location)
4. Make the question conversational and natural (not too formal)
5. The blank should be grammatically correct
6. DO NOT end with a question mark if it's a statement - only use "?" for actual questions
7. CRITICAL: NEVER use a number as the blank - numbers are not open-ended and make bad comedy questions
   - Bad: "firefighters rescued a calf from a _____-foot pipe" (blank is "200")
   - Good: "firefighters rescued a _____ from a 200-foot pipe" (blank is "calf")
8. Avoid redundant terms in the question (don't use the same word twice)
   - Bad: "cut through a pipe to reach a culvert pipe"
   - Good: "cut through metal to reach a culvert pipe"
9. CRITICAL: Include articles (a/an/the) as PART of the answer, NOT before the blank in the question
   - This prevents revealing whether the answer starts with a vowel/consonant
   - Bad question: "Police found an _____ on the highway" with answer "abandoned car" (reveals vowel start with "an")
   - Good question: "Police found _____ on the highway" with answer "an abandoned car" (doesn't reveal anything)
   - Good question: "In 2023, British divers rescued _____ from a river" with answer "a wedding ring"
10. The filled-in sentence MUST be grammatically perfect - test it before finalizing
   - Bad: "stuck in dumpster hole" (missing article - grammatically wrong)
   - Good: "stuck in a dumpster hole" (grammatically correct)
11. Avoid qualifier words in the question that clash with house answer types
   - Bad: "Doctors removed a foreign _____ from the patient" with answer "coin" (house answers like "kidney" clash with "foreign")
   - Good: "Doctors removed a foreign _____ from the patient's stomach" with answer "foreign coin"
12. Create a postscript: a one-liner shown after the question reveal that either:
    - Explains unusual terms in the answer (e.g., "BlaBlaCar is a French rideshare company founded in 2006.")
    - Shares fun trivia if no explanation needed (e.g., "Firefighters rescue about 12 cows per year from swimming pools.")
    - Makes a joke or sarcastic comment (encouraged!) (e.g., "The cow was later quoted saying 'no regrets.'")
13. Return ONLY valid JSON in this format:

{
  "question": "The question text with _____ blank",
  "realAnswer": "the exact word/phrase that fills the blank",
  "blank": "the exact word/phrase that fills the blank",
  "postscript": "One-liner explanation, trivia, or joke shown after reveal"
}

Examples:
- Title: "Court Says Bees Are Fish"
- Output: {"question": "In California, _____ are legally classified as fish.", "realAnswer": "bees", "blank": "bees", "postscript": "This legal loophole was used to protect bees under the Endangered Species Act."}

- Title: "Raccoon Stuck in Dumpster"
- Good: {"question": "Texas workers freed a raccoon whose head was stuck in _____.", "realAnswer": "a dumpster hole", "blank": "a dumpster hole", "postscript": "..."}
- Bad: {"question": "Texas workers freed a raccoon whose head was stuck in a _____.", "realAnswer": "dumpster hole", ...} (grammatically wrong when filled in)

- Title: "Divers Find Wedding Ring"
- Good: {"question": "In 2023, British divers rescued _____ from a river.", "realAnswer": "a wedding ring", "blank": "a wedding ring", "postscript": "..."}
- Bad: {"question": "British divers rescued this _____ from a river.", "realAnswer": "wedding ring", ...} (awkward "this")

- Good postscript: "The firefighters said this was the third puppy rescue that week."
- Bad postscript: "This was an interesting event." (too generic)

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
      const result = this.extractJSON(text) as any
      return {
        question: result.question,
        realAnswer: result.realAnswer,
        blank: result.blank,
        postscript: result.postscript,
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
    realAnswer: string,
    sampleRealAnswers?: string[]
  ): Promise<HouseAnswersResult> {
    const samplesSection = sampleRealAnswers && sampleRealAnswers.length > 0
      ? `\nStyle Examples (from other real answers in our database):
${sampleRealAnswers.map(a => `- "${a}"`).join('\n')}

Notice how these are concise and direct, without unnecessary adjectives.\n`
      : ''

    const prompt = `Generate 5 plausible but wrong answers for this trivia question.

Article Title: "${title}"
Summary: ${summary}
Question: "${question}"
Real Answer: "${realAnswer}"
${samplesSection}
Instructions:
1. Create 5 fake answers that are:
   - Funny and entertaining
   - Plausible (could sound reasonable if you didn't know better)
   - Diverse (vary the types of answers, don't just use synonyms)
   - NOT synonyms or near-synonyms of the real answer
   - Natural language (things a human might guess)
   - CONCISE: Avoid gratuitous adjectives like "unsuspecting", "wandering", "abandoned"
   - Match the style of real answers: direct and simple (e.g., "a guitar case" not "a wandering street musician's guitar case")
   - Each fake answer must be grammatically correct when inserted into the question (but doesn't need to match real answer's article pattern)
   - Test each fake by inserting it: "British divers rescued _____ from a river"
     - Good fakes: "a fishing rod" ✓, "Boris Johnson's housekeeper" ✓, "the mayor's watch" ✓, "jewelry" ✓
     - Bad fake: "ring" (grammatically incomplete: "rescued ring from a river")
   - Context matters: "A massive _____ crossed state lines"
     - Good fakes: "escaped elephant" ✓, "reptile" ✓ (both work: "A massive escaped elephant", "A massive reptile")
     - Bad fake: "a rare tarantula" (creates: "A massive a rare tarantula" - double article)

2. DO NOT repeat the pattern/structure from the question in your answer:
   - If question asks for "baby _____", answer should be "beavers" NOT "beaver kits" or "beaver babies"
   - If question asks for "three _____", answer should be "otters" NOT "three otters"
   - Strip out any duplicated context from the question

3. MATCH THE SEMANTIC CONSTRAINTS of the real answer:
   - If context implies many numbers (e.g., "lottery winning numbers"), real answer must have 6-8 digits, so fakes should too
   - Good: "death date" (8 digits: MM/DD/YYYY), "social security number" (9 digits)
   - Bad: "golf handicap" (1-2 digits), "jersey number" (1-2 digits)
   - If real answer is a specific type of thing, fakes should be plausible alternatives in that same category

4. Wrong answers can be different categories than the real answer ONLY if it makes sense contextually

5. Keep answers SHORT and DIRECT. Real answers are typically 1-3 words, your fakes should match that style.

6. Return ONLY valid JSON in this format:

{
  "houseAnswers": ["answer1", "answer2", "answer3", "answer4", "answer5"]
}

Examples:
- Question: "In California, _____ are legally classified as fish."
- Real answer: "bees"
- Good house answers: ["coral", "seahorses", "plankton", "starfish", "jellyfish"]
- Bad house answers: ["wasps", "hornets"] (too similar to bees)
- Bad house answers: ["honeybees", "bumblebees", "killer bees"] (too synonymous)
- Bad house answers: ["aggressive killer wasps", "beautiful coral reefs"] (too many adjectives)

- Question: "Three adorable baby _____ were born at the zoo"
- Real answer: "capybara pups"
- Good house answers: ["elephants", "giraffes", "pandas", "koalas", "sloths"] (no "baby", "pups", "kits")
- Bad house answers: ["baby elephants", "panda cubs", "sloth babies"] (duplicates "baby" from question)

- Question: "This lottery winner used her dad's _____ as the winning numbers"
- Real answer: "death date" (8 digits)
- Good house answers: ["social security number", "phone number", "birth certificate number", "driver's license number", "bank account number"]
- Bad house answers: ["golf handicap", "jersey number", "age"] (only 1-2 digits, doesn't match "winning numbers" context)

- Question: "In 2023, British divers rescued _____ from a river."
- Real answer: "a wedding ring"
- Good house answers: ["a vintage fishing rod", "an antique compass", "Boris Johnson's housekeeper", "the mayor's watch", "jewelry"] (varied article usage, all grammatically correct)
- Bad house answers: ["wedding ring", "fishing rod", "compass"] (missing articles - grammatically wrong: "rescued fishing rod")

- Question: "A massive _____ crossed state lines in Massachusetts."
- Real answer: "water monitor lizard" (no article because "A massive" already provides one)
- Good house answers: ["escaped elephant", "runaway alpaca", "reptile", "iguana", "exotic python"] (no extra articles - grammatically correct)
- Bad house answers: ["a rare tarantula", "an escaped elephant"] (creates double article: "A massive a rare tarantula")

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
      const result = this.extractJSON(text) as any
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
