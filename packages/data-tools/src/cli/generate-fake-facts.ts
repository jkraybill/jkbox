#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { FakeFactsOrchestrator } from '../services/fake-facts-orchestrator'
import { LocalLLM } from '../llm/local-llm'
import { ClaudeService } from '../llm/claude-service'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'

const program = new Command()

program
  .name('generate-fake-facts')
  .description('Generate trivia questions from weird news articles')
  .option('--batch-size <n>', 'Number of articles to process per batch', '10')
  .option('--target-questions <n>', 'Keep running batches until N questions are generated')
  .option('--dry-run', 'Show what would be processed without saving', false)
  .parse()

const options = program.opts()

interface CumulativeStats {
  totalArticlesProcessed: number
  totalQuestionsGenerated: number
  totalCandidatesRejected: number
  totalErrors: number
  totalCost: number
  totalOllamaInferences: number
  batchesRun: number
  errorDetails: Array<{ articleId: string; title: string; error: string }>
}

async function main() {
  console.log(chalk.blue('🎭 Fake Facts Generation\n'))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  // Check Anthropic API key
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    console.log(chalk.red('❌ ANTHROPIC_API_KEY environment variable not set'))
    console.log(chalk.gray('   Set it in .env file: ANTHROPIC_API_KEY=your-key-here'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const batchSize = parseInt(options.batchSize, 10)
  const targetQuestions = options.targetQuestions ? parseInt(options.targetQuestions, 10) : null

  // Initialize services
  console.log(chalk.gray('Initializing services...'))

  // Load Ollama config
  const llmConfig: LocalLLMConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
  )
  const ollama = new LocalLLM(llmConfig)

  // Initialize Claude
  const claude = new ClaudeService(anthropicKey)

  // Create orchestrator
  const orchestrator = new FakeFactsOrchestrator(pool, ollama, claude)

  console.log(chalk.green('✓ Services initialized'))

  if (targetQuestions) {
    console.log(chalk.gray(`Target: ${targetQuestions} questions (batch size: ${batchSize})\n`))
  } else {
    console.log(chalk.gray(`Processing ${batchSize} articles...\n`))
  }

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be saved\n'))
  }

  // Initialize cumulative stats
  const cumulative: CumulativeStats = {
    totalArticlesProcessed: 0,
    totalQuestionsGenerated: 0,
    totalCandidatesRejected: 0,
    totalErrors: 0,
    totalCost: 0,
    totalOllamaInferences: 0,
    batchesRun: 0,
    errorDetails: [],
  }

  // Run batches
  if (targetQuestions) {
    // Continuous mode - run until target reached
    let consecutiveEmptyBatches = 0
    const maxConsecutiveEmpty = 3

    while (cumulative.totalQuestionsGenerated < targetQuestions) {
      const batchNum = cumulative.batchesRun + 1
      console.log(chalk.cyan(`\n${'='.repeat(70)}`))
      console.log(
        chalk.cyan(
          `Batch ${batchNum} (Progress: ${cumulative.totalQuestionsGenerated}/${targetQuestions} questions)`
        )
      )
      console.log(chalk.cyan(`${'='.repeat(70)}\n`))

      const stats = await orchestrator.processBatch(batchSize, true)

      // Update cumulative stats
      cumulative.totalArticlesProcessed += stats.articlesProcessed
      cumulative.totalQuestionsGenerated += stats.questionsGenerated
      cumulative.totalCandidatesRejected += stats.candidatesRejected
      cumulative.totalErrors += stats.errors
      cumulative.totalCost += stats.totalCost
      cumulative.totalOllamaInferences += stats.ollamaInferences
      cumulative.batchesRun++
      cumulative.errorDetails.push(...stats.errorDetails)

      // Show batch summary
      console.log(chalk.blue('\n📊 Batch Summary:'))
      console.log(chalk.white(`  Questions generated this batch: ${stats.questionsGenerated}`))
      console.log(
        chalk.green(
          `  Total progress: ${cumulative.totalQuestionsGenerated}/${targetQuestions} (${Math.round((cumulative.totalQuestionsGenerated / targetQuestions) * 100)}%)`
        )
      )
      console.log(chalk.gray(`  Batch cost: $${stats.totalCost.toFixed(3)}`))

      // Check if we found any candidates
      if (stats.articlesProcessed === 0) {
        consecutiveEmptyBatches++
        console.log(
          chalk.yellow(
            `\n⚠️  No candidates found (${consecutiveEmptyBatches}/${maxConsecutiveEmpty})`
          )
        )

        if (consecutiveEmptyBatches >= maxConsecutiveEmpty) {
          console.log(chalk.red('\n❌ No more unprocessed articles available'))
          console.log(
            chalk.yellow(
              `   Generated ${cumulative.totalQuestionsGenerated}/${targetQuestions} questions before running out of candidates`
            )
          )
          break
        }
      } else {
        consecutiveEmptyBatches = 0
      }
    }

    // Final summary
    console.log(chalk.blue('\n\n' + '='.repeat(70)))
    console.log(chalk.blue('🎉 FINAL SUMMARY'))
    console.log(chalk.blue('='.repeat(70) + '\n'))
    console.log(chalk.green(`  Questions generated: ${cumulative.totalQuestionsGenerated}`))
    console.log(chalk.white(`  Articles processed: ${cumulative.totalArticlesProcessed}`))
    console.log(chalk.yellow(`  Candidates rejected: ${cumulative.totalCandidatesRejected}`))
    console.log(chalk.gray(`  Batches run: ${cumulative.batchesRun}`))
    console.log(chalk.red(`  Errors: ${cumulative.totalErrors}`))
    console.log(chalk.gray(`\n  Total Claude API cost: $${cumulative.totalCost.toFixed(3)}`))
    console.log(chalk.gray(`  Total Ollama inferences: ${cumulative.totalOllamaInferences}`))

    if (cumulative.totalQuestionsGenerated > 0) {
      const avgCost = cumulative.totalCost / cumulative.totalQuestionsGenerated
      console.log(chalk.gray(`  Average cost per question: $${avgCost.toFixed(4)}`))
    }

    // Show error summary if any
    if (cumulative.errorDetails.length > 0) {
      console.log(chalk.red(`\n❌ Errors: ${cumulative.errorDetails.length} total`))
      const recentErrors = cumulative.errorDetails.slice(-5)
      console.log(chalk.red('\n   Most recent errors:'))
      for (const detail of recentErrors) {
        console.log(chalk.red(`   • ${detail.title.substring(0, 60)}...`))
        console.log(chalk.gray(`     ${detail.error}`))
      }
    }
  } else {
    // Single batch mode
    const stats = await orchestrator.processBatch(batchSize, true)

    // Display summary
    console.log(chalk.blue('\n📊 Generation Summary:\n'))
    console.log(chalk.white(`  Articles processed: ${stats.articlesProcessed}`))
    console.log(chalk.green(`  Questions generated: ${stats.questionsGenerated}`))
    console.log(chalk.yellow(`  Candidates rejected: ${stats.candidatesRejected}`))
    console.log(chalk.red(`  Errors: ${stats.errors}`))
    console.log(chalk.gray(`\n  Claude API cost: $${stats.totalCost.toFixed(3)}`))
    console.log(chalk.gray(`  Ollama inferences: ${stats.ollamaInferences}`))

    if (stats.questionsGenerated > 0) {
      const avgCost = stats.totalCost / stats.questionsGenerated
      console.log(chalk.gray(`  Average cost per question: $${avgCost.toFixed(4)}`))
    }

    // Show error details if any
    if (stats.errorDetails.length > 0) {
      console.log(chalk.red('\n❌ Error Details:\n'))
      for (const detail of stats.errorDetails) {
        console.log(chalk.red(`  • ${detail.title.substring(0, 60)}...`))
        console.log(chalk.gray(`    ${detail.error}`))
      }
    }

    // Show rejection reasons if requested
    if (stats.rejectionReasons.length > 0 && stats.rejectionReasons.length <= 10) {
      console.log(chalk.yellow('\n⊘ Sample Rejection Reasons:\n'))
      for (const rejection of stats.rejectionReasons.slice(0, 5)) {
        console.log(chalk.yellow(`  • ${rejection.title.substring(0, 60)}...`))
        console.log(chalk.gray(`    ${rejection.reason}`))
      }
      if (stats.rejectionReasons.length > 5) {
        console.log(chalk.gray(`  ... and ${stats.rejectionReasons.length - 5} more`))
      }
    }
  }

  await pool.end()

  // Exit with error if target not reached or all failed
  if (targetQuestions && cumulative.totalQuestionsGenerated < targetQuestions) {
    console.log(
      chalk.red(
        `\n❌ Failed to reach target of ${targetQuestions} questions (generated ${cumulative.totalQuestionsGenerated})`
      )
    )
    process.exit(1)
  }

  if (
    !targetQuestions &&
    cumulative.batchesRun > 0 &&
    cumulative.totalQuestionsGenerated === 0 &&
    cumulative.totalErrors > 0
  ) {
    console.log(chalk.red('\n❌ All articles failed to process'))
    process.exit(1)
  }

  console.log(chalk.green('\n✓ Done!'))
  process.exit(0)
}

main()
