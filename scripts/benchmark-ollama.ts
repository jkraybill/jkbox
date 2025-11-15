#!/usr/bin/env tsx

/**
 * Quick benchmark: Qwen2.5 vs Llama 3.2
 * Tests: Speed + Quality for creative generation with constraints
 */

interface BenchmarkResult {
  model: string
  avgTimeMs: number
  results: Array<{
    prompt: string
    response: string
    timeMs: number
  }>
}

const TEST_CASES = [
  {
    title: "Mississippi Woman Kills Escaped Animal",
    summary: "A mother in Mississippi shot and killed an escaped emu that she claimed was threatening her children in their backyard.",
    expectedBlank: "Should be open-ended (emu, animal, creature, etc.)"
  },
  {
    title: "Man Uses Vintage Lawnmower in Unusual Competition",
    summary: "A Kentucky man won first place at the state fair's racing competition using his grandfather's 1960s riding lawnmower.",
    expectedBlank: "Should be open-ended (lawnmower, vehicle, equipment, etc.)"
  },
  {
    title: "Local Library Bans Unusual Item",
    summary: "A public library in Oregon has banned visitors from bringing in durian fruit after multiple complaints about the smell.",
    expectedBlank: "Should be open-ended (durian, fruit, food item, etc.)"
  }
]

async function testModel(modelName: string): Promise<BenchmarkResult> {
  console.log(`\n🧪 Testing ${modelName}...`)

  const results: BenchmarkResult['results'] = []

  for (const testCase of TEST_CASES) {
    const prompt = `Create a trivia question from this article with one word blanked out.

Article: "${testCase.title}"
Summary: ${testCase.summary}

Requirements:
1. The blank should be MAXIMALLY OPEN-ENDED (could be person, place, thing, animal, concept)
2. Question should be fun and surprising
3. Return ONLY the question with _____ for the blank

Question:`

    const startTime = Date.now()

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 100
          }
        })
      })

      const data = await response.json()
      const timeMs = Date.now() - startTime

      if (!data.response) {
        console.error(`  ✗ No response field:`, data)
        continue
      }

      results.push({
        prompt: testCase.title,
        response: data.response.trim(),
        timeMs
      })

      console.log(`  ✓ "${testCase.title.substring(0, 40)}..." (${timeMs}ms)`)
    } catch (error) {
      console.error(`  ✗ Error:`, error)
    }
  }

  const avgTimeMs = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length

  return {
    model: modelName,
    avgTimeMs,
    results
  }
}

async function main() {
  console.log('🏁 Quick Ollama Benchmark: Qwen2.5 vs Llama 3.2')
  console.log('Testing: Creative generation with constraints\n')

  // Test both models
  const llamaResult = await testModel('llama3.2:latest')
  const qwenResult = await testModel('qwen2.5:14b')

  // Print results
  console.log('\n' + '='.repeat(80))
  console.log('📊 RESULTS')
  console.log('='.repeat(80))

  console.log(`\n⏱️  SPEED:`)
  console.log(`  Llama 3.2:  ${llamaResult.avgTimeMs.toFixed(0)}ms average`)
  console.log(`  Qwen 2.5:   ${qwenResult.avgTimeMs.toFixed(0)}ms average`)

  const speedWinner = llamaResult.avgTimeMs < qwenResult.avgTimeMs ? 'Llama 3.2' : 'Qwen 2.5'
  const speedDiff = Math.abs(llamaResult.avgTimeMs - qwenResult.avgTimeMs)
  const speedPercent = ((speedDiff / Math.max(llamaResult.avgTimeMs, qwenResult.avgTimeMs)) * 100).toFixed(0)
  console.log(`  Winner: ${speedWinner} (${speedPercent}% faster)`)

  console.log(`\n📝 QUALITY COMPARISON:`)

  for (let i = 0; i < TEST_CASES.length; i++) {
    console.log(`\n  Test ${i + 1}: "${TEST_CASES[i].title}"`)
    console.log(`    Llama: ${llamaResult.results[i]?.response || 'ERROR'}`)
    console.log(`    Qwen:  ${qwenResult.results[i]?.response || 'ERROR'}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('👀 Manual quality assessment needed - check which model:')
  console.log('  1. Creates more open-ended blanks')
  console.log('  2. Follows the "MAXIMALLY OPEN-ENDED" constraint better')
  console.log('  3. Produces more fun/surprising questions')
  console.log('='.repeat(80) + '\n')
}

main().catch(console.error)
