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
import { getPrompt } from './prompt-loader'

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
function calculateClaudeCost(
	model: string,
	inputTokens: number,
	outputTokens: number
): { cost: number; inputCost: number; outputCost: number } {
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
 * Only logs when running in an active game (not during automated tests)
 */
function logAIConversation(
	type: 'prompt' | 'response',
	content: string,
	metadata?: Record<string, unknown>
): void {
	// Skip logging during automated tests
	if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
		return
	}

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
	additionalCount: number, // Number of additional house answers to generate
	questionSrt?: string // Optional SRT text of the question for context
): Promise<string[]> {
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

	// Build system prompt from template
	const systemPrompt = getPrompt('batch-generation-system.md', {
		WORD_COUNT_C2: clipNumber === 2 ? 4 : 3,
		WORD_COUNT_C3: clipNumber === 3 ? 3 : 4,
		NUM_CONSTRAINTS: combinedConstraints.length,
		ANSWER_TYPE: isC1 ? 'WORDS' : 'PHRASES',
		CONSTRAINTS_LIST: randomizedConstraints.map((c, i) => `${i + 1}. ${c}`).join('\n')
	})

	// Build user prompt from template
	const userPrompt = isC1
		? getPrompt('batch-generation-user-c1.md', {
				NUM_CONSTRAINTS: combinedConstraints.length,
				QUESTION_SRT: questionSrt || ''
			})
		: getPrompt('batch-generation-user-c2c3.md', {
				NUM_CONSTRAINTS: combinedConstraints.length,
				WORD_COUNT: wordCount,
				CLIP_NUMBER: clipNumber,
				KEYWORD: keyword,
				QUESTION_SRT: questionSrt || ''
			})

	try {
		let rawResponse: string

		// Always use Claude Sonnet for batch generation (higher quality)
		if (!process.env.ANTHROPIC_API_KEY) {
			throw new Error(
				'ANTHROPIC_API_KEY environment variable is required for AI answer generation. Please set it in your .env file.'
			)
		}

		{
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
				messages: [
					{
						role: 'user',
						content: userPrompt
					}
				]
			})

			const content = message.content[0]
			if (content.type !== 'text') {
				throw new Error('Expected text response from Claude')
			}
			rawResponse = (content as { type: 'text'; text: string }).text

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
		}

		// Parse JSON response
		const jsonMatch = rawResponse.match(/\[[\s\S]*\]/)
		if (!jsonMatch) {
			throw new Error('Failed to parse JSON array from response')
		}

		const answers = JSON.parse(jsonMatch[0]) as string[]

		if (answers.length !== combinedConstraints.length) {
			throw new Error(`Expected ${combinedConstraints.length} answers, got ${answers.length}`)
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

	const systemPrompt = getPrompt('single-answer-system.md')

	const userPrompt = isC1
		? getPrompt('single-answer-user-c1.md', {
				CONSTRAINT: constraint,
				KEYWORD: keyword
			})
		: getPrompt('single-answer-user-c2c3.md', {
				WORD_COUNT: wordCount,
				CONSTRAINT: constraint,
				KEYWORD: keyword
			})

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

	const systemPrompt = getPrompt('judging-system.md')

	const answerList = answers.map((a, i) => `${i + 1}. ${a.text}`).join('\n')

	const userPrompt = getPrompt('judging-user.md', {
		NUM_ANSWERS: answers.length,
		JUDGING_CONSTRAINT: judgingConstraint,
		ANSWERS_LIST: answerList
	})

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
