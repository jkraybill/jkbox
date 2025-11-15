#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'

const program = new Command()

program
  .name('reset-weird-classification')
  .description('Clear is_weird classification for all articles to enable re-classification')
  .option('--confirm', 'Actually perform the reset (dry run without this flag)', false)
  .parse()

const options = program.opts()

async function main() {
  console.log(chalk.blue('🔄 Reset Weird Classification\n'))

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // Check current state
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_weird = true) as weird,
        COUNT(*) FILTER (WHERE is_weird = false) as not_weird,
        COUNT(*) FILTER (WHERE is_weird IS NULL) as unclassified
      FROM articles
    `)

    const stats = statsResult.rows[0]

    console.log(chalk.white('Current state:'))
    console.log(chalk.white(`  Total articles: ${stats.total}`))
    console.log(chalk.green(`  Weird: ${stats.weird}`))
    console.log(chalk.red(`  Not weird: ${stats.not_weird}`))
    console.log(chalk.gray(`  Unclassified: ${stats.unclassified}`))

    if (!options.confirm) {
      console.log(chalk.yellow('\n⚠️  DRY RUN MODE'))
      console.log(chalk.yellow('   Run with --confirm to actually reset classifications'))
      console.log(chalk.gray('\n   This would set is_weird = NULL and weird_confidence = NULL for all articles'))
      await pool.end()
      return
    }

    console.log(chalk.yellow('\n⚠️  Resetting all classifications...'))

    const result = await pool.query(`
      UPDATE articles
      SET is_weird = NULL,
          weird_confidence = NULL
      WHERE is_weird IS NOT NULL
    `)

    console.log(chalk.green(`✓ Reset ${result.rowCount} articles`))
    console.log(chalk.gray('\n  Run classify-articles script to re-classify'))

    await pool.end()
  } catch (error) {
    console.error(chalk.red('Error:'), error)
    await pool.end()
    process.exit(1)
  }
}

main().catch(console.error)
