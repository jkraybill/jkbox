#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { RSSScraperService } from '../scrapers/rss-scraper'
import { DatabaseQueries } from '../storage/db/queries'
import { LocalLLM } from '../llm/local-llm'
import type { LocalLLMConfig } from '../llm/types'
import type { ArticleInsert } from '../types/article'
import { readFileSync } from 'fs'
import { join } from 'path'

const program = new Command()

program
  .name('collect-rss')
  .description('Collect current articles from all validated RSS feeds')
  .option('--all-feeds', 'Collect from all validated feeds', false)
  .option('-f, --feed-id <id>', 'Specific feed ID to collect from')
  .option('--no-classify', 'Skip Ollama classification (faster but not recommended)')
  .parse()

const options = program.opts()

async function main() {
  console.log(chalk.blue('📰 Current RSS Feed Collection\n'))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = new DatabaseQueries(pool)
  const rss = new RSSScraperService()

  const shouldClassify = options.classify !== false

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
      // Fetch and parse RSS
      console.log(chalk.gray('  Fetching current articles...'))
      const parsed = await rss.parseFeed(feed.url)
      totalArticles += parsed.items.length
      console.log(chalk.gray(`  Found ${parsed.items.length} articles`))

      if (parsed.items.length === 0) {
        console.log(chalk.yellow('  ⚠️  No articles found'))
        continue
      }

      // Classify articles (if enabled)
      let weirdCount = 0
      const classifications = new Map<number, { isWeird: boolean; confidence: number }>()

      if (llm) {
        console.log(chalk.gray(`  Classifying ${parsed.items.length} articles...`))
        for (let j = 0; j < parsed.items.length; j++) {
          const item = parsed.items[j]!
          try {
            const classification = await llm.classify(
              item.title,
              item.description ?? ''
            )
            classifications.set(j, classification)
            if (classification.isWeird && classification.confidence > 60) {
              weirdCount++
              totalWeird++
            }
          } catch (error) {
            // Classification failed, store null
            classifications.set(j, { isWeird: false, confidence: 0 })
          }
        }
        const marker = weirdCount > 0 ? '🎭' : '📰'
        console.log(
          chalk.gray(
            `  ${marker} ${weirdCount}/${parsed.items.length} weird articles (${Math.round((weirdCount / parsed.items.length) * 100)}%)`
          )
        )
      }

      // Convert to article inserts with classification
      const articles: ArticleInsert[] = parsed.items.map((item, index) => {
        const classification = classifications.get(index)
        return {
          sourceType: 'rss' as const,
          sourceId: String(feed.id),
          sourceUrl: feed.url,
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
      console.log(chalk.green(`  ✓ Saved ${saved}/${articles.length} articles`))
      if (saved < articles.length) {
        console.log(chalk.gray(`    (${articles.length - saved} duplicates skipped)`))
      }
    } catch (error) {
      console.log(chalk.red(`  ✗ Failed: ${error}`))
    }
  }

  // Summary
  console.log(chalk.blue('\n📊 Collection Summary:\n'))
  console.log(chalk.white(`  Feeds processed: ${feeds.length}`))
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
