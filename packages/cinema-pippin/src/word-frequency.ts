import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * Word frequency map (lazy-loaded from wordlist.txt)
 * Maps UPPERCASE words to their frequency counts
 */
let wordFrequencyMap: Map<string, number> | null = null

/**
 * Path to the word frequency file (3M+ words, semicolon-delimited)
 * Use import.meta.url for ESM compatibility (vitest)
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WORDLIST_PATH = resolve(__dirname, '../../../assets/wordlist.txt')

/**
 * Lazy-load the word frequency map from wordlist.txt
 * Format: WORD;COUNT (one per line)
 *
 * Only loads once, subsequent calls use cached map
 */
function loadWordFrequencyMap(): Map<string, number> {
  if (wordFrequencyMap !== null) {
    return wordFrequencyMap
  }

  wordFrequencyMap = new Map<string, number>()

  try {
    const content = readFileSync(WORDLIST_PATH, 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue // Skip empty lines

      const [word, countStr] = trimmed.split(';')
      if (!word || !countStr) continue // Skip malformed lines

      const count = parseInt(countStr, 10)
      if (isNaN(count)) continue // Skip invalid counts

      // Store as uppercase for case-insensitive lookups
      wordFrequencyMap.set(word.toUpperCase(), count)
    }

    console.log(`✅ Loaded ${wordFrequencyMap.size} words from word frequency list`)
  } catch (error) {
    console.error(`⚠️  Failed to load word frequency list: ${error}`)
    // Return empty map on error (all scores will be 0)
  }

  return wordFrequencyMap
}

/**
 * Get frequency score for a word
 *
 * @param word - Word to score (case-insensitive)
 * @returns Frequency count from wordlist, or 0 if not found
 *
 * @example
 * await scoreWordByFrequency('the') // => 2287073
 * await scoreWordByFrequency('BANANA') // => 1234 (if in list)
 * await scoreWordByFrequency('xyznotreal') // => 0
 * await scoreWordByFrequency("you're") // => looks up "youre" (strips apostrophe)
 * await scoreWordByFrequency("won't") // => looks up "wont" (strips apostrophe)
 * await scoreWordByFrequency("kichi-san") // => looks up "kichisan" (strips hyphen)
 * await scoreWordByFrequency("42") // => 0 (no alphabetic characters)
 */
export async function scoreWordByFrequency(word: string): Promise<number> {
  if (!word || word.trim() === '') {
    return 0
  }

  const map = loadWordFrequencyMap()

  // Strip all non-alphabetic characters before lookup
  // This handles contractions (you're → youre), hyphens (kichi-san → kichisan), etc.
  const alphaOnly = word.replace(/[^a-zA-Z]/g, '')

  // If no alphabetic characters remain (e.g., pure numbers like "42"), return 0
  if (alphaOnly === '') {
    return 0
  }

  const normalized = alphaOnly.toUpperCase()

  return map.get(normalized) ?? 0
}

/**
 * Clear the cached word frequency map (for testing)
 * WARNING: Only use in tests - forces re-load on next scoreWordByFrequency call
 */
export function clearWordFrequencyCache(): void {
  wordFrequencyMap = null
}
