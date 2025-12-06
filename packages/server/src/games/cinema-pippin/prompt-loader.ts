/**
 * Prompt Loader - Hot-reloadable prompt templates from .md files
 * Automatically watches for file changes and reloads prompts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

/**
 * Find the prompts directory
 * Searches multiple locations for packaged vs dev environments
 */
function findPromptsDir(): string {
	const __filename = fileURLToPath(import.meta.url)
	const __dirname = path.dirname(__filename)

	const promptsPaths = [
		path.join(process.cwd(), 'prompts'),                           // Packaged: next to executable
		path.join(__dirname, 'prompts'),                               // Dev: relative to prompt-loader.ts
		path.join(__dirname, '../prompts'),                            // Dev: one level up
		'/home/jk/jkbox/packages/server/src/games/cinema-pippin/prompts', // Fallback: absolute dev path
	]

	// Normalize paths for Windows (remove leading slash from /C:/...)
	const normalizedPaths = promptsPaths.map(p => {
		if (process.platform === 'win32' && p.startsWith('/') && p[2] === ':') {
			return p.substring(1)
		}
		return p
	})

	const promptsPath = normalizedPaths.find(p => fs.existsSync(p))

	if (!promptsPath) {
		console.error('[PromptLoader] Searched paths:', normalizedPaths)
		throw new Error('Prompts directory not found! Searched: ' + normalizedPaths.join(', '))
	}

	console.log(`[PromptLoader] Using prompts directory: ${promptsPath}`)
	return promptsPath
}

// Lazy-initialize PROMPTS_DIR on first access
let _promptsDir: string | null = null
function getPromptsDir(): string {
	if (_promptsDir === null) {
		_promptsDir = findPromptsDir()
	}
	return _promptsDir
}

// Cache for loaded prompts
const promptCache = new Map<string, string>()

// File watchers
const watchers = new Map<string, fs.FSWatcher>()

/**
 * Load a prompt from a .md file and set up a file watcher for hot-reload
 */
function loadPrompt(filename: string): string {
	const filepath = path.join(getPromptsDir(), filename)

	// Read the file
	const content = fs.readFileSync(filepath, 'utf-8')

	// Cache it
	promptCache.set(filename, content)

	// Set up file watcher if not already watching
	if (!watchers.has(filename)) {
		const watcher = fs.watch(filepath, (eventType) => {
			if (eventType === 'change') {
				console.log(`[PromptLoader] Detected change in ${filename}, reloading...`)
				try {
					const newContent = fs.readFileSync(filepath, 'utf-8')
					promptCache.set(filename, newContent)
					console.log(`[PromptLoader] Successfully reloaded ${filename}`)
				} catch (error) {
					console.error(`[PromptLoader] Error reloading ${filename}:`, error)
				}
			}
		})
		watchers.set(filename, watcher)
		console.log(`[PromptLoader] Watching ${filename} for changes`)
	}

	return content
}

/**
 * Get a prompt template and replace placeholders with values
 */
export function getPrompt(
	filename: string,
	replacements: Record<string, string | number> = {}
): string {
	// Load from cache or file
	let template = promptCache.get(filename)
	if (!template) {
		template = loadPrompt(filename)
	}

	// Replace all {{PLACEHOLDER}} with values
	let result = template
	for (const [key, value] of Object.entries(replacements)) {
		const placeholder = `{{${key}}}`
		result = result.replace(new RegExp(placeholder, 'g'), String(value))
	}

	return result
}

/**
 * Cleanup - stop all file watchers
 */
export function cleanupPromptLoader(): void {
	for (const [filename, watcher] of watchers.entries()) {
		watcher.close()
		console.log(`[PromptLoader] Stopped watching ${filename}`)
	}
	watchers.clear()
	promptCache.clear()
}

// Cleanup on process exit
process.on('exit', cleanupPromptLoader)
process.on('SIGINT', () => {
	cleanupPromptLoader()
	process.exit()
})
