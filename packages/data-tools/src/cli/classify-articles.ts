#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { LocalLLM } from '../llm/local-llm'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'

const program = new Command()

program
  .name('classify-articles')
  .description('Classify unclassified articles as weird/not weird using Ollama')
  .option('--batch-size <n>', 'Number of articles to process', '100')
  .option('--limit <n>', 'Maximum articles to classify (default: all)', '0')
  .option('--random', 'Randomize article order (default: sorted by pub_date DESC)', false)
  .parse()

const options = program.opts()

interface Article {
  id: string
  title: string
  description: string | null
}

async function main() {
  console.log(chalk.blue('🔍 Article Classification (Qwen)\n'))

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  // Load Ollama config
  const llmConfig: LocalLLMConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
  )

  const ollama = new LocalLLM(llmConfig)

  console.log(chalk.gray(`Using model: ${llmConfig.model}`))
  console.log(chalk.gray(`Endpoint: ${llmConfig.endpoint}\n`))

  try {
    // Get count of unclassified articles
    const countResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM articles
      WHERE is_weird IS NULL
    `)

    const totalUnclassified = parseInt(countResult.rows[0].count, 10)

    if (totalUnclassified === 0) {
      console.log(chalk.yellow('No unclassified articles found'))
      await pool.end()
      return
    }

    const limit = parseInt(options.limit, 10)
    const toClassify = limit > 0 ? Math.min(totalUnclassified, limit) : totalUnclassified

    console.log(chalk.white(`Found ${totalUnclassified} unclassified articles`))
    if (limit > 0) {
      console.log(chalk.gray(`Processing ${toClassify} (limited by --limit flag)\n`))
    } else {
      console.log(chalk.gray(`Processing all ${toClassify} articles\n`))
    }

    // Fetch unclassified articles
    const orderBy = options.random ? 'RANDOM()' : 'pub_date DESC'
    const articlesResult = await pool.query<Article>(
      `SELECT id, title, description
       FROM articles
       WHERE is_weird IS NULL
       ORDER BY ${orderBy}
       LIMIT $1`,
      [toClassify]
    )

    const articles = articlesResult.rows

    let weirdCount = 0
    let notWeirdCount = 0
    let errorCount = 0

    // Process in batches to avoid overwhelming the LLM
    const batchSize = parseInt(options.batchSize, 10)

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, Math.min(i + batchSize, articles.length))

      for (const article of batch) {
        const articleNum = i + batch.indexOf(article) + 1

        try {
          const description = article.description || ''
          const result = await ollama.classify(article.title, description)

          // Update database
          await pool.query(
            `UPDATE articles
             SET is_weird = $1,
                 weird_confidence = $2
             WHERE id = $3`,
            [result.isWeird, result.confidence, article.id]
          )

          if (result.isWeird) {
            weirdCount++
          } else {
            notWeirdCount++
          }

          // Show detailed output for each article
          const verdictColor = result.isWeird ? chalk.green : chalk.gray
          const verdictText = result.isWeird ? 'WEIRD' : 'NOT WEIRD'
          const titleTruncated = article.title.length > 80
            ? article.title.substring(0, 77) + '...'
            : article.title

          console.log(
            chalk.blue(`[${articleNum}/${articles.length}]`) + ' ' +
            chalk.white(titleTruncated) + ' - ' +
            verdictColor(verdictText) + ' - ' +
            chalk.yellow(`${result.confidence}%`)
          )
        } catch (error) {
          errorCount++
          const titleTruncated = article.title.length > 80
            ? article.title.substring(0, 77) + '...'
            : article.title

          console.log(
            chalk.blue(`[${articleNum}/${articles.length}]`) + ' ' +
            chalk.white(titleTruncated) + ' - ' +
            chalk.red('ERROR')
          )
        }
      }
    }

    console.log(chalk.blue('\n📊 Classification Results:\n'))
    console.log(chalk.green(`  Weird: ${weirdCount}`))
    console.log(chalk.gray(`  Not weird: ${notWeirdCount}`))
    if (errorCount > 0) {
      console.log(chalk.red(`  Errors: ${errorCount}`))
    }

    const weirdPercent = ((weirdCount / articles.length) * 100).toFixed(1)
    console.log(chalk.white(`\n  Weird percentage: ${weirdPercent}%`))

    await pool.end()
  } catch (error) {
    console.error(chalk.red('Error:'), error)
    await pool.end()
    process.exit(1)
  }
}

main().catch(console.error)
