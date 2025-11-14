#!/usr/bin/env node
import 'dotenv/config'
import { Pool } from 'pg'
import chalk from 'chalk'

async function reset() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    console.log(chalk.blue('🧹 Clearing generated questions and resetting articles...\n'))

    // Count what we have
    const questionsCount = await pool.query('SELECT COUNT(*) FROM fake_facts_questions')
    const answersCount = await pool.query('SELECT COUNT(*) FROM fake_facts_answers')
    const processedCount = await pool.query(
      'SELECT COUNT(*) FROM articles WHERE fake_facts_processed = true'
    )

    console.log(chalk.gray('Current state:'))
    console.log(chalk.white(`  Questions: ${questionsCount.rows[0].count}`))
    console.log(chalk.white(`  Answers: ${answersCount.rows[0].count}`))
    console.log(chalk.white(`  Processed articles: ${processedCount.rows[0].count}\n`))

    // Delete everything
    await pool.query('DELETE FROM fake_facts_answers')
    console.log(chalk.green('✓ Deleted all answers'))

    await pool.query('DELETE FROM fake_facts_questions')
    console.log(chalk.green('✓ Deleted all questions'))

    await pool.query(`
      UPDATE articles
      SET fake_facts_processed = false,
          fake_facts_processed_at = NULL,
          fake_facts_eligible = NULL,
          fake_facts_rejection_reason = NULL
    `)
    console.log(chalk.green('✓ Reset all articles to unprocessed'))

    console.log(chalk.blue('\n🎉 Done! Ready to regenerate.'))
  } catch (error) {
    console.error(chalk.red('Error:'), error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

reset()
