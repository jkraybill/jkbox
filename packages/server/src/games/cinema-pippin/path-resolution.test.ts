/**
 * Path Resolution Integration Tests
 *
 * These tests verify that all required external files can be found
 * in both dev and packaged environments. This prevents regressions
 * where the packaged exe can't find constraints.txt, prompts, clips, etc.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { loadConstraints } from './ai-player'
import { getPrompt } from './prompt-loader'
import { getAvailableFilms, getAvailableSequences, loadClipsFromSequence } from './film-loader'

// Get current directory for relative path tests
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Path Resolution - Constraints', () => {
	it('should find constraints.txt in at least one expected location', () => {
		const constraintsPaths = [
			path.join(process.cwd(), 'constraints.txt'),
			path.join(process.cwd(), 'assets/constraints.txt'),
			path.join(__dirname, '../../../../../assets/constraints.txt'),
			path.join(__dirname, '../../../../../../assets/constraints.txt'),
			'/home/jk/jkbox/assets/constraints.txt',
		]

		const found = constraintsPaths.find(p => fs.existsSync(p))
		expect(found).toBeDefined()
		console.log(`[Test] Found constraints.txt at: ${found}`)
	})

	it('should load valid constraints from file', () => {
		const constraints = loadConstraints()

		expect(Array.isArray(constraints)).toBe(true)
		expect(constraints.length).toBeGreaterThan(0)

		// Each constraint should be a non-empty string
		for (const constraint of constraints) {
			expect(typeof constraint).toBe('string')
			expect(constraint.length).toBeGreaterThan(0)
		}

		console.log(`[Test] Loaded ${constraints.length} constraints`)
	})
})

describe('Path Resolution - Prompts', () => {
	const requiredPrompts = [
		'batch-generation-system.md',
		'batch-generation-user-c1.md',
		'batch-generation-user-c2c3.md',
		'batch-generation-user-film-title.md',
		'judging-system.md',
		'judging-user.md',
		'single-answer-system.md',
		'single-answer-user-c1.md',
		'single-answer-user-c2c3.md',
	]

	it('should find prompts directory in at least one expected location', () => {
		const promptsPaths = [
			path.join(process.cwd(), 'prompts'),
			path.join(__dirname, 'prompts'),
			path.join(__dirname, '../prompts'),
			'/home/jk/jkbox/packages/server/src/games/cinema-pippin/prompts',
		]

		const found = promptsPaths.find(p => fs.existsSync(p))
		expect(found).toBeDefined()
		console.log(`[Test] Found prompts directory at: ${found}`)
	})

	it.each(requiredPrompts)('should find prompt file: %s', (promptFile) => {
		const promptsPaths = [
			path.join(process.cwd(), 'prompts'),
			path.join(__dirname, 'prompts'),
			path.join(__dirname, '../prompts'),
			'/home/jk/jkbox/packages/server/src/games/cinema-pippin/prompts',
		]

		const promptsDir = promptsPaths.find(p => fs.existsSync(p))
		expect(promptsDir).toBeDefined()

		const promptPath = path.join(promptsDir!, promptFile)
		expect(fs.existsSync(promptPath)).toBe(true)

		// Verify file has content
		const content = fs.readFileSync(promptPath, 'utf-8')
		expect(content.length).toBeGreaterThan(0)
	})

	it('should load prompts via getPrompt helper', () => {
		const systemPrompt = getPrompt('batch-generation-system.md', {
			WORD_COUNT_C2: 4,
			WORD_COUNT_C3: 3,
			NUM_CONSTRAINTS: 3,
			ANSWER_TYPE: 'WORDS',
			CONSTRAINTS_LIST: '1. Test\n2. Test2\n3. Test3',
			CONSTRAINT_1: 'Test',
			CONSTRAINT_2: 'Test2',
			CONSTRAINT_3: 'Test3',
		})

		expect(typeof systemPrompt).toBe('string')
		expect(systemPrompt.length).toBeGreaterThan(0)
		// Verify placeholders were replaced
		expect(systemPrompt).not.toContain('{{NUM_CONSTRAINTS}}')
	})
})

describe('Path Resolution - Clips', () => {
	it('should find clips directory in at least one expected location', () => {
		const clipsPaths = [
			path.join(process.cwd(), 'clips'),
			path.join(process.cwd(), 'generated/clips'),
			path.join(__dirname, '../../../../../generated/clips'),
			path.join(__dirname, '../../../../../../generated/clips'),
			'/home/jk/jkbox/generated/clips',
		]

		const found = clipsPaths.find(p => fs.existsSync(p))
		expect(found).toBeDefined()
		console.log(`[Test] Found clips directory at: ${found}`)
	})

	it('should have at least one film in clips directory', () => {
		const films = getAvailableFilms()

		expect(Array.isArray(films)).toBe(true)
		expect(films.length).toBeGreaterThan(0)

		console.log(`[Test] Found ${films.length} films`)
	})

	it('should be able to load clips for at least one film', () => {
		const films = getAvailableFilms()
		expect(films.length).toBeGreaterThan(0)

		const firstFilm = films[0]
		const sequences = getAvailableSequences(firstFilm)
		expect(sequences.length).toBeGreaterThan(0)

		const clips = loadClipsFromSequence(firstFilm, sequences[0])
		expect(clips.length).toBe(3) // Should have 3 clips per sequence

		// Each clip should have required properties
		for (const clip of clips) {
			expect(clip.clipNumber).toBeGreaterThanOrEqual(1)
			expect(clip.clipNumber).toBeLessThanOrEqual(3)
			expect(typeof clip.videoPath).toBe('string')
			expect(typeof clip.srtPath).toBe('string')
			expect(fs.existsSync(clip.videoPath)).toBe(true)
			expect(fs.existsSync(clip.srtPath)).toBe(true)
		}

		console.log(`[Test] Loaded 3 clips from ${firstFilm}/${sequences[0]}`)
	})
})

describe('Path Resolution - Build Output Simulation', () => {
	/**
	 * This test simulates what happens when running from a packaged exe
	 * by checking if the paths would work relative to process.cwd()
	 *
	 * In packaged mode:
	 * - process.cwd() = directory containing jkbox-server.exe
	 * - Expected files: constraints.txt, prompts/, clips/, client-dist/
	 */

	it('should document required files for packaged exe', () => {
		const requiredForPackage = [
			'constraints.txt',
			'prompts/batch-generation-system.md',
			'prompts/batch-generation-user-c1.md',
			'prompts/batch-generation-user-c2c3.md',
			'prompts/batch-generation-user-film-title.md',
			'prompts/judging-system.md',
			'prompts/judging-user.md',
			'clips/', // directory
			'client-dist/', // directory
			'.env',
		]

		// This test just documents what's needed - actual verification
		// happens when running the packaged exe
		console.log('[Test] Required files for packaged exe:')
		requiredForPackage.forEach(f => console.log(`  - ${f}`))

		expect(requiredForPackage.length).toBeGreaterThan(0)
	})
})
