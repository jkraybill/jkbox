#!/usr/bin/env node
import 'dotenv/config'
import { Pool } from 'pg'
import chalk from 'chalk'
import { Command } from 'commander'

const program = new Command()

program
  .name('show-question')
  .description('Show a generated question by article title')
  .argument('<title>', 'Article title (or partial title)')
  .parse()

const [searchTitle] = program.args

async function showQuestion() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log(chalk.red('❌ DATABASE_URL environment variable not set'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // Find article
    const articleResult = await pool.query(
      `SELECT a.id, a.title, a.link, a.source_type
       FROM articles a
       WHERE a.title ILIKE $1
       LIMIT 1`,
      [`%${searchTitle}%`]
    )

    if (articleResult.rows.length === 0) {
      console.log(chalk.red(`❌ No article found matching: "${searchTitle}"`))
      process.exit(1)
    }

    const article = articleResult.rows[0]

    console.log(chalk.blue('\n📰 Article:\n'))
    console.log(chalk.white(`  Title: ${article.title}`))
    console.log(chalk.gray(`  ID: ${article.id}`))
    console.log(chalk.gray(`  Source: ${article.source_type || 'unknown'}`))
    console.log(chalk.gray(`  Link: ${article.link}`))

    // Find question
    const questionResult = await pool.query(
      `SELECT q.id, q.question_text, q.blank_text, q.postscript
       FROM fake_facts_questions q
       WHERE q.article_id = $1`,
      [article.id]
    )

    if (questionResult.rows.length === 0) {
      console.log(chalk.yellow('\n⚠️  No question generated for this article yet'))
      process.exit(0)
    }

    const question = questionResult.rows[0]

    console.log(chalk.blue('\n❓ Question:\n'))
    console.log(chalk.white(`  ${question.question_text}`))
    console.log(chalk.green(`\n✓ Real Answer: ${question.blank_text}`))

    if (question.postscript) {
      console.log(chalk.gray(`\n  Postscript: ${question.postscript}`))
    }

    // Find answers
    const answersResult = await pool.query(
      `SELECT a.answer_text, a.is_real, a.answer_order
       FROM fake_facts_answers a
       WHERE a.question_id = $1
       ORDER BY a.is_real DESC, a.answer_order ASC`,
      [question.id]
    )

    if (answersResult.rows.length > 0) {
      console.log(chalk.blue('\n📝 All Answers:\n'))

      const realAnswers = answersResult.rows.filter(a => a.is_real)
      const houseAnswers = answersResult.rows.filter(a => !a.is_real)

      if (realAnswers.length > 0) {
        console.log(chalk.green('  Real answer:'))
        realAnswers.forEach(a => {
          console.log(chalk.green(`    • ${a.answer_text}`))
        })
      }

      if (houseAnswers.length > 0) {
        console.log(chalk.yellow('\n  House answers (fake):'))
        houseAnswers.forEach(a => {
          console.log(chalk.yellow(`    • ${a.answer_text}`))
        })
      }
    }

    console.log('')
  } catch (error) {
    console.error(chalk.red('Error:'), error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

showQuestion()
