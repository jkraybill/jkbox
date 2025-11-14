/**
 * Fake Facts types for trivia question generation
 */

export interface FakeFactsQuestion {
  id: string
  articleId: string

  // Question content
  questionText: string // e.g., "In California, _____ are legally classified as fish."
  blankText: string // e.g., "bees"
  postscript: string | null // e.g., "Bees were classified as fish to protect them under the Endangered Species Act."

  // Generation metadata
  generatedAt: Date
  generatorModel: string // e.g., "claude-3-5-haiku-20241022"
  generationCost: number | null // Cost in USD

  // Quality/usage tracking
  timesUsed: number
  timesCorrect: number
  difficultyScore: number | null // 0.0-1.0

  // Flags
  isActive: boolean
  isReviewed: boolean

  createdAt: Date
  updatedAt: Date
}

export interface FakeFactsQuestionInsert {
  articleId: string
  questionText: string
  blankText: string
  postscript?: string | null
  generatorModel: string
  generationCost?: number | null
}

export interface FakeFactsAnswer {
  id: string
  questionId: string

  // Answer content
  answerText: string

  // Type
  isReal: boolean // true = correct answer, false = house answer

  // For house answers
  answerOrder: number | null // 1-5 for house answers, null for real answer

  // Generation metadata
  generatedAt: Date
  generatorModel: string | null

  // Usage tracking
  timesSelected: number

  createdAt: Date
}

export interface FakeFactsAnswerInsert {
  questionId: string
  answerText: string
  isReal: boolean
  answerOrder?: number | null
  generatorModel?: string | null
}

/**
 * Complete question with answers for gameplay
 */
export interface FakeFactsGameQuestion {
  question: FakeFactsQuestion
  realAnswer: FakeFactsAnswer
  houseAnswers: FakeFactsAnswer[]
}

/**
 * Article candidate evaluation result
 */
export interface CandidateEvaluation {
  isGoodCandidate: boolean
  confidence: number // 0-100
  reason: string
}

/**
 * Question generation result from Claude
 */
export interface QuestionGenerationResult {
  question: string
  realAnswer: string
  blank: string
  postscript: string
}

/**
 * House answers generation result from Claude
 */
export interface HouseAnswersResult {
  houseAnswers: string[]
}
