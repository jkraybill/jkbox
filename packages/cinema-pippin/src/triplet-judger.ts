/**
 * Triplet Judger - Reduce 18 triplets down to 6 best using Ollama/Qwen
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename, dirname, join } from 'path';
import {
  extractLastWordFromText,
  replaceKeywordWithBlank,
  replaceKeywordWithWord,
  replaceKeywordWithBrackets,
  applyCasing
} from './keyword-utils.js';
import { extractVideosForSequence, extractTimestampRange, rebaseSrtTimestamps } from './video-extractor.js';
import { replaceBlankedText, condenseAndBlank } from './blanking-utils.js';

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen-fast'; // Optimized qwen2.5:14b (num_ctx=2048, num_batch=512) - ~40% faster
const CONSTRAINTS_FILE = '/home/jk/jkbox/assets/constraints.txt';
const MAX_RETRIES = 4; // Max 4 retries = 5 total attempts

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface TripletJudgment {
  tripletFile: string;
  tripletNumber: number;
  keyword: string;
  firstScene: string;
  blankedScene: string;
  generatedWords: string[];
  shuffledWords: string[];
  bestWord: string;
  bestWordIndex: number;
  top3Words: string[]; // Top 3 alternatives [best, 2nd, 3rd]
  // T2 (second scene) results
  secondScene: string;
  secondSceneWithWord: string;
  generatedPhrases: string[];
  shuffledPhrases: string[];
  bestPhrase: string;
  bestPhraseIndex: number;
  top3Phrases: string[]; // Top 3 alternatives [best, 2nd, 3rd]
  // T3 (third scene) - phrase generation and judging
  thirdScene: string;
  thirdSceneWithWord: string;
  generatedPhrasesT3: string[];
  shuffledPhrasesT3: string[];
  bestPhraseT3: string;
  bestPhraseIndexT3: number;
  top3PhrasesT3: string[]; // Top 3 alternatives [best, 2nd, 3rd]
  // Final quality judging
  qualityAnswers: [string, boolean][];
  qualityScore: number;
  // Complete scenes with winners for final output
  finalScene1: string;
  finalScene2: string;
  finalScene3: string;
}

/**
 * Retry wrapper for async operations
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`\n⚠️  Retry attempt ${attempt}/${maxRetries} for ${operationName}...\n`);
      }
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.error(`❌ ${operationName} failed: ${lastError.message}`);
        console.log(`   Will retry (${attempt + 1}/${maxRetries})...\n`);
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `${operationName} failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Load constraints from file
 */
function loadConstraints(): string[] {
  const content = readFileSync(CONSTRAINTS_FILE, 'utf-8');
  return content.split('\n').filter((line) => line.trim().length > 0);
}

/**
 * Randomly select N items from array
 */
function randomSample<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Shuffle array in place
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Parse version numbers from Ollama response with fallback handling
 * Primary: Match exactly 3 numbers in range 1-6
 * Fallback: Extract all numbers, filter to 1-6, pad/fix if needed
 * @returns Array of 3 0-based indices [best, 2nd, 3rd]
 */
function parseVersionNumbers(response: string): number[] {
  // Primary: Try exact match for 3 numbers in range 1-6
  const exactMatch = response.match(/\b([1-6])\s+([1-6])\s+([1-6])\b/);
  if (exactMatch) {
    return [
      parseInt(exactMatch[1], 10) - 1,
      parseInt(exactMatch[2], 10) - 1,
      parseInt(exactMatch[3], 10) - 1
    ];
  }

  // Fallback: Extract ALL numbers, filter to valid range, attempt recovery
  console.log(`⚠️  Primary parsing failed, attempting fallback recovery...`);

  const allNumbers = response.match(/\b\d+\b/g);
  if (!allNumbers) {
    throw new Error(`Could not extract any numbers from response: ${response}`);
  }

  // Convert to integers and filter to valid range (1-6)
  const validNumbers = allNumbers
    .map(n => parseInt(n, 10))
    .filter(n => n >= 1 && n <= 6);

  console.log(`   Found numbers: ${allNumbers.join(', ')} → Valid: ${validNumbers.join(', ')}`);

  if (validNumbers.length === 0) {
    throw new Error(`No valid version numbers (1-6) found in response: ${response}`);
  }

  // If we have at least 3 valid numbers, use first 3
  if (validNumbers.length >= 3) {
    const recovered = validNumbers.slice(0, 3);
    console.log(`   ✓ Recovered 3 valid numbers: ${recovered.join(' ')}`);
    return recovered.map(n => n - 1); // Convert to 0-based
  }

  // If we have 1-2 valid numbers, pad with random valid numbers (not already used)
  const used = new Set(validNumbers);
  const available = [1, 2, 3, 4, 5, 6].filter(n => !used.has(n));

  while (validNumbers.length < 3 && available.length > 0) {
    const randomIdx = Math.floor(Math.random() * available.length);
    const randomNum = available.splice(randomIdx, 1)[0];
    validNumbers.push(randomNum);
  }

  if (validNumbers.length === 3) {
    console.log(`   ✓ Padded to 3 numbers: ${validNumbers.join(' ')}`);
    return validNumbers.map(n => n - 1); // Convert to 0-based
  }

  throw new Error(`Could not recover 3 valid version numbers from response: ${response}`);
}

/**
 * Generate random word count using Gaussian distribution
 * median=6, sdev=2, min=1, max=12
 */
function generateWordCount(): number {
  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Transform to our distribution (median=6, sdev=2)
  const value = Math.round(6 + z0 * 2);

  // Clamp to [1, 12]
  return Math.max(1, Math.min(12, value));
}

/**
 * Call Ollama API with streaming and accumulate full response
 */
async function callOllama(
  prompt: string,
  temperature = 0.7,
  system?: string
): Promise<string> {
  const requestBody: any = {
    model: MODEL,
    prompt,
    temperature,
    stream: true,
  };

  if (system) {
    requestBody.system = system;
  }

  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body from Ollama');
  }

  // Accumulate the full response from streaming
  let fullResponse = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const json = JSON.parse(line) as OllamaResponse;
        fullResponse += json.response;
      } catch (e) {
        // Ignore JSON parse errors for incomplete chunks
      }
    }
  }

  return fullResponse.trim();
}

/**
 * Parse first scene from triplet file (delimited by \n---\n)
 * HTML tags already stripped during triplet extraction
 */
function parseFirstScene(tripletFilePath: string): string {
  const content = readFileSync(tripletFilePath, 'utf-8');
  const scenes = content.split(/\n---\n/);
  if (scenes.length < 1) {
    throw new Error(`No scenes found in ${tripletFilePath}`);
  }
  return scenes[0].trim();
}

/**
 * Parse second scene from triplet file (delimited by \n---\n)
 * HTML tags already stripped during triplet extraction
 */
function parseSecondScene(tripletFilePath: string): string {
  const content = readFileSync(tripletFilePath, 'utf-8');
  const scenes = content.split(/\n---\n/);
  if (scenes.length < 2) {
    throw new Error(`Second scene not found in ${tripletFilePath}`);
  }
  return scenes[1].trim();
}

/**
 * Parse third scene from triplet file (delimited by \n---\n)
 * HTML tags already stripped during triplet extraction
 */
function parseThirdScene(tripletFilePath: string): string {
  const content = readFileSync(tripletFilePath, 'utf-8');
  const scenes = content.split(/\n---\n/);
  if (scenes.length < 3) {
    throw new Error(`Third scene not found in ${tripletFilePath}`);
  }
  return scenes[2].trim();
}

/**
 * Extract keyword from first scene (last word of last frame's text)
 */
function extractKeywordFromScene(scene: string): string {
  // Split scene into frames (separated by blank lines)
  const frames = scene.split(/\n\n+/);
  if (frames.length === 0) {
    throw new Error('No frames found in scene');
  }

  // Get last frame
  const lastFrame = frames[frames.length - 1];
  const lines = lastFrame.split('\n');

  // Text starts after index (line 0) and timestamp (line 1)
  const textLines = lines.slice(2);
  const fullText = textLines.join(' ');

  return extractLastWordFromText(fullText);
}

/**
 * Generate 5 funny replacement words for the blank (internal implementation)
 */
async function generateReplacementWordsInternal(
  blankedScene: string,
  constraints: string[],
  tripletNumber?: number,
  totalTriplets?: number
): Promise<string[]> {
  const constraintsList = constraints
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  const system = `You are a PROFESSIONAL COMEDY WRITER for an adults-only party game called "Cinema Pippin". Your specialty is generating HILARIOUS, ABSURD, and CLEVER one-word punchlines that maximize humor through unexpected juxtapositions, shock value, and perfect contextual fit. You excel at dark humor, sexual innuendo, and toilet humor while respecting creative constraints.`;

  const prompt = `Generate 6 HILARIOUS one-word replacements for a blank in this film scene.

🚨 CRITICAL: DO NOT REORDER OR MODIFY CONSTRAINT NAMES! 🚨
The #1 failure mode is putting constraints in the wrong array position.
Your response WILL BE REJECTED if array positions don't match constraint numbers.

🎯 CRITICAL RULES - FOLLOW EXACTLY:
• Generate EXACTLY 6 words in a JSON array
• Array position MUST match constraint number:
  - Array[0] = word for constraint 1 (FIRST constraint below)
  - Array[1] = word for constraint 2 (SECOND constraint below)
  - Array[2] = word for constraint 3 (THIRD constraint below)
  - Array[3] = word for constraint 4 (FOURTH constraint below)
  - Array[4] = word for constraint 5 (FIFTH constraint below)
  - Array[5] = word for constraint 6 (SIXTH constraint below)
• COPY the constraint name EXACTLY as written - DO NOT modify, paraphrase, or reorder
• EACH word satisfies ONLY its ONE assigned constraint
• Words must be SINGLE WORDS (no phrases, no hyphens unless part of one word)
• Maximize ABSURDITY, SURPRISE, and HUMOR in context
• This is an ADULTS-ONLY game - dark humor, sexual innuendo, toilet humor all ENCOURAGED

📝 STEP-BY-STEP PROCESS (follow this order):
1. Read the 6 constraints below (numbered 1-6)
2. For constraint #1: Generate a funny word, create couplet [constraint_1_text, word_1]
3. For constraint #2: Generate a funny word, create couplet [constraint_2_text, word_2]
4. For constraint #3: Generate a funny word, create couplet [constraint_3_text, word_3]
5. For constraint #4: Generate a funny word, create couplet [constraint_4_text, word_4]
6. For constraint #5: Generate a funny word, create couplet [constraint_5_text, word_5]
7. For constraint #6: Generate a funny word, create couplet [constraint_6_text, word_6]
8. Return array: [couplet_1, couplet_2, couplet_3, couplet_4, couplet_5, couplet_6]

📝 WORD FORMAT RULES (CRITICAL):

🚨 SINGLE WORD ONLY - NO PUNCTUATION - NO SPACES!
• Your response must be EXACTLY ONE WORD with NO SPACES
• DO NOT include ANY punctuation (no periods, exclamation marks, question marks, etc.)
• DO NOT use multiple words or phrases - SINGLE WORD ONLY
• Examples of CORRECT format: "McDonald" or "Hell" or "boobies"
• Examples of WRONG format: "McDonald's!" (has punctuation), "New York" (has space), "oh boy" (multiple words)

📝 CASING RULES (follow proper English capitalization):
⚠️ IMPORTANT: Check the PREVIOUS SRT FRAME (the frame BEFORE the blank) for punctuation!
• If the previous frame ends with punctuation (. ! ? , ;) → CAPITALIZE first letter of your word
• If it's a proper noun (names, places) → ALWAYS capitalize appropriately
• If continuing a sentence mid-flow with NO punctuation → use lowercase (unless proper noun)

Examples:
  - Previous frame: "He went to the store." → Blank frame: "_____ was closed" → Answer: "McDonald" or "Hell" (CAPITALIZE - previous frame ended with .)
  - Previous frame: "Whose roar was that?" → Blank frame: "_____" → Answer: "Godzilla" or "America" (CAPITALIZE - previous frame ended with ?)
  - Same frame: "What the _____!" → "fuck" (mid-sentence within same frame, lowercase)
  - Same frame: "I love _____" → "tacos" or "Jesus" (continuation within same frame: lowercase unless proper)

🚨 REMEMBER: The punctuation is already in the film scene! You only provide the WORD!

📋 YOUR 6 CONSTRAINTS (one per word, IN ORDER):
${constraintsList}

🎬 FILM SCENE WITH BLANK:
${blankedScene}

💡 TIPS FOR MAX HUMOR:
- Choose words that create absurd/unexpected juxtapositions
- Context matters - how does the word land in THIS scene?
- Shock value + cleverness = gold
- If multiple words fit a constraint, pick the FUNNIEST one

❌ WRONG EXAMPLE #1 (reordered constraints):
Given constraints:
1. The letter 'S' -- this punchline must begin with the letter 'S'.
2. Foodie -- this punchline should be food-related.
3. Geographical -- this punchline should be geography-related.

BAD Output: [["Foodie -- this punchline should be food-related.", "ravioli"], ["The letter 'S' -- this punchline must begin with the letter 'S'.", "sexomophone"], ["Geographical -- this punchline should be geography-related.", "France"]]
← WRONG! Array[0] has constraint #2 instead of constraint #1. Constraints are SWAPPED!

❌ WRONG EXAMPLE #2 (made up different constraint names):
Given constraints:
1. The letter 'S' -- this punchline must begin with the letter 'S'.
2. Quotes -- this punchline should reference famous quotes.
3. Geographical -- this punchline should be geography-related.

BAD Output: [["The letter 'S' -- this punchline must begin with the letter 'S'.", "sexomophone"], ["Foodie -- this punchline should be food-related.", "ravioli"], ["Pop culture -- this punchline should reference movies.", "Yoda"]]
← WRONG! Array[1] has "Foodie" but constraint #2 was "Quotes". Array[2] has "Pop culture" but constraint #3 was "Geographical". You CANNOT make up your own constraints!

✅ CORRECT EXAMPLE:
Given constraints:
1. The letter 'S' -- this punchline must begin with the letter 'S'.
2. Foodie -- this punchline should be food-related.
3. Geographical -- this punchline should be geography-related.

GOOD Output: [["The letter 'S' -- this punchline must begin with the letter 'S'.", "sexomophone"], ["Foodie -- this punchline should be food-related.", "ravioli"], ["Geographical -- this punchline should be geography-related.", "France"]]
← RIGHT! Array[0]=constraint #1, Array[1]=constraint #2, Array[2]=constraint #3. Constraint names copied EXACTLY. Words are SINGLE WORDS with NO PUNCTUATION!

⚠️ OUTPUT FORMAT:
Respond with ONLY a valid JSON array of 6 couplets (constraint-word pairs).
Each couplet is [constraint_text, word] where constraint_text is EXACTLY copied from above.

Format:
[["constraint 1 full text here", "word1"], ["constraint 2 full text here", "word2"], ["constraint 3 full text here", "word3"], ["constraint 4 full text here", "word4"], ["constraint 5 full text here", "word5"], ["constraint 6 full text here", "word6"]]

No explanations, no other text. Just the JSON array of couplets.`;

  console.log('\n================================================================================');
  console.log('🎬 PROMPT 1: GENERATE REPLACEMENT WORDS');
  console.log('================================================================================');
  console.log('Model:', MODEL);
  console.log('Temperature: 0.95');
  console.log('\nSystem:');
  console.log(system);
  console.log('\nPrompt:');
  console.log(prompt);
  console.log('================================================================================');

  if (tripletNumber !== undefined && totalTriplets !== undefined) {
    console.log(`\n⏳ Submitting T1 word generation prompt for triplet ${tripletNumber} of ${totalTriplets}...`);
  }

  const response = await callOllama(prompt, 0.95, system);

  console.log('================================================================================');
  console.log('📥 OLLAMA RESPONSE (PROMPT 1)');
  console.log('================================================================================');
  console.log(response);
  console.log('================================================================================\n');

  // Extract JSON array from response
  const jsonMatch = response.match(/\[.*\]/s);
  if (!jsonMatch) {
    throw new Error(`Could not extract JSON array from response: ${response}`);
  }

  let jsonStr = jsonMatch[0];

  // Fix common JSON issues from LLM responses
  // Note: Constraints now use single quotes (e.g., "The letter 'E'") which don't need escaping in JSON
  // However, if LLM mistakenly uses double quotes, we still need to fix them

  // Fix patterns where LLM might use double quotes instead of single quotes
  // Pattern: "The letter "X" --" should be "The letter 'X' --" (but if it uses ", escape it)
  jsonStr = jsonStr.replace(/(letter\s+)"([A-Za-z0-9])"(\s+--)/gi, '$1\\"$2\\"$3');
  jsonStr = jsonStr.replace(/(letter\s+)"([A-Za-z0-9])"(\s*\.)/gi, '$1\\"$2\\"$3');
  jsonStr = jsonStr.replace(/(letter\s+)"([A-Za-z0-9])"/gi, '$1\\"$2\\"');

  // Fix LLM using single quotes for array elements instead of double quotes (invalid JSON)
  // JSON standard requires double quotes only
  // Pattern: ['text with \'apostrophe\'', "other"] should be ["text with 'apostrophe'", "other"]
  // Must properly handle:
  //   - Escaped single quotes (\') -> unescaped (')
  //   - Unescaped double quotes (") -> escaped (\")
  //   - Already-escaped sequences (\\", \\', \\\\, etc.) -> preserve
  jsonStr = jsonStr.replace(/([,\[])\s*'((?:[^'\\]|\\.)*)'/g, (match, prefix, content) => {
    // Step 1: Unescape escaped single quotes \' -> ' (since we're using double quotes now)
    let fixed = content.replace(/\\'/g, "'");

    // Step 2: Escape unescaped double quotes " -> \"
    // Replace all ", but then un-replace already-escaped ones \\"
    fixed = fixed.replace(/"/g, '\\"').replace(/\\\\"/g, '\\"');

    return `${prefix}"${fixed}"`;
  });

  // Fix incomplete couplets (arrays with only 1 element) by adding empty string as second element
  // This allows JSON to parse, then validation will catch and report the error clearly
  // Pattern: ["constraint text only"] -> ["constraint text only", ""]
  // Use lookahead to match closing bracket without consuming following comma or bracket
  jsonStr = jsonStr.replace(/\[("[^"]*")\](?=\s*[,\]])/g, '[$1, ""]');

  // Parse couplets
  let couplets: [string, string][];
  try {
    couplets = JSON.parse(jsonStr) as [string, string][];
  } catch (parseError) {
    throw new Error(`Could not parse JSON from response: ${response}\nJSON string after fixes: ${jsonStr}\nParse error: ${parseError}`);
  }

  // Validate we got 6 couplets
  if (!Array.isArray(couplets) || couplets.length !== 6) {
    throw new Error(
      `Expected 6 constraint-word couplets, got ${couplets?.length ?? 'invalid'}.\n` +
      `Response: ${JSON.stringify(couplets)}`
    );
  }

  // Validate each couplet and extract words
  const words: string[] = [];
  for (let i = 0; i < 5; i++) {
    const couplet = couplets[i];

    if (!Array.isArray(couplet) || couplet.length !== 2) {
      throw new Error(
        `Couplet ${i + 1} is not a 2-item array.\n` +
        `Expected: [constraint_text, word]\n` +
        `Got: ${JSON.stringify(couplet)}\n` +
        `Full response: ${JSON.stringify(couplets)}`
      );
    }

    const [returnedConstraint, word] = couplet;
    const expectedConstraint = constraints[i];

    // For T1, validate just the constraint name (not the full description)
    // LLMs often truncate/omit the long constraint descriptions
    // Extract just the constraint name before " -- " (e.g., "Political" from "Political -- this punchline should...")
    const expectedPrefix = expectedConstraint.split(' -- ')[0];  // e.g., "Political"
    const returnedPrefix = returnedConstraint.split(' -- ')[0];  // What LLM returned

    // Check if the returned prefix matches the expected prefix (case-insensitive)
    if (returnedPrefix.trim().toLowerCase() !== expectedPrefix.trim().toLowerCase() &&
        !returnedPrefix.trim().toLowerCase().startsWith(expectedPrefix.trim().toLowerCase())) {
      throw new Error(
        `❌ CONSTRAINT MISMATCH at position ${i + 1}!\n\n` +
        `Expected constraint name:\n"${expectedPrefix}"\n\n` +
        `Got:\n"${returnedPrefix}"\n\n` +
        `This means the LLM either:\n` +
        `1. Swapped constraint order (put constraint ${i + 1} in wrong position)\n` +
        `2. Modified the constraint name instead of copying exactly\n` +
        `3. Misunderstood the couplet format\n\n` +
        `Full response:\n${JSON.stringify(couplets, null, 2)}\n\n` +
        `Expected constraints order:\n${constraints.map((c, idx) => `${idx + 1}. ${c}`).join('\n')}`
      );
    }

    // Strip any punctuation and spaces from the word (user should only submit a single word)
    // Remove all non-alphanumeric characters except hyphens (for compound words like "self-aware")
    let cleanedWord = word.replace(/[^a-zA-Z0-9-]/g, '').trim();

    // If word still contains multiple parts (shouldn't happen, but belt-and-suspenders),
    // take the first word only
    if (cleanedWord.includes(' ')) {
      cleanedWord = cleanedWord.split(/\s+/)[0];
    }

    words.push(cleanedWord);
  }

  console.log(`✅ Constraint validation passed - all 5 constraints matched exactly!`);
  console.log(`🧹 Words after stripping punctuation: ${JSON.stringify(words)}`);
  return words;
}

/**
 * Generate 5 funny replacement words for the blank
 * Uses high temperature (0.95) for maximum creativity while respecting constraints
 * Retries up to 2 times on failure
 */
async function generateReplacementWords(
  blankedScene: string,
  constraints: string[],
  tripletNumber?: number,
  totalTriplets?: number
): Promise<string[]> {
  return withRetry(
    () => generateReplacementWordsInternal(blankedScene, constraints, tripletNumber, totalTriplets),
    'Generate replacement words'
  );
}

/**
 * Generate 5 funny replacement phrases for T2 blank (internal implementation)
 */
async function generateReplacementPhrasesInternal(
  blankedScene: string,
  constraints: string[],
  stage: 'T2' | 'T3',
  tripletNumber?: number,
  totalTriplets?: number
): Promise<string[]> {
  // Generate random word counts for each constraint (Gaussian: median=6, sdev=2, min=1, max=12)
  const wordCounts = [
    generateWordCount(),
    generateWordCount(),
    generateWordCount(),
    generateWordCount(),
    generateWordCount(),
  ];

  // Add word counts to constraints
  const constraintsWithWordCount = constraints.map(
    (c, i) => `${c.split(' -- ')[0]} (${wordCounts[i]} words) -- ${c.split(' -- ')[1]}`
  );

  const constraintsList = constraintsWithWordCount
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  const system = `You are a PROFESSIONAL COMEDY WRITER for an adults-only party game called "Cinema Pippin". Your specialty is generating HILARIOUS, ABSURD, and CLEVER multi-word punchlines and phrases that maximize humor through unexpected juxtapositions, shock value, and perfect contextual fit. You excel at dark humor, sexual innuendo, and toilet humor while respecting creative constraints.`;

  const prompt = `Generate 6 HILARIOUS phrase/sentence replacements for a blank in this film scene.

🚨 CRITICAL: DO NOT REORDER OR MODIFY CONSTRAINT NAMES! 🚨
The #1 failure mode is putting constraints in the wrong array position.
Your response WILL BE REJECTED if array positions don't match constraint numbers.

🎯 CRITICAL RULES - FOLLOW EXACTLY:
• Generate EXACTLY 6 phrases/sentences in a JSON array
• Array position MUST match constraint number:
  - Array[0] = phrase for constraint 1 (FIRST constraint below)
  - Array[1] = phrase for constraint 2 (SECOND constraint below)
  - Array[2] = phrase for constraint 3 (THIRD constraint below)
  - Array[3] = phrase for constraint 4 (FOURTH constraint below)
  - Array[4] = phrase for constraint 5 (FIFTH constraint below)
  - Array[5] = phrase for constraint 6 (SIXTH constraint below)
• COPY the constraint name EXACTLY as written - DO NOT modify, paraphrase, or reorder
• EACH phrase satisfies ONLY its ONE assigned constraint
• Phrases can be MULTIPLE WORDS - aim for the target word count but ±1-2 words is OK
• Maximize ABSURDITY, SURPRISE, and HUMOR in context
• This is an ADULTS-ONLY game - dark humor, sexual innuendo, toilet humor all ENCOURAGED

📝 STEP-BY-STEP PROCESS (follow this order):
1. Read the 6 constraints below (numbered 1-6)
2. For constraint #1: Generate a funny phrase, create couplet [constraint_1_text, phrase_1]
3. For constraint #2: Generate a funny phrase, create couplet [constraint_2_text, phrase_2]
4. For constraint #3: Generate a funny phrase, create couplet [constraint_3_text, phrase_3]
5. For constraint #4: Generate a funny phrase, create couplet [constraint_4_text, phrase_4]
6. For constraint #5: Generate a funny phrase, create couplet [constraint_5_text, phrase_5]
7. For constraint #6: Generate a funny phrase, create couplet [constraint_6_text, phrase_6]
8. Return array: [couplet_1, couplet_2, couplet_3, couplet_4, couplet_5, couplet_6]

📝 CASING & PUNCTUATION RULES:

⚠️ IMPORTANT: Check the PREVIOUS SRT FRAME (the frame BEFORE the blank) for punctuation!
• If the previous frame ends with punctuation (. ! ? , ;) → CAPITALIZE first word of your phrase
• If it's a proper noun (names, places) → ALWAYS capitalize appropriately
• If continuing a sentence mid-flow with NO punctuation → use lowercase (unless proper noun)
• Phrases can include punctuation if it enhances the humor

🚨 CRITICAL PUNCTUATION RULE: Your phrase MUST end with one of these punctuation marks: . ? ! ]
• EVERY phrase must end with . or ? or ! or ]
• No exceptions - if your phrase doesn't end with punctuation, ADD IT!

Examples:
  - Previous frame: "He went to the store." → Blank frame: "_____" → Answer: "But it was closed." or "Hell awaited him!" (CAPITALIZE - previous frame ended with .)
  - Previous frame: "Whose roar was that?" → Blank frame: "_____" → Answer: "Godzilla's angry cousin!" or "America screaming?" (CAPITALIZE - previous frame ended with ?)
  - Same frame: "I found it over there. _____" → "but it was broken." (lowercase - continuing within same context)
  - Answer examples with punctuation: "What the hell?", "That's hilarious!", "Never seen that before.", "[dramatic pause]"

🚨 CRITICAL: Look at the ENTIRE film scene context - if the blank is in a NEW FRAME and the PREVIOUS FRAME ended with punctuation, you MUST capitalize the first word!

📋 YOUR 6 CONSTRAINTS (one per phrase, IN ORDER, with target word counts):
${constraintsList}

🎬 FILM SCENE WITH BLANK:
${blankedScene}

💡 TIPS FOR MAX HUMOR:
- **CLEVER TWIST > CRUDE SHOCK:** "May the Force be with you... and in you" beats "just fucking"
- **ABSURD JUXTAPOSITION:** Mix serious + silly, formal + crude, mundane + extreme
- **CONTEXT FIT MATTERS:** Phrase must land in THIS scene, not generic shock
- **AVOID:** Pure sound effects ("Vroom vroom"), preachy lectures, lazy obscenity
- **PRIORITIZE:** Surprise + wordplay + unexpected callbacks to pop culture
- Word count is flexible - prioritize HUMOR over exact count
- Think phrases/sentences, NOT single words!

❌ WRONG EXAMPLE #1 (reordered constraints):
Given constraints:
1. Suggestive (3 words) -- this punchline should maximize humorous adult innuendo...
2. Foodie (5 words) -- this punchline should be food-related.
3. Geographical (4 words) -- this punchline should be geography-related.

BAD Output: [["Foodie (5 words) -- this punchline should be food-related.", "eating spaghetti."], ["Suggestive (3 words) -- this punchline should maximize humorous adult innuendo...", "very sexual!"], ["Geographical (4 words) -- this punchline should be geography-related.", "in rural France."]]
← WRONG! Array[0] has constraint #2 instead of constraint #1. Constraints are SWAPPED!

❌ WRONG EXAMPLE #2 (made up different constraint names):
Given constraints:
1. Suggestive (3 words) -- this punchline should maximize humorous adult innuendo...
2. Quotes (5 words) -- this punchline should reference famous quotes...
3. Geographical (4 words) -- this punchline should be geography-related.

BAD Output: [["Suggestive (3 words) -- this punchline should maximize humorous adult innuendo...", "very sexual!"], ["Foodie (5 words) -- this punchline should be food-related.", "eating spaghetti."], ["Pop culture (4 words) -- this punchline should reference movies...", "May the Force!"]]
← WRONG! Array[1] has "Foodie" but constraint #2 was "Quotes". Array[2] has "Pop culture" but constraint #3 was "Geographical". You CANNOT make up your own constraints!

✅ CORRECT EXAMPLE:
Given constraints:
1. Suggestive (3 words) -- this punchline should maximize humorous adult innuendo...
2. Foodie (5 words) -- this punchline should be food-related.
3. Geographical (4 words) -- this punchline should be geography-related.

GOOD Output: [["Suggestive (3 words) -- this punchline should maximize humorous adult innuendo...", "very sexually charged!"], ["Foodie (5 words) -- this punchline should be food-related.", "eating spaghetti with meatballs."], ["Geographical (4 words) -- this punchline should be geography-related.", "somewhere in rural France."]]
← RIGHT! Array[0]=constraint #1, Array[1]=constraint #2, Array[2]=constraint #3. Constraint names copied EXACTLY. Phrases end with punctuation!

⚠️ OUTPUT FORMAT:
Respond with ONLY a valid JSON array of 6 couplets (constraint-phrase pairs).
Each couplet is [constraint_text, phrase] where constraint_text is EXACTLY copied from above.

Format:
[["constraint 1 full text here", "phrase 1"], ["constraint 2 full text here", "phrase 2"], ["constraint 3 full text here", "phrase 3"], ["constraint 4 full text here", "phrase 4"], ["constraint 5 full text here", "phrase 5"], ["constraint 6 full text here", "phrase 6"]]

No explanations, no other text. Just the JSON array of couplets.`;

  console.log('\n================================================================================');
  console.log(`🎬 PROMPT 1 (${stage}): GENERATE REPLACEMENT PHRASES`);
  console.log('================================================================================');
  console.log('Model:', MODEL);
  console.log('Temperature: 0.95');
  console.log('\nSystem:');
  console.log(system);
  console.log('\nPrompt:');
  console.log(prompt);
  console.log('================================================================================');

  if (tripletNumber !== undefined && totalTriplets !== undefined) {
    console.log(`\n⏳ Submitting ${stage} phrase generation prompt for triplet ${tripletNumber} of ${totalTriplets}...`);
  }

  const response = await callOllama(prompt, 0.95, system);

  console.log('================================================================================');
  console.log(`📥 OLLAMA RESPONSE (PROMPT 1 ${stage})`);
  console.log('================================================================================');
  console.log(response);
  console.log('================================================================================\n');

  // Extract JSON array from response
  const jsonMatch = response.match(/\[.*\]/s);
  if (!jsonMatch) {
    throw new Error(`Could not extract JSON array from response: ${response}`);
  }

  let jsonStr = jsonMatch[0];

  // Fix common JSON issues (same as T1)
  jsonStr = jsonStr.replace(/(letter\s+)"([A-Za-z0-9])"(\s+--)/gi, '$1\\"$2\\"$3');
  jsonStr = jsonStr.replace(/(letter\s+)"([A-Za-z0-9])"(\s*\.)/gi, '$1\\"$2\\"$3');
  jsonStr = jsonStr.replace(/(letter\s+)"([A-Za-z0-9])"/gi, '$1\\"$2\\"');

  // Fix LLM using single quotes for array elements instead of double quotes (invalid JSON)
  // JSON standard requires double quotes only
  // Pattern: ['text with \'apostrophe\'', "other"] should be ["text with 'apostrophe'", "other"]
  // Must properly handle:
  //   - Escaped single quotes (\') -> unescaped (')
  //   - Unescaped double quotes (") -> escaped (\")
  jsonStr = jsonStr.replace(/([,\[])\s*'((?:[^'\\]|\\.)*)'/g, (match, prefix, content) => {
    // Step 1: Unescape escaped single quotes \' -> ' (since we're using double quotes now)
    let fixed = content.replace(/\\'/g, "'");

    // Step 2: Escape unescaped double quotes " -> \"
    // Replace all ", but then un-replace already-escaped ones \\"
    fixed = fixed.replace(/"/g, '\\"').replace(/\\\\"/g, '\\"');

    return `${prefix}"${fixed}"`;
  });

  // Fix incomplete couplets (arrays with only 1 element) by adding empty string as second element
  jsonStr = jsonStr.replace(/\[("[^"]*")\](?=\s*[,\]])/g, '[$1, ""]');

  // Parse couplets
  let couplets: [string, string][];
  try {
    couplets = JSON.parse(jsonStr) as [string, string][];
  } catch (parseError) {
    throw new Error(`Could not parse JSON from response: ${response}\nJSON string after fixes: ${jsonStr}\nParse error: ${parseError}`);
  }

  // Validate we got 6 couplets
  if (!Array.isArray(couplets) || couplets.length !== 6) {
    throw new Error(
      `Expected 6 constraint-phrase couplets, got ${couplets?.length ?? 'invalid'}.\n` +
      `Response: ${JSON.stringify(couplets)}`
    );
  }

  // Validate each couplet and extract phrases
  const phrases: string[] = [];
  for (let i = 0; i < 5; i++) {
    const couplet = couplets[i];

    if (!Array.isArray(couplet) || couplet.length !== 2) {
      throw new Error(
        `Couplet ${i + 1} is not a 2-item array.\n` +
        `Expected: [constraint_text, phrase]\n` +
        `Got: ${JSON.stringify(couplet)}\n` +
        `Full response: ${JSON.stringify(couplets)}`
      );
    }

    const [returnedConstraint, phrase] = couplet;
    const expectedConstraint = constraintsWithWordCount[i];

    // For T2, validate just the constraint name + word count (not the full description)
    // LLMs often truncate/omit the long constraint descriptions
    // Extract just "Constraint Name (N words)" without the " -- description" part
    const expectedPrefix = expectedConstraint.split(' -- ')[0];  // e.g., "The letter 'R' (5 words)"
    const returnedPrefix = returnedConstraint.split(' -- ')[0];  // What LLM returned

    // Normalize both for comparison: strip surrounding quotes, unescape internal quotes
    const normalizeConstraint = (str: string) => {
      return str.trim()
        .replace(/^["']|["']$/g, '')  // Strip surrounding quotes
        .replace(/\\"/g, '"')         // Unescape internal quotes
        .replace(/\s+/g, ' ')         // Normalize whitespace
        .toLowerCase();
    };

    const expectedNorm = normalizeConstraint(expectedPrefix);
    const returnedNorm = normalizeConstraint(returnedPrefix);

    // Check if the returned prefix matches the expected prefix (normalized)
    // Be lenient - just check that it starts with or equals the expected prefix
    if (returnedNorm !== expectedNorm && !returnedNorm.startsWith(expectedNorm)) {
      throw new Error(
        `❌ CONSTRAINT MISMATCH at position ${i + 1}!\n\n` +
        `Expected constraint name:\n"${expectedPrefix}"\n\n` +
        `Got:\n"${returnedPrefix}"\n\n` +
        `This means the LLM either:\n` +
        `1. Swapped constraint order (put constraint ${i + 1} in wrong position)\n` +
        `2. Modified the constraint name/word count\n` +
        `3. Misunderstood the couplet format\n\n` +
        `Full response:\n${JSON.stringify(couplets, null, 2)}\n\n` +
        `Expected constraints order:\n${constraintsWithWordCount.map((c, idx) => `${idx + 1}. ${c.split(' -- ')[0]}`).join('\n')}`
      );
    }

    phrases.push(phrase);
  }

  console.log(`✅ Constraint validation passed - all 5 constraints matched exactly!`);
  return phrases;
}

/**
 * Generate 5 funny replacement phrases for T2 blank
 * Uses high temperature (0.95) for maximum creativity while respecting constraints
 * Retries up to 2 times on failure
 */
async function generateReplacementPhrases(
  blankedScene: string,
  constraints: string[],
  stage: 'T2' | 'T3',
  tripletNumber?: number,
  totalTriplets?: number
): Promise<string[]> {
  return withRetry(
    () => generateReplacementPhrasesInternal(blankedScene, constraints, stage, tripletNumber, totalTriplets),
    `Generate replacement phrases (${stage})`
  );
}

/**
 * Judge which of 6 words are the top 3 funniest (internal implementation)
 * Returns array of 3 indices (0-based) in rank order: [best, 2nd, 3rd]
 */
async function judgeWordsInternal(
  originalScene: string,
  keyword: string,
  words: string[],
  tripletNumber?: number,
  totalTriplets?: number
): Promise<number[]> {
  // Create 6 versions of the scene with each word, preserving casing from original
  const versions = words.map((word, idx) => {
    const filledScene = replaceKeywordWithWord(originalScene, keyword, word);
    return `VERSION ${idx + 1}:\n${filledScene}`;
  });

  const system = `You are an EXPERT COMEDY JUDGE for "Cinema Pippin", an adults-only party game. You have impeccable taste in humor and can identify what makes people laugh hardest. You evaluate punchlines based on: maximum comedic impact, surprise/shock value, absurdity, clever contextual fit, and broad adult appeal. You are decisive and pick clear winners.`;

  const prompt = `Judge these 6 versions of the same film scene. Each has a different word filling the blank.

🎯 YOUR TASK:
Rank the TOP 3 FUNNIEST versions - the ones that:
• Maximize HUMOR and make people LAUGH HARDEST
• Have the best SURPRISE/SHOCK value
• Create the most ABSURD or CLEVER juxtaposition
• Fit the context while being UNEXPECTED
• Have broad ADULT APPEAL for a party game

📽️ THE 6 VERSIONS:

${versions.join('\n\n---\n\n')}

⚠️ OUTPUT FORMAT:
Provide EXACTLY 3 numbers (1-6) separated by spaces, ranked from funniest to third-funniest.
Example: "3 1 5" means Version 3 is funniest, Version 1 is second, Version 5 is third.

🚨 CRITICAL VALIDATION RULES:
• ONLY use numbers 1, 2, 3, 4, 5, or 6
• DO NOT use 0, 7, 8, 9, or any number outside 1-6
• There are exactly 6 versions - you CANNOT select version 7 or higher
• Using invalid numbers will cause an error

Your response should be ONLY the 3 numbers separated by spaces. No explanations, no other text.`;

  console.log('\n================================================================================');
  console.log('⚖️  PROMPT 2: JUDGE FUNNIEST WORD');
  console.log('================================================================================');
  console.log('Model:', MODEL);
  console.log('Temperature: 0.3');
  console.log('\nSystem:');
  console.log(system);
  console.log('\nPrompt:');
  console.log(prompt);
  console.log('================================================================================');

  if (tripletNumber !== undefined && totalTriplets !== undefined) {
    console.log(`\n⏳ Submitting T1 word judging prompt for triplet ${tripletNumber} of ${totalTriplets}...`);
  }

  const response = await callOllama(prompt, 0.3, system);

  console.log('================================================================================');
  console.log('📥 OLLAMA RESPONSE (PROMPT 2)');
  console.log('================================================================================');
  console.log(response);
  console.log('================================================================================\n');

  // Parse version numbers with fallback handling
  return parseVersionNumbers(response);
}

/**
 * Judge which of 6 words are the top 3 funniest
 * Uses lower temperature (0.3) for consistent, reliable judgment
 * Retries up to 2 times on failure
 */
async function judgeWords(
  originalScene: string,
  keyword: string,
  words: string[],
  tripletNumber?: number,
  totalTriplets?: number
): Promise<number[]> {
  return withRetry(
    () => judgeWordsInternal(originalScene, keyword, words, tripletNumber, totalTriplets),
    'Judge funniest word'
  );
}

/**
 * Judge which of 6 phrases are the top 3 funniest for T2/T3 (internal implementation)
 * Returns array of 3 indices (0-based) in rank order: [best, 2nd, 3rd]
 */
async function judgePhrasesInternal(
  sceneTemplate: string,
  phrases: string[],
  stage: 'T2' | 'T3',
  tripletNumber?: number,
  totalTriplets?: number
): Promise<number[]> {
  // Create 6 versions of the scene with each phrase
  const versions = phrases.map((phrase, idx) => {
    const filledScene = replaceBlankedText(sceneTemplate, phrase);
    return `VERSION ${idx + 1}:\n${filledScene}`;
  });

  const system = `You are an EXPERT COMEDY JUDGE for "Cinema Pippin", an adults-only party game. You have impeccable taste in humor and can identify what makes people laugh hardest. You evaluate punchlines based on: maximum comedic impact, surprise/shock value, absurdity, clever contextual fit, and broad adult appeal. You are decisive and pick clear winners.`;

  const prompt = `Judge these 6 versions of the same film scene. Each has a different PHRASE filling the blank.

🎯 YOUR TASK:
Rank the TOP 3 FUNNIEST versions - the ones that:
• Maximizes HUMOR and makes people LAUGH HARDEST
• Has the best SURPRISE/SHOCK value
• Creates the most ABSURD or CLEVER juxtaposition
• Fits the context while being UNEXPECTED
• Has broad ADULT APPEAL for a party game

📽️ THE 6 VERSIONS:

${versions.join('\n\n---\n\n')}

⚠️ OUTPUT FORMAT:
Provide EXACTLY 3 numbers (1-6) separated by spaces, ranked from funniest to third-funniest.
Example: "3 1 5" means Version 3 is funniest, Version 1 is second, Version 5 is third.

🚨 CRITICAL VALIDATION RULES:
• ONLY use numbers 1, 2, 3, 4, 5, or 6
• DO NOT use 0, 7, 8, 9, or any number outside 1-6
• There are exactly 6 versions - you CANNOT select version 7 or higher
• Using invalid numbers will cause an error

Your response should be ONLY the 3 numbers separated by spaces. No explanations, no other text.`;

  console.log('\n================================================================================');
  console.log(`⚖️  PROMPT 2 (${stage}): JUDGE FUNNIEST PHRASE`);
  console.log('================================================================================');
  console.log('Model:', MODEL);
  console.log('Temperature: 0.3');
  console.log('\nSystem:');
  console.log(system);
  console.log('\nPrompt:');
  console.log(prompt);
  console.log('================================================================================');

  if (tripletNumber !== undefined && totalTriplets !== undefined) {
    console.log(`\n⏳ Submitting ${stage} phrase judging prompt for triplet ${tripletNumber} of ${totalTriplets}...`);
  }

  const response = await callOllama(prompt, 0.3, system);

  console.log('================================================================================');
  console.log(`📥 OLLAMA RESPONSE (PROMPT 2 ${stage})`);
  console.log('================================================================================');
  console.log(response);
  console.log('================================================================================\n');

  // Parse version numbers with fallback handling
  return parseVersionNumbers(response);
}

/**
 * Judge which of 6 phrases are the top 3 funniest for T2/T3
 * Uses lower temperature (0.3) for consistent, reliable judgment
 * Retries up to 2 times on failure
 */
async function judgePhrases(
  sceneTemplate: string,
  phrases: string[],
  stage: 'T2' | 'T3',
  tripletNumber?: number,
  totalTriplets?: number
): Promise<number[]> {
  return withRetry(
    () => judgePhrasesInternal(sceneTemplate, phrases, stage, tripletNumber, totalTriplets),
    `Judge funniest phrase (${stage})`
  );
}

/**
 * Final quality judging - evaluate the complete triplet with all winners inserted
 * Internal implementation (no retry wrapper)
 */
async function judgeQualityInternal(
  scene1: string,
  scene2: string,
  scene3: string,
  tripletNumber?: number,
  totalTriplets?: number
): Promise<[string, boolean][]> {
  const questions = [
    'Is scene 1 funny?',
    'Is scene 2 funny?',
    'Is scene 3 funny?',
    'Is scene 1 coherent?',
    'Is scene 2 coherent?',
    'Is scene 3 coherent?',
    'Do these three scenes tell a coherent story together?',
    'Would these three scenes each make a spectator laugh out loud?',
    'Are these scenes unexpected in a funny or ironic way?',
    'Do these three scenes all embody best screenwriting practices?'
  ];

  const questionsList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  const system = `You are an EXPERT FILM CRITIC and COMEDY ANALYST for "Cinema Pippin", an adults-only party game. You have exceptional taste in humor, storytelling, and screenwriting. You evaluate film scenes objectively based on comedic impact, narrative coherence, surprise value, and professional screenwriting standards.`;

  const prompt = `Evaluate this complete three-scene sequence from a film and answer 10 yes/no questions about its quality.

🎬 COMPLETE THREE-SCENE SEQUENCE:

📽️  SCENE 1:
${scene1}

📽️  SCENE 2:
${scene2}

📽️  SCENE 3:
${scene3}

🎯 YOUR TASK:
Answer these 10 questions with true or false. Be honest and objective in your evaluation.

📋 THE 10 QUESTIONS:
${questionsList}

⚠️ OUTPUT FORMAT:
Respond with ONLY a valid JSON array of 10 couplets (question-answer pairs).
Each couplet is [question_text, true/false] where:
- question_text is EXACTLY copied from the numbered list above (including the number)
- The answer is the boolean true or false (NOT a string)

Format:
[["1. Is scene 1 funny?", true], ["2. Is scene 2 funny?", false], ..., ["10. Do these three scenes all embody best screenwriting practices?", true]]

No explanations, no other text. Just the JSON array of couplets.`;

  console.log('\n================================================================================');
  console.log('🎯 FINAL QUALITY JUDGING');
  console.log('================================================================================');
  console.log('Model:', MODEL);
  console.log('Temperature: 0.3');
  console.log('\nSystem:');
  console.log(system);
  console.log('\nPrompt:');
  console.log(prompt);
  console.log('================================================================================');

  if (tripletNumber !== undefined && totalTriplets !== undefined) {
    console.log(`\n⏳ Submitting quality judging prompt for triplet ${tripletNumber} of ${totalTriplets}...`);
  }

  const response = await callOllama(prompt, 0.3, system);

  console.log('================================================================================');
  console.log('📥 OLLAMA RESPONSE (QUALITY JUDGING)');
  console.log('================================================================================');
  console.log(response);
  console.log('================================================================================\n');

  // Extract JSON array from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Could not extract JSON array from response: ${response}`);
  }

  let jsonStr = jsonMatch[0];

  // Fix LLM using single quotes for array elements instead of double quotes (invalid JSON)
  // JSON standard requires double quotes only
  // Pattern: ['text with \'apostrophe\'', "other"] should be ["text with 'apostrophe'", "other"]
  // Must properly handle:
  //   - Escaped single quotes (\') -> unescaped (')
  //   - Unescaped double quotes (") -> escaped (\")
  jsonStr = jsonStr.replace(/([,\[])\s*'((?:[^'\\]|\\.)*)'/g, (match, prefix, content) => {
    // Step 1: Unescape escaped single quotes \' -> ' (since we're using double quotes now)
    let fixed = content.replace(/\\'/g, "'");

    // Step 2: Escape unescaped double quotes " -> \"
    // Replace all ", but then un-replace already-escaped ones \\"
    fixed = fixed.replace(/"/g, '\\"').replace(/\\\\"/g, '\\"');

    return `${prefix}"${fixed}"`;
  });

  // Parse couplets
  let couplets: [string, boolean][];
  try {
    couplets = JSON.parse(jsonStr) as [string, boolean][];
  } catch (parseError) {
    throw new Error(`Could not parse JSON from response: ${response}\nJSON string after fixes: ${jsonStr}\nParse error: ${parseError}`);
  }

  // Validate we got 10 couplets
  if (!Array.isArray(couplets) || couplets.length !== 10) {
    throw new Error(
      `Expected 10 question-answer couplets, got ${couplets?.length ?? 'invalid'}.\n` +
      `Response: ${JSON.stringify(couplets)}`
    );
  }

  // Validate each couplet has correct structure
  for (let i = 0; i < couplets.length; i++) {
    const [question, answer] = couplets[i];
    if (typeof question !== 'string' || typeof answer !== 'boolean') {
      throw new Error(
        `Invalid couplet at position ${i + 1}: expected [string, boolean], got [${typeof question}, ${typeof answer}]\n` +
        `Couplet: ${JSON.stringify(couplets[i])}`
      );
    }
  }

  console.log('✅ Quality evaluation completed!\n');
  console.log('📊 Answers:');
  couplets.forEach(([q, a]) => {
    console.log(`   ${q} → ${a ? '✅ TRUE' : '❌ FALSE'}`);
  });

  const trueCount = couplets.filter(([, answer]) => answer).length;
  console.log(`\n🏆 QUALITY SCORE: ${trueCount}/10\n`);

  return couplets;
}

/**
 * Final quality judging with retry logic
 */
async function judgeQuality(
  scene1: string,
  scene2: string,
  scene3: string,
  tripletNumber?: number,
  totalTriplets?: number
): Promise<[string, boolean][]> {
  return withRetry(
    () => judgeQualityInternal(scene1, scene2, scene3, tripletNumber, totalTriplets),
    'Final quality judging'
  );
}

/**
 * Judge a single triplet file
 */
export async function judgeTriplet(
  tripletFilePath: string,
  tripletNumber: number,
  totalTriplets: number = 1
): Promise<TripletJudgment> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎭 JUDGING TRIPLET ${tripletNumber}: ${basename(tripletFilePath)}`);
  console.log('='.repeat(80));

  // 1. Parse first scene
  const firstScene = parseFirstScene(tripletFilePath);
  console.log('\n📄 First scene loaded');

  // 2. Extract keyword
  const keyword = extractKeywordFromScene(firstScene);
  console.log(`🔑 Keyword extracted: "${keyword}"`);

  // 3. Blank out keyword
  const blankedScene = firstScene
    .split('\n')
    .map((line) => replaceKeywordWithBlank(line, keyword))
    .join('\n');
  console.log('✏️  Keyword blanked out');

  // 4. Load and randomly select 5 constraints
  const allConstraints = loadConstraints();
  const selectedConstraints = randomSample(allConstraints, 6);
  console.log('\n🎲 Randomly selected 6 constraints:');
  selectedConstraints.forEach((c, i) => console.log(`   ${i + 1}. ${c}`));

  // 5. Generate 6 replacement words
  const generatedWords = await generateReplacementWords(
    blankedScene,
    selectedConstraints,
    tripletNumber,
    totalTriplets
  );
  console.log(`\n✅ Generated 5 words: ${JSON.stringify(generatedWords)}`);

  // 6. Shuffle the words
  const shuffledWords = shuffle(generatedWords);
  console.log(`🔀 Shuffled order: ${JSON.stringify(shuffledWords)}`);

  // 7. Judge top 3 funniest (using original scene to preserve casing)
  const top3Indices = await judgeWords(firstScene, keyword, shuffledWords, tripletNumber, totalTriplets);
  const top3Words = top3Indices.map(idx => shuffledWords[idx]);
  const bestWord = top3Words[0]; // Use #1 for gameplay progression
  console.log(`\n🏆 WINNERS (T1):`);
  console.log(`   #1 (best): Version ${top3Indices[0] + 1} - "${top3Words[0]}"`);
  console.log(`   #2: Version ${top3Indices[1] + 1} - "${top3Words[1]}"`);
  console.log(`   #3: Version ${top3Indices[2] + 1} - "${top3Words[2]}"`);

  // ============================================================================
  // T2 (SECOND SCENE) PROCESSING
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('🎬 STARTING T2 (SECOND SCENE) PROCESSING');
  console.log('='.repeat(80));

  // 8. Parse second scene
  const secondScene = parseSecondScene(tripletFilePath);
  console.log('\n📄 Second scene loaded');

  // 9. Replace [keyword] and all occurrences of the original keyword in second scene with best word from T1
  // First replace literal [keyword] markers
  let secondSceneWithWord = secondScene
    .split('\n')
    .map((line) => line.replace(/\[keyword\]/g, bestWord))
    .join('\n');

  // Then replace all case-insensitive occurrences of the original keyword, preserving casing
  secondSceneWithWord = replaceKeywordWithWord(secondSceneWithWord, keyword, bestWord);
  console.log(`✏️  Replaced [keyword] and all occurrences of "${keyword}" with "${bestWord}" (case-matched) in second scene`);

  // 10. Blank out the entire text of the final SRT frame with _____
  // Split into frames (separated by blank lines)
  const frames = secondSceneWithWord.split(/\n\n+/);
  if (frames.length === 0) {
    throw new Error(`No frames found in second scene`);
  }

  // Get the last frame and blank out its text
  const lastFrameLines = frames[frames.length - 1].split('\n');
  if (lastFrameLines.length < 3) {
    throw new Error(`Last frame in second scene has invalid format`);
  }

  // Keep index (line 0) and timestamp (line 1), blank text while preserving spaces
  // NEW RULE: Condense multi-line to single line (with spaces), then blank with max 8 words
  const textLines = lastFrameLines.slice(2);
  const blankedText = condenseAndBlank(textLines);
  console.log(`🐛 DEBUG T2: Input lines=${textLines.length}, Blanked="${blankedText}", WordCount=${blankedText.split(/\s+/).length}`);
  const blankedLastFrame = [
    lastFrameLines[0], // Index
    lastFrameLines[1], // Timestamp
    blankedText        // Condensed + blanked text (max 8 blank words)
  ].join('\n');

  // Reconstruct second scene with blanked last frame
  const blankedSecondScene = [
    ...frames.slice(0, -1),
    blankedLastFrame
  ].join('\n\n');

  console.log(`✏️  Blanked out final frame text in second scene`)

  // 11. Randomly select NEW 5 constraints for T2
  const selectedConstraintsT2 = randomSample(allConstraints, 6);
  console.log('\n🎲 Randomly selected 6 NEW constraints for T2:');
  selectedConstraintsT2.forEach((c, i) => console.log(`   ${i + 1}. ${c}`));

  // 12. Generate 6 replacement phrases for T2
  const generatedPhrases = await generateReplacementPhrases(
    blankedSecondScene,
    selectedConstraintsT2,
    'T2',
    tripletNumber,
    totalTriplets
  );
  console.log(`\n✅ Generated 5 phrases: ${JSON.stringify(generatedPhrases)}`);

  // 13. Shuffle the phrases
  const shuffledPhrases = shuffle(generatedPhrases);
  console.log(`🔀 Shuffled order: ${JSON.stringify(shuffledPhrases)}`);

  // 14. Judge top 3 funniest phrases
  const top3PhrasesIndices = await judgePhrases(blankedSecondScene, shuffledPhrases, 'T2', tripletNumber, totalTriplets);
  const top3Phrases = top3PhrasesIndices.map(idx => shuffledPhrases[idx]);
  const bestPhrase = top3Phrases[0]; // Use #1 for gameplay progression
  console.log(`\n🏆 WINNERS (T2):`);
  console.log(`   #1 (best): Version ${top3PhrasesIndices[0] + 1} - "${top3Phrases[0]}"`);
  console.log(`   #2: Version ${top3PhrasesIndices[1] + 1} - "${top3Phrases[1]}"`);
  console.log(`   #3: Version ${top3PhrasesIndices[2] + 1} - "${top3Phrases[2]}"`);

  // ============================================================================
  // T3 (THIRD SCENE) PROCESSING - Phrase generation and judging
  // ============================================================================

  console.log('\n' + '='.repeat(80));
  console.log('🎬 STARTING T3 (THIRD SCENE) PROCESSING');
  console.log('='.repeat(80));

  // 15. Parse third scene
  const thirdScene = parseThirdScene(tripletFilePath);
  console.log('\n📄 Third scene loaded');

  // 16. Replace [keyword] and all occurrences of the original keyword in third scene with best word from T1
  // First replace literal [keyword] markers
  let thirdSceneWithWord = thirdScene
    .split('\n')
    .map((line) => line.replace(/\[keyword\]/g, bestWord))
    .join('\n');

  // Then replace all case-insensitive occurrences of the original keyword, preserving casing
  thirdSceneWithWord = replaceKeywordWithWord(thirdSceneWithWord, keyword, bestWord);
  console.log(`✏️  Replaced [keyword] and all occurrences of "${keyword}" with "${bestWord}" (case-matched) in third scene`);

  // 17. Blank out the entire text of the final SRT frame with _____
  const framesT3 = thirdSceneWithWord.split(/\n\n+/);
  if (framesT3.length === 0) {
    throw new Error(`No frames found in third scene`);
  }

  const lastFrameLinesT3 = framesT3[framesT3.length - 1].split('\n');
  if (lastFrameLinesT3.length < 3) {
    throw new Error(`Last frame in third scene has invalid format`);
  }

  // NEW RULE: Condense multi-line to single line (with spaces), then blank with max 8 words
  const textLinesT3 = lastFrameLinesT3.slice(2);
  const blankedTextT3 = condenseAndBlank(textLinesT3);
  console.log(`🐛 DEBUG T3: Input lines=${textLinesT3.length}, Blanked="${blankedTextT3}", WordCount=${blankedTextT3.split(/\s+/).length}`);
  const blankedLastFrameT3 = [
    lastFrameLinesT3[0], // Index
    lastFrameLinesT3[1], // Timestamp
    blankedTextT3        // Condensed + blanked text (max 8 blank words)
  ].join('\n');

  const blankedThirdScene = [
    ...framesT3.slice(0, -1),
    blankedLastFrameT3
  ].join('\n\n');

  console.log(`✏️  Blanked out final frame text in third scene`);

  // 18. Randomly select NEW 5 constraints for T3
  const selectedConstraintsT3 = randomSample(allConstraints, 6);
  console.log('\n🎲 Randomly selected 6 NEW constraints for T3:');
  selectedConstraintsT3.forEach((c, i) => console.log(`   ${i + 1}. ${c}`));

  // 19. Generate 6 replacement phrases for T3
  const generatedPhrasesT3 = await generateReplacementPhrases(
    blankedThirdScene,
    selectedConstraintsT3,
    'T3',
    tripletNumber,
    totalTriplets
  );
  console.log(`\n✅ Generated 5 phrases (T3): ${JSON.stringify(generatedPhrasesT3)}`);

  // 20. Shuffle the phrases
  const shuffledPhrasesT3 = shuffle(generatedPhrasesT3);
  console.log(`🔀 Shuffled order: ${JSON.stringify(shuffledPhrasesT3)}`);

  // 21. Judge top 3 funniest phrases
  const top3PhrasesIndicesT3 = await judgePhrases(blankedThirdScene, shuffledPhrasesT3, 'T3', tripletNumber, totalTriplets);
  const top3PhrasesT3 = top3PhrasesIndicesT3.map(idx => shuffledPhrasesT3[idx]);
  const bestPhraseT3 = top3PhrasesT3[0]; // Use #1 for gameplay progression
  console.log(`\n🏆 WINNERS (T3):`);
  console.log(`   #1 (best): Version ${top3PhrasesIndicesT3[0] + 1} - "${top3PhrasesT3[0]}"`);
  console.log(`   #2: Version ${top3PhrasesIndicesT3[1] + 1} - "${top3PhrasesT3[1]}"`);
  console.log(`   #3: Version ${top3PhrasesIndicesT3[2] + 1} - "${top3PhrasesT3[2]}"`);

  // ============================================================================
  // FINAL OUTPUT - Complete triplet with all winners
  // ============================================================================

  console.log('\n' + '*'.repeat(80));
  console.log('*'.repeat(80));
  console.log(`COMPLETE TRIPLET ${tripletNumber} WITH ALL WINNERS INSERTED`);
  console.log('*'.repeat(80));
  console.log('*'.repeat(80));

  // Scene 1 with T1 winner (replace keyword in original scene to preserve casing)
  const finalScene1 = replaceKeywordWithWord(firstScene, keyword, bestWord);
  console.log('\n📽️  SCENE 1 (T1 Winner: "' + bestWord + '" with case-matching):');
  console.log(finalScene1);

  // Scene 2 with T1 winner keyword replacement AND T2 winner phrase
  const finalScene2 = replaceBlankedText(blankedSecondScene, bestPhrase);
  console.log('\n📽️  SCENE 2 (T1 keyword + T2 Winner: "' + bestPhrase + '"):');
  console.log(finalScene2);

  // Scene 3 with T1 winner keyword replacement AND T3 winner phrase
  const finalScene3 = replaceBlankedText(blankedThirdScene, bestPhraseT3);
  console.log('\n📽️  SCENE 3 (T1 keyword + T3 Winner: "' + bestPhraseT3 + '"):');
  console.log(finalScene3);

  console.log('\n' + '*'.repeat(80));
  console.log('*'.repeat(80));

  // ============================================================================
  // FINAL QUALITY JUDGING
  // ============================================================================

  const qualityAnswers = await judgeQuality(finalScene1, finalScene2, finalScene3, tripletNumber, totalTriplets);
  const qualityScore = qualityAnswers.filter(([, answer]) => answer).length;

  // 22. Return complete judgment with T1, T2, T3, and quality results
  return {
    tripletFile: tripletFilePath,
    tripletNumber,
    keyword,
    firstScene,
    blankedScene,
    generatedWords,
    shuffledWords,
    bestWord,
    bestWordIndex: top3Indices[0],
    top3Words,
    // T2 fields
    secondScene,
    secondSceneWithWord,
    generatedPhrases,
    shuffledPhrases,
    bestPhrase,
    bestPhraseIndex: top3PhrasesIndices[0],
    top3Phrases,
    // T3 fields
    thirdScene,
    thirdSceneWithWord,
    generatedPhrasesT3,
    shuffledPhrasesT3,
    bestPhraseT3,
    bestPhraseIndexT3: top3PhrasesIndicesT3[0],
    top3PhrasesT3,
    // Final quality judging
    qualityAnswers,
    qualityScore,
    finalScene1,
    finalScene2,
    finalScene3,
  };
}

/**
 * Judge all triplets for a given SRT file
 */
export async function judgeAllTriplets(srtFile: string): Promise<TripletJudgment[]> {
  const srtBasename = basename(srtFile);
  const generatedDir = '/home/jk/jkbox/generated';

  // Find all triplet files matching pattern: <srtBasename>.*.txt
  const fs = await import('fs/promises');
  const files = await fs.readdir(generatedDir);
  const tripletFiles = files
    .filter((f) => f.startsWith(srtBasename) && f.endsWith('.txt'))
    .sort()
    .map((f) => join(generatedDir, f));

  if (tripletFiles.length === 0) {
    throw new Error(
      `No triplet files found for ${srtBasename} in ${generatedDir}`
    );
  }

  console.log(`\n🎬 Found ${tripletFiles.length} triplet file(s) to judge`);
  tripletFiles.forEach((f, i) => console.log(`   ${i + 1}. ${basename(f)}`));

  const judgments: TripletJudgment[] = [];

  for (let i = 0; i < tripletFiles.length; i++) {
    const judgment = await judgeTriplet(tripletFiles[i], i + 1, tripletFiles.length);
    judgments.push(judgment);
  }

  // Sort by quality score (highest first)
  judgments.sort((a, b) => b.qualityScore - a.qualityScore);

  // ============================================================================
  // FINAL RANKED OUTPUT - All triplets sorted by quality score
  // ============================================================================

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('='.repeat(80));
  console.log('🏆 FINAL RANKED TRIPLETS (SORTED BY QUALITY SCORE)');
  console.log('='.repeat(80));
  console.log('='.repeat(80));

  for (const judgment of judgments) {
    console.log('\n\n');
    console.log('='.repeat(80));
    console.log('='.repeat(80));
    console.log(`TRIPLET ${judgment.tripletNumber}: ${basename(judgment.tripletFile)}`);
    console.log('='.repeat(80));
    console.log('='.repeat(80));

    console.log('\n📽️  SCENE 1:');
    console.log(judgment.finalScene1);

    console.log('\n📽️  SCENE 2:');
    console.log(judgment.finalScene2);

    console.log('\n📽️  SCENE 3:');
    console.log(judgment.finalScene3);

    console.log('\n📊 QUALITY EVALUATION:');
    judgment.qualityAnswers.forEach(([q, a]) => {
      console.log(`   ${q} → ${a ? '✅ TRUE' : '❌ FALSE'}`);
    });

    console.log(`\n🏆 QUALITY SCORE: ${judgment.qualityScore}/10`);

    console.log('\n' + '='.repeat(80));
    console.log('='.repeat(80));
  }

  console.log('\n\n');
  console.log('✨ ALL TRIPLETS JUDGED AND RANKED! ✨');
  console.log(`Total triplets evaluated: ${judgments.length}`);
  console.log(`Best score: ${judgments[0]?.qualityScore ?? 0}/10`);
  console.log(`Worst score: ${judgments[judgments.length - 1]?.qualityScore ?? 0}/10`);

  return judgments;
}

/**
 * Helper: Blank out the last frame of a scene with condensed blanks (max 8 words)
 * Uses condenseAndBlank to ensure consistent behavior with T2/T3 processing
 * Example: "I'll be back!" becomes "____ __ ____"
 */
function blankLastFrame(scene: string): string {
  const frames = scene.split(/\n\n+/);
  if (frames.length === 0) {
    return scene;
  }

  const lastFrame = frames[frames.length - 1];
  const lastFrameLines = lastFrame.split('\n');

  if (lastFrameLines.length < 3) {
    return scene;
  }

  // Keep index (line 0) and timestamp (line 1), blank text with condenseAndBlank (max 8 words)
  const textLines = lastFrameLines.slice(2);
  const blankedText = condenseAndBlank(textLines);
  const blankedLastFrame = [
    lastFrameLines[0], // Index
    lastFrameLines[1], // Timestamp
    blankedText        // Condensed + blanked text (max 8 blank words)
  ].join('\n');

  // Reconstruct scene with blanked last frame
  return [
    ...frames.slice(0, -1),
    blankedLastFrame
  ].join('\n\n');
}

/**
 * Export the top N triplets to ~/jkbox/generated/clips/SRT_NAME/1, /2, etc.
 * N = min(X/2, 6) where X is the number of judged triplets
 *
 * Each directory contains 9 SRT files (3 scenes × 3 versions) + answers.json
 * If sourceVideo is provided, also extracts video segments for each scene
 */
export async function exportTopTriplets(
  srtFile: string,
  judgments: TripletJudgment[],
  sourceVideo?: string,
  audioStreamIndex?: number | null,
  paddingSeconds: number = 1.0
): Promise<void> {
  const srtBasename = basename(srtFile, '.srt');
  const clipsBaseDir = join('/home/jk/jkbox/generated/clips', srtBasename);

  // Calculate N = min(ceil(X/2), 6) - round up so 1 judgment exports 1 clip
  const numToExport = Math.min(Math.ceil(judgments.length / 2), 6);

  console.log(`\n📦 Exporting top ${numToExport} triplet sequence(s) to ${clipsBaseDir}`);
  if (sourceVideo) {
    console.log(`📹 Video padding: ${paddingSeconds}s before/after each clip (subtitles delayed, audio fades in/out)`);
  }

  // Export the top N judgments (already sorted by quality score)
  for (let i = 0; i < numToExport; i++) {
    const judgment = judgments[i];
    const rankDir = join(clipsBaseDir, `${i + 1}`);

    // Create directory
    mkdirSync(rankDir, { recursive: true });

    console.log(`\n  📁 Exporting rank ${i + 1} (score: ${judgment.qualityScore}/10) to ${basename(rankDir)}/`);

    // Extract timestamp ranges from original scenes BEFORE rebasing (needed for video extraction)
    const scene1Range = extractTimestampRange(judgment.firstScene);
    const scene2Range = extractTimestampRange(judgment.secondScene);
    const scene3Range = extractTimestampRange(judgment.thirdScene);

    // ========================================================================
    // SCENE 1 - 3 versions (all rebased with padding delay)
    // ========================================================================

    // Scene 1 - Original (rebased with padding delay)
    const scene1Original = rebaseSrtTimestamps(judgment.firstScene, scene1Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-1-original.srt`),
      scene1Original,
      'utf-8'
    );

    // Scene 1 - Question (keyword blanked with _____, rebased with padding delay)
    const scene1Question = rebaseSrtTimestamps(judgment.blankedScene, scene1Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-1-question.srt`),
      scene1Question,
      'utf-8'
    );

    // Scene 1 - CPU (with winning T1 word, rebased with padding delay)
    const scene1CPU = rebaseSrtTimestamps(judgment.finalScene1, scene1Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-1-cpu.srt`),
      scene1CPU,
      'utf-8'
    );

    // ========================================================================
    // SCENE 2 - 3 versions (all rebased with padding delay)
    // ========================================================================

    // Scene 2 - Original (rebased with padding delay)
    const scene2Original = rebaseSrtTimestamps(judgment.secondScene, scene2Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-2-original.srt`),
      scene2Original,
      'utf-8'
    );

    // Scene 2 - Question (keyword → [keyword], last frame → _____, rebased with padding delay)
    let scene2Question = replaceKeywordWithWord(
      judgment.secondScene,
      judgment.keyword,
      '[keyword]'
    );
    scene2Question = blankLastFrame(scene2Question);
    scene2Question = rebaseSrtTimestamps(scene2Question, scene2Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-2-question.srt`),
      scene2Question,
      'utf-8'
    );

    // Scene 2 - CPU (with T1 winner + T2 winner phrase, rebased with padding delay)
    const scene2CPU = rebaseSrtTimestamps(judgment.finalScene2, scene2Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-2-cpu.srt`),
      scene2CPU,
      'utf-8'
    );

    // ========================================================================
    // SCENE 3 - 3 versions (all rebased with padding delay)
    // ========================================================================

    // Scene 3 - Original (rebased with padding delay)
    const scene3Original = rebaseSrtTimestamps(judgment.thirdScene, scene3Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-3-original.srt`),
      scene3Original,
      'utf-8'
    );

    // Scene 3 - Question (keyword → [keyword], last frame → _____, rebased with padding delay)
    let scene3Question = replaceKeywordWithWord(
      judgment.thirdScene,
      judgment.keyword,
      '[keyword]'
    );
    scene3Question = blankLastFrame(scene3Question);
    scene3Question = rebaseSrtTimestamps(scene3Question, scene3Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-3-question.srt`),
      scene3Question,
      'utf-8'
    );

    // Scene 3 - CPU (with T1 winner + T3 winner phrase, rebased with padding delay)
    const scene3CPU = rebaseSrtTimestamps(judgment.finalScene3, scene3Range.startTime, paddingSeconds);
    writeFileSync(
      join(rankDir, `${srtBasename}-3-cpu.srt`),
      scene3CPU,
      'utf-8'
    );

    // ========================================================================
    // ANSWERS JSON
    // ========================================================================

    const answers = {
      answers: [
        judgment.top3Words,       // T1: [best, 2nd, 3rd]
        judgment.top3Phrases,     // T2: [best, 2nd, 3rd]
        judgment.top3PhrasesT3    // T3: [best, 2nd, 3rd]
      ]
    };

    writeFileSync(
      join(rankDir, 'answers.json'),
      JSON.stringify(answers, null, 2),
      'utf-8'
    );

    console.log(`    ✅ Exported 9 SRT files + answers.json`);

    // Extract videos if source video provided
    if (sourceVideo) {
      try {
        const timestampRanges = [scene1Range, scene2Range, scene3Range];
        extractVideosForSequence(rankDir, sourceVideo, srtBasename, timestampRanges, audioStreamIndex, paddingSeconds);
        console.log(`    ✅ Extracted 3 video segments`);
      } catch (error) {
        console.error(`    ⚠ Video extraction failed: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  console.log(`\n✨ Export complete! ${numToExport} sequence(s) saved to ${clipsBaseDir}\n`);
}
