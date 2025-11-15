#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { NewsOfWeirdScraper } from '../scrapers/news-of-weird-scraper'
import { LocalLLM } from '../llm/local-llm'
import { DatabaseQueries } from '../storage/db/queries'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ArticleInsert } from '../types/article'

const program = new Command()

program
  .name('collect-news-of-weird')
  .description('Collect articles from News of the Weird archives')
  .option('--limit <number>', 'Limit number of articles to process', '0')
  .option('--start-year <year>', 'Start year for collection (default: 2020)', '2020')
  .option('--no-classify', 'Skip Ollama classification (faster but not recommended)')
  .option('--rate-limit <ms>', 'Rate limit between requests in milliseconds', '2000')
  .parse()

const options = program.opts()

async function main() {
  console.log(chalk.blue('📰 News of the Weird Collector\n'))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = new DatabaseQueries(pool)

  const rateLimitMs = parseInt(options.rateLimit, 10)
  const limit = parseInt(options.limit, 10)
  const startYear = parseInt(options.startYear, 10)
  const shouldClassify = options.classify !== false

  console.log(chalk.gray(`Start year: ${startYear}`))
  console.log(chalk.gray(`Rate limit: ${rateLimitMs}ms between requests`))
  console.log(chalk.gray(`Classification: ${shouldClassify ? 'enabled' : 'disabled (--no-classify)'}`))
  if (limit > 0) {
    console.log(chalk.gray(`Limit: ${limit} articles\n`))
  } else {
    console.log(chalk.gray(`Limit: none (processing all)\n`))
  }

  // Initialize scraper
  const scraper = new NewsOfWeirdScraper(rateLimitMs)

  // Initialize Ollama if classification enabled
  let llm: LocalLLM | null = null
  if (shouldClassify) {
    const llmConfig: LocalLLMConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
    )
    llm = new LocalLLM(llmConfig)
    console.log(chalk.yellow('🧠 Ollama classification enabled\n'))
  }

  try {
    // Generate article URLs by date (News of the Weird publishes weekly on Thursdays)
    console.log(chalk.gray(`Generating potential article URLs from ${startYear} to present...`))
    const urls = await scraper.fetchArticleUrls(startYear)

    console.log(chalk.green(`✓ Generated ${urls.length} potential article URLs\n`))

    // Limit if specified
    const urlsToProcess = limit > 0 ? urls.slice(0, limit) : urls

    if (limit > 0 && limit < urls.length) {
      console.log(chalk.yellow(`Processing first ${limit} articles (use --limit 0 for all)\n`))
    }

    let totalProcessed = 0
    let totalSaved = 0
    let totalWeird = 0
    let totalErrors = 0
    let totalSkipped = 0

    // Process each article
    for (let i = 0; i < urlsToProcess.length; i++) {
      const url = urlsToProcess[i]!

      console.log(chalk.blue(`\n[${i + 1}/${urlsToProcess.length}]`))
      console.log(chalk.gray(`  URL: ${url}`))

      // Check if we already have this URL (or any stories from this URL)
      // News of Weird articles have multiple stories, stored as url#story-0, url#story-1, etc.
      const existingCount = await pool.query(
        'SELECT COUNT(*) FROM articles WHERE source_url LIKE $1',
        [`${url}%`]
      )
      const exists = parseInt(existingCount.rows[0]?.count || '0', 10) > 0
      if (exists) {
        totalSkipped++
        console.log(chalk.gray(`  ⊘ Already collected (skipping)`))
        continue
      }

      try {
        // Fetch article
        const article = await scraper.fetchArticle(url)
        console.log(chalk.white(`  Title: ${article.title.substring(0, 80)}${article.title.length > 80 ? '...' : ''}`))

        // Extract individual news items using LLM (News of the Weird articles contain multiple stories)
        let newsItems: Array<{
          title: string
          content: string
          url: string
          date: Date
          author: string
        }> = []

        if (llm) {
          try {
            const extractionResult = await llm.extractStories(article.content)

            if (!extractionResult.valid) {
              console.log(chalk.red(`  ✗ LLM extraction validation failed: ${extractionResult.validationError}`))
              console.log(chalk.red(`  ✗ Skipping this article (likely hallucination)`))
              totalErrors++
              continue // Skip this article entirely
            }

            newsItems = extractionResult.stories.map((story, idx) => ({
              title: story.title,
              content: story.content,
              url: `${article.url}#story-${idx}`,
              date: article.date,
              author: article.author,
            }))
            console.log(chalk.gray(`  Extracted ${newsItems.length} individual stories from column`))
          } catch (error) {
            console.log(chalk.yellow(`  ⚠️  LLM extraction failed: ${error}`))
            console.log(chalk.yellow(`  ⚠️  Falling back to basic parsing`))
            // Fallback to basic extraction on error (not validation failure)
            newsItems = scraper.extractNewsItems(article)
            console.log(chalk.gray(`  Found ${newsItems.length} news items in this column`))
          }
        } else {
          // No LLM, use basic extraction
          newsItems = scraper.extractNewsItems(article)
          console.log(chalk.gray(`  Found ${newsItems.length} news items in this column`))
        }

        // Classify each news item
        const itemsWithClassification: Array<ArticleInsert> = []

        for (const item of newsItems) {
          let classification: { isWeird: boolean; confidence: number } | null = null

          if (llm) {
            try {
              const result = await llm.classify(item.title, item.content.substring(0, 500))
              classification = {
                isWeird: result.isWeird,
                confidence: result.confidence,
              }

              // Show classification result for each item
              const verdictColor = result.isWeird ? chalk.green : chalk.gray
              const verdictText = result.isWeird ? 'WEIRD' : 'NOT WEIRD'
              const titleTruncated = item.title.length > 80
                ? item.title.substring(0, 77) + '...'
                : item.title

              console.log(
                chalk.gray(`    • `) +
                chalk.white(titleTruncated) + ' - ' +
                verdictColor(verdictText) + ' - ' +
                chalk.yellow(`${result.confidence}%`)
              )
            } catch (error) {
              console.log(chalk.yellow(`    ⚠️  Classification failed: ${error}`))
            }
          }

          itemsWithClassification.push({
            sourceType: 'news-of-weird' as const,
            sourceId: 'news-of-weird',
            sourceUrl: item.url,
            title: item.title,
            description: item.content.substring(0, 200),
            content: item.content,
            link: item.url,
            author: item.author,
            pubDate: item.date,
            collectedAt: new Date(),
            isWeird: classification?.isWeird ?? null,
            weirdConfidence: classification?.confidence ?? null,
            categories: ['weird', 'news-of-the-weird'],
            engagementScore: null,
            qualityScore: null,
            language: 'en',
            country: 'us',
            contentHash: null, // Will be generated by insertArticles
          })

          if (classification?.isWeird) {
            totalWeird++
          }
        }

        // Save to database
        const saved = await db.insertArticles(itemsWithClassification)
        totalSaved += saved
        totalProcessed++

        if (saved < newsItems.length) {
          console.log(chalk.gray(`  Saved ${saved}/${newsItems.length} items (${newsItems.length - saved} duplicates)`))
        } else {
          console.log(chalk.green(`  ✓ Saved ${saved} items`))
        }
      } catch (error) {
        totalErrors++
        console.log(chalk.red(`  ✗ Error: ${error}`))
      }
    }

    // Summary
    console.log(chalk.blue('\n\n' + '='.repeat(70)))
    console.log(chalk.blue('📊 Collection Summary:\n'))
    console.log(chalk.white(`  Articles processed: ${totalProcessed}`))
    console.log(chalk.green(`  News items saved: ${totalSaved}`))
    if (totalSkipped > 0) {
      console.log(chalk.gray(`  Already collected (skipped): ${totalSkipped}`))
    }
    if (shouldClassify) {
      console.log(chalk.yellow(`  Classified as weird: ${totalWeird} (${((totalWeird / Math.max(totalSaved, 1)) * 100).toFixed(1)}%)`))
    }
    if (totalErrors > 0) {
      console.log(chalk.red(`  Errors: ${totalErrors}`))
    }
    console.log(chalk.blue('='.repeat(70) + '\n'))

    await pool.end()
  } catch (error) {
    console.error(chalk.red('Error:'), error)
    await pool.end()
    process.exit(1)
  }
}

main().catch(console.error)
