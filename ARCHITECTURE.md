# jkbox Architecture

## Storage Architecture: Server State vs. Persistent Data

This is a critical distinction for understanding how jkbox handles data.

### Server State (Ephemeral)

**What:** Active game session data - rooms, connected players, current game progress

**Where:** `jkbox-rooms.db` (SQLite)

**Lifetime:**
- Lives in RAM during gameplay
- Saved to disk for crash recovery (5min window)
- **Cleared if stale (>5min old) on server startup**

**Purpose:**
- Crash recovery for active games (power loss, server restart)
- NOT long-term storage - this is ephemeral by design

**Examples:**
- Current room phase (title/lobby/playing/results)
- Connected players list
- Active game state
- Voting state
- Countdown timers

**Clearing server state:**
- Admin clicks "Hard Reset" → instant clear
- Server restarts after >5min idle → auto-clear on startup
- Like rebooting a traditional server - everything resets

### Persistent Data (Long-term)

**What:** Historical records, user data, achievements

**Where:** Future `jkbox-archive.db` or similar (not yet implemented)

**Lifetime:** Forever (or until explicitly deleted by user)

**Purpose:** Long-term storage that survives server restarts, migrations, etc.

**Examples (Future):**
- High scores
- Classic clips/highlights
- Device IDs (for device deduplication)
- Game logs/history
- User preferences

**When we say "persist to storage":**
- We mean write to long-term persistent data
- This is separate from server state

## Database Files

```
jkbox/
├── jkbox-rooms.db          # Server state (ephemeral, <5min crash recovery)
└── jkbox-archive.db        # Persistent data (future - long-term storage)
```

## Data Flow Examples

### Example 1: Normal Gameplay

```
1. Players join room
   → Server state updated (RAM + jkbox-rooms.db)

2. Game starts
   → Server state updated (phase: playing)

3. Round results
   → Server state updated (scores)
   → Future: Persist high scores to jkbox-archive.db

4. Game ends
   → Server state updated (phase: results)

5. Server restart within 5min
   → Server state restored from jkbox-rooms.db ✅

6. Server restart after >5min
   → Server state cleared (stale) ❌
   → Persistent data unchanged ✅
```

### Example 2: Hard Reset (Admin)

```
1. Admin clicks "Hard Reset"
   → Server state cleared (back to title phase)
   → Persistent data unchanged
   → Like rebooting server - fresh start
```

### Example 3: Laptop Migration

```
Old laptop:
  → Export persistent data (high scores, clips, etc.)
  → Server state NOT exported (ephemeral by design)

New laptop:
  → Import persistent data
  → Server state starts fresh (clean boot)
```

## Terminology Guide for Future Gordos

| Term | Meaning |
|------|---------|
| **Server state** | Ephemeral game session data (rooms, players, current game) |
| **Reset server state** | Clear everything, back to intro/lobby (like fresh boot) |
| **Persistent data** / **Storage** | Long-term database storage (high scores, clips, logs) |
| **Persist to storage** | Write to long-term database (NOT server state) |
| **Crash recovery** | Restoring server state from jkbox-rooms.db (if <5min old) |
| **Staleness threshold** | 5 minutes - server state older than this gets cleared |

## Code Examples

### Writing to Server State (Crash Recovery)

```typescript
// Auto-saved after every state change
roomManager.updateRoomState(roomId, newState)
// → Writes to RAM + jkbox-rooms.db (crash recovery)
```

### Future: Writing to Persistent Data

```typescript
// NOT YET IMPLEMENTED - example for future Gordos
archiveStorage.saveHighScore({
  playerId: 'abc123',
  score: 9000,
  game: 'fake-facts',
  timestamp: Date.now()
})
// → Writes to jkbox-archive.db (permanent storage)
```

### Clearing Server State

```typescript
// Method 1: Hard reset (admin button)
roomManager.updateRoomState(roomId, titleState) // Reset to intro

// Method 2: Staleness check (startup)
if (age > 5min) {
  storage.clearAllServerState() // Wipe ephemeral data
}
```

## State Management Architecture

### Phase-Based State System (Discriminated Unions)

**Core Type:** `RoomState` (packages/shared/src/types/room-state.ts)

jkbox uses **discriminated union pattern** for type-safe state management:

```typescript
type RoomState =
  | TitleState      // Intro screen (Pippin animation)
  | LobbyState      // Players joining, voting, ready-check
  | CountdownState  // 5→0 countdown before game
  | PlayingState    // Game in progress
  | ResultsState    // Winners/scores display

// Each phase has different properties, TypeScript narrows types automatically
```

**Why Discriminated Unions?**
- Type narrowing: TypeScript infers exact properties based on `phase`
- Serialization: Easy to broadcast over Socket.io
- Client rendering: Components render UI based on `state.phase`
- No invalid states: Can't have `gameVotes` in playing phase

### State Transition Flow

```
title → lobby → countdown → playing → results → lobby (repeat)
        ↑                                           ↓
        └─────────────── hard reset ───────────────┘
```

**Managed by:** `RoomManager.updateRoomState(roomId, newState)`

**Broadcast mechanism:** Socket.io room channels
```typescript
// Server updates state
roomManager.updateRoomState(roomId, newState)

// Broadcast to all clients in room
io.to(roomId).emit('room:state', { type: 'room:state', state: newState })

// Clients subscribed to roomId receive update instantly
```

### XState Integration (Future)

**Current Status:** XState machines exist (`room-machine.ts`, `round-machine.ts`) but are **not yet integrated**.

**Scaffolded but unused:**
- `room-machine.ts`: lobby → playing → finished transitions (guards for min players)
- `round-machine.ts`: submit → vote → results → complete (timer management, pause/resume)

**Future Integration Plan:**
- XState will manage **transitions and business logic** (guards, actions)
- Discriminated unions will remain for **serialization and client rendering**
- Server emits XState snapshots → converts to RoomState → broadcasts

**Why keep both?**
- XState: Server-side transition validation and logic
- Discriminated unions: Wire format for client communication
- Best of both: type-safe transitions + serializable state

See packages/server/src/fsm/README.md for XState documentation.

### Socket.io Room Channels

**Pattern:** Each room has dedicated Socket.io channel (roomId)

```typescript
// Client joins room channel
socket.emit('join', { roomId, nickname, deviceId })

// Server adds client to channel
socket.join(roomId)

// Server broadcasts to room
io.to(roomId).emit('room:state', stateMessage)

// All clients in room receive update (jumbotron, phones)
```

**Critical for hard reset:** Preserving roomId ensures clients stay subscribed during state reset.

## Architecture Principles

1. **Server state is ephemeral by design**
   - Active games don't survive long server outages
   - This is intentional - prevents orphaned game sessions

2. **Persistent data is forever**
   - High scores, clips, achievements survive restarts
   - Backed up during laptop migrations

3. **Clear separation of concerns**
   - `RoomStorage` → crash recovery (server state)
   - `ArchiveStorage` (future) → permanent records

4. **Staleness prevents zombie sessions**
   - 5min threshold ensures clean state after server restart
   - Players don't rejoin abandoned games from yesterday

5. **Discriminated unions for state**
   - Type-safe phase transitions
   - Impossible states become unrepresentable
   - Client rendering based on phase property

6. **Socket.io for real-time sync**
   - Room-based channels (one per party room)
   - Broadcast state changes to all clients
   - Auto-reconnection for mobile chaos tolerance

## When to Use What

**Use server state when:**
- Tracking active game progress
- Managing connected players
- Coordinating real-time gameplay

**Use persistent data when:**
- Saving high scores
- Recording achievements
- Storing user preferences
- Archiving game logs

**Use hard reset when:**
- Starting fresh party session
- Clearing orphaned state
- Testing from clean slate

---

**Key Insight for Future Gordos:**

When JK says "reset server state" → think "reboot server, fresh boot"
When JK says "persist to storage" → think "save to permanent database"

These are fundamentally different operations with different storage backends!
