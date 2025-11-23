/**
 * Cinema Pippin - AI Player Management
 * Create, configure, and manage AI players with constraints
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Ollama } from 'ollama'
import Anthropic from '@anthropic-ai/sdk'
import type { ClipNumber } from './types'

export interface AIPlayer {
	playerId: string
	nickname: string
	isAI: boolean
	constraint: string
}

export interface AIConfig {
	ollamaEndpoint: string
	model: string
	temperature: number
}

/**
 * Claude API pricing (per million tokens) as of 2024
 */
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
	'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
	'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
	'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
	'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
	'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
	'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
}

/**
 * Calculate cost for Claude API calls based on model pricing
 */
function calculateClaudeCost(model: string, inputTokens: number, outputTokens: number): { cost: number; inputCost: number; outputCost: number } {
	const pricing = CLAUDE_PRICING[model]

	if (!pricing) {
		console.warn(`[AI] Unknown model pricing for ${model}, using Sonnet 3.5 pricing as default`)
		const defaultPricing = CLAUDE_PRICING['claude-3-5-sonnet-20241022']
		const inputCost = (inputTokens / 1_000_000) * defaultPricing.input
		const outputCost = (outputTokens / 1_000_000) * defaultPricing.output
		return { cost: inputCost + outputCost, inputCost, outputCost }
	}

	const inputCost = (inputTokens / 1_000_000) * pricing.input
	const outputCost = (outputTokens / 1_000_000) * pricing.output

	return { cost: inputCost + outputCost, inputCost, outputCost }
}

/**
 * Log AI conversation to ~/pippin-ai.log
 */
function logAIConversation(type: 'prompt' | 'response', content: string, metadata?: Record<string, any>): void {
	const logPath = path.join(os.homedir(), 'pippin-ai.log')
	const timestamp = new Date().toISOString()
	const metadataStr = metadata ? `\nMetadata: ${JSON.stringify(metadata, null, 2)}` : ''

	const logEntry = `[${timestamp}] ${type.toUpperCase()}${metadataStr}\n${content}\n---\n`

	fs.appendFileSync(logPath, logEntry, 'utf-8')
}

/**
 * Create a new AI player with constraint-based name
 */
export function createAIPlayer(index: number, constraint: string): AIPlayer {
	// Extract first word from constraint (e.g., "Pippin's word" -> "Pippin")
	const firstWord = constraint.split(/\s+/)[0]
	const nickname = `${firstWord}Bot`

	return {
		playerId: `ai-${index}`,
		nickname,
		isAI: true,
		constraint
	}
}

/**
 * Load constraints from assets/constraints.txt
 */
export function loadConstraints(): string[] {
	// Always use assets/constraints.txt from project root
	const constraintsPath = path.join(process.cwd(), '../../assets/constraints.txt')

	if (!fs.existsSync(constraintsPath)) {
		throw new Error(`constraints.txt not found at: ${constraintsPath}`)
	}

	console.log(`[AI] Loading constraints from: ${constraintsPath}`)
	const content = fs.readFileSync(constraintsPath, 'utf-8')
	const constraints = content
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
	console.log(`[AI] Loaded ${constraints.length} constraints`)
	return constraints
}

/**
 * Shuffle constraints array (Fisher-Yates)
 */
export function shuffleConstraints(constraints: string[]): string[] {
	const shuffled = [...constraints]

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}

	return shuffled
}

/**
 * Create multiple AI players with unique constraints
 */
export function createAIPlayers(count: number, constraints: string[]): AIPlayer[] {
	if (count > constraints.length) {
		throw new Error(`Not enough constraints (${constraints.length}) for ${count} AI players`)
	}

	return Array.from({ length: count }, (_, i) => createAIPlayer(i + 1, constraints[i]))
}

/**
 * Generate batch answers (X AI + N house) for a given clip
 * Returns array of X+N answers in randomized order
 */
export async function generateBatchAnswers(
	config: AIConfig,
	clipNumber: ClipNumber,
	keyword: string,
	aiConstraints: string[], // AI player constraints
	additionalCount: number // Number of additional house answers to generate
): Promise<string[]> {
	const ollama = new Ollama({ host: config.ollamaEndpoint })

	const isC1 = clipNumber === 1
	const wordCount = isC1 ? 1 : clipNumber === 2 ? 4 : 3

	// Build constraint list: AI constraints + random unique constraints
	const allConstraints = loadConstraints()
	const availableForHouse = allConstraints.filter((c) => !aiConstraints.includes(c))
	const shuffled = shuffleConstraints(availableForHouse)
	const houseConstraints = shuffled.slice(0, additionalCount)

	// Combine and randomize
	const combinedConstraints = [...aiConstraints, ...houseConstraints]
	const randomizedConstraints = shuffleConstraints(combinedConstraints)

	const systemPrompt = `You are a PROFESSIONAL COMEDY WRITER for an adults-only party game called "Cinema Pippin".

🎬 THE GAME:
- Players watch foreign film clips with subtitles that have BLANKS
- Act 1 (C1): Submit a single word to fill the blank
- THE WINNING C1 WORD becomes the KEYWORD for Acts 2 & 3
- Act 2 (C2): Submit ${clipNumber === 2 ? 4 : 3}-word phrase/sentence using the keyword
- Act 3 (C3): Submit ${clipNumber === 3 ? 3 : 4}-word phrase/sentence using the keyword
- Players VOTE on the funniest answers
- VOTES = POINTS. Winner takes all!

🎯 YOUR TASK:
Generate ${combinedConstraints.length} HILARIOUS ${isC1 ? 'WORDS' : 'PHRASES'} that maximize LAUGHS and VOTES in a competitive party setting.

💡 EXPERT STRATEGY:
- **THINK LIKE A PLAYER:** What would make ME vote for this over others?
- **VARIETY > REPETITION:** Each answer should feel UNIQUE (avoid thematic overlap)
- **SURPRISE > EXPECTED:** Subvert expectations, avoid obvious choices
- **CLEVER > CRUDE:** "accidental pregnancy test" beats "big boobies"
- **CONTEXT-AWARE:** These fill blanks in FILM SUBTITLES (dramatic, romantic, tense scenes)
- **INCOGNITO CONSTRAINTS:** Satisfy constraint WITHOUT being obvious about it

${isC1 ? '⚠️ C1 CRITICAL: Winning word becomes the KEYWORD for C2/C3! Pick words with COMEDIC POTENTIAL for reuse.' : `⚠️ C${clipNumber} KEYWORD: "${keyword}" - Use this word NATURALLY in your phrase`}

📋 CONSTRAINTS (one per answer, in ORDER):
${randomizedConstraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}`

	const userPrompt = isC1
		? `Generate EXACTLY ${combinedConstraints.length} single HILARIOUS WORDS, one per constraint listed above.

🎯 C1 RULES:
• EXACTLY 1 word each (no phrases, no spaces, no hyphens unless part of word like "McDonald's")
• Each word MUST satisfy its numbered constraint
• Follow proper capitalization (proper nouns capitalized, otherwise lowercase)
• NO punctuation (no periods, exclamation marks, question marks)
• **WINNING WORD BECOMES KEYWORD** - pick words with comedic reuse potential!

📤 OUTPUT FORMAT:
Return ONLY a JSON array of ${combinedConstraints.length} strings:
["word1", "word2", "word3", ...]

NO explanations, NO markdown, NO extra text. ONLY the JSON array.`
		: `Generate EXACTLY ${combinedConstraints.length} HILARIOUS ${wordCount}-WORD PHRASES, one per constraint listed above.

🎯 C${clipNumber} RULES:
• EXACTLY ${wordCount} words each (±1 OK, but aim for ${wordCount})
• Each phrase MUST satisfy its numbered constraint
• MUST use keyword "${keyword}" naturally in the phrase
• Follow proper capitalization
• MUST end with punctuation (. ! or ?)
• **CLEVER > CRUDE:** Absurd juxtapositions beat lazy obscenity

📤 OUTPUT FORMAT:
Return ONLY a JSON array of ${combinedConstraints.length} strings:
["phrase one here!", "phrase two here.", "phrase three here!"]

NO explanations, NO markdown, NO extra text. ONLY the JSON array.`

	try {
		let rawResponse: string

		// Use Claude API if ANTHROPIC_API_KEY is set, otherwise fall back to Ollama
		if (process.env.ANTHROPIC_API_KEY) {
			const claudeModel = 'claude-3-5-sonnet-20241022'
			console.log(`[AI] Using Claude API (${claudeModel}) for generation...`)
			const anthropic = new Anthropic({
				apiKey: process.env.ANTHROPIC_API_KEY
			})

			// Log the prompt
			const fullPrompt = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`
			logAIConversation('prompt', fullPrompt, {
				model: claudeModel,
				clipNumber,
				keyword,
				numConstraints: combinedConstraints.length,
				temperature: config.temperature
			})

			// Using Claude 3.5 Sonnet - excellent quality for party game punchlines
			const message = await anthropic.messages.create({
				model: claudeModel,
				max_tokens: isC1 ? 256 : 1024,
				temperature: config.temperature,
				system: systemPrompt,
				messages: [{
					role: 'user',
					content: userPrompt
				}]
			})

			const content = message.content[0]
			if (content.type !== 'text') {
				throw new Error('Expected text response from Claude')
			}
			rawResponse = content.text

			// Calculate cost and log the response
			const { cost, inputCost, outputCost } = calculateClaudeCost(
				claudeModel,
				message.usage.input_tokens,
				message.usage.output_tokens
			)
			logAIConversation('response', rawResponse, {
				model: claudeModel,
				inputTokens: message.usage.input_tokens,
				outputTokens: message.usage.output_tokens,
				totalTokens: message.usage.input_tokens + message.usage.output_tokens,
				cost: `$${cost.toFixed(6)}`,
				costBreakdown: {
					input: `$${inputCost.toFixed(6)}`,
					output: `$${outputCost.toFixed(6)}`
				}
			})
		} else {
			console.log('[AI] Using Ollama (qwen-fast) for generation...')

			// Log the prompt
			const fullPrompt = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`
			logAIConversation('prompt', fullPrompt, {
				model: config.model,
				clipNumber,
				keyword,
				numConstraints: combinedConstraints.length,
				temperature: config.temperature,
				endpoint: config.ollamaEndpoint
			})

			const response = await ollama.generate({
				model: config.model,
				system: systemPrompt,
				prompt: userPrompt,
				options: {
					temperature: config.temperature,
					num_predict: isC1 ? 50 : 200
				}
			})
			rawResponse = response.response

			// Log the response with token counts
			logAIConversation('response', rawResponse, {
				model: config.model,
				inputTokens: response.prompt_eval_count || 0,
				outputTokens: response.eval_count || 0,
				totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
				timing: {
					totalDuration: response.total_duration,
					loadDuration: response.load_duration
				}
			})
		}

		// Parse JSON response
		const jsonMatch = rawResponse.match(/\[[\s\S]*\]/)
		if (!jsonMatch) {
			throw new Error('Failed to parse JSON array from response')
		}

		const answers = JSON.parse(jsonMatch[0]) as string[]

		if (answers.length !== combinedConstraints.length) {
			throw new Error(
				`Expected ${combinedConstraints.length} answers, got ${answers.length}`
			)
		}

		// Clean up answers
		const cleanedAnswers = answers.map((answer) => {
			let cleaned = answer.trim()
			cleaned = cleaned.replace(/^["']|["']$/g, '') // Remove quotes

			if (isC1) {
				// C1: Remove all punctuation and spaces
				cleaned = cleaned.replace(/[^a-zA-Z0-9'-]/g, '')
			} else {
				// C2/C3: Ensure ends with punctuation
				if (!/[.!?]$/.test(cleaned)) {
					cleaned += '.'
				}
			}

			return cleaned
		})

		return cleanedAnswers
	} catch (error) {
		console.error('[Batch Answer Generation] Failed:', error)
		throw error
	}
}

/**
 * Generate single AI answer for a given clip using constraint
 * @deprecated Use generateBatchAnswers instead
 */
export async function generateAIAnswer(
	config: AIConfig,
	clipNumber: ClipNumber,
	keyword: string,
	constraint: string
): Promise<string> {
	const ollama = new Ollama({ host: config.ollamaEndpoint })

	const isC1 = clipNumber === 1
	const wordCount = isC1 ? 1 : clipNumber === 2 ? 4 : 3

	const systemPrompt = `You are a PROFESSIONAL COMEDY WRITER for an adults-only party game called "Cinema Pippin". You excel at generating HILARIOUS, ABSURD, and CLEVER punchlines that maximize humor through unexpected juxtapositions, shock value, and perfect contextual fit. You excel at dark humor, sexual innuendo, and toilet humor while respecting creative constraints.`

	const userPrompt = isC1
		? `Generate a single HILARIOUS word that fits this constraint: "${constraint}"

🎯 CRITICAL RULES:
• Generate EXACTLY 1 word (no phrases, no spaces, no hyphens unless part of the word like "McDonald's")
• The word MUST satisfy the constraint: ${constraint}
• Maximize ABSURDITY, SURPRISE, and HUMOR
• This is an ADULTS-ONLY game - dark humor, sexual innuendo, toilet humor all ENCOURAGED
• The word will replace the keyword "${keyword}" in a film subtitle
• Follow proper English capitalization (capitalize if it's a proper noun, otherwise lowercase)
• DO NOT include any punctuation (no periods, exclamation marks, question marks)

Examples of good words: "boobies", "McDonald", "Hell", "butt", "taco"
Examples of bad words: "McDonald's!" (has punctuation), "New York" (has space), "very good" (multiple words)

Respond with ONLY the single word, nothing else.`
		: `Generate a HILARIOUS ${wordCount}-word phrase/sentence that fits this constraint: "${constraint}"

🎯 CRITICAL RULES:
• Generate EXACTLY ${wordCount} words (±1 word is OK, but aim for ${wordCount})
• The phrase MUST satisfy the constraint: ${constraint}
• Maximize ABSURDITY, SURPRISE, and HUMOR in context
• This is an ADULTS-ONLY game - dark humor, sexual innuendo, toilet humor all ENCOURAGED
• The phrase will replace the keyword "${keyword}" in a film subtitle
• Follow proper English capitalization
• MUST end with punctuation (. or ! or ?)
• **CLEVER TWIST > CRUDE SHOCK:** "May the Force be with you... and in you" beats "just fucking"
• **ABSURD JUXTAPOSITION:** Mix serious + silly, formal + crude, mundane + extreme
• Avoid pure sound effects ("Vroom vroom"), preachy lectures, lazy obscenity

Examples of good phrases: "munching delicious tacos!", "showing off my boobies!", "eating fresh avocado toast."
Examples of bad phrases: "very good day" (boring), "Vroom vroom" (sound effect), "just sex" (no ending punctuation)

Respond with ONLY the phrase/sentence, nothing else.`

	const response = await ollama.generate({
		model: config.model,
		system: systemPrompt,
		prompt: userPrompt,
		options: {
			temperature: config.temperature,
			num_predict: isC1 ? 20 : 50
		}
	})

	// Clean up response - remove quotes, trim, remove trailing punctuation for C1
	let answer = response.response.trim()
	answer = answer.replace(/^["']|["']$/g, '') // Remove surrounding quotes

	if (isC1) {
		// C1: Remove all punctuation and spaces
		answer = answer.replace(/[^a-zA-Z0-9'-]/g, '')
	} else {
		// C2/C3: Ensure it ends with punctuation
		if (!/[.!?\]]$/.test(answer)) {
			answer += '.'
		}
	}

	return answer
}

/**
 * Have AI player vote on answers based on judging constraint
 */
export async function generateAIVote(
	config: AIConfig,
	answers: Array<{ id: string; text: string }>,
	judgingConstraint: string
): Promise<string> {
	if (answers.length === 0) {
		throw new Error('No answers to vote on')
	}

	if (answers.length === 1) {
		return answers[0].id
	}

	const ollama = new Ollama({ host: config.ollamaEndpoint })

	const systemPrompt = `You are an EXPERT COMEDY JUDGE for "Cinema Pippin", an adults-only party game. You have impeccable taste in humor and can identify what makes people laugh hardest. You evaluate punchlines based on: maximum comedic impact, surprise/shock value, absurdity, clever contextual fit, and broad adult appeal.`

	const answerList = answers.map((a, i) => `${i + 1}. ${a.text}`).join('\n')

	const userPrompt = `Judge these ${answers.length} punchlines and pick the FUNNIEST one that best fits this judging preference: "${judgingConstraint}"

🎯 YOUR TASK:
Pick the answer that:
• Maximizes HUMOR and makes people LAUGH HARDEST
• Best aligns with the judging constraint: ${judgingConstraint}
• Has the best SURPRISE/SHOCK value
• Creates the most ABSURD or CLEVER juxtaposition
• Has broad ADULT APPEAL for a party game

📋 THE ${answers.length} OPTIONS:
${answerList}

⚠️ OUTPUT FORMAT:
Respond with ONLY the number (1-${answers.length}) of the funniest answer. No explanations, no other text.

Your response should be a single number between 1 and ${answers.length}.`

	// Log the prompt
	const fullPrompt = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`
	logAIConversation('prompt', fullPrompt, {
		model: config.model,
		judgingConstraint,
		numAnswers: answers.length,
		temperature: 0.3,
		endpoint: config.ollamaEndpoint
	})

	const response = await ollama.generate({
		model: config.model,
		system: systemPrompt,
		prompt: userPrompt,
		options: {
			temperature: 0.3, // Lower temp for more consistent judging
			num_predict: 10
		}
	})

	// Log the response with token counts
	logAIConversation('response', response.response, {
		model: config.model,
		inputTokens: response.prompt_eval_count || 0,
		outputTokens: response.eval_count || 0,
		totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
		timing: {
			totalDuration: response.total_duration,
			loadDuration: response.load_duration
		}
	})

	// Parse the number from response
	const match = response.response.match(/\d+/)
	if (!match) {
		// Fallback to random if parsing fails
		console.warn('[AI Vote] Failed to parse vote response, choosing randomly')
		return answers[Math.floor(Math.random() * answers.length)].id
	}

	const choiceIndex = parseInt(match[0]) - 1

	// Validate choice is in range
	if (choiceIndex < 0 || choiceIndex >= answers.length) {
		console.warn('[AI Vote] Choice out of range, choosing randomly')
		return answers[Math.floor(Math.random() * answers.length)].id
	}

	return answers[choiceIndex].id
}
