#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import { DiscoveryService } from '../services/discovery-service'
import type { LocalLLMConfig } from '../llm/types'

const program = new Command()

program
  .name('list-feeds')
  .description('List discovered RSS feeds')
  .option('-l, --language <lang>', 'Filter by language (ISO 639-1)')
  .option('--limit <number>', 'Limit number of results', '10')
  .parse()

const options = program.opts()

async function main() {
  console.log(chalk.blue('📰 Discovered Feeds\n'))

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const llmConfig: LocalLLMConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
  )

  const seedData = JSON.parse(
    readFileSync(join(process.cwd(), 'seeds/weird-news-feeds.json'), 'utf-8')
  )

  const service = new DiscoveryService({
    keywords: seedData.keywords,
    llmConfig,
    databaseUrl,
  })

  try {
    const language = options.language
    const limit = parseInt(options.limit, 10)

    if (!language) {
      console.log(chalk.red('❌ --language required'))
      console.log(chalk.gray('   Example: npm run list-feeds -- --language ar'))
      process.exit(1)
    }

    const feeds = await service.getFeedsByLanguage(language, limit)

    if (feeds.length === 0) {
      console.log(chalk.yellow(`No feeds found for language: ${language}`))
      console.log(chalk.gray('\nRun discovery first:'))
      console.log(chalk.gray('  npm run discover-feeds -- --language ar --limit 5'))
      await service.close()
      return
    }

    console.log(chalk.green(`Found ${feeds.length} feeds (language: ${language}):\n`))

    for (const feed of feeds) {
      console.log(chalk.white(`  ${feed.newspaperName}`))
      console.log(chalk.gray(`    ${feed.title}`))
      console.log(chalk.gray(`    ${feed.url}`))
      console.log(chalk.gray(`    Quality: ${feed.qualityScore}/100, Articles: ${feed.articleCount}`))
      console.log(chalk.gray(`    Category: ${feed.category}, Validated: ${feed.isValidated}\n`))
    }

    await service.close()
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed: ${error}`))
    await service.close()
    process.exit(1)
  }
}

main()
