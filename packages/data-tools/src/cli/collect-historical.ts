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
import type { ArticleInsert } from '../types/article'

const program = new Command()

program
  .name('collect-historical')
  .description('Collect historical RSS feed data via Internet Archive Wayback Machine')
  .option('-f, --feed-id <id>', 'Specific feed ID to collect historical data for')
  .option('--all-feeds', 'Collect historical data for all validated feeds', false)
  .option('-y, --years <number>', 'Years of history to collect', '10')
  .option('--no-classify', 'Skip Ollama classification (faster but not recommended)')
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
  const shouldClassify = options.classify !== false // True by default, false only with --no-classify

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
  console.log(chalk.gray(`Historical depth: ${years} years`))
  console.log(chalk.gray(`Classification: ${shouldClassify ? 'enabled (default)' : 'disabled (--no-classify)'}\n`))

  // Initialize Ollama (enabled by default)
  let llm: LocalLLM | null = null
  if (shouldClassify) {
    const llmConfig: LocalLLMConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
    )
    llm = new LocalLLM(llmConfig)
    console.log(chalk.yellow('🧠 Ollama classification enabled\n'))
  }

  let totalSnapshots = 0
  let totalArticles = 0
  let totalWeird = 0
  let totalSaved = 0

  // Process each feed
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i]!
    console.log(
      chalk.white(`\n[${i + 1}/${feeds.length}] ${feed.newspaperName} (${feed.language})`)
    )
    console.log(chalk.gray(`  Feed: ${feed.url}`))

    try {
      // Get historical snapshots (monthly sampling)
      console.log(chalk.gray(`  Querying Wayback Machine (${years} years, monthly sampling)...`))
      const snapshots = await wayback.getYearlySnapshots(feed.url, years)
      totalSnapshots += snapshots.length
      console.log(chalk.green(`  ✓ Found ${snapshots.length} monthly snapshots`))

      if (snapshots.length === 0) {
        console.log(chalk.yellow(`  ⚠️  No historical data available`))
        continue
      }

      // Process each snapshot
      for (let j = 0; j < snapshots.length; j++) {
        const snapshot = snapshots[j]!
        const year = snapshot.timestamp.substring(0, 4)
        const month = snapshot.timestamp.substring(4, 6)
        console.log(
          chalk.gray(`  [${j + 1}/${snapshots.length}] Processing ${year}-${month} snapshot...`)
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

          // Classify articles (if enabled)
          let weirdCount = 0
          const classifications = new Map<number, { isWeird: boolean; confidence: number }>()

          if (llm) {
            console.log(chalk.gray(`    Classifying ${parsed.items.length} articles...`))
            for (let k = 0; k < parsed.items.length; k++) {
              const item = parsed.items[k]!
              try {
                const classification = await llm.classify(
                  item.title,
                  item.description ?? ''
                )
                classifications.set(k, classification)
                if (classification.isWeird && classification.confidence > 60) {
                  weirdCount++
                  totalWeird++
                }
              } catch (error) {
                // Classification failed, store null
                classifications.set(k, { isWeird: false, confidence: 0 })
              }
            }
            const marker = weirdCount > 0 ? '🎭' : '📰'
            console.log(
              chalk.gray(
                `    ${marker} ${weirdCount}/${parsed.items.length} weird articles (${Math.round((weirdCount / parsed.items.length) * 100)}%)`
              )
            )
          }

          // Convert to article inserts with classification
          const articles: ArticleInsert[] = parsed.items.map((item, index) => {
            const classification = classifications.get(index)
            return {
              sourceType: 'historical' as const,
              sourceId: String(feed.id),
              sourceUrl: snapshot.url, // Wayback snapshot URL
              title: item.title,
              description: item.description ?? null,
              content: item.content ?? null,
              link: item.link,
              author: item.author ?? null,
              pubDate: item.pubDate ?? null,
              collectedAt: new Date(),
              isWeird: classification?.isWeird ?? null,
              weirdConfidence: classification?.confidence ?? null,
              categories: item.categories,
              engagementScore: null,
              qualityScore: null,
              language: feed.language,
              country: null,
              contentHash: null, // Will be generated by insertArticle
            }
          })

          // Save to database
          const saved = await db.insertArticles(articles)
          totalSaved += saved
          if (saved < articles.length) {
            console.log(chalk.gray(`    Saved ${saved}/${articles.length} (${articles.length - saved} duplicates)`))
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
  console.log(chalk.green(`  Articles saved: ${totalSaved}`))
  if (totalSaved < totalArticles) {
    console.log(chalk.gray(`  Duplicates skipped: ${totalArticles - totalSaved}`))
  }
  if (shouldClassify) {
    console.log(chalk.white(`  Weird articles: ${totalWeird} (${totalArticles > 0 ? Math.round((totalWeird / totalArticles) * 100) : 0}%)`))
  }

  await pool.end()
  process.exit(0)
}

main()
