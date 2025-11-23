/**
 * Prompt Loader - Hot-reloadable prompt templates from .md files
 * Automatically watches for file changes and reloads prompts
 */

import * as fs from 'fs'
import * as path from 'path'

const PROMPTS_DIR = path.join(__dirname, 'prompts')

// Cache for loaded prompts
const promptCache = new Map<string, string>()

// File watchers
const watchers = new Map<string, fs.FSWatcher>()

/**
 * Load a prompt from a .md file and set up a file watcher for hot-reload
 */
function loadPrompt(filename: string): string {
	const filepath = path.join(PROMPTS_DIR, filename)

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
