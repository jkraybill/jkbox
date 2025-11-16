import Database from 'better-sqlite3'
import type { Room, Player } from '@jkbox/shared'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * SQLite-based persistent storage for rooms
 * Survives server restarts
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
  saveRoom(room: Room): void {
    const tx = this.db.transaction(() => {
      // Upsert room
      const stmt = this.db.prepare(`
        INSERT INTO rooms (
          id, host_id, state, current_game, created_at, updated_at,
          max_players, allow_mid_game_join, auto_advance_timers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          host_id = excluded.host_id,
          state = excluded.state,
          current_game = excluded.current_game,
          updated_at = excluded.updated_at,
          max_players = excluded.max_players,
          allow_mid_game_join = excluded.allow_mid_game_join,
          auto_advance_timers = excluded.auto_advance_timers
      `)

      stmt.run(
        room.id,
        room.hostId,
        room.state,
        room.currentGame,
        room.createdAt.getTime(),
        Date.now(),
        room.config.maxPlayers,
        room.config.allowMidGameJoin ? 1 : 0,
        room.config.autoAdvanceTimers ? 1 : 0
      )

      // Delete existing players (simpler than diff + update)
      this.db.prepare('DELETE FROM room_players WHERE room_id = ?').run(room.id)

      // Insert current players
      if (room.players.length > 0) {
        const playerStmt = this.db.prepare(`
          INSERT INTO room_players (
            id, room_id, nickname, connected, score, joined_at, is_admin
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)

        for (const player of room.players) {
          playerStmt.run(
            player.id,
            room.id,
            player.nickname,
            player.isConnected ? 1 : 0,
            player.score,
            player.connectedAt.getTime(),
            room.adminIds.includes(player.id) ? 1 : 0
          )
        }
      }
    })

    tx()
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room | undefined {
    const roomRow = this.db
      .prepare('SELECT * FROM rooms WHERE id = ?')
      .get(roomId) as any

    if (!roomRow) {
      return undefined
    }

    // Get players
    const playerRows = this.db
      .prepare('SELECT * FROM room_players WHERE room_id = ? ORDER BY joined_at ASC')
      .all(roomId) as any[]

    const players: Player[] = playerRows.map(row => ({
      id: row.id,
      roomId: roomRow.id,
      nickname: row.nickname,
      sessionToken: '', // Not persisted, will be regenerated on reconnect
      isAdmin: row.is_admin === 1,
      isHost: row.id === roomRow.host_id,
      score: row.score,
      connectedAt: new Date(row.joined_at),
      lastSeenAt: new Date(row.joined_at),
      isConnected: row.connected === 1
    }))

    // Extract admin IDs
    const adminIds = playerRows
      .filter(row => row.is_admin === 1)
      .map(row => row.id)

    // Always include host in admin list
    if (!adminIds.includes(roomRow.host_id)) {
      adminIds.push(roomRow.host_id)
    }

    const room: Room = {
      id: roomRow.id,
      hostId: roomRow.host_id,
      adminIds,
      state: roomRow.state,
      currentGame: roomRow.current_game,
      players,
      createdAt: new Date(roomRow.created_at),
      config: {
        maxPlayers: roomRow.max_players,
        allowMidGameJoin: roomRow.allow_mid_game_join === 1,
        autoAdvanceTimers: roomRow.auto_advance_timers === 1
      }
    }

    return room
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Room[] {
    const roomRows = this.db
      .prepare('SELECT id FROM rooms ORDER BY created_at DESC')
      .all() as { id: string }[]

    return roomRows
      .map(row => this.getRoom(row.id))
      .filter((room): room is Room => room !== undefined)
  }

  /**
   * Delete room (cascade deletes players via FK)
   */
  deleteRoom(roomId: string): void {
    this.db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId)
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }
}
