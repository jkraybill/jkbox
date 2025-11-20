-- Room persistence schema for jkbox server (v2 - RoomState discriminated union)
-- SQLite database to persist party room state across server restarts

-- Rooms table - stores full RoomState as JSON
CREATE TABLE IF NOT EXISTS rooms (
  room_id TEXT PRIMARY KEY, -- Room code (e.g., "ABCD")
  phase TEXT NOT NULL CHECK(phase IN ('title', 'lobby', 'countdown', 'playing', 'results')),
  state_json TEXT NOT NULL, -- Full RoomState serialized as JSON
  created_at INTEGER NOT NULL, -- Unix timestamp
  updated_at INTEGER NOT NULL -- Unix timestamp
);

CREATE INDEX IF NOT EXISTS idx_rooms_phase ON rooms(phase);
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);

-- Players table (denormalized for quick lookups)
CREATE TABLE IF NOT EXISTS room_players (
  player_id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  connected INTEGER NOT NULL DEFAULT 1, -- 0 = disconnected, 1 = connected
  joined_at INTEGER NOT NULL, -- Unix timestamp

  PRIMARY KEY (player_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_connected ON room_players(connected);
