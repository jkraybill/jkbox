#!/usr/bin/env node
import 'dotenv/config'
import { Pool } from 'pg'
import chalk from 'chalk'
import { LocalLLM } from '../llm/local-llm'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'

interface Article {
  id: string
  title: string
  description: string | null
}

async function main() {
  console.log(chalk.blue('🧪 Test Classification Prompt (Dry Run)\n'))

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
  console.log(chalk.gray(`Testing 20 random articles...\n`))

  try {
    // Get 20 random articles
    const result = await pool.query<Article>(
      `SELECT id, title, description
       FROM articles
       ORDER BY RANDOM()
       LIMIT 20`
    )

    const articles = result.rows

    let weirdCount = 0
    let notWeirdCount = 0

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]
      const description = article.description || ''

      console.log(chalk.blue(`\n[${ i + 1}/20] ` + '='.repeat(70)))
      console.log(chalk.white(`Title: ${article.title}`))
      if (description) {
        console.log(chalk.gray(`Description: ${description.substring(0, 150)}${description.length > 150 ? '...' : ''}`))
      }

      try {
        const result = await ollama.classify(article.title, description)

        const verdictColor = result.isWeird ? chalk.green : chalk.red
        const verdictText = result.isWeird ? 'WEIRD' : 'NOT WEIRD'

        console.log(verdictColor(`\n→ VERDICT: ${verdictText}`))
        console.log(chalk.yellow(`→ CONFIDENCE: ${result.confidence}%`))
        console.log(chalk.gray(`→ REASONING: ${result.reasoning}`))

        if (result.isWeird) {
          weirdCount++
        } else {
          notWeirdCount++
        }
      } catch (error) {
        console.log(chalk.red(`\n→ ERROR: ${error}`))
      }
    }

    console.log(chalk.blue('\n\n' + '='.repeat(70)))
    console.log(chalk.blue('📊 SUMMARY:\n'))
    console.log(chalk.green(`  Classified as WEIRD: ${weirdCount}/20 (${((weirdCount / 20) * 100).toFixed(0)}%)`))
    console.log(chalk.red(`  Classified as NOT WEIRD: ${notWeirdCount}/20 (${((notWeirdCount / 20) * 100).toFixed(0)}%)`))
    console.log(chalk.blue('\n' + '='.repeat(70)))
    console.log(chalk.yellow('\n💡 Review the classifications above.'))
    console.log(chalk.gray('   If accuracy seems low, we can adjust the prompt.\n'))

    await pool.end()
  } catch (error) {
    console.error(chalk.red('Error:'), error)
    await pool.end()
    process.exit(1)
  }
}

main().catch(console.error)
