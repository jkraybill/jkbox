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
  judging?: {
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
   * Generate a blanked-out question from article title and content
   */
  async generateQuestion(
    title: string,
    content: string,
    spacetime?: {
      eventYear?: number | null
      locationCity?: string | null
      locationState?: string | null
      country?: string | null
    }
  ): Promise<QuestionGenerationResult & { cost: number }> {
    // Build spacetime context string
    const spacetimeContext = spacetime
      ? `
SPACETIME METADATA (use this for temporal/location context):
- Year: ${spacetime.eventYear || 'Unknown'}
- City: ${spacetime.locationCity || 'Unknown'}
- State: ${spacetime.locationState || 'Unknown'}
- Country: ${spacetime.country || 'Unknown'}
`
      : ''

    const prompt = `Given this weird news article, create a fun trivia question with a blanked-out word or phrase.

Article Title: "${title}"
Article Content: ${content}
${spacetimeContext}
=== CRITICAL: STICK TO THE FACTS ===

EVERY FACT in your question and answer MUST come directly from the article content above.

DO NOT:
- Invent details not in the article
- Change facts or paraphrase in ways that alter meaning
- Generalize specific details ("lawn mower" → "equipment")
- Add your own interpretation

=== HANDLING LONG LISTS: SUBSETS ARE ENCOURAGED ===

If the article contains a long list (3+ items), you have two good options:

OPTION 1: Use a SUBSET (pick the most interesting/surprising item)
- Article: "threatened punishment for those who shave like Elvis Presley, Sylvester Stallone, and the U.S. Marines"
- ✅ GOOD: "In 1996, a Somali court threatened to punish men who shave like which famous musician?"
  Answer: "Elvis Presley"
  → Reworked question to imply selection from larger set, takes most surprising item

- Article: "The park banned dogs, bicycles, and skateboards"
- ✅ GOOD: "What wheeled item did the park ban?"
  Answer: "skateboards" (or "bicycles")
  → Question implies there are other banned items, selects one

OPTION 2: Use fill-in-the-blank for list completion (only if comedically strong)
- Article: "arrested with cocaine, heroin, and a live alligator"
- ✅ GOOD: "Police found cocaine, heroin, and _____ in his car"
  Answer: "a live alligator"
  → Works because the punchline item is absurd

❌ AVOID: Including full long lists in answers
- "Elvis Presley, Sylvester Stallone, and the U.S. Marines" (7 words - too long!)

When using subsets, REWORD the question to imply it's a selection from a larger set:
- "which celebrity did X mention?"
- "what animal did the zoo report missing?"
- "which item was found in the suspect's car?"

This makes it clear you're asking about ONE thing, not omitting facts.

=== NEVER GENERALIZE OR VAGUE-IFY ===

- Article: "arrested for stealing a lawn mower"
  ✅ GOOD: "arrested for stealing a lawn mower"
  ❌ BAD: "arrested for stealing lawn equipment" (too general!)

- Article: "claimed she saw Bigfoot"
  ✅ GOOD: "claimed she saw Bigfoot"
  ❌ BAD: "claimed she saw a mysterious creature" (lost the specific detail!)

- Article: "built a 12-foot statue made of cheese"
  ✅ GOOD: "a 12-foot cheese statue"
  ❌ BAD: "a giant cheese sculpture" (lost the 12-foot detail!)

Keep specific numbers, specific names, specific objects. Don't genericize.

VERIFY: Re-read the article to confirm your answer is factually present (exact match or legitimate subset).

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

=== KEEP REAL ANSWERS CONCISE & PUNCHY ===

CRITICAL: Answers should be 1-3 words. Maximum 4 words in rare cases.

**REFERENCE PLAYER:** Imagine a drunk person at a party, typing on their phone. They won't type verbose phrases like "his opponent's campaign button" (they'd type "his opponent's button") or "the police force" (they'd type "the police"). Keep it SHORT and NATURAL.

MANDATORY VALIDATION: After generating an answer, ask yourself:
1. "Would a DRUNK PERSON AT A PARTY actually type ALL these words on their phone?"
2. "Are there any redundant or unnecessary modifiers?"
3. "Can I remove ANY word without losing the essence?"
4. "Does this sound NATURAL - like something a human would actually say?"

If yes to #2 or #3, or no to #4 → REVISE to be shorter and more natural!

Remove unnecessary specificity from real answers:

BAD: "a bald JD Vance meme" → GOOD: "a JD Vance meme"
BAD: "a VP of manufacturing named Omead Afshar" → GOOD: "a VP of manufacturing"
BAD: "John Wilkes Booth hiding under her bed" → GOOD: "John Wilkes Booth"

BAD: "the police force" (3 words, too formal/verbose) → GOOD: "the police" (2 words, natural!)
BAD: "his opponent's campaign button" (4 words!) → GOOD: "his opponent's button" (3 words)
BAD: "laser-cut it into pieces" (4 words, redundant!) → GOOD: "laser-cut it" (2 words!)
  → Why: "into pieces" is implied by "laser-cut" - drunk people don't type extra words!
BAD: "a 21-year-old man" (3 words but verbose) → GOOD: "a young man" OR "a 21 year old"
  → Why: Pick simpler phrasing OR remove gender if age is the key detail
BAD: "her father's death date" (4 words, wordy) → GOOD: Rephrase question so blank is shorter
BAD: "the coordinates to his burial site" (6 words!) → GOOD: Rephrase question
BAD: "involuntary lethal injection" (3 words but verbose) → GOOD: "lethal injection"

CRITICAL: Remove REDUNDANT modifiers (when the adjective is inherent to the noun):

BAD: "the biblical 10 Lost Tribes" (5 words! "biblical" is redundant - Lost Tribes ARE biblical)
  → GOOD: "the Lost Tribes" (3 words, punchy)
  → GOOD: "biblical tribes" (2 words, even better!)

BAD: "frozen ice" → GOOD: "ice" (ice is inherently frozen)
BAD: "illegal contraband" → GOOD: "contraband" (contraband is inherently illegal)
BAD: "circular ring" → GOOD: "ring" (rings are inherently circular)

THINK: What's the SHORTEST form that preserves the comedy and surprise?

=== CRITICAL: NO COMPOUND ANSWERS WITH "OR" ===

Players will NEVER type compound answers. Pick ONE specific answer.

❌ NEVER DO THIS:
- "concrete or hot asphalt" → Players type "concrete" or "asphalt", never "concrete or hot asphalt"
- "a cat or dog" → Players type "cat" or "dog"
- "heroin or cocaine" → Players type "heroin" or "cocaine"

✅ PICK THE MOST SPECIFIC/INTERESTING ONE:
- "concrete" (simpler, more common)
- "a cat" (pick one)
- "heroin" (darker, funnier)

If the article mentions multiple things, pick the SINGLE most surprising/funny/specific one as the answer.

=== FAMOUS PEOPLE = OBSCURE STORIES ONLY ===

If the article is about a celebrity or famous person (Trump, Obama, Elon, etc.), the story MUST be obscure and surprising.

❌ REJECT: "Trump bragged about a dementia test" - everyone knows this story
❌ REJECT: "Tesla fires executive" - boring, not weird
✅ ACCEPT: Obscure Trump story that's genuinely surprising

=== SPACETIME CONTEXT ===

CRITICAL: Include location and/or time to avoid temporal confusion.

**USE THE SPACETIME METADATA PROVIDED ABOVE** - it's been extracted for you!

For questions, construct location/time context like:
- If you have Year + State: "In 2004, in Maryland, a 911 operator..."
- If you have Year only: "In 1996, a man climbed a tower..."
- If you have State only: "In Colorado, a sheriff candidate..."
- If you have City + State: "In Brisbane, Queensland, a suspended cop..."

**🚨 CRITICAL: MONTH/YEAR RULES - THIS IS CHECKED IN VALIDATION! 🚨**

ABSOLUTE RULE: NEVER write "In January" or "In February" or "In March" (etc.) without the year.

You have THREE options. Pick ONE:

✅ Option A: Month + Year
- "In January 1999, the Fox family in Iowa..."
- "In August 1996, a man climbed a tower..."
- "In September 2011, two wheelchair-bound men..."

✅ Option B: Year only (no month)
- "In 1999, the Fox family in Iowa..."
- "In 1996, a man climbed a tower..."
- "In 2011, two wheelchair-bound men..."

✅ Option C: Drop temporal context (location only or nothing)
- "In Iowa, the Fox family opened..."
- "A man climbed a tower..."
- "Two wheelchair-bound men..."

❌ NEVER WRITE THESE (they will be REJECTED in validation):
- "In January, the Fox family..." → Which January?! MISSING YEAR!
- "In August, a man climbed..." → Which August?! MISSING YEAR!
- "In September, two wheelchair-bound men..." → Which September?! MISSING YEAR!
- "Last March, a woman..." → Which March?! (Only OK if you're certain it's THIS year)

The rule is simple: If you type a month name (January, February, March, April, May, June, July, August, September, October, November, December), the YEAR must appear in the same sentence.

If you're not sure of the year, or it's not important to the story → Use Option B (year only) or Option C (drop it).

This will be EXPLICITLY CHECKED before your question is accepted. Month without year = AUTOMATIC REJECTION.

=== GRAMMAR & ARTICLES ===

1. Include articles (a/an/the) as PART of the answer, NOT before the blank:
   - BAD: "Police found an _____ on the highway" with answer "abandoned car"
   - GOOD: "Police found _____ on the highway" with answer "an abandoned car"

2. Test the filled-in sentence for grammatical correctness:
   - "stuck in a dumpster hole" ✓ (not "stuck in dumpster hole")

3. **🚨 CRITICAL: SPOILER WORDS MUST BE PART OF THE BLANK 🚨**

   Words like "also", "too", "as well", "similarly", "likewise" create a semantic relationship that SPOILS the question by revealing what type of answer is expected.

   ❌ BAD - Spoiler word before blank:
   Question: "Leonard Birkinbine was re-elected as coroner two days after dying because his challenger had also _____"
   Answer: "died"
   → PROBLEM: "also" reveals the answer must be the SAME as what Birkinbine did (died)!
   → Makes house answers like "quit" or "withdrawn" OBVIOUSLY WRONG

   ✅ GOOD - Move spoiler word INTO the blank:
   Question: "Leonard Birkinbine was re-elected as coroner two days after dying because his challenger had _____"
   Answer: "also died"
   House: "moved to Canada", "withdrawn from the race", "been disqualified", "already conceded", "quit politics"
   → Now house answers use DIFFERENT structures (no "also"), so "also died" doesn't stand out
   → Players can't tell which structural pattern is correct

   ❌ BAD - Another example:
   Question: "The suspect escaped by hiding in the same place where police _____ too"
   Answer: "looked"
   → "too" spoils it by revealing answer must match what police did

   ✅ GOOD - Fixed:
   Question: "The suspect escaped by hiding in the same place where police _____"
   Answer: "looked too"
   House: "already searched", "never checked", "had investigated", "swept earlier"
   → House answers use different structures, so "looked too" doesn't give itself away

   Rule: If a word creates a semantic requirement (answer must match/relate to something else), move it INTO the blank. House answers should use VARIED structures, NOT all copy the same modifier.

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

=== MANDATORY PRE-SUBMISSION VALIDATION CHECKLIST ===

Before submitting your question, you MUST verify each item below. If ANY item fails, REVISE your question.

CHECKPOINT 1: Month/Year Check
□ Does your question mention a month (January, February, March, April, May, June, July, August, September, October, November, December)?
  → If YES: Does it ALSO include the year?
    → If NO YEAR: ❌ REJECT - Fix it! Use "In [Month] [Year]" OR "In [Year]" OR drop temporal context entirely
    → If HAS YEAR: ✅ PASS

Examples of FAILING this checkpoint:
❌ "In September, two wheelchair-bound men..." → NO YEAR! Fix: "In September 2011, two..." or "In 2011, two..." or "Two wheelchair-bound men..."
❌ "In January, the Fox family in Iowa..." → NO YEAR! Fix: "In January 1999, the Fox family..." or "In 1999, the Fox family..." or "The Fox family in Iowa..."
❌ "In August, a man climbed a tower..." → NO YEAR! Fix: "In August 1996, a man..." or "In 1996, a man..." or "A man climbed a tower..."

CHECKPOINT 2: Spoiler Word Check
□ Does your question have a spoiler word (also, too, as well, similarly, likewise) RIGHT BEFORE the blank?
  → If YES: Does this word create a semantic requirement that reveals what TYPE of answer is expected?
    → If YES: ❌ REJECT - Move the spoiler word INTO the blank as part of the answer!
    → If NO: ✅ PASS

Examples of FAILING this checkpoint:
❌ "...his challenger had also _____" with answer "died"
   → "also" reveals answer must match what Birkinbine did!
   Fix: "...his challenger had _____" with answer "also died"
   (House answers will use DIFFERENT structures like "moved to Canada", "been disqualified" - no "also")

❌ "...the same place where police _____ too" with answer "looked"
   → "too" reveals answer must match police action!
   Fix: "...the same place where police _____" with answer "looked too"
   (House answers will use different structures like "already searched", "never checked")

CHECKPOINT 3: Open-endedness Check
□ Could the blank be filled with multiple categories of answers (not just variations within one category)?
  → If NO: ❌ REJECT - Question too narrow

CHECKPOINT 4: Conciseness Check
□ Is the real answer 1-3 words (max 4 in rare cases)?
  → If NO: ❌ REJECT - Answer too long

CHECKPOINT 5: Compound Answer Check
□ Does the real answer contain "or" (e.g., "cats or dogs")?
  → If YES: ❌ REJECT - Pick ONE specific answer

If all checkpoints PASS → Proceed to output format below.
If any checkpoint FAILS → REVISE your question and check again.

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
      const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens)

      // Auto-fix: Insert year for "In Month," patterns
      const monthWithoutYearPattern = /\b(In|in)\s+(January|February|March|April|May|June|July|August|September|October|November|December)(,?)\s+(?!\d{4})/
      if (monthWithoutYearPattern.test(result.question)) {
        const originalQuestion = result.question

        // Try to get year from spacetime metadata or article pubDate
        let year: number | null = null
        if (spacetime?.eventYear) {
          year = spacetime.eventYear
        }

        if (year) {
          // Insert year after month: "In December," → "In December 2022,"
          result.question = result.question.replace(
            monthWithoutYearPattern,
            (match: string, inWord: string, month: string, comma: string) => {
              const hasComma = comma === ','
              return `${inWord} ${month} ${year}${hasComma ? ',' : ''}`
            }
          )
          console.log(`✓ Auto-fixed temporal clarity: "${originalQuestion.substring(0, 50)}..." → "${result.question.substring(0, 50)}..."`)
        } else {
          console.warn('⚠️  WARNING: Question contains month without year (no year metadata available to fix):', result.question)
          console.warn('    This violates temporal clarity rules. Consider rejecting or regenerating.')
        }
      }

      return {
        question: result.question,
        realAnswer: result.realAnswer,
        blank: result.blank,
        postscript: result.postscript,
        cost,
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
    content: string,
    question: string,
    realAnswer: string,
    sampleRealAnswers?: string[]
  ): Promise<HouseAnswersResult & { cost: number }> {
    const samplesSection = sampleRealAnswers && sampleRealAnswers.length > 0
      ? `\nStyle Examples (from other real answers in our database):
${sampleRealAnswers.map(a => `- "${a}"`).join('\n')}

Notice how these are concise and direct, without unnecessary adjectives.\n`
      : ''

    const systemPrompt = `You are generating fake "house answers" for an adults-only trivia game.

CRITICAL VALIDATION REQUIREMENT:
For EVERY house answer you generate, you MUST MENTALLY validate it by imagining the COMPLETE filled-in sentence:
1. Grammatically correct (articles, verb agreement, etc.)
2. Semantically coherent (makes logical sense)
3. Verb constraints satisfied (e.g., "unleashing" requires unleashable things)

Validate MENTALLY - do NOT write out your validation work in the output.
Return ONLY valid JSON. NO explanations. NO markdown. NO process description.

This is MANDATORY. If you output anything other than pure JSON, the game will break.`

    const prompt = `Generate 5 plausible but wrong answers for this trivia question.

Article Title: "${title}"
Article Content: ${content}
Question: "${question}"
Real Answer: "${realAnswer}"
${samplesSection}

=== MANDATORY STEP-BY-STEP PROCESS ===

For EACH potential house answer:

STEP 1: Write the COMPLETE filled-in sentence
STEP 2: Check grammar (articles, verb agreement, plural/singular)
STEP 3: Check semantics (does this make logical sense?)
STEP 4: Check verb constraints (does the verb work with this answer?)
STEP 5: Only if ALL checks pass → include in final list

DO NOT SKIP STEPS. You MUST validate EVERY answer before including it.

Example of BROKEN house answers (NEVER do this):
Question: "attempting to super glue his penis to his _____"
❌ BAD: "the baseball bat"
  → COMPLETE: "attempting to super glue his penis to his the baseball bat"
  → GRAMMAR FAIL: Double article "to his the" is broken English!
  → REJECT

❌ BAD: "her car"
  → COMPLETE: "attempting to super glue his penis to his her car"
  → GRAMMAR FAIL: "his her car" is nonsensical!
  → REJECT

✅ GOOD: "his car"
  → COMPLETE: "attempting to super glue his penis to his car"
  → ✓ Grammar correct, semantics valid, weird and funny!
  → ACCEPT

Example 2:
Question: "a black bear was caught on security camera stealing _____"
❌ BAD: "the HOA president"
  → COMPLETE: "a black bear was caught on security camera stealing the HOA president"
  → SEMANTIC FAIL: Bears don't "steal" people. You steal objects, not humans.
  → REJECT

✅ GOOD: "the HOA president's grill"
  → COMPLETE: "a black bear was caught on security camera stealing the HOA president's grill"
  → ✓ Grammar correct, semantics valid (bears CAN steal grills), funny!
  → ACCEPT

=== CRITICAL: HOUSE ANSWERS MUST BE WRONG ===

House answers must be WRONG - they cannot match the real answer.

🚨 CRITICAL: House answers must be SEMANTICALLY DIFFERENT from the real answer. They cannot be synonyms, paraphrases, or alternative expressions of the same thing.

Example - BAD semantic similarity:
Real Answer: "$10"
❌ BAD House Answers:
- "ten bucks each" → This is just another way to say $10! COMPLETELY BREAKS THE GAME!
- "ten dollars" → Same meaning, just spelled out! REJECT!
- "10 bucks" → Literally the same amount! REJECT!
- "a tenner" → Slang for $10! REJECT!

✅ GOOD House Answers (actually DIFFERENT amounts/concepts):
- "$1" or "a single dollar" (different amount)
- "$100" or "a crisp Benjamin" (different amount)
- "a penny" (different amount)
- "their dignity" (completely different concept - not money at all!)
- "naming rights" (different concept)

Example 2 - Spatial/directional:
Real Answer: "north"
❌ BAD: "northward", "up north", "to the north" (all mean the same direction!)
✅ GOOD: "south", "east", "in circles", "backwards"

Example 3 - Synonyms:
Real Answer: "a car"
❌ BAD: "an automobile", "a vehicle", "his ride" (synonyms!)
✅ GOOD: "a bicycle", "a skateboard", "his ex-wife"

Example 4 - Paraphrases:
Real Answer: "his boss"
❌ BAD: "his supervisor", "his manager", "the person he reports to" (same person!)
✅ GOOD: "his wife", "his therapist", "his nemesis"

THE RULE: If a player could reasonably say "that's basically the same answer!", it's TOO SIMILAR. Reject it immediately.

If the real answer is a SUBSET of a larger list in the article, house answers CAN use other items from that list:

Example - Subset question:
Article: "threatened punishment for those who shave like Elvis Presley, Sylvester Stallone, and the U.S. Marines"
Question: "In 1996, a Somali court threatened to punish men who shave like which famous musician?"
Real Answer: "Elvis Presley"

✅ GOOD House Answers:
- "Sylvester Stallone" (other item from the list - wrong answer to THIS question)
- "Michael Jackson"
- "Frank Sinatra"
- "the Village People"
- "Freddie Mercury"

Example - Full answer (not subset):
Real Answer: "a lawn mower"

❌ BAD House Answer: "a lawn mower" (identical!)
✅ GOOD House Answers: "a bicycle", "hedge trimmers", "a tractor"

The key rule: House answer ≠ Real answer (NOT EVEN CLOSE!). No synonyms, no paraphrases, no alternative expressions of the same thing. If the question is asking for a subset/selection, other items from the source list are fair game as wrong answers.

=== CRITICAL: SPOILER WORDS IN REAL ANSWER - USE VARIED STRUCTURES ===

If the real answer contains spoiler words like "also", "too", "as well", "similarly", "likewise", house answers should use DIFFERENT structures to avoid revealing the pattern.

Example:
Question: "Leonard Birkinbine was re-elected as coroner two days after dying because his challenger had _____"
Real Answer: "also died"

✅ GOOD House Answers (use VARIED structures, NOT "also"):
- "moved to Canada"
- "withdrawn from the race"
- "been disqualified"
- "already conceded"
- "quit politics"
→ Now players can't tell that "also" is the key word. The real answer doesn't stand out.

❌ BAD House Answers (all use "also" - creates obvious pattern):
- "also withdrawn" → Bad! If ALL answers have "also", it's a giveaway
- "also quit" → Bad! Pattern reveals "also" is important
- "also been arrested" → Bad! Makes the structure too obvious

Example 2:
Real Answer: "looked too"

✅ GOOD House Answers (varied structures):
- "already searched"
- "never checked"
- "had investigated earlier"
- "swept for evidence"
- "combed through"

❌ BAD House Answers (all use "too"):
- "searched too" → Creates obvious pattern
- "checked too" → Makes structure too obvious

The rule: If real answer has a modifier like "also/too/as well", house answers should use DIFFERENT modifiers or NO modifier. This prevents players from identifying the pattern.

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

This is an ADULTS-ONLY game. Dark humor, sexual content, violence, drugs, crime - all ENCOURAGED as long as it's funny.

House answers must be entertaining, not just category-appropriate.

Question: "In 2024, a Norwegian tourist was denied US entry after border control found _____ on his phone"
Real Answer: "a JD Vance meme"

❌ BORING house answers:
- "unauthorized government documents" (obvious, not funny, not weird)
- "satirical AI-generated content" (corporate speak, boring)

✅ GREAT house answers:
- "clown porn" (absurd, funny, weird, adult content is GOOD)
- "pictures of flour" (random, weird, funny)
- "a wasp nest" (what?? perfect absurdity)
- "semen" (dark humor, surprising, sexual content is GOOD)
- "decapitation videos" (dark but absurd in context)

The game is COMEDY. Prioritize WEIRD + FUNNY over "sensible categories". Dark/sexual/violent humor is ENCOURAGED.

=== KEEP ANSWERS SHORT & PUNCHY ===

CRITICAL: Answers should be 1-3 words. Maximum 4 words in rare cases.

**REFERENCE PLAYER:** Imagine a drunk person at a party, typing on their phone. They won't type verbose phrases like "his opponent's campaign button" (they'd type "his opponent's button") or "the police force" (they'd type "the police"). Keep it SHORT and NATURAL.

MANDATORY VALIDATION FOR EACH HOUSE ANSWER: Ask yourself:
1. "Would a DRUNK PERSON AT A PARTY actually type ALL these words on their phone?"
2. "Are there any redundant or unnecessary modifiers?"
3. "Can I remove ANY word without losing the fun?"
4. "Does this sound NATURAL - like something a human would actually say?"

If yes to #2 or #3, or no to #4 → REVISE to be shorter and more natural!

Players will type what they THINK, not verbose descriptions. Optimize for matching!

❌ BAD: "a can of hair spray" → Players type "hairspray" or "hair spray", NEVER "a can of hair spray"
✅ GOOD: "hair spray" or "hairspray" (what players actually type)

❌ BAD: "the police force" (too formal/verbose) → Players type "the police"
✅ GOOD: "the police" (natural, conversational)

❌ BAD: "his opponent's campaign button" (4 words!) → Drunk people don't type this!
✅ GOOD: "his opponent's button" (3 words, much better)

❌ BAD: "laser-cut it into pieces" (4 words, redundant!) → "into pieces" is implied!
✅ GOOD: "laser-cut it" (2 words, punchy!)

❌ BAD: "a 21-year-old man" (3 words but verbose) → Too specific for a house answer!
✅ GOOD: "a young man" OR "a 21 year old" (simpler, more natural)

❌ BAD: "the coordinates to Jimmy Hoffa's burial site" (7 words!)
✅ GOOD: "Jimmy Hoffa's coordinates" (3 words)

❌ BAD: "a bottle of whiskey" → Players type "whiskey"
✅ GOOD: "whiskey"

❌ BAD: "the combination to her therapist's safe" (6 words!)
✅ GOOD: "her therapist's safe combo" (4 words) or "her safe combination" (3 words)

❌ BAD: "compromising political cartoons" (3 words but wordy)
✅ GOOD: "political cartoons" (2 words)

❌ BAD: "unsuspecting neighbor's cat"
✅ GOOD: "neighbor's cat"

❌ BAD: "vintage lawnmower"
✅ GOOD: "lawnmower"

CRITICAL: Remove REDUNDANT modifiers (adjective inherent to the noun):
❌ BAD: "the biblical 10 Lost Tribes" → ✅ GOOD: "the Lost Tribes" or "biblical tribes"
❌ BAD: "frozen ice" → ✅ GOOD: "ice"
❌ BAD: "illegal contraband" → ✅ GOOD: "contraband"

RULE: If the article mentions "a can of X", the answer is just "X" (or "a can" if that's the surprising part).

If the real answer is long, match its length/style. But aim for PUNCHY and CONCISE and MATCHABLE.

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

CRITICAL: You MUST generate EXACTLY 5 house answers. NOT 4. NOT 6. EXACTLY 5.

🚨 CRITICAL: Return ONLY valid JSON. NO explanations, NO markdown, NO validation text, NO process description.

DO NOT WRITE:
- "I'll generate 5 house answers..."
- "Testing Candidate 1..."
- "Complete sentence: ..."
- Any text before or after the JSON
- Any markdown formatting (**, ---, etc.)

DO YOUR VALIDATION MENTALLY. Then output ONLY this JSON:

{
  "houseAnswers": ["answer1", "answer2", "answer3", "answer4", "answer5"]
}

Each answer MUST be:
1. Validated MENTALLY by imagining the complete filled-in sentence
2. Grammatically correct
3. Semantically coherent with verb/context
4. Weird + funny (not just "category appropriate")
5. Concise (no gratuitous adjectives)
6. Varied (not 3+ of the same joke type)

PROCESS (do this IN YOUR HEAD, not in the output):
1. Test candidates mentally until you have EXACTLY 5 accepted answers
2. If a candidate fails validation, test another one mentally
3. STOP when you have 5 accepted answers
4. Return ONLY THE JSON with those 5 answers - NOTHING ELSE

Generate the 5 house answers now (validate mentally, output ONLY JSON):`

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.houseAnswers.maxTokens,
      temperature: this.config.houseAnswers.temperature,
      system: systemPrompt, // Use our custom system prompt with validation requirements
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
      const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens)

      return {
        houseAnswers: result.houseAnswers,
        cost,
      }
    } catch (error) {
      // Fallback: Extract validated answers from the validation text
      // Claude may have shown its work without including final JSON
      const acceptedAnswers: string[] = []

      // Try multiple patterns to handle different formatting styles

      // Pattern 1: ## Testing House Answer N: "answer" ... ✅ **ACCEPT**
      const pattern1 = /## Testing House Answer \d+(?:\s+\(revised\))?: "([^"]+)"[\s\S]*?✅ \*\*ACCEPT\*\*/g
      let match
      while ((match = pattern1.exec(text)) !== null) {
        if (match[1]) acceptedAnswers.push(match[1])
      }

      // Pattern 2: ## Testing House Answer N: "answer" ... ✅ **Grammar check:** (new format)
      if (acceptedAnswers.length < 5) {
        acceptedAnswers.length = 0
        const pattern2 = /## Testing House Answer \d+: "([^"]+)"[\s\S]*?✅ \*\*Grammar check:\*\*/g
        while ((match = pattern2.exec(text)) !== null) {
          if (match[1]) acceptedAnswers.push(match[1])
        }
      }

      // Pattern 3: **Testing "answer":** ... ✓ or → ✓
      if (acceptedAnswers.length < 5) {
        acceptedAnswers.length = 0
        const pattern3 = /\*\*Testing "([^"]+)":\*\*[\s\S]*?(?:→ )?✓/g
        while ((match = pattern3.exec(text)) !== null) {
          if (match[1]) acceptedAnswers.push(match[1])
        }
      }

      // Pattern 4: **Testing Candidate N: "answer"** ... → ✓ (new format)
      if (acceptedAnswers.length < 5) {
        acceptedAnswers.length = 0
        const pattern4 = /\*\*Testing Candidate \d+: "([^"]+)"\*\*[\s\S]*?→ ✓/g
        while ((match = pattern4.exec(text)) !== null) {
          if (match[1]) acceptedAnswers.push(match[1])
        }
      }

      // Pattern 5: Fuzzy - Look for any quoted answers followed by acceptance indicators
      if (acceptedAnswers.length < 5) {
        acceptedAnswers.length = 0
        const pattern5 = /"([^"]+)"[\s\S]{0,200}?(?:✅|✓)[\s\S]{0,50}?(?:ACCEPT|Grammar|check)/gi
        while ((match = pattern5.exec(text)) !== null) {
          const answer = match[1]!
          // Filter out noise (questions, reasoning text)
          if (answer.length < 50 && !answer.includes('In 19') && !answer.includes('citing')) {
            acceptedAnswers.push(answer)
          }
        }
      }

      // Deduplicate while preserving order
      const uniqueAnswers = [...new Set(acceptedAnswers)]

      // Filter out single-letter answers and very short nonsense (minimum 2 chars)
      const filtered = uniqueAnswers.filter(a => a.length > 1)

      // If we found 5+ accepted answers (after filtering), use the first 5
      if (filtered.length >= 5) {
        const finalAnswers = filtered.slice(0, 5)
        const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens)
        console.log('ℹ️  Extracted house answers from validation text (no JSON found)')
        console.log(`   Found ${uniqueAnswers.length} answers (${filtered.length} after filtering), using first 5:`, finalAnswers)
        return {
          houseAnswers: finalAnswers,
          cost,
        }
      }

      // Otherwise, fail with the original error (too few answers is a quality issue)
      throw new Error(`Failed to parse Claude response as JSON and couldn't extract validated answers (found ${filtered.length}/5 after filtering, ${uniqueAnswers.length} before). First 500 chars:\n${text.substring(0, 500)}...`)
    }
  }

  /**
   * Score article candidates (for bakeoff comparison with Ollama)
   */
  async scoreArticleCandidates(
    candidates: Array<{ id: string; title: string; summary: string }>
  ): Promise<{ scores: Array<{ id: string; score: number; reasoning: string }>; cost: number }> {
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

CRITICAL: Do NOT penalize articles for adult/dark content. The game embraces dark comedy.

Articles to score:
${candidates.map((c, i) => `
[${i + 1}] ${c.title}
Summary: ${c.summary}
`).join('\n')}

For EACH article, respond in this EXACT format:

ARTICLE 1
ANALYSIS: <1-2 sentences of critical analysis>
SCORES:
{
  "specificity": <0-100>,
  "surprise": <0-100>,
  "openEndedness": <0-100>,
  "humor": <0-100>,
  "overall": <0-100>
}

ARTICLE 2
ANALYSIS: <1-2 sentences>
SCORES:
{
  "specificity": <0-100>,
  "surprise": <0-100>,
  "openEndedness": <0-100>,
  "humor": <0-100>,
  "overall": <0-100>
}

(continue for all articles)`

    console.log('\n' + '='.repeat(80))
    console.log('🧠 CLAUDE SCORING REQUEST')
    console.log('='.repeat(80))
    console.log('Model:', this.config.model)
    console.log('Temperature:', 0.35)
    console.log('Max Tokens:', 3000)
    console.log('\nPrompt:')
    console.log(prompt)
    console.log('='.repeat(80) + '\n')

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.judging?.maxTokens || 3000,
      temperature: this.config.judging?.temperature || 0.35,
      system: this.config.judging?.systemPrompt || 'You are judging trivia questions for quality and entertainment value.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    console.log('\n' + '='.repeat(80))
    console.log('📥 CLAUDE SCORING RESPONSE')
    console.log('='.repeat(80))
    console.log(text)
    console.log('='.repeat(80) + '\n')

    // Parse scores
    const scores: Array<{ id: string; score: number; reasoning: string }> = []

    const articleBlocks = text.split(/ARTICLE \d+/).filter(b => b.trim())

    for (let i = 0; i < articleBlocks.length && i < candidates.length; i++) {
      const block = articleBlocks[i]!
      const candidate = candidates[i]!

      // Extract analysis
      const analysisMatch = block.match(/ANALYSIS:\s*(.+?)(?=SCORES:|$)/is)
      const reasoning = analysisMatch?.[1]?.trim() || 'No analysis provided'

      // Extract overall score from JSON
      let overallScore = 0
      const scoresMatch = block.match(/SCORES:\s*(\{[\s\S]*?\})/i)
      if (scoresMatch) {
        try {
          const jsonStr = scoresMatch[1]!
            .replace(/,\s*\/\/[^\n]*/g, '')
            .replace(/\/\/[^\n]*/g, '')
          const scoreObj = JSON.parse(jsonStr)
          overallScore = scoreObj.overall || 0
        } catch {
          // Fallback: regex
          const overallMatch = block.match(/"overall":\s*(\d+)/i)
          overallScore = overallMatch ? parseInt(overallMatch[1]!, 10) : 0
        }
      }

      scores.push({
        id: candidate.id,
        score: overallScore,
        reasoning,
      })
    }

    // Calculate cost
    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens)

    return { scores, cost }
  }

  /**
   * Get cost for a response based on the model being used
   */
  calculateCost(inputTokens: number, outputTokens: number): number {
    // Pricing per million tokens based on model
    let INPUT_COST_PER_MILLION: number
    let OUTPUT_COST_PER_MILLION: number

    if (this.config.model.includes('haiku')) {
      // Claude 3.5 Haiku pricing
      INPUT_COST_PER_MILLION = 0.25
      OUTPUT_COST_PER_MILLION = 1.25
    } else if (this.config.model.includes('sonnet')) {
      // Claude 3.5 Sonnet / Sonnet 4.5 pricing
      INPUT_COST_PER_MILLION = 3.00
      OUTPUT_COST_PER_MILLION = 15.00
    } else if (this.config.model.includes('opus')) {
      // Claude 3 Opus pricing
      INPUT_COST_PER_MILLION = 15.00
      OUTPUT_COST_PER_MILLION = 75.00
    } else {
      // Default to Sonnet pricing (safest assumption)
      INPUT_COST_PER_MILLION = 3.00
      OUTPUT_COST_PER_MILLION = 15.00
    }

    const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION
    const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION

    return inputCost + outputCost
  }

  /**
   * Judge between two trivia questions (head-to-head comparison)
   */
  async judgeQuestions(
    question1: { question: string; correctAnswer: string; houseAnswers: string[] },
    question2: { question: string; correctAnswer: string; houseAnswers: string[] }
  ): Promise<{ winner: 1 | 2; reasoning: string; cost: number }> {
    const prompt = `You are judging two trivia questions for "Fake Facts" - an adults-only party game.

Pick the question that will make players LAUGH THE HARDEST.

CRITICAL: This is ADULTS-ONLY comedy. Dark humor, sexual content, violence, controversial topics are ENCOURAGED as long as they're funny. Do NOT penalize questions for adult content.

Criteria for a GREAT question:
✓ SPECIFIC and concrete (not vague)
✓ SURPRISING and unexpected
✓ Open-ended (multiple plausible answers)
✓ Funny/absurd (dark humor is GOOD - death, sex, violence, drugs all fair game!)
✓ Clear and easy to understand
✓ Temporal clarity: If mentions month (January, etc.), MUST include year - otherwise confusing!
✓ House answers are creative, funny, AND grammatically correct

CRITICAL: All house answers MUST be grammatically compatible with the question.

RED FLAG - Auto-reject if:
❌ Question says "In January" or "In August" etc. WITHOUT a year (should be "In January 1999" or "In 1999" or drop it)

Question 1:
${question1.question}
Correct Answer: ${question1.correctAnswer}
House Answers: ${question1.houseAnswers.join(', ')}

Question 2:
${question2.question}
Correct Answer: ${question2.correctAnswer}
House Answers: ${question2.houseAnswers.join(', ')}

Analyze each question on:
1. Specificity (concrete vs vague)
2. Surprise factor (unexpected vs predictable)
3. Open-endedness (multiple plausible answers)
4. Comedy value (funny, absurd, dark humor welcome)
5. Clarity (easy to understand)
6. Temporal clarity (month without year = RED FLAG)
7. House answer quality (creative, funny, grammatically correct)

Then pick the WINNER (1 or 2) and explain why.

IMPORTANT: If a question mentions a month without a year (e.g., "In January"), this is a SERIOUS flaw that should heavily penalize that question.

Respond in this EXACT format:
WINNER: 1 or 2
REASONING: <your detailed reasoning>`

    const systemPrompt = this.config.judging?.systemPrompt || 'You are judging trivia questions for quality and entertainment value.'

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.judging?.maxTokens || 1500,
      temperature: this.config.judging?.temperature || 0.35,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Parse winner and reasoning
    const winnerMatch = text.match(/WINNER:\s*([12])/i)
    const reasoningMatch = text.match(/REASONING:\s*(.+?)$/is)

    if (!winnerMatch) {
      throw new Error(`Failed to parse winner from Claude response: ${text}`)
    }

    const winner = parseInt(winnerMatch[1]!, 10) as 1 | 2
    const reasoning = reasoningMatch?.[1]?.trim() || 'No reasoning provided'
    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens)

    return { winner, reasoning, cost }
  }

  /**
   * Judge between THREE questions and pick the single best one
   */
  async judgeThreeQuestions(
    question1: { question: string; correctAnswer: string; houseAnswers: string[] },
    question2: { question: string; correctAnswer: string; houseAnswers: string[] },
    question3: { question: string; correctAnswer: string; houseAnswers: string[] }
  ): Promise<{ winner: 1 | 2 | 3; reasoning: string; cost: number }> {
    const prompt = `You are judging THREE trivia questions for "Fake Facts" - an adults-only party game.

Pick the SINGLE BEST question that will make players LAUGH THE HARDEST.

CRITICAL: This is ADULTS-ONLY comedy. Dark humor, sexual content, violence, controversial topics are ENCOURAGED as long as they're funny. Do NOT penalize questions for adult content.

Criteria for a GREAT question:
✓ SPECIFIC and concrete (not vague)
✓ SURPRISING and unexpected
✓ Open-ended (multiple plausible answers)
✓ Funny/absurd (dark humor is GOOD - death, sex, violence, drugs all fair game!)
✓ Clear and easy to understand
✓ Temporal clarity: If mentions month (January, etc.), MUST include year - otherwise confusing!
✓ House answers are creative, funny, AND grammatically correct

CRITICAL: All house answers MUST be grammatically compatible with the question.

RED FLAG - Auto-reject if:
❌ Question says "In January" or "In August" etc. WITHOUT a year (should be "In January 1999" or "In 1999" or drop it)

Question A:
${question1.question}
Correct Answer: ${question1.correctAnswer}
House Answers: ${question1.houseAnswers.join(', ')}

Question B:
${question2.question}
Correct Answer: ${question2.correctAnswer}
House Answers: ${question2.houseAnswers.join(', ')}

Question C:
${question3.question}
Correct Answer: ${question3.correctAnswer}
House Answers: ${question3.houseAnswers.join(', ')}

Analyze each question on:
1. Specificity (concrete vs vague)
2. Surprise factor (unexpected vs predictable)
3. Open-endedness (multiple plausible answers)
4. Comedy value (funny, absurd, dark humor welcome)
5. Clarity (easy to understand)
6. Temporal clarity (month without year = RED FLAG)
7. House answer quality (creative, funny, grammatically correct)

Then pick the SINGLE WINNER (A, B, or C) and explain why.

IMPORTANT: If a question mentions a month without a year (e.g., "In January"), this is a SERIOUS flaw that should heavily penalize that question.

Respond in this EXACT format:
WINNER: A or B or C
REASONING: <your detailed reasoning comparing all three and explaining why the winner is superior>`

    const systemPrompt = this.config.judging?.systemPrompt || 'You are judging trivia questions for quality and entertainment value.'

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.judging?.maxTokens || 2000,
      temperature: this.config.judging?.temperature || 0.35,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Parse winner and reasoning
    const winnerMatch = text.match(/WINNER:\s*([ABC])/i)
    const reasoningMatch = text.match(/REASONING:\s*(.+?)$/is)

    if (!winnerMatch) {
      throw new Error(`Failed to parse winner from Claude response: ${text}`)
    }

    // Map A/B/C to 1/2/3
    const letterToNumber: Record<string, 1 | 2 | 3> = { 'A': 1, 'B': 2, 'C': 3 }
    const winner = letterToNumber[winnerMatch[1]!.toUpperCase()] || 1
    const reasoning = reasoningMatch?.[1]?.trim() || 'No reasoning provided'
    const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens)

    return { winner, reasoning, cost }
  }
}
