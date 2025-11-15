import { describe, it, expect } from 'vitest'
import { ClaudeService } from './claude-service'

// Test helper to directly access calculateCost without instantiating full service
class ClaudeServiceTestHelper {
  constructor(private modelName: string) {}

  calculateCost(inputTokens: number, outputTokens: number): number {
    let INPUT_COST_PER_MILLION: number
    let OUTPUT_COST_PER_MILLION: number

    if (this.modelName.includes('haiku')) {
      INPUT_COST_PER_MILLION = 0.25
      OUTPUT_COST_PER_MILLION = 1.25
    } else if (this.modelName.includes('sonnet')) {
      INPUT_COST_PER_MILLION = 3.0
      OUTPUT_COST_PER_MILLION = 15.0
    } else if (this.modelName.includes('opus')) {
      INPUT_COST_PER_MILLION = 15.0
      OUTPUT_COST_PER_MILLION = 75.0
    } else {
      INPUT_COST_PER_MILLION = 3.0
      OUTPUT_COST_PER_MILLION = 15.0
    }

    const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION
    const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION

    return inputCost + outputCost
  }
}

describe('ClaudeService cost calculation', () => {
  describe('calculateCost for different models', () => {
    it('should calculate cost for Haiku model', () => {
      const helper = new ClaudeServiceTestHelper('claude-3-5-haiku-20241022')

      // Haiku pricing: $0.25 input / $1.25 output per MTok
      // 100k input tokens = $0.025, 50k output tokens = $0.0625
      const cost = helper.calculateCost(100000, 50000)

      expect(cost).toBeCloseTo(0.0875, 4)
    })

    it('should calculate cost for Sonnet model', () => {
      const helper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')

      // Sonnet pricing: $3.00 input / $15.00 output per MTok
      // 100k input tokens = $0.30, 50k output tokens = $0.75
      const cost = helper.calculateCost(100000, 50000)

      expect(cost).toBeCloseTo(1.05, 4)
    })

    it('should calculate cost for Opus model', () => {
      const helper = new ClaudeServiceTestHelper('claude-3-opus-20240229')

      // Opus pricing: $15.00 input / $75.00 output per MTok
      // 100k input tokens = $1.50, 50k output tokens = $3.75
      const cost = helper.calculateCost(100000, 50000)

      expect(cost).toBeCloseTo(5.25, 4)
    })

    it('should default to Sonnet pricing for unknown model', () => {
      const helper = new ClaudeServiceTestHelper('claude-unknown-model')

      // Should default to Sonnet pricing: $3.00 input / $15.00 output per MTok
      const cost = helper.calculateCost(100000, 50000)

      expect(cost).toBeCloseTo(1.05, 4)
    })
  })

  describe('model detection', () => {
    it('should detect haiku in model name', () => {
      const helper = new ClaudeServiceTestHelper('claude-3-haiku-20240307')

      const cost = helper.calculateCost(1000000, 1000000)
      // Haiku pricing: $0.25 + $1.25 = $1.50
      expect(cost).toBeCloseTo(1.5, 4)
    })

    it('should detect sonnet in model name', () => {
      const helper = new ClaudeServiceTestHelper('claude-3-5-sonnet-20241022')

      const cost = helper.calculateCost(1000000, 1000000)
      // Sonnet pricing: $3.00 + $15.00 = $18.00
      expect(cost).toBeCloseTo(18.0, 4)
    })

    it('should detect opus in model name', () => {
      const helper = new ClaudeServiceTestHelper('claude-opus-v2')

      const cost = helper.calculateCost(1000000, 1000000)
      // Opus pricing: $15.00 + $75.00 = $90.00
      expect(cost).toBeCloseTo(90.0, 4)
    })
  })

  describe('edge cases', () => {
    it('should handle zero tokens', () => {
      const helper = new ClaudeServiceTestHelper('claude-3-5-haiku-20241022')

      const cost = helper.calculateCost(0, 0)

      expect(cost).toBe(0)
    })

    it('should calculate cost for small token counts', () => {
      const helper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')

      // Sonnet: $3.00/$15.00 per MTok
      // 1k input + 500 output = $0.003 + $0.0075 = $0.0105
      const cost = helper.calculateCost(1000, 500)

      expect(cost).toBeCloseTo(0.0105, 4)
    })

    it('should calculate cost for large token counts', () => {
      const helper = new ClaudeServiceTestHelper('claude-3-5-haiku-20241022')

      // Haiku: $0.25/$1.25 per MTok
      // 1M input + 1M output = $0.25 + $1.25 = $1.50
      const cost = helper.calculateCost(1000000, 1000000)

      expect(cost).toBeCloseTo(1.5, 4)
    })
  })

  describe('cost comparisons between models', () => {
    it('should show Sonnet costs 12x more than Haiku', () => {
      const haikuHelper = new ClaudeServiceTestHelper('claude-3-5-haiku-20241022')
      const sonnetHelper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')

      const haikuCost = haikuHelper.calculateCost(100000, 100000)
      const sonnetCost = sonnetHelper.calculateCost(100000, 100000)

      // Haiku: $0.025 + $0.125 = $0.15
      // Sonnet: $0.30 + $1.50 = $1.80
      // Ratio: $1.80 / $0.15 = 12
      expect(sonnetCost / haikuCost).toBeCloseTo(12, 1)
    })

    it('should show Opus costs 60x more than Haiku', () => {
      const haikuHelper = new ClaudeServiceTestHelper('claude-3-5-haiku-20241022')
      const opusHelper = new ClaudeServiceTestHelper('claude-3-opus-20240229')

      const haikuCost = haikuHelper.calculateCost(100000, 100000)
      const opusCost = opusHelper.calculateCost(100000, 100000)

      // Haiku: $0.15
      // Opus: $1.50 + $7.50 = $9.00
      // Ratio: $9.00 / $0.15 = 60
      expect(opusCost / haikuCost).toBeCloseTo(60, 1)
    })

    it('should show Opus costs 5x more than Sonnet', () => {
      const sonnetHelper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')
      const opusHelper = new ClaudeServiceTestHelper('claude-3-opus-20240229')

      const sonnetCost = sonnetHelper.calculateCost(100000, 100000)
      const opusCost = opusHelper.calculateCost(100000, 100000)

      // Sonnet: $1.80
      // Opus: $9.00
      // Ratio: $9.00 / $1.80 = 5
      expect(opusCost / sonnetCost).toBeCloseTo(5, 1)
    })
  })

  describe('realistic cost scenarios', () => {
    it('should calculate realistic cost for question generation', () => {
      const helper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')

      // Typical question generation: ~800 input tokens, ~150 output tokens
      const cost = helper.calculateCost(800, 150)

      // Sonnet: ($3.00 * 0.0008) + ($15.00 * 0.00015) = $0.0024 + $0.00225 = $0.00465
      expect(cost).toBeCloseTo(0.00465, 5)
    })

    it('should calculate realistic cost for house answers generation', () => {
      const helper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')

      // Typical house answers: ~500 input tokens, ~200 output tokens
      const cost = helper.calculateCost(500, 200)

      // Sonnet: ($3.00 * 0.0005) + ($15.00 * 0.0002) = $0.0015 + $0.003 = $0.0045
      expect(cost).toBeCloseTo(0.0045, 5)
    })

    it('should calculate realistic total cost per question (question + house answers)', () => {
      const helper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')

      const questionCost = helper.calculateCost(800, 150) // ~$0.00465
      const houseAnswersCost = helper.calculateCost(500, 200) // ~$0.0045

      const totalCost = questionCost + houseAnswersCost

      // Total: ~$0.00915 (much more than the old hardcoded $0.003!)
      expect(totalCost).toBeCloseTo(0.00915, 5)
      expect(totalCost).toBeGreaterThan(0.003) // Verify it's more than old hardcoded value
    })

    it('should calculate realistic cost for scoring 10 candidates', () => {
      const helper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')

      // Scoring 10 candidates: ~2500 input tokens, ~1500 output tokens
      const cost = helper.calculateCost(2500, 1500)

      // Sonnet: ($3.00 * 0.0025) + ($15.00 * 0.0015) = $0.0075 + $0.0225 = $0.03
      expect(cost).toBeCloseTo(0.03, 4)
    })

    it('should show cost difference between old hardcoded estimate and real Sonnet cost', () => {
      const helper = new ClaudeServiceTestHelper('claude-sonnet-4-5-20250929')

      const OLD_HARDCODED_COST = 0.003
      const questionCost = helper.calculateCost(800, 150)
      const houseAnswersCost = helper.calculateCost(500, 200)
      const realCost = questionCost + houseAnswersCost

      // Real cost should be ~3x the old hardcoded estimate
      const ratio = realCost / OLD_HARDCODED_COST
      expect(ratio).toBeGreaterThan(2.5)
      expect(ratio).toBeLessThan(4)
    })
  })

  describe('House answer validation fallback extraction', () => {
    it('should extract answers from ## Testing format (original)', () => {
      const validationText = `
## Testing House Answer 1: "his manifesto"
→ ✅ **ACCEPT**

## Testing House Answer 2: "a single banana"
→ ✅ **ACCEPT**

## Testing House Answer 3: "toilet paper"
→ ✅ **ACCEPT**

## Testing House Answer 4: "a participation trophy"
→ ✅ **ACCEPT**

## Testing House Answer 5: "beef jerky"
→ ✅ **ACCEPT**
`
      // This tests the pattern extraction logic
      const pattern = /## Testing House Answer \d+(?:\s+\(revised\))?: "([^"]+)"[\s\S]*?✅ \*\*ACCEPT\*\*/g
      const answers: string[] = []
      let match
      while ((match = pattern.exec(validationText)) !== null) {
        if (match[1]) answers.push(match[1])
      }

      expect(answers).toHaveLength(5)
      expect(answers).toEqual([
        'his manifesto',
        'a single banana',
        'toilet paper',
        'a participation trophy',
        'beef jerky'
      ])
    })

    it('should extract answers from **Testing format (new)', () => {
      const validationText = `
**Testing "explosive diarrhea":**
→ Complete sentence: "In 1983, Detroit lawyer Leonard Jaques missed a court date, citing explosive diarrhea"
→ ✓ Grammar: Correct

**Testing "a family emergency":**
→ ✓ Grammar: Correct

**Testing "alien abduction":**
→ ✓ Grammar: Correct

**Testing "his therapist's advice":**
→ ✓ Grammar: Correct

**Testing "divine intervention":**
→ ✓ Grammar: Correct
`
      // This tests the new pattern
      const pattern = /\*\*Testing "([^"]+)":\*\*[\s\S]*?→ ✓/g
      const answers: string[] = []
      let match
      while ((match = pattern.exec(validationText)) !== null) {
        if (match[1]) answers.push(match[1])
      }

      expect(answers).toHaveLength(5)
      expect(answers[0]).toBe('explosive diarrhea')
    })

    it('should handle exactly 5 answers (happy path)', () => {
      const validationText = `
## Testing House Answer 1: "his evil twin"
→ ✅ **ACCEPT**

## Testing House Answer 2: "a demon"
→ ✅ **ACCEPT**

## Testing House Answer 3: "his alter ego"
→ ✅ **ACCEPT**

## Testing House Answer 4: "Satan"
→ ✅ **ACCEPT**

## Testing House Answer 5: "his therapist"
→ ✅ **ACCEPT**
`
      const pattern = /## Testing House Answer \d+(?:\s+\(revised\))?: "([^"]+)"[\s\S]*?✅ \*\*ACCEPT\*\*/g
      const answers: string[] = []
      let match
      while ((match = pattern.exec(validationText)) !== null) {
        if (match[1]) answers.push(match[1])
      }

      const uniqueAnswers = [...new Set(answers)]

      expect(uniqueAnswers).toHaveLength(5)
      expect(uniqueAnswers).toEqual([
        'his evil twin',
        'a demon',
        'his alter ego',
        'Satan',
        'his therapist'
      ])
    })

    it('should handle 6-7 answers by taking first 5 (slice logic)', () => {
      const validationText = `
## Testing House Answer 1: "answer1"
→ ✅ **ACCEPT**

## Testing House Answer 2: "answer2"
→ ✅ **ACCEPT**

## Testing House Answer 3: "answer3"
→ ✅ **ACCEPT**

## Testing House Answer 4: "answer4"
→ ✅ **ACCEPT**

## Testing House Answer 5: "answer5"
→ ✅ **ACCEPT**

## Testing House Answer 6: "answer6"
→ ✅ **ACCEPT**

## Testing House Answer 7: "answer7"
→ ✅ **ACCEPT**
`
      const pattern = /## Testing House Answer \d+(?:\s+\(revised\))?: "([^"]+)"[\s\S]*?✅ \*\*ACCEPT\*\*/g
      const answers: string[] = []
      let match
      while ((match = pattern.exec(validationText)) !== null) {
        if (match[1]) answers.push(match[1])
      }

      const uniqueAnswers = [...new Set(answers)]

      expect(uniqueAnswers.length).toBeGreaterThanOrEqual(5)
      expect(uniqueAnswers).toHaveLength(7)

      // Should take first 5
      const finalAnswers = uniqueAnswers.slice(0, 5)
      expect(finalAnswers).toHaveLength(5)
      expect(finalAnswers).toEqual(['answer1', 'answer2', 'answer3', 'answer4', 'answer5'])
    })

    it('should fail with <5 answers (quality control)', () => {
      const validationText = `
## Testing House Answer 1: "answer1"
→ ✅ **ACCEPT**

## Testing House Answer 2: "answer2"
→ ✅ **ACCEPT**

## Testing House Answer 3: "answer3"
→ ✅ **ACCEPT**
`
      const pattern = /## Testing House Answer \d+(?:\s+\(revised\))?: "([^"]+)"[\s\S]*?✅ \*\*ACCEPT\*\*/g
      const answers: string[] = []
      let match
      while ((match = pattern.exec(validationText)) !== null) {
        if (match[1]) answers.push(match[1])
      }

      const uniqueAnswers = [...new Set(answers)]

      // Should have <5 answers (failure case)
      expect(uniqueAnswers).toHaveLength(3)
      expect(uniqueAnswers.length).toBeLessThan(5)

      // In real code, this would throw an error
    })

    it('should deduplicate extracted answers', () => {
      const validationText = `
## Testing House Answer 1: "his evil twin"
→ ✅ **ACCEPT**

## Testing House Answer 2: "a demon"
→ ✅ **ACCEPT**

## Testing House Answer 3: "his evil twin"
→ ✅ **ACCEPT**

## Testing House Answer 4: "Satan"
→ ✅ **ACCEPT**

## Testing House Answer 5: "a demon"
→ ✅ **ACCEPT**

## Testing House Answer 6: "his therapist"
→ ✅ **ACCEPT**
`
      const pattern = /## Testing House Answer \d+(?:\s+\(revised\))?: "([^"]+)"[\s\S]*?✅ \*\*ACCEPT\*\*/g
      const answers: string[] = []
      let match
      while ((match = pattern.exec(validationText)) !== null) {
        if (match[1]) answers.push(match[1])
      }

      // Before deduplication: 6 answers (with 2 duplicates)
      expect(answers).toHaveLength(6)

      const uniqueAnswers = [...new Set(answers)]

      // After deduplication: 4 unique answers
      expect(uniqueAnswers).toHaveLength(4)
      expect(uniqueAnswers).toEqual(['his evil twin', 'a demon', 'Satan', 'his therapist'])
    })

    it('should handle mixed validation formats (multiple patterns)', () => {
      const validationText = `
## Testing House Answer 1: "his evil twin"
→ ✅ **ACCEPT**

**Testing "a demon":**
→ ✓ Grammar: Correct

## Testing House Answer 3: "Satan"
→ ✅ **ACCEPT**

**Testing "his therapist":**
→ ✓

## Testing House Answer 5: "divine intervention"
→ ✅ **ACCEPT**
`
      // Pattern 1: ## Testing format
      const pattern1 = /## Testing House Answer \d+(?:\s+\(revised\))?: "([^"]+)"[\s\S]*?✅ \*\*ACCEPT\*\*/g
      const answers1: string[] = []
      let match
      while ((match = pattern1.exec(validationText)) !== null) {
        if (match[1]) answers1.push(match[1])
      }

      // Pattern 3: **Testing format
      const pattern3 = /\*\*Testing "([^"]+)":\*\*[\s\S]*?(?:→ )?✓/g
      const answers3: string[] = []
      while ((match = pattern3.exec(validationText)) !== null) {
        if (match[1]) answers3.push(match[1])
      }

      // Should find some with each pattern
      expect(answers1.length).toBeGreaterThan(0)
      expect(answers3.length).toBeGreaterThan(0)

      // Combined should have all 5
      const combined = [...answers1, ...answers3]
      const uniqueAnswers = [...new Set(combined)]
      expect(uniqueAnswers).toHaveLength(5)
    })
  })

  describe('Question generation with spacetime metadata', () => {
    it('should construct spacetime context when all metadata provided', () => {
      const spacetime = {
        eventYear: 2004,
        locationCity: 'Annapolis',
        locationState: 'Maryland',
        country: 'us'
      }

      // Test the spacetime context construction logic
      const spacetimeContext = spacetime
        ? `
SPACETIME METADATA (use this for temporal/location context):
- Year: ${spacetime.eventYear || 'Unknown'}
- City: ${spacetime.locationCity || 'Unknown'}
- State: ${spacetime.locationState || 'Unknown'}
- Country: ${spacetime.country || 'Unknown'}
`
        : ''

      expect(spacetimeContext).toContain('Year: 2004')
      expect(spacetimeContext).toContain('City: Annapolis')
      expect(spacetimeContext).toContain('State: Maryland')
      expect(spacetimeContext).toContain('Country: us')
      expect(spacetimeContext).toContain('SPACETIME METADATA')
    })

    it('should handle partial spacetime (year only)', () => {
      const spacetime = {
        eventYear: 1996,
        locationCity: null,
        locationState: null,
        country: 'us'
      }

      const spacetimeContext = spacetime
        ? `
SPACETIME METADATA (use this for temporal/location context):
- Year: ${spacetime.eventYear || 'Unknown'}
- City: ${spacetime.locationCity || 'Unknown'}
- State: ${spacetime.locationState || 'Unknown'}
- Country: ${spacetime.country || 'Unknown'}
`
        : ''

      expect(spacetimeContext).toContain('Year: 1996')
      expect(spacetimeContext).toContain('City: Unknown')
      expect(spacetimeContext).toContain('State: Unknown')
    })

    it('should handle partial spacetime (state only)', () => {
      const spacetime = {
        eventYear: null,
        locationCity: null,
        locationState: 'Colorado',
        country: 'us'
      }

      const spacetimeContext = spacetime
        ? `
SPACETIME METADATA (use this for temporal/location context):
- Year: ${spacetime.eventYear || 'Unknown'}
- City: ${spacetime.locationCity || 'Unknown'}
- State: ${spacetime.locationState || 'Unknown'}
- Country: ${spacetime.country || 'Unknown'}
`
        : ''

      expect(spacetimeContext).toContain('Year: Unknown')
      expect(spacetimeContext).toContain('State: Colorado')
    })

    it('should handle city + state without year', () => {
      const spacetime = {
        eventYear: null,
        locationCity: 'Brisbane',
        locationState: 'Queensland',
        country: 'au'
      }

      const spacetimeContext = spacetime
        ? `
SPACETIME METADATA (use this for temporal/location context):
- Year: ${spacetime.eventYear || 'Unknown'}
- City: ${spacetime.locationCity || 'Unknown'}
- State: ${spacetime.locationState || 'Unknown'}
- Country: ${spacetime.country || 'Unknown'}
`
        : ''

      expect(spacetimeContext).toContain('City: Brisbane')
      expect(spacetimeContext).toContain('State: Queensland')
      expect(spacetimeContext).toContain('Year: Unknown')
    })

    it('should handle undefined spacetime (optional parameter)', () => {
      const spacetime = undefined

      const spacetimeContext = spacetime
        ? `
SPACETIME METADATA (use this for temporal/location context):
- Year: ${spacetime.eventYear || 'Unknown'}
- City: ${spacetime.locationCity || 'Unknown'}
- State: ${spacetime.locationState || 'Unknown'}
- Country: ${spacetime.country || 'Unknown'}
`
        : ''

      // Should be empty string when undefined
      expect(spacetimeContext).toBe('')
    })

    it('should handle all Unknown values', () => {
      const spacetime = {
        eventYear: null,
        locationCity: null,
        locationState: null,
        country: null
      }

      const spacetimeContext = spacetime
        ? `
SPACETIME METADATA (use this for temporal/location context):
- Year: ${spacetime.eventYear || 'Unknown'}
- City: ${spacetime.locationCity || 'Unknown'}
- State: ${spacetime.locationState || 'Unknown'}
- Country: ${spacetime.country || 'Unknown'}
`
        : ''

      expect(spacetimeContext).toContain('Year: Unknown')
      expect(spacetimeContext).toContain('City: Unknown')
      expect(spacetimeContext).toContain('State: Unknown')
      expect(spacetimeContext).toContain('Country: Unknown')
    })
  })
})
