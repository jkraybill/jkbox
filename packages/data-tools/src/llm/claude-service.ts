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
   * Get the model name being used
   */
  getModel(): string {
    return this.config.model
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

=== CRITICAL: OPEN-ENDEDNESS IS EVERYTHING ===

The #1 rule: The blank must be MAXIMALLY OPEN-ENDED. Players should be genuinely unsure what category of answer to expect.

✅ GREAT (wide open):
- "In Mississippi, a mother killed an escaped _____ she claimed was threatening her children"
  → Could be: animal, person, object, concept - totally open!

- "In a recent study, _____ report facing discrimination in their daily lives"
  → Could be: any group of people, animals, objects - extremely open!

❌ BAD (too narrow):
- "In Maryland, a woman won lottery cash by using her dad's death date as a _____"
  → Only "lottery number" makes sense. Zero ambiguity. REJECT THIS.

- "In 2024, Tesla fired _____ amid declining electric vehicle sales"
  → Boring corporate news, not surprising. REJECT THIS.

=== REMOVE SPECIFICITY THAT NARROWS THE BLANK ===

BAD: "In Spain, a 70-year-old beekeeper responded to a traffic stop by unleashing _____"
→ "beekeeper" gives away that it's bee-related

GOOD: "In Spain, a 70-year-old woman responded to a traffic stop by unleashing _____"
→ Could be anything! Much more open.

BAD: "In Florida, a man stabbed his friend during an argument over a 'bankrupt' _____"
→ Awkward phrasing, narrow blank

GOOD: "In Florida, a man stabbed his friend during an argument about whether Donald Trump was _____"
→ Wide open! Could be: "bankrupt", "a man", "alive", "a lizard person", etc.

=== KEEP REAL ANSWERS CONCISE ===

CRITICAL: Answers should be 1-3 words. Maximum 4 words in rare cases.

Remove unnecessary specificity from real answers:

BAD: "a bald JD Vance meme" → GOOD: "a JD Vance meme"
BAD: "a VP of manufacturing named Omead Afshar" → GOOD: "a VP of manufacturing"
BAD: "John Wilkes Booth hiding under her bed" → GOOD: "John Wilkes Booth"

BAD: "her father's death date" (4 words, wordy) → GOOD: Rephrase question so blank is shorter
BAD: "the coordinates to his burial site" (6 words!) → GOOD: Rephrase question
BAD: "involuntary lethal injection" (3 words but verbose) → GOOD: "lethal injection"

=== FAMOUS PEOPLE = OBSCURE STORIES ONLY ===

If the article is about a celebrity or famous person (Trump, Obama, Elon, etc.), the story MUST be obscure and surprising.

❌ REJECT: "Trump bragged about a dementia test" - everyone knows this story
❌ REJECT: "Tesla fires executive" - boring, not weird
✅ ACCEPT: Obscure Trump story that's genuinely surprising

=== SPACETIME CONTEXT ===

Include location and/or time:
- "In 2024, a Norwegian tourist..."
- "In Rome, an American tourist..."
- "Last winter in Texas..."

=== GRAMMAR & ARTICLES ===

1. Include articles (a/an/the) as PART of the answer, NOT before the blank:
   - BAD: "Police found an _____ on the highway" with answer "abandoned car"
   - GOOD: "Police found _____ on the highway" with answer "an abandoned car"

2. Test the filled-in sentence for grammatical correctness:
   - "stuck in a dumpster hole" ✓ (not "stuck in dumpster hole")

=== POSTSCRIPTS ===

CRITICAL RULES:
1. NO CLICHES: Never use "Apparently", "...", "who knew?", "surprisingly"
2. NO FALSE FACTS: Don't claim historians/researchers say things they don't
3. BE SPECIFIC: About THIS situation, not general trends
4. BE PUNCHY: One sentence, sarcastic/funny preferred over educational

✅ GREAT postscripts:
- "The British take queuing so seriously, they consider it a national sport with multiple qualifying rounds." (sarcastic, clever)
- "He survived and is now banned from every UNESCO site." (specific, punchy)
- "The parents are now reconsidering their Civil War museum memberships." (specific to THIS case)
- "Political disagreements in Florida can get surprisingly stabby." (sarcastic, no "Apparently")

❌ BAD postscripts:
- "Apparently, memes are now considered a national security threat... who knew?" (cliches!)
- "Researchers note that hoarding is a complex mental health condition, not just a lifestyle choice." (preachy PSA)
- "Apparently, Ford's Theatre tours are way more terrifying for toddlers than adults anticipated." (unsupported generalization from ONE toddler)

=== EXAMPLES ===

Example 1 - EXCELLENT:
Title: "Mississippi woman kills escaped monkey"
Question: "In Mississippi, a mother killed an escaped _____ she claimed was threatening her children"
Real Answer: "research monkey"
Postscript: "Highway monkey escapes are just another Tuesday in the Magnolia State."
Why it works: Extremely open-ended (could be animal OR human), surprising story, concise answer, punchy postscript

Example 2 - EXCELLENT:
Title: "Toddler fears John Wilkes Booth under bed"
Question: "In Maryland, a toddler developed an unusual childhood fear of _____"
Real Answer: "John Wilkes Booth"
Postscript: "The parents are now reconsidering their Civil War museum memberships."
Why it works: Very open ("unusual fear" = anything), concise answer, specific postscript

Example 3 - REJECT:
Title: "Lottery winner uses dad's death date"
Question: "In Maryland, a woman won lottery cash by using her dad's death date as a _____"
Real Answer: "lottery number"
Why reject: NOT open-ended at all - only one possible answer

Example 4 - REJECT:
Title: "Trump dementia test"
Question: "President Trump bragged about a test that was actually designed to detect _____"
Real Answer: "early signs of dementia"
Why reject: Too well-known, everyone knows this story about famous person

=== OUTPUT FORMAT ===

Return ONLY valid JSON:

{
  "question": "The question text with _____ blank",
  "realAnswer": "the exact word/phrase that fills the blank (CONCISE!)",
  "blank": "the exact word/phrase that fills the blank (CONCISE!)",
  "postscript": "One punchy sentence, no cliches, specific to THIS case"
}

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

=== CRITICAL: VALIDATE BY WRITING OUT COMPLETE FILLED-IN SENTENCES ===

For EACH house answer you generate, you MUST write out the complete filled-in sentence to validate it works.

This is MANDATORY. Do not skip this step. Write:
1. Complete sentence with your fake answer
2. Check if it's grammatically correct
3. Check if it makes logical/semantic sense
4. ONLY THEN include it in your final list

Example process:
Question: "In Spain, a 70-year-old woman responded to a traffic stop by unleashing _____"
Real Answer: "a swarm of bees"

Testing house answer "paperwork":
→ "In Spain, a 70-year-old woman responded to a traffic stop by unleashing paperwork"
→ ❌ REJECT: You cannot "unleash" paperwork. Verb constraint violation.

Testing house answer "her pet cheetah":
→ "In Spain, a 70-year-old woman responded to a traffic stop by unleashing her pet cheetah"
→ ✅ ACCEPT: Grammatically correct, semantically coherent, absurd and funny!

Testing house answer "the kraken":
→ "In Spain, a 70-year-old woman responded to a traffic stop by unleashing the kraken"
→ ✅ ACCEPT: Jokey/mythological but works perfectly with "unleashing"!

=== VERB CONSTRAINTS ===

Pay extreme attention to verbs in the question. They constrain what answers work.

"unleashed" → requires things that CAN be unleashed:
  ✅ animals, forces, chaos, mythological creatures
  ❌ static objects (paperwork, jars, beehives)

"impaled on" → requires things that are SHARP/POINTY:
  ✅ spikes, swords, selfie sticks
  ❌ blunt objects (columns, fence posts)

"waiting in" → requires PLACES or STATES:
  ✅ "the rain", "silence", "agony", "line", "terror"
  ❌ objects/events ("tennis rackets", "autographs", "ceremonies")

"escaped" → requires a SOURCE (prison, zoo, lab, cage):
  ✅ "research monkey" (from lab), "convict" (from prison), "giraffe" (from zoo)
  ❌ "wild boar" (where does it escape FROM?), "rabid raccoon" (raccoons don't escape)

"reunited" → requires 2+ entities:
  ✅ "two racing pigeons", "former lovers", "the Backstreet Boys"
  ❌ "a retired jockey" (singular can't reunite alone)

=== SEMANTIC CONSTRAINTS ===

The answer must make logical sense in the full context of the question.

Question: "At Churchill Downs, _____ reunited at the scene of their racing triumphs"
Real Answer: "Mystik Dan and Thorpedo Anna" (racehorses)

Testing "Kentucky bourbon enthusiasts":
→ "At Churchill Downs, Kentucky bourbon enthusiasts reunited at the scene of their racing triumphs"
→ ❌ REJECT: Bourbon enthusiasts don't have "racing triumphs". Semantic violation.

Testing "two racing pigeons":
→ "At Churchill Downs, two racing pigeons reunited at the scene of their racing triumphs"
→ ✅ ACCEPT: Racing pigeons CAN have racing triumphs. Makes sense!

=== GRAMMAR VALIDATION ===

Test article usage carefully:

Question: "Police found _____ on the highway"

Testing "ring":
→ "Police found ring on the highway"
→ ❌ REJECT: Grammatically broken. Needs article.

Testing "a vintage watch":
→ "Police found a vintage watch on the highway"
→ ✅ ACCEPT: Grammatically perfect!

=== BE WEIRD + FUNNY, NOT JUST "PLAUSIBLE" ===

House answers must be entertaining, not just category-appropriate.

Question: "In 2024, a Norwegian tourist was denied US entry after border control found _____ on his phone"
Real Answer: "a JD Vance meme"

❌ BORING house answers:
- "unauthorized government documents" (obvious, not funny, not weird)
- "satirical AI-generated content" (corporate speak, boring)

✅ GREAT house answers:
- "clown porn" (absurd, funny, weird)
- "pictures of flour" (random, weird, funny)
- "a wasp nest" (what?? perfect absurdity)
- "semen" (dark humor, surprising)

The game is COMEDY. Prioritize WEIRD + FUNNY over "sensible categories".

=== KEEP ANSWERS SHORT & PUNCHY ===

CRITICAL: Answers should be 1-3 words. Maximum 4 words in rare cases.

❌ BAD: "the coordinates to Jimmy Hoffa's burial site" (7 words!)
✅ GOOD: "Jimmy Hoffa's coordinates" (3 words)

❌ BAD: "the combination to her therapist's safe" (6 words!)
✅ GOOD: "her therapist's safe combo" (4 words) or "her safe combination" (3 words)

❌ BAD: "compromising political cartoons" (3 words but wordy)
✅ GOOD: "political cartoons" (2 words)

❌ BAD: "unsuspecting neighbor's cat"
✅ GOOD: "neighbor's cat"

❌ BAD: "vintage lawnmower"
✅ GOOD: "lawnmower"

If the real answer is long, match its length/style. But aim for PUNCHY and CONCISE.

=== VARIETY IS CRITICAL ===

Don't repeat the same joke type 3-5 times!

Question: "President Trump bragged about a test designed to detect _____"
Real Answer: "early signs of dementia"

❌ BAD variety (all absurd skills):
- "underwater navigation skills"
- "professional juggling techniques"
- "competitive yo-yo expertise"
→ Same joke 3 times!

✅ GOOD variety:
- "learning disabilities" (similar medical condition)
- "pregnancy" (different medical test type)
- "lying" (character trait, absurd)
- "reptilian ancestry" (conspiracy theory absurdism)
- "alien intelligence" (sci-fi absurdism)

=== JOKEY/ABSURD ANSWERS ARE ENCOURAGED ===

The game embraces absurdity! These are GOOD house answers:

- "the kraken" (mythological)
- "the dragon" (fantasy)
- "Pippin" (specific pet name)
- "200 helium balloons" (oddly specific)
- "a lizard person" (conspiracy meme)
- "Elon Musk in a robotic suit" (ultra-absurd)
- "clown porn" (shock value)

Don't be too conservative. Push into absurdity territory.

=== COMPLETE VALIDATION EXAMPLES ===

Example 1:
Question: "In Mississippi, a mother killed an escaped _____ she claimed was threatening her children"
Real Answer: "research monkey"

Process each house answer:

1. Testing "wild boar":
   → "In Mississippi, a mother killed an escaped wild boar she claimed was threatening her children"
   → ❌ REJECT: Wild boars don't "escape" from anywhere. Semantic violation.

2. Testing "giraffe":
   → "In Mississippi, a mother killed an escaped giraffe she claimed was threatening her children"
   → ✅ ACCEPT: Giraffes escape from zoos. Absurd and funny!

3. Testing "convict":
   → "In Mississippi, a mother killed an escaped convict she claimed was threatening her children"
   → ✅ ACCEPT: Convicts escape from prison. Dark but works!

4. Testing "guinea pig":
   → "In Mississippi, a mother killed an escaped guinea pig she claimed was threatening her children"
   → ✅ ACCEPT: Guinea pigs escape from cages. Absurdly unthreatening!

5. Testing "serial killer":
   → "In Mississippi, a mother killed an escaped serial killer she claimed was threatening her children"
   → ✅ ACCEPT: Dark humor, escapes from prison/asylum. Works!

Final answers: ["giraffe", "convict", "guinea pig", "serial killer", "the Pope's hat"]

Example 2:
Question: "In Spain, a 70-year-old woman responded to a traffic stop by unleashing _____"
Real Answer: "a swarm of bees"

1. Testing "vintage beehive":
   → "In Spain, a 70-year-old woman responded to a traffic stop by unleashing vintage beehive"
   → ❌ REJECT: Cannot "unleash" a static object (beehive). Also missing article.

2. Testing "her pet cheetah":
   → "In Spain, a 70-year-old woman responded to a traffic stop by unleashing her pet cheetah"
   → ✅ ACCEPT: Can unleash animals. Absurd and great!

3. Testing "the dragon":
   → "In Spain, a 70-year-old woman responded to a traffic stop by unleashing the dragon"
   → ✅ ACCEPT: Jokey/mythological but verb works perfectly!

4. Testing "Pippin":
   → "In Spain, a 70-year-old woman responded to a traffic stop by unleashing Pippin"
   → ✅ ACCEPT: Pet name, implies dog. Ultra-jokey. Love it!

5. Testing "200 helium balloons":
   → "In Spain, a 70-year-old woman responded to a traffic stop by unleashing 200 helium balloons"
   → ✅ ACCEPT: You CAN unleash balloons (release them). Absurd specificity!

Final answers: ["her pet cheetah", "the dragon", "Pippin", "200 helium balloons", "chaos"]

=== OUTPUT FORMAT ===

Return ONLY valid JSON:

{
  "houseAnswers": ["answer1", "answer2", "answer3", "answer4", "answer5"]
}

Each answer MUST be:
1. Validated by writing out the complete filled-in sentence
2. Grammatically correct
3. Semantically coherent with verb/context
4. Weird + funny (not just "category appropriate")
5. Concise (no gratuitous adjectives)
6. Varied (not 3+ of the same joke type)

Generate the 5 house answers now (and validate each one by writing out the complete sentence):`

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
