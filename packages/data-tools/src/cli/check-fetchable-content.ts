#!/usr/bin/env node
import 'dotenv/config'
import { Pool } from 'pg'
import chalk from 'chalk'
import { ArticleFetcher } from '../scrapers/article-fetcher'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  console.log(chalk.blue('🔍 Checking articles with empty content but valid links...\n'))

  const result = await pool.query(`
    SELECT
      id,
      title,
      link,
      source_type,
      COALESCE(LENGTH(content), 0) as content_length,
      is_weird,
      pub_date
    FROM articles
    WHERE (content IS NULL OR content = '')
      AND link IS NOT NULL
      AND is_weird = true
    ORDER BY pub_date DESC
    LIMIT 10
  `)

  console.log(chalk.white(`Found ${result.rows.length} articles with empty content but valid links\n`))
  console.log(chalk.gray('='.repeat(80)))

  if (result.rows.length === 0) {
    console.log(chalk.yellow('No articles found!'))
    await pool.end()
    return
  }

  // Try fetching from a few
  const articleFetcher = new ArticleFetcher()

  for (let i = 0; i < Math.min(1, result.rows.length); i++) {
    const row = result.rows[i]!

    console.log(chalk.cyan(`\n[${i + 1}/${result.rows.length}]`))
    console.log(chalk.white(`Title: ${row.title}`))
    console.log(chalk.gray(`Link: ${row.link}`))
    console.log(chalk.gray(`Source: ${row.source_type}`))
    console.log(chalk.gray(`Current content length: ${row.content_length}`))
    console.log(chalk.gray(`Published: ${row.pub_date}`))

    try {
      console.log(chalk.yellow(`\n→ Attempting to fetch content...`))
      const fetched = await articleFetcher.fetchArticleContent(row.link)

      if (fetched.mainText && fetched.mainText.length > 0) {
        console.log(chalk.green(`✓ Successfully fetched ${fetched.mainText.length} chars!`))
        console.log(chalk.yellow(`\nFull Content Preview (first 600 chars):`))
        console.log(chalk.white('─'.repeat(80)))
        console.log(chalk.gray(fetched.mainText.substring(0, 600)))
        console.log(chalk.white('─'.repeat(80)))
      } else {
        console.log(chalk.yellow(`⚠️  Fetched but content is empty`))
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.log(chalk.red(`✗ Failed: ${errorMsg}`))
    }
  }

  console.log(chalk.gray('\n' + '='.repeat(80)))
  console.log(chalk.blue('\n📊 Summary:\n'))
  console.log(chalk.white(`Total articles with empty content + valid link: ${result.rows.length}`))
  console.log(chalk.gray(`Tested: ${Math.min(3, result.rows.length)}`))

  await pool.end()
}

main()
