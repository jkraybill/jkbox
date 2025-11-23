import Database from 'better-sqlite3'

/**
 * Global configuration storage (persists across server restarts)
 * Stores system-wide settings like AI player count
 */
export class GlobalConfigStorage {
	private db: Database.Database

	constructor(dbPath: string = './jkbox-config.db') {
		this.db = new Database(dbPath)
		this.initializeSchema()
	}

	private initializeSchema(): void {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
	}

	/**
	 * Get a config value
	 */
	get(key: string): string | null {
		const stmt = this.db.prepare('SELECT value FROM global_config WHERE key = ?')
		const row = stmt.get(key) as { value: string } | undefined
		return row?.value ?? null
	}

	/**
	 * Set a config value
	 */
	set(key: string, value: string): void {
		const stmt = this.db.prepare(`
      INSERT INTO global_config (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
		stmt.run(key, value, Date.now())
	}

	/**
	 * Get AI player count (default: 1)
	 */
	getAIPlayerCount(): number {
		const value = this.get('ai_player_count')
		return value ? parseInt(value, 10) : 1
	}

	/**
	 * Set AI player count
	 */
	setAIPlayerCount(count: number): void {
		this.set('ai_player_count', count.toString())
	}

	/**
	 * Close database connection
	 */
	close(): void {
		this.db.close()
	}
}

// Singleton instance
let instance: GlobalConfigStorage | null = null

export function getGlobalConfigStorage(): GlobalConfigStorage {
	if (!instance) {
		instance = new GlobalConfigStorage()
	}
	return instance
}
