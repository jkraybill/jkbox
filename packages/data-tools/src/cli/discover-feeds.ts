#!/usr/bin/env node
import 'dotenv/config'
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
  .option('--no-historical', 'Disable automatic historical collection', false)
  .option('--historical-years <number>', 'Years of historical data to fetch', '10')
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

  if (domains.length === 0) {
    console.log(chalk.red('No domains to process'))
    process.exit(1)
  }

  console.log(chalk.gray(`Found ${domains.length} potential domains`))

  // Prioritize domains: never checked > oldest checked > recently checked
  console.log(chalk.gray(`Prioritizing domains by check history...\n`))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    console.log(chalk.gray('   Example: export DATABASE_URL="postgresql://user:pass@localhost:5432/jkbox_data"'))
    process.exit(1)
  }

  const service = new DiscoveryService({
    keywords: seedData.keywords,
    llmConfig,
    databaseUrl,
    sampleSize: parseInt(options.sampleSize, 10),
    weirdThreshold: parseInt(options.weirdThreshold, 10),
    enableHistorical: options.historical !== false, // Commander negates --no-historical
    historicalYears: parseInt(options.historicalYears, 10),
  })

  try {
    // Get check history for prioritization
    const domainCheckTimes = await Promise.all(
      domains.map(async (d: any) => ({
        ...d,
        lastChecked: await service.getDomainLastChecked(d.domain),
      }))
    )

    // Sort: never checked first, then oldest checked
    domainCheckTimes.sort((a, b) => {
      if (!a.lastChecked && !b.lastChecked) return 0
      if (!a.lastChecked) return -1
      if (!b.lastChecked) return 1
      return a.lastChecked.getTime() - b.lastChecked.getTime()
    })

    // Apply limit after prioritization
    const limit = parseInt(options.limit, 10)
    const domainsToCheck = limit > 0 ? domainCheckTimes.slice(0, limit) : domainCheckTimes

    // Show prioritization results
    const neverChecked = domainsToCheck.filter((d) => !d.lastChecked).length
    const previouslyChecked = domainsToCheck.length - neverChecked
    console.log(
      chalk.gray(
        `Prioritized: ${neverChecked} never checked, ${previouslyChecked} previously checked`
      )
    )
    if (domainsToCheck.length > 0 && domainsToCheck[0]!.lastChecked) {
      const oldest = domainsToCheck[0]!.lastChecked
      const hoursAgo = Math.round((Date.now() - oldest.getTime()) / (1000 * 60 * 60))
      console.log(chalk.gray(`Oldest check was ${hoursAgo} hours ago\n`))
    } else {
      console.log('')
    }

    console.log(chalk.green(`📡 Discovering feeds from ${domainsToCheck.length} domains...\n`))

    const result = await service.discoverFromDomains(domainsToCheck)

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
    process.exit(0)
  } catch (error) {
    console.log(chalk.red(`\n❌ Discovery failed: ${error}`))
    await service.close()
    process.exit(1)
  }
}

main()
