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
  .option('--classify', 'Classify posts with Ollama (slow)', false)
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

  // Optionally classify with Ollama
  let classified = filtered
  if (options.classify) {
    console.log(chalk.yellow('\n🧠 Classifying posts with Ollama...\n'))

    const llmConfig: LocalLLMConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
    )
    const llm = new LocalLLM(llmConfig)

    const weirdPosts = []
    for (let i = 0; i < filtered.length; i++) {
      const post = filtered[i]!
      try {
        const classification = await llm.classify(post.title, post.text)
        const marker = classification.isWeird ? '🎭' : '📰'
        console.log(
          `  [${i + 1}/${filtered.length}] ${marker} r/${post.subreddit}: "${post.title.substring(0, 60)}..." (${classification.confidence}% confident)`
        )

        if (classification.isWeird && classification.confidence > 60) {
          weirdPosts.push(post)
        }
      } catch (error) {
        console.log(`  [${i + 1}/${filtered.length}] ❌ Classification failed`)
      }
    }

    console.log(chalk.green(`\n✓ Classified: ${weirdPosts.length}/${filtered.length} weird posts`))
    classified = weirdPosts
  }

  // Display summary
  console.log(chalk.blue('\n📊 Collection Summary:\n'))
  console.log(chalk.white(`  Total posts fetched: ${posts.length}`))
  console.log(chalk.white(`  After score filter: ${filtered.length}`))
  if (options.classify) {
    console.log(chalk.white(`  After classification: ${classified.length}`))
  }

  // Show top posts by subreddit
  console.log(chalk.blue('\n📰 Top Posts by Subreddit:\n'))
  const bySubreddit = new Map<string, typeof classified>()
  for (const post of classified) {
    const existing = bySubreddit.get(post.subreddit) || []
    existing.push(post)
    bySubreddit.set(post.subreddit, existing)
  }

  for (const [subreddit, subPosts] of bySubreddit.entries()) {
    console.log(chalk.white(`  r/${subreddit}: ${subPosts.length} posts`))
    // Show top 3
    const sorted = fetcher.sortByScore(subPosts).slice(0, 3)
    for (const post of sorted) {
      console.log(chalk.gray(`    ↑${post.score.toLocaleString()} - ${post.title.substring(0, 80)}`))
    }
    console.log('')
  }

  // TODO: Store in database (need to design reddit_posts table schema)
  console.log(
    chalk.yellow(
      '\n⚠️  Database storage not yet implemented - posts are not saved (TODO: design schema)'
    )
  )

  await pool.end()
}

main()
