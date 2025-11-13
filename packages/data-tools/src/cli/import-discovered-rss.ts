#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { RSSScraperService } from '../scrapers/rss-scraper'
import { DatabaseQueries } from '../storage/db/queries'
import { LocalLLM } from '../llm/local-llm'
import type { LocalLLMConfig } from '../llm/types'
import type { FeedSource } from '../types/feed'
import { readFileSync } from 'fs'
import { join } from 'path'

const program = new Command()

program
  .name('import-discovered-rss')
  .description('Import and validate RSS feeds from discovered-rss-feeds.json')
  .option('--dry-run', 'Validate feeds without saving to database', false)
  .option('--min-weird <number>', 'Minimum weird articles required (out of 5)', '1')
  .parse()

const options = program.opts()

interface DiscoveredFeed {
  url: string
  source: string
  language: string
  country: string
  description: string
  confidence: 'verified' | 'high' | 'medium' | 'low'
}

async function main() {
  console.log(chalk.blue('📥 Importing Discovered RSS Feeds\n'))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = new DatabaseQueries(pool)
  const rss = new RSSScraperService()

  // Initialize Ollama
  const llmConfig: LocalLLMConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
  )
  const llm = new LocalLLM(llmConfig)

  // Load discovered feeds
  const feedsFilePath = join(process.cwd(), 'data/discovered-rss-feeds.json')
  const feedsData = JSON.parse(readFileSync(feedsFilePath, 'utf-8'))
  const feeds: DiscoveredFeed[] = feedsData.feeds

  console.log(chalk.gray(`Loaded ${feeds.length} feeds from discovered-rss-feeds.json`))
  console.log(chalk.gray(`Dry run: ${options.dryRun ? 'yes' : 'no'}`))
  console.log(chalk.gray(`Minimum weird articles: ${options.minWeird}/5\n`))

  const minWeirdRequired = parseInt(options.minWeird, 10)
  let totalValidated = 0
  let totalSaved = 0
  let totalFailed = 0
  const validatedFeeds: FeedSource[] = []

  // Process each feed
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i]!
    console.log(chalk.white(`\n[${i + 1}/${feeds.length}] ${feed.source} (${feed.language})`))
    console.log(chalk.gray(`  ${feed.url}`))

    try {
      // Fetch and parse RSS
      console.log(chalk.gray('  Fetching RSS feed...'))
      const parsed = await rss.parseFeed(feed.url)

      if (parsed.items.length === 0) {
        console.log(chalk.yellow('  ⚠️  No articles found'))
        totalFailed++
        continue
      }

      console.log(chalk.gray(`  Found ${parsed.items.length} articles`))

      // Classify sample articles
      const sampleSize = Math.min(5, parsed.items.length)
      let weirdCount = 0

      console.log(chalk.gray(`  Classifying ${sampleSize} sample articles...`))
      for (let j = 0; j < sampleSize; j++) {
        const article = parsed.items[j]!
        try {
          const classification = await llm.classify(article.title, article.description ?? '')
          const marker = classification.isWeird ? '🎭' : '📰'
          console.log(
            chalk.gray(
              `    [${j + 1}/${sampleSize}] ${marker} "${article.title.substring(0, 60)}..." (${classification.confidence}% confident)`
            )
          )
          if (classification.isWeird && classification.confidence > 60) {
            weirdCount++
          }
        } catch (error) {
          console.log(chalk.gray(`    [${j + 1}/${sampleSize}] ❌ Classification failed`))
        }
      }

      console.log(
        chalk.gray(`  Result: ${weirdCount}/${sampleSize} weird articles (${Math.round((weirdCount / sampleSize) * 100)}%)`)
      )

      // Check if feed meets minimum weird requirement
      if (weirdCount < minWeirdRequired) {
        console.log(chalk.yellow(`  ✗ Not enough weird content (${weirdCount} < ${minWeirdRequired})`))
        totalFailed++
        continue
      }

      // Calculate quality score
      const weirdRatio = weirdCount / sampleSize
      const qualityScore = Math.round(weirdRatio * 100)

      // Extract domain
      const url = new URL(feed.url)
      const domain = url.hostname.replace(/^www\./, '')

      // Create feed source object
      const feedSource: Omit<FeedSource, 'id'> = {
        url: feed.url,
        newspaperName: feed.source,
        domain,
        country: feed.country,
        language: feed.language,
        category: 'weird',
        keywords: ['weird', 'strange', 'odd', 'unusual'],
        title: parsed.title,
        description: parsed.description,
        lastBuildDate: parsed.lastBuildDate,
        discoveredAt: new Date(),
        lastCheckedAt: new Date(),
        lastSuccessfulFetchAt: new Date(),
        articleCount: parsed.items.length,
        updateFrequency: 0,
        qualityScore,
        isActive: true,
        isValidated: true,
        errors: [],
      }

      validatedFeeds.push(feedSource as FeedSource)
      totalValidated++

      console.log(chalk.green(`  ✓ Validated (quality: ${qualityScore}/100)`))

      // Save to database (unless dry run)
      if (!options.dryRun) {
        try {
          await db.insertFeedSource(feedSource)
          totalSaved++
          console.log(chalk.green('  ✓ Saved to database'))
        } catch (error) {
          if (error instanceof Error && error.message.includes('duplicate key')) {
            console.log(chalk.gray('  ℹ️  Already exists in database'))
          } else {
            console.log(chalk.red(`  ✗ Database error: ${error}`))
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`  ✗ Failed: ${error}`))
      totalFailed++
    }
  }

  // Summary
  console.log(chalk.blue('\n📊 Import Summary:\n'))
  console.log(chalk.white(`  Total feeds processed: ${feeds.length}`))
  console.log(chalk.green(`  Validated: ${totalValidated}`))
  console.log(chalk.red(`  Failed: ${totalFailed}`))
  if (!options.dryRun) {
    console.log(chalk.white(`  Saved to database: ${totalSaved}`))
  } else {
    console.log(chalk.yellow('  Dry run mode - nothing saved'))
  }

  // Show validated feeds by language
  if (validatedFeeds.length > 0) {
    console.log(chalk.blue('\n✅ Validated Feeds by Language:\n'))
    const byLanguage = new Map<string, FeedSource[]>()
    for (const feed of validatedFeeds) {
      const existing = byLanguage.get(feed.language) || []
      existing.push(feed)
      byLanguage.set(feed.language, existing)
    }

    for (const [lang, langFeeds] of byLanguage.entries()) {
      console.log(chalk.white(`  ${lang.toUpperCase()}: ${langFeeds.length} feeds`))
      for (const feed of langFeeds) {
        console.log(chalk.gray(`    - ${feed.newspaperName} (quality: ${feed.qualityScore}/100)`))
      }
    }
  }

  await pool.end()
  process.exit(0)
}

main()
