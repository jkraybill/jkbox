#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { distance } from 'fastest-levenshtein'

const program = new Command()

program
  .name('dedupe-articles')
  .description('Find and remove duplicate articles using fuzzy title matching')
  .option('--threshold <percent>', 'Similarity threshold (default: 75)', '75')
  .option('--dry-run', 'Show duplicates without deleting them', false)
  .option('--source-type <type>', 'Only dedupe specific source type')
  .parse()

const options = program.opts()

interface Article {
  id: string
  title: string
  content: string | null
  pub_date: Date
  is_weird: boolean | null
  weird_confidence: number | null
  source_type: string
}

/**
 * Calculate similarity between two strings (0-100%)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 100

  const dist = distance(str1, str2)
  return ((maxLen - dist) / maxLen) * 100
}

/**
 * Normalize title for comparison (lowercase, remove special chars)
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

/**
 * Determine which article to keep from a duplicate group
 * Priority: has classification > longer content > earlier pub_date
 */
function chooseBestArticle(articles: Article[]): Article {
  return articles.sort((a, b) => {
    // 1. Prefer articles with classification
    if (a.is_weird !== null && b.is_weird === null) return -1
    if (a.is_weird === null && b.is_weird !== null) return 1

    // 2. Prefer longer content
    const aLen = a.content?.length || 0
    const bLen = b.content?.length || 0
    if (aLen !== bLen) return bLen - aLen

    // 3. Prefer earlier pub_date (original)
    return new Date(a.pub_date).getTime() - new Date(b.pub_date).getTime()
  })[0]!
}

async function main() {
  console.log(chalk.blue('🔍 Article Deduplication\n'))

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const threshold = parseInt(options.threshold, 10)
  const isDryRun = options.dryRun

  console.log(chalk.gray(`Similarity threshold: ${threshold}%`))
  console.log(chalk.gray(`Mode: ${isDryRun ? 'DRY RUN (no deletions)' : 'LIVE (will delete duplicates)'}`))
  if (options.sourceType) {
    console.log(chalk.gray(`Source type filter: ${options.sourceType}`))
  }
  console.log()

  try {
    // Fetch all articles
    const whereClause = options.sourceType ? `WHERE source_type = '${options.sourceType}'` : ''
    const result = await pool.query<Article>(
      `SELECT id, title, content, pub_date, is_weird, weird_confidence, source_type
       FROM articles
       ${whereClause}
       ORDER BY pub_date DESC`
    )

    const articles = result.rows
    console.log(chalk.white(`Found ${articles.length} articles to check\n`))

    // Find duplicate groups
    const duplicateGroups: Article[][] = []
    const processed = new Set<string>()

    for (let i = 0; i < articles.length; i++) {
      const article1 = articles[i]!
      if (processed.has(article1.id)) continue

      const normalizedTitle1 = normalizeTitle(article1.title)
      const group: Article[] = [article1]
      processed.add(article1.id)

      // Compare with remaining articles
      for (let j = i + 1; j < articles.length; j++) {
        const article2 = articles[j]!
        if (processed.has(article2.id)) continue

        const normalizedTitle2 = normalizeTitle(article2.title)
        const similarity = calculateSimilarity(normalizedTitle1, normalizedTitle2)

        if (similarity >= threshold) {
          group.push(article2)
          processed.add(article2.id)
        }
      }

      if (group.length > 1) {
        duplicateGroups.push(group)
      }
    }

    console.log(chalk.yellow(`Found ${duplicateGroups.length} duplicate groups\n`))

    if (duplicateGroups.length === 0) {
      console.log(chalk.green('✓ No duplicates found!'))
      await pool.end()
      return
    }

    let totalToDelete = 0
    const idsToDelete: string[] = []

    // Process each duplicate group
    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i]!
      const best = chooseBestArticle(group)
      const toDelete = group.filter(a => a.id !== best.id)

      console.log(chalk.blue(`\n[Group ${i + 1}/${duplicateGroups.length}] ${group.length} duplicates`))
      console.log(chalk.green(`  ✓ KEEPING: ${best.title.substring(0, 80)}`))
      console.log(chalk.gray(`    ID: ${best.id} | Source: ${best.source_type} | Date: ${best.pub_date.toISOString().split('T')[0]}`))

      for (const dup of toDelete) {
        console.log(chalk.red(`  ✗ DELETING: ${dup.title.substring(0, 80)}`))
        console.log(chalk.gray(`    ID: ${dup.id} | Source: ${dup.source_type} | Date: ${dup.pub_date.toISOString().split('T')[0]}`))
        idsToDelete.push(dup.id)
        totalToDelete++
      }
    }

    console.log(chalk.blue('\n\n' + '='.repeat(70)))
    console.log(chalk.blue('📊 Deduplication Summary:\n'))
    console.log(chalk.white(`  Duplicate groups found: ${duplicateGroups.length}`))
    console.log(chalk.red(`  Articles to delete: ${totalToDelete}`))
    console.log(chalk.green(`  Articles to keep: ${duplicateGroups.length}`))

    if (isDryRun) {
      console.log(chalk.yellow('\n⚠️  DRY RUN - No deletions performed'))
      console.log(chalk.gray('Run without --dry-run to actually delete duplicates'))
    } else {
      // Delete duplicates
      if (idsToDelete.length > 0) {
        console.log(chalk.yellow('\n⏳ Deleting duplicates...'))
        await pool.query(
          `DELETE FROM articles WHERE id = ANY($1::uuid[])`,
          [idsToDelete]
        )
        console.log(chalk.green(`✓ Deleted ${totalToDelete} duplicate articles`))
      }
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
