-- Room persistence schema for jkbox server
-- SQLite database to persist party room state across server restarts

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, -- Room code (e.g., "ABCD")
  host_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('lobby', 'playing', 'finished')),
  current_game TEXT, -- GameModule name (null if in lobby)
  created_at INTEGER NOT NULL, -- Unix timestamp
  updated_at INTEGER NOT NULL, -- Unix timestamp

  -- Config
  max_players INTEGER NOT NULL DEFAULT 12,
  allow_mid_game_join INTEGER NOT NULL DEFAULT 0, -- SQLite boolean (0/1)
  auto_advance_timers INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_rooms_state ON rooms(state);
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);

-- Players in rooms
CREATE TABLE IF NOT EXISTS room_players (
  id TEXT PRIMARY KEY, -- Player session token
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  connected INTEGER NOT NULL DEFAULT 1, -- 0 = disconnected, 1 = connected
  score INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL, -- Unix timestamp

  -- Admin status
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_connected ON room_players(connected);

-- Game state (for playing rooms)
-- Stores current round data, answers, etc.
CREATE TABLE IF NOT EXISTS room_game_state (
  room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  current_round INTEGER NOT NULL DEFAULT 0,
  total_rounds INTEGER NOT NULL,
  round_data TEXT, -- JSON blob with round-specific data
  updated_at INTEGER NOT NULL
);
