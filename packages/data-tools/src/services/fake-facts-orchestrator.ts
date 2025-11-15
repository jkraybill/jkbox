import { Pool } from 'pg'
import { DatabaseQueries } from '../storage/db/queries'
import { ArticleFetcher } from '../scrapers/article-fetcher'
import { LocalLLM } from '../llm/local-llm'
import { ClaudeService } from '../llm/claude-service'
import type { Article } from '../types/article'
import type { FakeFactsQuestionInsert, FakeFactsAnswerInsert } from '../types/fake-facts'

export interface ProcessingStats {
  articlesProcessed: number
  questionsGenerated: number
  candidatesRejected: number
  errors: number
  totalCost: number
  ollamaInferences: number
  errorDetails: Array<{ articleId: string; title: string; error: string }>
  rejectionReasons: Array<{ articleId: string; title: string; reason: string }>
}

export interface ProcessingResult {
  success: boolean
  articleId: string
  questionGenerated: boolean
  rejectionReason?: string
  error?: string
}

export class FakeFactsOrchestrator {
  private db: DatabaseQueries
  private articleFetcher: ArticleFetcher
  private ollama: LocalLLM
  private claude: ClaudeService
  private stats: ProcessingStats

  constructor(
    pool: Pool,
    ollama: LocalLLM,
    claude: ClaudeService,
    rateLimitPerSecond: number = 1
  ) {
    this.db = new DatabaseQueries(pool)
    this.articleFetcher = new ArticleFetcher(rateLimitPerSecond)
    this.ollama = ollama
    this.claude = claude
    this.stats = {
      articlesProcessed: 0,
      questionsGenerated: 0,
      candidatesRejected: 0,
      errors: 0,
      totalCost: 0,
      ollamaInferences: 0,
      errorDetails: [],
      rejectionReasons: [],
    }
  }

  /**
   * Get sample real answers to show Claude the style
   */
  private async getSampleRealAnswers(limit: number = 5): Promise<string[]> {
    try {
      const result = await this.db['pool'].query(
        `SELECT DISTINCT blank_text
         FROM fake_facts_questions
         ORDER BY RANDOM()
         LIMIT $1`,
        [limit]
      )
      return result.rows.map(row => row.blank_text)
    } catch {
      // If no samples exist yet, return empty array
      return []
    }
  }

  /**
   * Process a single article through the entire pipeline
   */
  async processArticle(article: Article): Promise<ProcessingResult> {
    try {
      // Step 1: Get content (use existing if available, otherwise fetch)
      let contentText: string

      if (article.content && article.content.length > 100) {
        // Use existing content from database
        contentText = article.content
      } else {
        // Fetch content from URL
        if (!article.link) {
          return {
            success: false,
            articleId: article.id!,
            questionGenerated: false,
            error: 'No link or content available for article',
          }
        }

        const fetchedContent = await this.articleFetcher.fetchArticleContent(article.link)
        contentText = fetchedContent.mainText
      }

      // Step 2: Get or generate summary
      let summary: string
      if (article.articleSummary && article.articleSummary.length > 20) {
        // Use cached summary
        summary = article.articleSummary
      } else {
        // Generate and cache new summary
        summary = await this.ollama.summarize(article.title, contentText)
        this.stats.ollamaInferences++

        // Cache summary for future use
        await this.db.updateArticleSummary(article.id!, summary)
      }

      // Step 3: Evaluate candidate with Ollama
      const evaluation = await this.ollama.evaluateCandidate(article.title, summary)
      this.stats.ollamaInferences++

      if (!evaluation.isGoodCandidate || evaluation.confidence < 60) {
        // Not a good candidate, mark as processed and skip
        await this.db.markArticleAsProcessed(article.id!, false, evaluation.reason)
        this.stats.candidatesRejected++

        return {
          success: true,
          articleId: article.id!,
          questionGenerated: false,
          rejectionReason: evaluation.reason,
        }
      }

      // Step 4: Generate question with Claude
      const questionResult = await this.claude.generateQuestion(article.title, summary)

      // Step 5: Get sample real answers to show Claude the style
      const sampleAnswers = await this.getSampleRealAnswers(5)

      // Step 6: Generate house answers with Claude
      const houseAnswersResult = await this.claude.generateHouseAnswers(
        article.title,
        summary,
        questionResult.question,
        questionResult.realAnswer,
        sampleAnswers
      )

      // Calculate total cost from actual API usage
      const totalCost = questionResult.cost + houseAnswersResult.cost

      // Step 7: Store in database
      const question: FakeFactsQuestionInsert = {
        articleId: article.id!,
        questionText: questionResult.question,
        blankText: questionResult.blank,
        postscript: questionResult.postscript,
        generatorModel: this.claude.getModel(),
        generationCost: totalCost,
      }

      const questionId = await this.db.insertQuestion(question)
      this.stats.totalCost += totalCost

      // Insert real answer
      const realAnswer: FakeFactsAnswerInsert = {
        questionId,
        answerText: questionResult.realAnswer,
        isReal: true,
      }

      await this.db.insertAnswer(realAnswer)

      // Insert house answers
      const houseAnswers: FakeFactsAnswerInsert[] = houseAnswersResult.houseAnswers.map(
        (text, index) => ({
          questionId,
          answerText: text,
          isReal: false,
          answerOrder: index + 1,
          generatorModel: this.claude.getModel(),
        })
      )

      await this.db.insertAnswers(houseAnswers)

      // Step 8: Mark article as processed
      await this.db.markArticleAsProcessed(article.id!, true, null)

      this.stats.questionsGenerated++

      return {
        success: true,
        articleId: article.id!,
        questionGenerated: true,
      }
    } catch (error) {
      this.stats.errors++

      // Mark article as processed with error
      await this.db.markArticleAsProcessed(
        article.id!,
        false,
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )

      return {
        success: false,
        articleId: article.id!,
        questionGenerated: false,
        error: error instanceof Error ? error.message : String(error),
      }
    } finally {
      this.stats.articlesProcessed++
    }
  }

  /**
   * Process a batch using competitive pipeline:
   * 1. Get 10 candidates
   * 2. Score all 10 with Ollama
   * 3. Take top 2
   * 4. Generate questions for both
   * 5. Judge questions head-to-head
   * 6. Winner gets saved
   * 7. Update last_considered for all 10
   */
  async processBatch(batchSize: number = 10, verbose: boolean = true): Promise<ProcessingStats> {
    // Reset stats
    this.stats = {
      articlesProcessed: 0,
      questionsGenerated: 0,
      candidatesRejected: 0,
      errors: 0,
      totalCost: 0,
      ollamaInferences: 0,
      errorDetails: [],
      rejectionReasons: [],
    }

    // STEP 1: Get candidates - keep fetching until we have 10 usable ones
    if (verbose) console.log('\n🎯 Step 1: Fetching candidate articles...')

    const candidatesWithSummaries: Array<{ id: string; title: string; summary: string; article: Article }> = []
    const allCandidateIds: string[] = []
    let fetchAttempts = 0
    const maxFetchAttempts = 10

    while (candidatesWithSummaries.length < 10 && fetchAttempts < maxFetchAttempts) {
      fetchAttempts++

      // Fetch more candidates
      const candidates = await this.db.getUnprocessedArticles(10)

      if (candidates.length === 0) {
        if (verbose) console.log(`  ⚠️  No more unprocessed articles available`)
        break
      }

      if (verbose && fetchAttempts === 1) {
        console.log(`  Fetched ${candidates.length} initial candidates\n`)
      } else if (verbose) {
        console.log(`  Fetching ${candidates.length} more candidates (${candidatesWithSummaries.length}/10 usable so far)\n`)
      }

      for (const article of candidates) {
        allCandidateIds.push(article.id!)

        if (verbose) {
          console.log(`  📰 Processing: ${article.title}`)
        }

        try {
          // Get or generate summary
          let summary: string
          if (article.articleSummary && article.articleSummary.length > 20) {
            summary = article.articleSummary
            if (verbose) console.log(`     ✓ Using cached summary`)
          } else {
            // Get content first
            let contentText = article.content || ''
            if (!contentText && article.link) {
              if (verbose) console.log(`     → Fetching content from URL...`)
              const fetched = await this.articleFetcher.fetchArticleContent(article.link)
              contentText = fetched.mainText
            }

            if (!contentText || contentText.length < 50) {
              throw new Error(`Insufficient content for summarization (${contentText.length} chars): "${contentText}"`)
            }

            if (verbose) console.log(`     → Generating summary with Ollama...`)
            summary = await this.ollama.summarize(article.title, contentText)
            await this.db.updateArticleSummary(article.id!, summary)
            this.stats.ollamaInferences++
          }

          candidatesWithSummaries.push({
            id: article.id!,
            title: article.title,
            summary,
            article,
          })

          if (verbose) {
            console.log(`     ✓ Success! (${candidatesWithSummaries.length}/10 usable)\n`)
          }

          // Stop if we have 10 usable candidates
          if (candidatesWithSummaries.length >= 10) {
            break
          }
        } catch (error) {
          // Mark this article as processed with error and skip it
          const errorMsg = error instanceof Error ? error.message : String(error)
          if (verbose) {
            console.log(`     ✗ FAILED: ${errorMsg}`)
            console.log(`     → Marking as processed and skipping\n`)
          }

          await this.db.markArticleAsProcessed(
            article.id!,
            false,
            `Article preparation failed: ${errorMsg}`
          )

          this.stats.candidatesRejected++
          this.stats.rejectionReasons.push({
            articleId: article.id!,
            title: article.title,
            reason: `Preparation failed: ${errorMsg}`,
          })
        }
      }
    }

    if (verbose) {
      console.log(`  ✓ Found ${candidatesWithSummaries.length} usable candidates\n`)
    }

    // Check if we have enough candidates to proceed
    if (candidatesWithSummaries.length < 2) {
      if (verbose) {
        console.log(`⚠️  Insufficient candidates (${candidatesWithSummaries.length} usable)`)
        console.log(`   Need at least 2 candidates to run competitive pipeline`)
      }

      // Update last_considered for all candidates that were processed
      await this.db.updateLastConsidered(allCandidateIds)

      return this.stats
    }

    try {

      // STEP 2: Score all 10 with Ollama
      if (verbose) console.log('🏆 Step 2: Scoring candidates with Ollama...')
      const scores = await this.ollama.scoreArticleCandidates(candidatesWithSummaries)
      this.stats.ollamaInferences++

      if (verbose) {
        console.log('\n  Scores:')
        scores
          .sort((a, b) => b.score - a.score)
          .forEach((s, i) => {
            const candidate = candidatesWithSummaries.find(c => c.id === s.id)!
            console.log(`  ${i + 1}. [${s.score}] ${candidate.title}`)
            console.log(`     ${s.reasoning}\n`)
          })
      }

      // STEP 3: Take top 2 (sorted by score DESC, random for ties)
      const sortedScores = scores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return Math.random() - 0.5 // Random tie-breaker
      })

      const top2 = sortedScores.slice(0, 2)
      const finalists = top2.map(s => candidatesWithSummaries.find(c => c.id === s.id)!)

      if (verbose) {
        console.log(`\n🥇 Step 3: Top 2 finalists:`)
        finalists.forEach((f, i) => {
          console.log(`  ${i + 1}. ${f.title}`)
        })
        console.log()
      }

      // STEP 4: Generate questions for both finalists
      if (verbose) console.log('❓ Step 4: Generating questions for finalists...\n')

      const generatedQuestions: Array<{
        candidate: typeof finalists[0]
        question: string
        correctAnswer: string
        houseAnswers: string[]
        postscript: string
        blank: string
        cost: number
      }> = []

      for (let i = 0; i < finalists.length; i++) {
        const finalist = finalists[i]!

        if (verbose) console.log(`  Generating question ${i + 1}/2...`)

        const questionResult = await this.claude.generateQuestion(finalist.title, finalist.summary)
        const sampleAnswers = await this.getSampleRealAnswers(5)
        const houseAnswersResult = await this.claude.generateHouseAnswers(
          finalist.title,
          finalist.summary,
          questionResult.question,
          questionResult.realAnswer,
          sampleAnswers
        )

        const questionCost = questionResult.cost + houseAnswersResult.cost

        generatedQuestions.push({
          candidate: finalist,
          question: questionResult.question,
          correctAnswer: questionResult.realAnswer,
          houseAnswers: houseAnswersResult.houseAnswers,
          postscript: questionResult.postscript,
          blank: questionResult.blank,
          cost: questionCost,
        })

        if (verbose) {
          console.log(`    Q: ${questionResult.question}`)
          console.log(`    A: ${questionResult.realAnswer}`)
          console.log(`    House: ${houseAnswersResult.houseAnswers.join(', ')}\n`)
        }
      }

      // STEP 5: Shuffle and judge
      if (verbose) console.log('⚖️  Step 5: Judging questions head-to-head...\n')

      // Shuffle to avoid position bias
      const shuffled = generatedQuestions.sort(() => Math.random() - 0.5)

      const judgment = await this.ollama.judgeQuestions(
        {
          question: shuffled[0]!.question,
          correctAnswer: shuffled[0]!.correctAnswer,
          houseAnswers: shuffled[0]!.houseAnswers,
        },
        {
          question: shuffled[1]!.question,
          correctAnswer: shuffled[1]!.correctAnswer,
          houseAnswers: shuffled[1]!.houseAnswers,
        }
      )
      this.stats.ollamaInferences++

      const winnerIndex = judgment.winner - 1
      const winner = shuffled[winnerIndex]!

      if (verbose) {
        console.log(`  🏆 Winner: Question ${judgment.winner}`)
        console.log(`  Reasoning: ${judgment.reasoning}\n`)
      }

      // STEP 6: Save winner to database
      if (verbose) console.log('💾 Step 6: Saving winning question...\n')

      const question: FakeFactsQuestionInsert = {
        articleId: winner.candidate.id,
        questionText: winner.question,
        blankText: winner.blank,
        postscript: winner.postscript,
        generatorModel: this.claude.getModel(),
        generationCost: winner.cost,
      }

      const questionId = await this.db.insertQuestion(question)

      const realAnswer: FakeFactsAnswerInsert = {
        questionId,
        answerText: winner.correctAnswer,
        isReal: true,
      }

      await this.db.insertAnswer(realAnswer)

      const houseAnswers: FakeFactsAnswerInsert[] = winner.houseAnswers.map((text, index) => ({
        questionId,
        answerText: text,
        isReal: false,
        answerOrder: index + 1,
        generatorModel: this.claude.getModel(),
      }))

      await this.db.insertAnswers(houseAnswers)

      // Mark winner as processed
      await this.db.markArticleAsProcessed(winner.candidate.id, true, null)

      this.stats.questionsGenerated++
      this.stats.totalCost += winner.cost

      if (verbose) {
        console.log(`  ✓ Question saved!`)
        console.log(`  Article: ${winner.candidate.title}`)
        console.log(`  Question: ${winner.question}`)
        console.log(`  Answer: ${winner.correctAnswer}`)
        console.log(`  House Answers: ${winner.houseAnswers.join(', ')}`)
        console.log(`  Postscript: ${winner.postscript}`)
        console.log()
      }

      // STEP 7: Update last_considered for all candidates (including failed ones)
      if (verbose) console.log('📅 Step 7: Updating last_considered timestamps...\n')

      await this.db.updateLastConsidered(allCandidateIds)

      // Update stats with total articles processed
      this.stats.articlesProcessed = allCandidateIds.length

      if (verbose) {
        console.log(`  ✓ Updated ${allCandidateIds.length} articles\n`)
        console.log('🎉 Pipeline complete!')
      }

      return this.stats
    } catch (error) {
      this.stats.errors++
      this.stats.errorDetails.push({
        articleId: 'batch',
        title: 'Batch processing',
        error: error instanceof Error ? error.message : String(error),
      })

      if (verbose) {
        console.log(`\n❌ Error in pipeline: ${error instanceof Error ? error.message : String(error)}`)
        console.log('⚠️  last_considered timestamps NOT updated (will retry same articles next run)')
      }

      return this.stats
    }
  }

  /**
   * Get current processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats }
  }
}
