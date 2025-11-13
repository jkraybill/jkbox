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
  .option('--batch-size <n>', 'Number of articles to process', '10')
  .option('--dry-run', 'Show what would be processed without saving', false)
  .parse()

const options = program.opts()

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
  console.log(chalk.gray(`Processing ${batchSize} articles...\n`))

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be saved\n'))
  }

  // Process batch
  const stats = await orchestrator.processBatch(batchSize)

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

  await pool.end()

  // Exit with error if all failed
  if (stats.articlesProcessed > 0 && stats.questionsGenerated === 0 && stats.errors > 0) {
    console.log(chalk.red('\n❌ All articles failed to process'))
    process.exit(1)
  }

  console.log(chalk.green('\n✓ Done!'))
  process.exit(0)
}

main()
