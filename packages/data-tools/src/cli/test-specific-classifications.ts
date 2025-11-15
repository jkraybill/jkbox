#!/usr/bin/env node
import 'dotenv/config'
import chalk from 'chalk'
import { LocalLLM } from '../llm/local-llm'
import type { LocalLLMConfig } from '../llm/types'
import { readFileSync } from 'fs'
import { join } from 'path'

async function main() {
  console.log(chalk.blue('🧪 Testing Specific Edge Cases\n'))

  // Load Ollama config
  const llmConfig: LocalLLMConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'config/llm.json'), 'utf-8')
  )

  const ollama = new LocalLLM(llmConfig)

  const testCases = [
    {
      title: "Woman accidentally goes on date with '97-year-old' man – and things go very wrong",
      description: "The 28-year-old thought she was going on a date with someone close to her age – but all was not what it seemed",
      expectedVerdict: false,
      reason: "Simple misunderstanding/mistake"
    },
    {
      title: "Amazon denies stories of workers peeing in bottles, receives a flood of evidence in return",
      description: "",
      expectedVerdict: false,
      reason: "Depressing corporate dystopia, not funny"
    }
  ]

  let correctCount = 0

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]

    console.log(chalk.blue(`\n[${i + 1}/${testCases.length}] ` + '='.repeat(70)))
    console.log(chalk.white(`Title: ${testCase.title}`))
    if (testCase.description) {
      console.log(chalk.gray(`Description: ${testCase.description}`))
    }
    console.log(chalk.yellow(`Expected: ${testCase.expectedVerdict ? 'WEIRD' : 'NOT WEIRD'} (${testCase.reason})`))

    try {
      const result = await ollama.classify(testCase.title, testCase.description)

      const isCorrect = result.isWeird === testCase.expectedVerdict
      const statusColor = isCorrect ? chalk.green : chalk.red
      const statusText = isCorrect ? '✓ CORRECT' : '✗ WRONG'

      console.log(statusColor(`\n→ ${statusText}`))
      console.log(chalk.white(`→ VERDICT: ${result.isWeird ? 'WEIRD' : 'NOT WEIRD'}`))
      console.log(chalk.yellow(`→ CONFIDENCE: ${result.confidence}%`))
      console.log(chalk.gray(`→ REASONING: ${result.reasoning}`))

      if (isCorrect) {
        correctCount++
      }
    } catch (error) {
      console.log(chalk.red(`\n→ ERROR: ${error}`))
    }
  }

  console.log(chalk.blue('\n\n' + '='.repeat(70)))
  console.log(chalk.blue('📊 RESULTS:\n'))
  console.log(chalk.white(`  Correct: ${correctCount}/${testCases.length}`))

  if (correctCount === testCases.length) {
    console.log(chalk.green('\n  ✓ All edge cases handled correctly!'))
  } else {
    console.log(chalk.yellow(`\n  ⚠ ${testCases.length - correctCount} edge case(s) still misclassified`))
  }

  console.log(chalk.blue('='.repeat(70) + '\n'))
}

main().catch(console.error)
