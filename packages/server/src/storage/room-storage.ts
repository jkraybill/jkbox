import Database from 'better-sqlite3'
import type { RoomState } from '@jkbox/shared'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * SQLite-based persistent storage for rooms (v2 - RoomState discriminated union)
 * Stores full RoomState as JSON for simplicity
 */
export class RoomStorage {
  private db: Database.Database

  constructor(dbPath: string = './jkbox-rooms.db') {
    this.db = new Database(dbPath)

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON')

    // Load and execute schema
    this.initializeSchema()
  }

  private initializeSchema(): void {
    const schemaPath = join(__dirname, '../../schema/room-persistence.sql')
    const schema = readFileSync(schemaPath, 'utf-8')

    // Execute schema (SQLite supports multiple statements)
    this.db.exec(schema)
  }

  /**
   * Save room to database (insert or update)
   */
  saveRoom(room: RoomState): void {
    const tx = this.db.transaction(() => {
      // Upsert room (serialize full state as JSON)
      const stmt = this.db.prepare(`
        INSERT INTO rooms (
          room_id, phase, state_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(room_id) DO UPDATE SET
          phase = excluded.phase,
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `)

      const now = Date.now()
      stmt.run(
        room.roomId,
        room.phase,
        JSON.stringify(room),
        now, // created_at (ignored on update due to ON CONFLICT)
        now  // updated_at
      )

      // Delete existing players (simpler than diff)
      this.db.prepare('DELETE FROM room_players WHERE room_id = ?').run(room.roomId)

      // Insert current players (denormalized for quick lookups)
      if (room.players.length > 0) {
        const playerStmt = this.db.prepare(`
          INSERT INTO room_players (
            player_id, room_id, nickname, connected, joined_at
          ) VALUES (?, ?, ?, ?, ?)
        `)

        for (const player of room.players) {
          playerStmt.run(
            player.id,
            room.roomId,
            player.nickname,
            player.isConnected ? 1 : 0,
            player.connectedAt.getTime()
          )
        }
      }
    })

    tx()
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): RoomState | undefined {
    const roomRow = this.db
      .prepare('SELECT state_json FROM rooms WHERE room_id = ?')
      .get(roomId) as { state_json: string } | undefined

    if (!roomRow) {
      return undefined
    }

    // Deserialize JSON to RoomState
    const room = JSON.parse(roomRow.state_json) as RoomState

    // Restore Date objects (JSON.parse doesn't handle Dates)
    room.players.forEach(player => {
      player.connectedAt = new Date(player.connectedAt)
      player.lastSeenAt = new Date(player.lastSeenAt)
    })

    return room
  }

  /**
   * Get all rooms
   */
  getAllRooms(): RoomState[] {
    const roomRows = this.db
      .prepare('SELECT room_id FROM rooms ORDER BY created_at DESC')
      .all() as { room_id: string }[]

    return roomRows
      .map(row => this.getRoom(row.room_id))
      .filter((room): room is RoomState => room !== undefined)
  }

  /**
   * Delete room (cascade deletes players via FK)
   */
  deleteRoom(roomId: string): void {
    this.db.prepare('DELETE FROM rooms WHERE room_id = ?').run(roomId)
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }
}
