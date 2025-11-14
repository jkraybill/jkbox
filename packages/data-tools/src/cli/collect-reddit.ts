#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { RedditFetcher, WEIRD_NEWS_SUBREDDITS } from '../scrapers/reddit-fetcher'
import { LocalLLM } from '../llm/local-llm'
import { DatabaseQueries } from '../storage/db/queries'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'

const program = new Command()

program
  .name('collect-reddit')
  .description('Collect top posts from Reddit weird news subreddits')
  .option('-s, --subreddits <names...>', 'Specific subreddits to fetch (without r/)')
  .option('-l, --limit <number>', 'Posts per subreddit', '1000')
  .option('--min-score <number>', 'Minimum post score', '100')
  .option('--no-classify', 'Skip Ollama classification (faster but not recommended)')
  .parse()

const options = program.opts()

async function main() {
  console.log(chalk.blue('🤖 Reddit Weird News Collection\n'))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = new DatabaseQueries(pool)
  const fetcher = new RedditFetcher()

  // Determine which subreddits to fetch
  const subreddits = options.subreddits || WEIRD_NEWS_SUBREDDITS
  const limit = parseInt(options.limit, 10)
  const minScore = parseInt(options.minScore, 10)

  console.log(chalk.gray(`Target subreddits: ${subreddits.length}`))
  console.log(chalk.gray(`Posts per subreddit: ${limit}`))
  console.log(chalk.gray(`Minimum score: ${minScore}\n`))

  // Fetch posts
  console.log(chalk.green('📡 Fetching Reddit posts...\n'))
  const posts = await fetcher.getTopPostsFromMultiple(subreddits, limit)

  // Filter by minimum score
  const filtered = fetcher.filterByScore(posts, minScore)
  console.log(
    chalk.gray(`\nFiltered: ${filtered.length}/${posts.length} posts with score >= ${minScore}`)
  )

  // Classify with Ollama and save immediately (enabled by default)
  const shouldClassify = options.classify !== false
  let saved = 0
  let duplicates = 0
  let weirdCount = 0
  let classified = filtered

  if (shouldClassify) {
    console.log(chalk.yellow('\n🧠 Classifying & saving posts with Ollama (saves after each post)...\n'))

    const llmConfig: LocalLLMConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
    )
    const llm = new LocalLLM(llmConfig)

    for (let i = 0; i < filtered.length; i++) {
      const post = filtered[i]!
      try {
        const classification = await llm.classify(post.title, post.text)
        const marker = classification.isWeird ? '🎭' : '📰'
        const confidence = classification.confidence

        // Save to DB immediately if weird enough
        if (classification.isWeird && confidence > 60) {
          weirdCount++

          const article = {
            sourceType: 'reddit' as const,
            sourceId: post.id,
            sourceUrl: `https://www.reddit.com${post.permalink}`,
            title: post.title,
            description: post.text.substring(0, 500) || null,
            content: post.text || null,
            link: post.url,
            author: null,
            pubDate: post.createdAt,
            collectedAt: new Date(),
            isWeird: true,
            weirdConfidence: confidence,
            categories: [post.subreddit],
            engagementScore: post.score,
            qualityScore: null,
            language: 'en',
            country: null,
            contentHash: null,
          }

          try {
            await db.insertArticle(article)
            saved++
            console.log(
              `  [${i + 1}/${filtered.length}] ${marker} r/${post.subreddit}: "${post.title.substring(0, 60)}..." (${confidence}% confident) ✓ saved`
            )
          } catch (error) {
            if (error instanceof Error && error.message.includes('duplicate')) {
              duplicates++
              console.log(
                `  [${i + 1}/${filtered.length}] ${marker} r/${post.subreddit}: "${post.title.substring(0, 60)}..." (${confidence}% confident) - duplicate`
              )
            } else {
              console.log(
                `  [${i + 1}/${filtered.length}] ${marker} r/${post.subreddit}: "${post.title.substring(0, 60)}..." (${confidence}% confident) ❌ save failed`
              )
            }
          }
        } else {
          console.log(
            `  [${i + 1}/${filtered.length}] ${marker} r/${post.subreddit}: "${post.title.substring(0, 60)}..." (${confidence}% confident)`
          )
        }
      } catch (error) {
        console.log(`  [${i + 1}/${filtered.length}] ❌ Classification failed`)
      }
    }

    console.log(chalk.green(`\n✓ Processed: ${weirdCount} weird posts found, ${saved} new saved, ${duplicates} duplicates`))
  }

  // Display summary
  console.log(chalk.blue('\n📊 Collection Summary:\n'))
  console.log(chalk.white(`  Total posts fetched: ${posts.length}`))
  console.log(chalk.white(`  After score filter: ${filtered.length}`))
  if (shouldClassify) {
    console.log(chalk.white(`  Classified as weird: ${weirdCount}`))
    console.log(chalk.white(`  New articles saved: ${saved}`))
    console.log(chalk.white(`  Duplicates skipped: ${duplicates}`))
  }

  await pool.end()
  process.exit(0)
}

main()
