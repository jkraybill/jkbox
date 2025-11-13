#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { Pool } from 'pg'
import chalk from 'chalk'
import { RSSSearchService } from '../services/rss-search-service'
import { RSSScraperService } from '../scrapers/rss-scraper'
import { DatabaseQueries } from '../storage/db/queries'
import { LocalLLM } from '../llm/local-llm'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'

const program = new Command()

program
  .name('discover-rss')
  .description('Discover RSS feeds via web search for direct feed URLs')
  .option('-l, --language <code>', 'Specific language to search (e.g., en, es, fr)')
  .option('--all-languages', 'Search all 14 supported languages', false)
  .option('--validate', 'Validate discovered URLs are actual RSS feeds', true)
  .parse()

const options = program.opts()

// Language configurations with weird news keywords
const LANGUAGE_CONFIGS = [
  {
    language: 'en',
    country: 'US',
    weirdKeywords: ['weird news', 'strange news', 'bizarre news', 'odd news', 'unusual news'],
  },
  {
    language: 'es',
    country: 'Spain',
    weirdKeywords: ['noticias extrañas', 'noticias raras', 'noticias curiosas'],
  },
  {
    language: 'fr',
    country: 'France',
    weirdKeywords: ['actualités étranges', 'faits divers insolites', 'nouvelles bizarres'],
  },
  {
    language: 'de',
    country: 'Germany',
    weirdKeywords: ['seltsame nachrichten', 'kuriose news', 'bizarre meldungen'],
  },
  {
    language: 'it',
    country: 'Italy',
    weirdKeywords: ['notizie strane', 'notizie bizzarre', 'curiosità'],
  },
  {
    language: 'pt',
    country: 'Brazil',
    weirdKeywords: ['notícias estranhas', 'notícias bizarras', 'curiosidades'],
  },
  {
    language: 'nl',
    country: 'Netherlands',
    weirdKeywords: ['vreemd nieuws', 'bizar nieuws', 'merkwaardig nieuws'],
  },
  {
    language: 'pl',
    country: 'Poland',
    weirdKeywords: ['dziwne wiadomości', 'kuriozalne wydarzenia'],
  },
  {
    language: 'ru',
    country: 'Russia',
    weirdKeywords: ['странные новости', 'необычные новости'],
  },
  {
    language: 'ja',
    country: 'Japan',
    weirdKeywords: ['奇妙なニュース', '変なニュース'],
  },
  {
    language: 'zh',
    country: 'China',
    weirdKeywords: ['奇闻', '怪事', '奇怪新闻'],
  },
  {
    language: 'ar',
    country: 'Saudi Arabia',
    weirdKeywords: ['أخبار غريبة', 'أخبار عجيبة'],
  },
  {
    language: 'hi',
    country: 'India',
    weirdKeywords: ['अजीब खबरें', 'विचित्र समाचार'],
  },
  {
    language: 'ko',
    country: 'Korea',
    weirdKeywords: ['이상한 뉴스', '기이한 소식'],
  },
]

async function main() {
  console.log(chalk.blue('🔍 RSS Feed Discovery via Web Search\n'))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = new DatabaseQueries(pool)
  const rssSearch = new RSSSearchService()
  const rssScraper = new RSSScraperService()

  // Initialize Ollama for classification
  const llmConfig: LocalLLMConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
  )
  const llm = new LocalLLM(llmConfig)

  // Determine which languages to search
  let languagesToSearch = LANGUAGE_CONFIGS
  if (options.language) {
    const lang = LANGUAGE_CONFIGS.find((l) => l.language === options.language)
    if (!lang) {
      console.log(chalk.red(`❌ Language '${options.language}' not found`))
      await pool.end()
      process.exit(1)
    }
    languagesToSearch = [lang]
  }

  console.log(chalk.gray(`Languages: ${languagesToSearch.length}`))
  console.log(chalk.gray(`Validation: ${options.validate ? 'enabled' : 'disabled'}\n`))

  const allDiscoveredFeeds: Array<{ url: string; domain: string; language: string }> = []
  let totalQueries = 0
  let totalUrls = 0
  let totalValidated = 0

  // Process each language
  for (let i = 0; i < languagesToSearch.length; i++) {
    const langConfig = languagesToSearch[i]!
    console.log(
      chalk.white(
        `\n[${i + 1}/${languagesToSearch.length}] ${langConfig.language.toUpperCase()} - ${langConfig.country}`
      )
    )

    // Generate search queries
    const queries = rssSearch.generateRSSQueries(langConfig)
    totalQueries += queries.length
    console.log(chalk.gray(`  Generated ${queries.length} search queries`))

    console.log(
      chalk.yellow(
        `\n  🔍 Please manually search and paste RSS URLs found for ${langConfig.language}:`
      )
    )
    console.log(chalk.gray('     Suggested queries:'))
    for (const query of queries.slice(0, 5)) {
      console.log(chalk.gray(`       - "${query}"`))
    }
    console.log(
      chalk.yellow(
        '\n     Search these on Google, extract RSS/feed URLs, and paste them below.'
      )
    )
    console.log(
      chalk.yellow(
        '     Enter URLs one per line, then empty line to finish, or "skip" to skip:\n'
      )
    )

    // For automation: would use WebSearch API here
    // For now, provide manual input workflow
    console.log(chalk.gray('     [Manual input mode - automation TODO]'))
    console.log(chalk.gray(`     Example URLs to look for:`))
    console.log(chalk.gray(`       - https://example.com/rss`))
    console.log(chalk.gray(`       - https://news.example.com/feed.xml`))
    console.log(chalk.gray(`       - https://feeds.example.com/weird-news\n`))

    // Placeholder: In real implementation, would collect URLs here
    // For WWGD+ autonomous mode, I'll use web search programmatically

    const discoveredUrls: string[] = []

    // TODO: Implement automated web search collection
    // For now, skip to next language
    console.log(chalk.gray(`     Skipping automated search (manual mode not implemented)\n`))
  }

  // Summary
  console.log(chalk.blue('\n📊 Discovery Summary:\n'))
  console.log(chalk.white(`  Languages processed: ${languagesToSearch.length}`))
  console.log(chalk.white(`  Search queries generated: ${totalQueries}`))
  console.log(chalk.white(`  RSS URLs discovered: ${totalUrls}`))
  if (options.validate) {
    console.log(chalk.white(`  Feeds validated: ${totalValidated}`))
  }
  console.log(chalk.white(`  Feeds stored in database: ${allDiscoveredFeeds.length}`))

  console.log(
    chalk.yellow(
      '\n💡 Next: Implement automated WebSearch integration or use manual URL collection'
    )
  )

  await pool.end()
  process.exit(0)
}

main()
