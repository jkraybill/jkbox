#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import { DiscoveryService } from '../services/discovery-service'
import type { LocalLLMConfig } from '../llm/types'

const program = new Command()

program
  .name('discover-feeds')
  .description('Discover RSS feeds from news sources')
  .option('-s, --seed <file>', 'Seed file with domains', 'seeds/weird-news-feeds.json')
  .option('-l, --language <lang>', 'Filter by language (ISO 639-1)', '')
  .option('--limit <number>', 'Limit number of domains', '0')
  .option('--sample-size <number>', 'Articles to sample per feed', '5')
  .option('--weird-threshold <number>', 'Minimum weird articles required', '1')
  .parse()

const options = program.opts()

async function main() {
  console.log(chalk.blue('🔍 jkbox Feed Discovery\n'))

  // Load configuration
  const llmConfig: LocalLLMConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
  )

  const seedData = JSON.parse(
    readFileSync(join(process.cwd(), options.seed), 'utf-8')
  )

  // Filter by language if specified
  let domains = seedData.feeds
  if (options.language) {
    domains = domains.filter((d: any) => d.language === options.language)
    console.log(chalk.gray(`Filtered to language: ${options.language}`))
  }

  // Apply limit
  const limit = parseInt(options.limit, 10)
  if (limit > 0) {
    domains = domains.slice(0, limit)
    console.log(chalk.gray(`Limited to ${limit} domains\n`))
  }

  if (domains.length === 0) {
    console.log(chalk.red('No domains to process'))
    process.exit(1)
  }

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    console.log(chalk.gray('   Example: export DATABASE_URL="postgresql://user:pass@localhost:5432/jkbox_data"'))
    process.exit(1)
  }

  console.log(chalk.green(`📡 Discovering feeds from ${domains.length} domains...\n`))

  const service = new DiscoveryService({
    keywords: seedData.keywords,
    llmConfig,
    databaseUrl,
    sampleSize: parseInt(options.sampleSize, 10),
    weirdThreshold: parseInt(options.weirdThreshold, 10),
  })

  try {
    const result = await service.discoverFromDomains(domains)

    console.log(chalk.green('\n✅ Discovery Complete!'))
    console.log(chalk.gray(`Session ID: ${result.sessionId}`))
    console.log(chalk.gray(`Domains evaluated: ${result.domainsEvaluated}`))
    console.log(chalk.gray(`Feeds discovered: ${result.feedsDiscovered.length}`))

    if (result.errors.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Errors (${result.errors.length}):`))
      result.errors.forEach((err) => console.log(chalk.gray(`  ${err}`)))
    }

    console.log(chalk.blue('\n📰 Discovered Feeds:\n'))
    for (const feed of result.feedsDiscovered) {
      console.log(chalk.white(`  ${feed.newspaperName} (${feed.language})`))
      console.log(chalk.gray(`    ${feed.title}`))
      console.log(chalk.gray(`    ${feed.url}`))
      console.log(chalk.gray(`    Quality: ${feed.qualityScore}/100, Articles: ${feed.articleCount}\n`))
    }

    await service.close()
  } catch (error) {
    console.log(chalk.red(`\n❌ Discovery failed: ${error}`))
    await service.close()
    process.exit(1)
  }
}

main()
