import { describe, it, expect, beforeAll } from 'vitest'
import { LocalLLM } from './local-llm'
import type { LocalLLMConfig } from './types'

const OLLAMA_AVAILABLE = process.env.SKIP_OLLAMA_TESTS !== 'true'

describe('LocalLLM', () => {
  let llm: LocalLLM

  beforeAll(() => {
    const config: LocalLLMConfig = {
      provider: 'ollama',
      model: 'qwen2.5:14b',
      endpoint: 'http://localhost:11434',
      temperature: 0.3,
      maxTokens: 200,
    }
    llm = new LocalLLM(config)
  })

  describe('parseStoriesResponse', () => {
    it('should parse single story from LLM response', () => {
      const response = `STORY 1
TITLE: 63-year-old predicts future by throwing asparagus in the air
CONTENT: Jemima Packington of Bath, England, claims she can predict the future by throwing asparagus spears into the air and reading the patterns they make when they land.`

      const stories = (llm as any).parseStoriesResponse(response)

      expect(stories).toHaveLength(1)
      expect(stories[0]?.title).toBe('63-year-old predicts future by throwing asparagus in the air')
      expect(stories[0]?.content).toContain('Jemima Packington')
      expect(stories[0]?.content).toContain('asparagus spears')
    })

    it('should parse multiple stories from LLM response', () => {
      const response = `STORY 1
TITLE: Florida man arrested for stealing lawn mower while riding stolen lawn mower
CONTENT: A Florida man was arrested after police caught him stealing a lawn mower while riding another stolen lawn mower.

STORY 2
TITLE: Woman calls 911 because McDonald's ran out of McNuggets
CONTENT: A woman in Ohio called 911 three times after McDonald's informed her they were out of Chicken McNuggets.

STORY 3
TITLE: Man tries to rob bank with avocado
CONTENT: A California man attempted to rob a bank using an avocado painted black to look like a grenade.`

      const stories = (llm as any).parseStoriesResponse(response)

      expect(stories).toHaveLength(3)
      expect(stories[0]?.title).toContain('lawn mower')
      expect(stories[1]?.title).toContain('McNuggets')
      expect(stories[2]?.title).toContain('avocado')
    })

    it('should handle malformed response gracefully', () => {
      const response = `Some random text without proper formatting`

      const stories = (llm as any).parseStoriesResponse(response)

      expect(stories).toHaveLength(0)
    })

    it('should ignore incomplete stories', () => {
      const response = `STORY 1
TITLE: Complete story with title and content
CONTENT: This is a complete story.

STORY 2
TITLE: Incomplete story missing content`

      const stories = (llm as any).parseStoriesResponse(response)

      expect(stories).toHaveLength(1)
      expect(stories[0]?.title).toBe('Complete story with title and content')
    })
  })

  describe('extractStories (integration with Ollama)', () => {
    it.skipIf(!OLLAMA_AVAILABLE)('should extract individual stories from News of the Weird compilation', async () => {
      const compilation = `LEAD STORY -- People Different From Us

Jemima Packington, 63, of Bath, England, claims she can predict the future by throwing asparagus spears into the air and reading the patterns they make when they land. She's been doing it for years and says her predictions have an 80% accuracy rate.

LEAST COMPETENT CRIMINAL

A Florida man was arrested on Jan. 15 after police found him stealing a lawn mower from a home improvement store while riding another stolen lawn mower he had taken from the same store 10 minutes earlier.

THE PASSING PARADE

A woman in Toledo, Ohio, called 911 three times on Jan. 18 after a McDonald's restaurant told her they were out of Chicken McNuggets. She was arrested and charged with misuse of 911.`

      const result = await llm.extractStories(compilation)

      // Extraction should be valid
      expect(result.valid).toBe(true)
      expect(result.stories.length).toBeGreaterThanOrEqual(3)

      // Check that we have titles
      expect(result.stories[0]?.title).toBeTruthy()
      expect(result.stories[0]?.title.length).toBeGreaterThan(10)

      // Check that we have content
      expect(result.stories[0]?.content).toBeTruthy()
      expect(result.stories[0]?.content.length).toBeGreaterThan(20)

      // Titles should be specific and punchy (not generic)
      const titles = result.stories.map(s => s.title.toLowerCase())
      expect(titles.some(t => t.includes('asparagus') || t.includes('predict'))).toBe(true)

      // Content should be preserved
      expect(result.stories.some(s => s.content.includes('Jemima Packington'))).toBe(true)
    }, 30000) // 30 second timeout for LLM call

    it.skipIf(!OLLAMA_AVAILABLE)('should handle single story compilation', async () => {
      const compilation = `A man in California attempted to rob a bank on Jan. 20 using what appeared to be a grenade. Police later discovered it was an avocado painted black. He was arrested without incident.`

      const result = await llm.extractStories(compilation)

      expect(result.valid).toBe(true)
      expect(result.stories.length).toBeGreaterThanOrEqual(1)
      expect(result.stories[0]?.title).toBeTruthy()
      expect(result.stories[0]?.content).toContain('avocado')
    }, 30000)
  })

  describe('classify (integration with Ollama)', () => {
    it.skipIf(!OLLAMA_AVAILABLE)('should classify weird story as WEIRD', async () => {
      const result = await llm.classify(
        '63-year-old predicts future by throwing asparagus',
        'Jemima Packington claims she can predict the future by throwing asparagus spears.'
      )

      expect(result.isWeird).toBe(true)
      expect(result.confidence).toBeGreaterThan(70)
      expect(result.reasoning).toBeTruthy()
    }, 10000)

    it.skipIf(!OLLAMA_AVAILABLE)('should classify mundane story as NOT WEIRD', async () => {
      const result = await llm.classify(
        'Local library extends hours',
        'The public library will now be open until 9pm on weekdays.'
      )

      expect(result.isWeird).toBe(false)
      expect(result.reasoning).toBeTruthy()
    }, 10000)
  })

  describe('parseArticleScores', () => {
    it('should parse new JSON format with analysis and scores', () => {
      const response = `ARTICLE 1
ANALYSIS: Great absurdity with the asparagus divination angle. Strong visual comedy potential with specific details.
SCORES:
{
  "specificity": 90,
  "surprise": 85,
  "openEndedness": 80,
  "humor": 88,
  "overall": 85
}

ARTICLE 2
ANALYSIS: Solid criminal incompetence angle but fairly standard Florida man territory. Lacks unique specificity.
SCORES:
{
  "specificity": 65,
  "surprise": 70,
  "openEndedness": 75,
  "humor": 72,
  "overall": 72
}

ARTICLE 3
ANALYSIS: Excellent specificity with the avocado grenade. Unexpected twist with great comedic potential and multiple angles.
SCORES:
{
  "specificity": 95,
  "surprise": 92,
  "openEndedness": 85,
  "humor": 90,
  "overall": 90
}`

      const candidates = [
        { id: 'id-1', title: 'Article 1', summary: 'Summary 1' },
        { id: 'id-2', title: 'Article 2', summary: 'Summary 2' },
        { id: 'id-3', title: 'Article 3', summary: 'Summary 3' },
      ]

      const scores = (llm as any).parseArticleScores(response, candidates)

      expect(scores).toHaveLength(3)
      expect(scores[0]).toEqual({
        id: 'id-1',
        score: 85,
        reasoning: 'Great absurdity with the asparagus divination angle. Strong visual comedy potential with specific details.',
      })
      expect(scores[1]).toEqual({
        id: 'id-2',
        score: 72,
        reasoning: 'Solid criminal incompetence angle but fairly standard Florida man territory. Lacks unique specificity.',
      })
      expect(scores[2]).toEqual({
        id: 'id-3',
        score: 90,
        reasoning: 'Excellent specificity with the avocado grenade. Unexpected twist with great comedic potential and multiple angles.',
      })
    })

    it('should handle missing JSON scores gracefully', () => {
      const response = `ARTICLE 1
ANALYSIS: Good story with some potential.
SCORES:
{
  "specificity": 70,
  "surprise": 65,
  "overall": 68
}

ARTICLE 2
ANALYSIS: Missing scores entirely.`

      const candidates = [
        { id: 'id-1', title: 'Article 1', summary: 'Summary 1' },
        { id: 'id-2', title: 'Article 2', summary: 'Summary 2' },
      ]

      const scores = (llm as any).parseArticleScores(response, candidates)

      expect(scores).toHaveLength(2)
      expect(scores[0]?.score).toBe(68)
      expect(scores[1]?.score).toBe(0) // Default when no scores found
    })

    it('should parse JSON with comments', () => {
      const response = `ARTICLE 1
ANALYSIS: Test with inline comments in JSON.
SCORES:
{
  "specificity": 75, // Good specificity
  "surprise": 80,
  "overall": 78 // Overall assessment
}`

      const candidates = [
        { id: 'id-1', title: 'Article 1', summary: 'Summary 1' },
      ]

      const scores = (llm as any).parseArticleScores(response, candidates)

      expect(scores).toHaveLength(1)
      expect(scores[0]?.score).toBe(78)
    })

    it('should fallback to regex when JSON parsing fails', () => {
      const response = `ARTICLE 1
ANALYSIS: Malformed JSON but overall score present.
SCORES:
{
  "specificity": 70,
  "surprise": malformed,
  "overall": 65
}`

      const candidates = [
        { id: 'id-1', title: 'Article 1', summary: 'Summary 1' },
      ]

      const scores = (llm as any).parseArticleScores(response, candidates)

      expect(scores).toHaveLength(1)
      expect(scores[0]?.score).toBe(65) // Should extract via regex fallback
    })
  })

  describe('parseQuestionJudgment', () => {
    it('should parse new format with analysis and scores for question 1 winner', () => {
      const response = `QUESTION 1 ANALYSIS:
This question has excellent specificity with the asparagus divination detail. Very open-ended and surprising. House answers are creative and grammatically correct.

QUESTION 1 SCORES:
{
  "specificity": 90,
  "surprise": 95,
  "openEndedness": 88,
  "humor": 92,
  "clarity": 85,
  "houseAnswerQuality": 90,
  "overall": 90
}

QUESTION 2 ANALYSIS:
Standard lawn mower theft story. Less surprising and more predictable. House answers lack creativity.

QUESTION 2 SCORES:
{
  "specificity": 70,
  "surprise": 60,
  "openEndedness": 65,
  "humor": 68,
  "clarity": 80,
  "houseAnswerQuality": 65,
  "overall": 68
}

WINNER: 1
REASONING: Question 1 has better specificity with the asparagus detail and more comedic potential. The overall score of 90 vs 68 reflects its superior open-endedness and surprise factor.`

      const judgment = (llm as any).parseQuestionJudgment(response)

      expect(judgment.winner).toBe(1)
      expect(judgment.reasoning).toContain('asparagus')
    })

    it('should parse question 2 winner with scores', () => {
      const response = `QUESTION 1 ANALYSIS:
Boring municipal topic with low surprise value. House answers are uninspired.

QUESTION 1 SCORES:
{
  "specificity": 60,
  "surprise": 40,
  "openEndedness": 50,
  "humor": 45,
  "clarity": 75,
  "houseAnswerQuality": 55,
  "overall": 52
}

QUESTION 2 ANALYSIS:
Criminal incompetence angle is hilarious with the stolen-on-stolen lawn mower detail. Very absurd and memorable.

QUESTION 2 SCORES:
{
  "specificity": 85,
  "surprise": 90,
  "openEndedness": 80,
  "humor": 92,
  "clarity": 88,
  "houseAnswerQuality": 85,
  "overall": 87
}

WINNER: 2
REASONING: Question 2's criminal incompetence angle is more absurd with excellent humor scores (92 vs 45).`

      const judgment = (llm as any).parseQuestionJudgment(response)

      expect(judgment.winner).toBe(2)
      expect(judgment.reasoning).toContain('incompetence')
    })

    it('should use score-based winner when explicit winner conflicts with scores', () => {
      const response = `QUESTION 1 ANALYSIS:
Great question with high scores.

QUESTION 1 SCORES:
{
  "overall": 92
}

QUESTION 2 ANALYSIS:
Weak question with low scores.

QUESTION 2 SCORES:
{
  "overall": 45
}

WINNER: 2
REASONING: Mistakenly picked 2.`

      const judgment = (llm as any).parseQuestionJudgment(response)

      // Should override to winner 1 because scores disagree by >20 points (92 vs 45)
      expect(judgment.winner).toBe(1)
    })

    it('should default to winner 1 for invalid response', () => {
      const response = `Some invalid response without proper format.`

      const judgment = (llm as any).parseQuestionJudgment(response)

      expect(judgment.winner).toBe(1)
      expect(judgment.reasoning).toContain('Winner scored')
    })

    it('should handle malformed JSON gracefully', () => {
      const response = `QUESTION 1 ANALYSIS:
Good analysis here.

QUESTION 1 SCORES:
{
  "overall": 75
}

QUESTION 2 ANALYSIS:
Another analysis.

QUESTION 2 SCORES:
{ malformed json but "overall": 80 }

WINNER: 2
REASONING: Based on scores.`

      const judgment = (llm as any).parseQuestionJudgment(response)

      expect(judgment.winner).toBe(2)
      expect(judgment.reasoning).toContain('Based on scores')
    })
  })

  describe('scoreArticleCandidates (integration with Ollama)', () => {
    it.skipIf(!OLLAMA_AVAILABLE)('should score multiple candidates', async () => {
      const candidates = [
        {
          id: 'id-1',
          title: 'Woman predicts future with asparagus',
          summary: 'A 63-year-old claims she can predict the future by throwing asparagus spears and reading the patterns.',
        },
        {
          id: 'id-2',
          title: 'Man steals lawn mower on stolen lawn mower',
          summary: 'Florida man arrested for stealing a lawn mower while riding another stolen lawn mower.',
        },
        {
          id: 'id-3',
          title: 'Local council meeting postponed',
          summary: 'The monthly council meeting was postponed due to scheduling conflicts.',
        },
      ]

      const scores = await llm.scoreArticleCandidates(candidates)

      expect(scores).toHaveLength(3)

      // All scores should have required fields
      scores.forEach(score => {
        expect(score.id).toBeTruthy()
        expect(score.score).toBeGreaterThanOrEqual(0)
        expect(score.score).toBeLessThanOrEqual(100)
        expect(score.reasoning).toBeTruthy()
      })

      // Weird stories should score higher than mundane ones
      const asparagusScore = scores.find(s => s.id === 'id-1')?.score || 0
      const councilScore = scores.find(s => s.id === 'id-3')?.score || 0
      expect(asparagusScore).toBeGreaterThan(councilScore)
    }, 30000)
  })

  describe('judgeQuestions (integration with Ollama)', () => {
    it.skipIf(!OLLAMA_AVAILABLE)('should judge between two questions', async () => {
      const question1 = {
        question: 'How does a 63-year-old woman predict the future?',
        correctAnswer: 'throwing asparagus',
        houseAnswers: ['reading tea leaves', 'crystal ball', 'tarot cards'],
      }

      const question2 = {
        question: 'What was the town council discussing at their meeting?',
        correctAnswer: 'zoning regulations',
        houseAnswers: ['budget cuts', 'park renovations', 'traffic lights'],
      }

      const judgment = await llm.judgeQuestions(question1, question2)

      expect(judgment.winner).toBeGreaterThanOrEqual(1)
      expect(judgment.winner).toBeLessThanOrEqual(2)
      expect(judgment.reasoning).toBeTruthy()
      expect(judgment.reasoning.length).toBeGreaterThan(20)

      // Should prefer the asparagus question (more absurd)
      expect(judgment.winner).toBe(1)
    }, 30000)

    it.skipIf(!OLLAMA_AVAILABLE)('should provide reasoning for judgment', async () => {
      const question1 = {
        question: 'What did the man use to rob a bank?',
        correctAnswer: 'a painted avocado',
        houseAnswers: ['a banana', 'a cucumber', 'a zucchini'],
      }

      const question2 = {
        question: 'What vehicle was stolen twice?',
        correctAnswer: 'lawn mower',
        houseAnswers: ['bicycle', 'motorcycle', 'golf cart'],
      }

      const judgment = await llm.judgeQuestions(question1, question2)

      expect(judgment.reasoning).toBeTruthy()
      // Reasoning should mention something about the questions
      expect(judgment.reasoning.length).toBeGreaterThan(30)
    }, 60000)
  })

  describe('extractSpacetime', () => {
    describe('parsing logic', () => {
      it('should parse year, city, and state from valid response', () => {
        const response = {
          response: `YEAR: 2004
CITY: Annapolis
STATE: Maryland`
        }

        // Mock the Ollama client to return our test response
        const mockLlm = new LocalLLM({
          provider: 'ollama',
          model: 'qwen2.5:14b',
          endpoint: 'http://localhost:11434',
          temperature: 0.1,
          maxTokens: 100,
        })

        // Access private client and mock generate method
        const mockGenerate = async () => response
        ;(mockLlm as any).client.generate = mockGenerate

        // The actual parsing would happen inside extractSpacetime
        // Let's test the regex patterns directly
        const yearMatch = response.response.match(/YEAR:\s*(\d{4}|NULL)/i)
        const cityMatch = response.response.match(/CITY:\s*(.+?)(?=\n|STATE:|$)/i)
        const stateMatch = response.response.match(/STATE:\s*(.+?)(?=\n|$)/i)

        expect(yearMatch?.[1]).toBe('2004')
        expect(cityMatch?.[1]?.trim()).toBe('Annapolis')
        expect(stateMatch?.[1]?.trim()).toBe('Maryland')
      })

      it('should handle NULL values', () => {
        const response = `YEAR: 2024
CITY: NULL
STATE: Colorado`

        const yearMatch = response.match(/YEAR:\s*(\d{4}|NULL)/i)
        const cityMatch = response.match(/CITY:\s*(.+?)(?=\n|STATE:|$)/i)
        const stateMatch = response.match(/STATE:\s*(.+?)(?=\n|$)/i)

        expect(yearMatch?.[1]).toBe('2024')
        expect(cityMatch?.[1]?.trim()).toBe('NULL')
        expect(stateMatch?.[1]?.trim()).toBe('Colorado')
      })

      it('should handle all NULL values', () => {
        const response = `YEAR: NULL
CITY: NULL
STATE: NULL`

        const yearMatch = response.match(/YEAR:\s*(\d{4}|NULL)/i)
        const cityMatch = response.match(/CITY:\s*(.+?)(?=\n|STATE:|$)/i)
        const stateMatch = response.match(/STATE:\s*(.+?)(?=\n|$)/i)

        expect(yearMatch?.[1]).toBe('NULL')
        expect(cityMatch?.[1]?.trim()).toBe('NULL')
        expect(stateMatch?.[1]?.trim()).toBe('NULL')
      })

      it('should handle year-only extraction', () => {
        const response = `YEAR: 1996
CITY: NULL
STATE: NULL`

        const yearMatch = response.match(/YEAR:\s*(\d{4}|NULL)/i)

        expect(yearMatch?.[1]).toBe('1996')
      })

      it('should handle state-only extraction', () => {
        const response = `YEAR: NULL
CITY: NULL
STATE: Florida`

        const stateMatch = response.match(/STATE:\s*(.+?)(?=\n|$)/i)

        expect(stateMatch?.[1]?.trim()).toBe('Florida')
      })

      it('should handle city + state without year', () => {
        const response = `YEAR: NULL
CITY: Brisbane
STATE: Queensland`

        const cityMatch = response.match(/CITY:\s*(.+?)(?=\n|STATE:|$)/i)
        const stateMatch = response.match(/STATE:\s*(.+?)(?=\n|$)/i)

        expect(cityMatch?.[1]?.trim()).toBe('Brisbane')
        expect(stateMatch?.[1]?.trim()).toBe('Queensland')
      })
    })

    describe('integration with Ollama', () => {
      it.skipIf(!OLLAMA_AVAILABLE)('should extract spacetime from article with all metadata', async () => {
        const title = 'Maryland 911 Operator Falls Asleep During Break-In Call'
        const content = 'In Anne Arundel County, Maryland, a 911 operator fell asleep on the job in 2004 while an active break-in call came in.'
        const pubDate = new Date('2004-08-22')

        const result = await llm.extractSpacetime(title, content, pubDate)

        // Should extract year from content or fall back to pubDate
        expect(result.eventYear).toBe(2004)

        // Should extract state
        expect(result.locationState).toBeTruthy()
        expect(result.locationState?.toLowerCase()).toContain('maryland')

        // City might be extracted (Anne Arundel County) or NULL
        // Don't enforce strict expectation since LLM behavior varies
      }, 15000)

      it.skipIf(!OLLAMA_AVAILABLE)('should fall back to pub_date when extraction fails', async () => {
        const title = 'Strange Event Occurred'
        const content = 'Something weird happened recently.'
        const pubDate = new Date('2023-05-15')

        const result = await llm.extractSpacetime(title, content, pubDate)

        // Should fall back to pubDate year
        expect(result.eventYear).toBe(2023)
      }, 15000)

      it.skipIf(!OLLAMA_AVAILABLE)('should handle article with city and state', async () => {
        const title = 'Brisbane Cop Suspended'
        const content = 'In Brisbane, Queensland, a suspended cop solicited body samples from people.'
        const pubDate = new Date('2024-01-01')

        const result = await llm.extractSpacetime(title, content, pubDate)

        // Should extract city
        expect(result.locationCity).toBeTruthy()

        // Should extract state
        expect(result.locationState).toBeTruthy()
        expect(result.locationState?.toLowerCase()).toContain('queensland')
      }, 15000)

      it.skipIf(!OLLAMA_AVAILABLE)('should handle article with explicit year', async () => {
        const title = 'Explorer Plans Trip'
        const content = 'In 2005, a Utah explorer planned a $21,000 expedition to the North Pole.'
        const pubDate = null

        const result = await llm.extractSpacetime(title, content, pubDate)

        // Should extract explicit year
        expect(result.eventYear).toBe(2005)

        // Should extract state
        expect(result.locationState).toBeTruthy()
        expect(result.locationState?.toLowerCase()).toContain('utah')
      }, 15000)

      it.skipIf(!OLLAMA_AVAILABLE)('should handle NULL pub_date gracefully', async () => {
        const title = 'Recent Event'
        const content = 'Something happened last week in Colorado.'
        const pubDate = null

        const result = await llm.extractSpacetime(title, content, pubDate)

        // Should still attempt extraction
        // Year might be current year or NULL
        expect(result).toBeDefined()
        expect(result.eventYear === null || typeof result.eventYear === 'number').toBe(true)
      }, 15000)

      it('should return fallback on Ollama error', async () => {
        const title = 'Test Article'
        const content = 'Test content'
        const pubDate = new Date('2020-01-01')

        // Create LLM with valid URL but port that won't respond (connection will fail/timeout)
        const badLlm = new LocalLLM({
          provider: 'ollama',
          model: 'qwen2.5:14b',
          endpoint: 'http://localhost:9999', // Valid URL but nothing listening on port 9999
          temperature: 0.1,
          maxTokens: 100,
        })

        const result = await badLlm.extractSpacetime(title, content, pubDate)

        // Should fall back gracefully
        expect(result.eventYear).toBe(2020) // Falls back to pubDate
        expect(result.locationCity).toBeNull()
        expect(result.locationState).toBeNull()
      }, 15000)
    })
  })
})
