#!/usr/bin/env node
import 'dotenv/config'
import { Pool } from 'pg'
import chalk from 'chalk'
import { DatabaseQueries } from '../storage/db/queries'
import { LocalLLM } from '../llm/local-llm'
import { ClaudeService } from '../llm/claude-service'
import { ArticleFetcher } from '../scrapers/article-fetcher'
import { TextFormatter } from '../utils/text-formatter'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync, appendFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as readline from 'readline'

const LOG_FILE = '/tmp/justify.log'
const formatter = new TextFormatter(70)

function log(message: string) {
  appendFileSync(LOG_FILE, message + '\n')
}

interface ArticleAssessment {
  articleId: string
  title: string
  summary: string
  ollamaScore: number
  ollamaReasoning: string
  claudeScore: number
  claudeReasoning: string
}

async function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  // Initialize log file
  writeFileSync(LOG_FILE, `BAKEOFF SCORING LOG - ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`)

  console.log(chalk.blue('🎮 BLIND JUDGING BAKEOFF: Ollama vs Claude Sonnet\n'))

  // Check database URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  // Check Anthropic API key
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    console.log(chalk.red('❌ ANTHROPIC_API_KEY environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = new DatabaseQueries(pool)

  // Initialize services
  console.log(chalk.gray('Initializing services...\n'))

  const llmConfig: LocalLLMConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
  )
  const ollama = new LocalLLM(llmConfig)
  const claude = new ClaudeService(anthropicKey)
  const articleFetcher = new ArticleFetcher()

  console.log(chalk.green('✓ Services initialized\n'))

  const allAssessments: ArticleAssessment[] = []
  let totalClaudeCost = 0
  const totalRuns = 3

  // ========================================================================
  // PHASE 1: RUN THE ASSESSMENTS
  // ========================================================================
  console.log(chalk.yellow('📊 PHASE 1: Running assessments...\n'))

  for (let run = 1; run <= totalRuns; run++) {
    console.log(chalk.cyan(`\n${'='.repeat(70)}`))
    console.log(chalk.cyan(`RUN ${run}/${totalRuns}`))
    console.log(chalk.cyan(`${'='.repeat(70)}\n`))
    log(`\n${'='.repeat(70)}\nRUN ${run}/${totalRuns}\n${'='.repeat(70)}\n`)

    // Get 10 unprocessed candidates
    const candidates = await db.getUnprocessedArticles(10)

    if (candidates.length === 0) {
      console.log(chalk.yellow('⚠️  No more unprocessed articles available'))
      log('⚠️  No more unprocessed articles available')
      break
    }

    console.log(chalk.white(`Found ${candidates.length} candidates\n`))
    log(`Found ${candidates.length} candidates\n`)

    console.log(chalk.gray('📝 Preparing candidates with summaries...\n'))

    // Prepare candidates with summaries
    const candidatesWithSummaries: Array<{
      id: string
      title: string
      summary: string
    }> = []

    for (let i = 0; i < candidates.length; i++) {
      const article = candidates[i]!
      console.log(chalk.gray(`  [${i + 1}/${candidates.length}] ${article.title}`))
      log(`  [${i + 1}/${candidates.length}] ${article.title}`)

      let summary = article.articleSummary

      if (!summary || summary.length < 20) {
        // Get content first
        let contentText = article.content || ''

        if (!contentText && article.link) {
          console.log(chalk.gray(`      → Fetching full content from URL...`))
          log(`      → Fetching content from ${article.link}`)
          try {
            const fetched = await articleFetcher.fetchArticleContent(article.link)
            contentText = fetched.mainText
            log(`      ✓ Fetched ${contentText.length} chars`)
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            console.log(chalk.red(`      ✗ Failed to fetch: ${errorMsg}`))
            log(`      ✗ Failed to fetch: ${errorMsg}`)
            continue
          }
        }

        if (contentText.length > 50) {
          console.log(chalk.gray(`      → Generating summary with Ollama...`))
          log(`      → Generating summary with Ollama...`)
          log(`      Content: ${contentText}`)
          summary = await ollama.summarize(article.title, contentText)
          log(`      Summary: ${summary}`)
          console.log(chalk.green(`      ✓ Summary generated`))
        } else {
          console.log(chalk.yellow(`      ⚠️  Skipping - insufficient content (${contentText.length} chars, need >50)`))
          console.log(chalk.gray(`      Content: "${contentText}"`))
          log(`      ⚠️  Skipping - insufficient content (${contentText.length} chars)\n      Content: "${contentText}"`)
          continue
        }
      } else {
        console.log(chalk.gray(`      ✓ Using cached summary (${summary.length} chars)`))
        log(`      ✓ Using cached summary (${summary.length} chars)`)
      }

      candidatesWithSummaries.push({
        id: article.id!,
        title: article.title,
        summary,
      })
    }

    if (candidatesWithSummaries.length < 2) {
      console.log(chalk.yellow(`⚠️  Only ${candidatesWithSummaries.length} usable candidates, skipping run`))
      log(`⚠️  Only ${candidatesWithSummaries.length} usable candidates, skipping run`)
      continue
    }

    console.log(chalk.white(`\nPrepared ${candidatesWithSummaries.length} candidates with summaries\n`))
    log(`\nPrepared ${candidatesWithSummaries.length} candidates with summaries\n`)

    // Score with Ollama
    console.log(chalk.blue('🤖 Scoring with Ollama...'))
    console.log(chalk.gray(`   Sending ${candidatesWithSummaries.length} candidates to Ollama for scoring...`))
    log('\n🤖 OLLAMA SCORING')
    log(`Sending ${candidatesWithSummaries.length} candidates to Ollama for scoring...`)
    const ollamaScores = await ollama.scoreArticleCandidates(candidatesWithSummaries)
    log(`Ollama returned ${ollamaScores.length} scores`)
    console.log(chalk.green(`✓ Ollama scoring complete (${ollamaScores.length} scores returned)\n`))

    // Score with Claude
    console.log(chalk.blue('🧠 Scoring with Claude Sonnet...'))
    console.log(chalk.gray(`   Sending ${candidatesWithSummaries.length} candidates to Claude API...`))
    log('\n🧠 CLAUDE SCORING')
    log(`Sending ${candidatesWithSummaries.length} candidates to Claude for scoring...`)
    const { scores: claudeScores, cost } = await claude.scoreArticleCandidates(candidatesWithSummaries)
    totalClaudeCost += cost
    log(`Claude returned ${claudeScores.length} scores (cost: $${cost.toFixed(4)})`)
    console.log(chalk.green(`✓ Claude scoring complete (${claudeScores.length} scores returned, cost: $${cost.toFixed(4)})\n`))

    // Collect assessments
    for (const candidate of candidatesWithSummaries) {
      const ollamaResult = ollamaScores.find(s => s.id === candidate.id)
      const claudeResult = claudeScores.find(s => s.id === candidate.id)

      if (ollamaResult && claudeResult) {
        const assessment: ArticleAssessment = {
          articleId: candidate.id,
          title: candidate.title,
          summary: candidate.summary,
          ollamaScore: ollamaResult.score,
          ollamaReasoning: ollamaResult.reasoning,
          claudeScore: claudeResult.score,
          claudeReasoning: claudeResult.reasoning,
        }

        allAssessments.push(assessment)

        log(`\nARTICLE: ${candidate.title}`)
        log(`SUMMARY: ${candidate.summary}`)
        log(`OLLAMA: ${ollamaResult.score}/100 - ${ollamaResult.reasoning}`)
        log(`CLAUDE: ${claudeResult.score}/100 - ${claudeResult.reasoning}`)
      }
    }

    console.log(chalk.gray(`Completed run ${run}/${totalRuns}\n`))
    log(`Completed run ${run}/${totalRuns}\n`)
  }

  console.log(chalk.green(`\n✓ Assessment phase complete! Collected ${allAssessments.length} assessments.\n`))
  log(`\n✓ Assessment phase complete! Collected ${allAssessments.length} assessments.\n`)

  // ========================================================================
  // PHASE 2: BLIND JUDGING GAME
  // ========================================================================
  console.log(chalk.yellow('\n🎲 PHASE 2: Blind Judging Game\n'))
  console.log(chalk.white('You will see each article and its summary.'))
  console.log(chalk.white('Then you\'ll see TWO judgments in random order.'))
  console.log(chalk.white('Pick which judgment you agree with most (1 or 2).\n'))
  console.log(chalk.gray('Press Enter to start...'))
  await askQuestion('')

  // Shuffle the assessments
  const shuffledAssessments = [...allAssessments].sort(() => Math.random() - 0.5)

  let ollamaWins = 0
  let claudeWins = 0

  for (let i = 0; i < shuffledAssessments.length; i++) {
    const assessment = shuffledAssessments[i]!

    console.clear()
    console.log(chalk.cyan(`\n${'='.repeat(70)}`))
    console.log(chalk.cyan(`ARTICLE ${i + 1}/${shuffledAssessments.length}`))
    console.log(chalk.cyan(`${'='.repeat(70)}\n`))

    console.log(chalk.yellow('TITLE:'))
    formatter.wrapAndPrint(assessment.title, line => console.log(chalk.white(line)))
    console.log()

    console.log(chalk.yellow('SUMMARY:'))
    formatter.wrapAndPrint(assessment.summary, line => console.log(chalk.white(line)))
    console.log()

    // Randomly order the two judgments
    const showOllamaFirst = Math.random() < 0.5

    const judgment1 = showOllamaFirst
      ? { judge: 'ollama', score: assessment.ollamaScore, reasoning: assessment.ollamaReasoning }
      : { judge: 'claude', score: assessment.claudeScore, reasoning: assessment.claudeReasoning }

    const judgment2 = showOllamaFirst
      ? { judge: 'claude', score: assessment.claudeScore, reasoning: assessment.claudeReasoning }
      : { judge: 'ollama', score: assessment.ollamaScore, reasoning: assessment.ollamaReasoning }

    log(`\n${'='.repeat(70)}`)
    log(`BLIND JUDGMENT ${i + 1}/${shuffledAssessments.length}`)
    log(`Article: ${assessment.title}`)
    log(`Judgment 1 (${judgment1.judge}): ${judgment1.score}/100`)
    log(`Judgment 2 (${judgment2.judge}): ${judgment2.score}/100`)

    console.log(chalk.blue('JUDGMENT 1:'))
    console.log(chalk.white(`Score: ${judgment1.score}/100`))
    formatter.wrapQuotedAndPrint(judgment1.reasoning, line => console.log(chalk.gray(line)))
    console.log()

    console.log(chalk.blue('JUDGMENT 2:'))
    console.log(chalk.white(`Score: ${judgment2.score}/100`))
    formatter.wrapQuotedAndPrint(judgment2.reasoning, line => console.log(chalk.gray(line)))
    console.log()

    let choice = ''
    while (choice !== '1' && choice !== '2') {
      choice = await askQuestion(chalk.yellow('Which judgment do you agree with most? (1 or 2): '))
      if (choice !== '1' && choice !== '2') {
        console.log(chalk.red('Please enter 1 or 2'))
      }
    }

    const selectedJudge = choice === '1' ? judgment1.judge : judgment2.judge

    log(`User selected: ${choice} (${selectedJudge})`)

    if (selectedJudge === 'ollama') {
      ollamaWins++
      console.log(chalk.green('\n✓ Noted!\n'))
    } else {
      claudeWins++
      console.log(chalk.green('\n✓ Noted!\n'))
    }

    if (i < shuffledAssessments.length - 1) {
      console.log(chalk.gray('Press Enter to continue...'))
      await askQuestion('')
    }
  }

  // ========================================================================
  // PHASE 3: FINAL RESULTS
  // ========================================================================
  console.clear()
  console.log(chalk.blue('\n\n' + '='.repeat(70)))
  console.log(chalk.blue('🏆 FINAL RESULTS'))
  console.log(chalk.blue('='.repeat(70) + '\n'))

  const total = ollamaWins + claudeWins
  const ollamaPercent = ((ollamaWins / total) * 100).toFixed(1)
  const claudePercent = ((claudeWins / total) * 100).toFixed(1)

  console.log(chalk.yellow('YOUR BLIND JUDGING RESULTS:\n'))
  console.log(chalk.white(`Total judgments: ${total}`))
  console.log(chalk.magenta(`🤖 Ollama wins: ${ollamaWins} (${ollamaPercent}%)`))
  console.log(chalk.blue(`🧠 Claude wins: ${claudeWins} (${claudePercent}%)`))

  if (ollamaWins > claudeWins) {
    console.log(chalk.green(`\n🎉 WINNER: Ollama by ${ollamaWins - claudeWins} judgments!`))
    log(`\nWINNER: Ollama (${ollamaWins} vs ${claudeWins})`)
  } else if (claudeWins > ollamaWins) {
    console.log(chalk.green(`\n🎉 WINNER: Claude by ${claudeWins - ollamaWins} judgments!`))
    log(`\nWINNER: Claude (${claudeWins} vs ${ollamaWins})`)
  } else {
    console.log(chalk.yellow(`\n🤝 TIE! Both models won ${ollamaWins} judgments.`))
    log(`\nTIE! Both ${ollamaWins} vs ${claudeWins}`)
  }

  console.log(chalk.white(`\nTotal Claude cost: $${totalClaudeCost.toFixed(4)}`))
  console.log(chalk.white(`Ollama cost: $0.00 (local inference)`))

  console.log(chalk.gray(`\n📝 Full logs saved to: ${LOG_FILE}\n`))
  log(`\nFinal scores: Ollama ${ollamaWins}, Claude ${claudeWins}`)
  log(`Total Claude cost: $${totalClaudeCost.toFixed(4)}`)

  await pool.end()

  console.log(chalk.green('✓ Bakeoff complete!'))
  process.exit(0)
}

main()
