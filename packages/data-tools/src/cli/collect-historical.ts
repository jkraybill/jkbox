#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { WaybackFetcher } from '../scrapers/wayback-fetcher'
import { RSSScraperService } from '../scrapers/rss-scraper'
import { LocalLLM } from '../llm/local-llm'
import { DatabaseQueries } from '../storage/db/queries'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'
import { RateLimiter } from '../utils/rate-limiter'

const program = new Command()

program
  .name('collect-historical')
  .description('Collect historical RSS feed data via Internet Archive Wayback Machine')
  .option('-f, --feed-id <id>', 'Specific feed ID to collect historical data for')
  .option('--all-feeds', 'Collect historical data for all validated feeds', false)
  .option('-y, --years <number>', 'Years of history to collect', '10')
  .option('--classify', 'Classify articles with Ollama (slow)', false)
  .parse()

const options = program.opts()

async function main() {
  console.log(chalk.blue('📚 Historical RSS Feed Collection (Internet Archive)\n'))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = new DatabaseQueries(pool)
  const wayback = new WaybackFetcher()
  const rss = new RSSScraperService()
  const rateLimiter = new RateLimiter(2000, true)

  const years = parseInt(options.years, 10)

  // Get feeds to process
  let feeds: Array<{ id: number; url: string; newspaperName: string; language: string }>
  if (options.feedId) {
    const feedId = parseInt(options.feedId, 10)
    const feed = await db.getFeedById(feedId)
    if (!feed) {
      console.log(chalk.red(`❌ Feed ${feedId} not found`))
      await pool.end()
      process.exit(1)
    }
    feeds = [{ id: feed.id!, url: feed.url, newspaperName: feed.newspaperName, language: feed.language }]
  } else if (options.allFeeds) {
    const allFeeds = await db.getAllValidatedFeeds()
    feeds = allFeeds.map((f) => ({ id: f.id!, url: f.url, newspaperName: f.newspaperName, language: f.language }))
  } else {
    console.log(chalk.red('❌ Must specify either --feed-id or --all-feeds'))
    await pool.end()
    process.exit(1)
  }

  console.log(chalk.gray(`Processing ${feeds.length} feed(s)`))
  console.log(chalk.gray(`Historical depth: ${years} years\n`))

  // Initialize Ollama if needed
  let llm: LocalLLM | null = null
  if (options.classify) {
    const llmConfig: LocalLLMConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
    )
    llm = new LocalLLM(llmConfig)
    console.log(chalk.yellow('🧠 Ollama classification enabled\n'))
  }

  let totalSnapshots = 0
  let totalArticles = 0
  let totalWeird = 0

  // Process each feed
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i]!
    console.log(
      chalk.white(`\n[${i + 1}/${feeds.length}] ${feed.newspaperName} (${feed.language})`)
    )
    console.log(chalk.gray(`  Feed: ${feed.url}`))

    try {
      // Get historical snapshots
      console.log(chalk.gray(`  Querying Wayback Machine (${years} years)...`))
      const snapshots = await wayback.getYearlySnapshots(feed.url, years)
      totalSnapshots += snapshots.length
      console.log(chalk.green(`  ✓ Found ${snapshots.length} yearly snapshots`))

      if (snapshots.length === 0) {
        console.log(chalk.yellow(`  ⚠️  No historical data available`))
        continue
      }

      // Process each snapshot
      for (let j = 0; j < snapshots.length; j++) {
        const snapshot = snapshots[j]!
        const year = snapshot.timestamp.substring(0, 4)
        console.log(
          chalk.gray(`  [${j + 1}/${snapshots.length}] Processing ${year} snapshot...`)
        )

        try {
          // Fetch and parse snapshot
          const content = await rateLimiter.throttle(feed.url, async () => {
            return await wayback.fetchSnapshot(snapshot.url)
          })

          if (!content) {
            console.log(chalk.yellow(`    ⚠️  Failed to fetch snapshot`))
            continue
          }

          // Parse RSS feed from snapshot
          const parsed = await rss.parseRSSContent(content)
          totalArticles += parsed.items.length
          console.log(chalk.gray(`    Found ${parsed.items.length} articles`))

          // Optionally classify
          if (llm && parsed.items.length > 0) {
            const sampleSize = Math.min(5, parsed.items.length)
            let weirdCount = 0

            for (let k = 0; k < sampleSize; k++) {
              const article = parsed.items[k]!
              try {
                const classification = await llm.classify(
                  article.title,
                  article.description ?? ''
                )
                if (classification.isWeird && classification.confidence > 60) {
                  weirdCount++
                  totalWeird++
                }
              } catch (error) {
                // Classification failed, skip
              }
            }

            const marker = weirdCount > 0 ? '🎭' : '📰'
            console.log(
              chalk.gray(
                `    ${marker} Classified sample: ${weirdCount}/${sampleSize} weird (${Math.round((weirdCount / sampleSize) * 100)}%)`
              )
            )
          }
        } catch (error) {
          console.log(chalk.yellow(`    ⚠️  Snapshot processing failed: ${error}`))
        }
      }
    } catch (error) {
      console.log(chalk.red(`  ✗ Failed: ${error}`))
    }
  }

  // Summary
  console.log(chalk.blue('\n📊 Collection Summary:\n'))
  console.log(chalk.white(`  Feeds processed: ${feeds.length}`))
  console.log(chalk.white(`  Snapshots retrieved: ${totalSnapshots}`))
  console.log(chalk.white(`  Articles found: ${totalArticles}`))
  if (options.classify) {
    console.log(chalk.white(`  Weird articles: ${totalWeird}`))
  }

  // TODO: Store historical articles in database
  console.log(
    chalk.yellow(
      '\n⚠️  Database storage not yet implemented - articles are not saved (TODO: design schema)'
    )
  )

  await pool.end()
}

main()
