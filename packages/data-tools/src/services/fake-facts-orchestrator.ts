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

      // Step 2: Summarize with Ollama
      const summary = await this.ollama.summarize(article.title, contentText)
      this.stats.ollamaInferences++

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

      // Step 7: Store in database
      const question: FakeFactsQuestionInsert = {
        articleId: article.id!,
        questionText: questionResult.question,
        blankText: questionResult.blank,
        postscript: questionResult.postscript,
        generatorModel: 'claude-3-5-haiku-20241022',
        generationCost: 0.003, // Approximate, could be calculated from tokens
      }

      const questionId = await this.db.insertQuestion(question)
      this.stats.totalCost += 0.003

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
          generatorModel: 'claude-3-5-haiku-20241022',
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
   * Process a batch of articles
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

    // Get unprocessed articles
    const articles = await this.db.getUnprocessedArticles(batchSize)

    if (articles.length === 0) {
      return this.stats
    }

    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]!

      if (verbose) {
        const progress = `[${i + 1}/${articles.length}]`
        const title = article.title.substring(0, 80)
        console.log(`\n${progress} Processing: "${title}"...`)
      }

      const result = await this.processArticle(article)

      // Track detailed results
      if (result.error) {
        this.stats.errorDetails.push({
          articleId: result.articleId,
          title: article.title,
          error: result.error,
        })
      } else if (result.rejectionReason) {
        this.stats.rejectionReasons.push({
          articleId: result.articleId,
          title: article.title,
          reason: result.rejectionReason,
        })
      }

      if (verbose) {
        if (result.questionGenerated) {
          console.log(`  ✓ Question generated successfully`)
        } else if (result.rejectionReason) {
          console.log(`  ⊘ Rejected: ${result.rejectionReason}`)
        } else if (result.error) {
          console.log(`  ✗ Error: ${result.error}`)
        }
      }
    }

    return this.stats
  }

  /**
   * Get current processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats }
  }
}
