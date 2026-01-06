/**
 * Database abstraction layer for cross-runtime compatibility
 *
 * Uses bun:sqlite when running in Bun, falls back to better-sqlite3 for Node.js (tests)
 * This allows:
 * - Production: Single executable via Bun compile (bun:sqlite)
 * - Development/Testing: Works with vitest in Node.js (better-sqlite3)
 */

import { createRequire } from 'node:module'

// Detect if we're running in Bun
// @ts-expect-error - Bun global only exists in Bun runtime
const isBun = typeof Bun !== 'undefined'

// Re-export the appropriate Database class based on runtime
// This uses conditional require/import to avoid loading the wrong module

let Database: typeof import('bun:sqlite').Database

if (isBun) {
	// Use Bun's native SQLite - direct import works in Bun
	// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires
	Database = require('bun:sqlite').Database
} else {
	// Use better-sqlite3 for Node.js (testing)
	// createRequire allows us to use require() in ESM context
	const require = createRequire(import.meta.url)
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	Database = require('better-sqlite3')
}

export { Database }
