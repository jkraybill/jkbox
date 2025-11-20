# State Machines (XState)

This directory contains all state machines for jkbox, built with [XState v5](https://stately.ai/docs/xstate).

## Why XState?

- **Type-safe**: Full TypeScript support with typed events, context, and states
- **Visualizer**: Debug state transitions with Stately Inspector
- **Testable**: Guards and actions are easily unit-tested
- **Documented**: State machines self-document business logic

## State Machines

### Room Machine (`room-machine.ts`)

**Purpose:** Manages room lifecycle (lobby → playing → finished)

**States:**
- `lobby`: Players joining, waiting to start
- `playing`: Game in progress
- `finished`: Game completed, showing results

**Events:**
- `START_GAME`: Transition from lobby → playing (requires min 3 players)
- `GAME_END`: Transition from playing → finished
- `RESET`: Transition from finished → lobby
- `UPDATE_PLAYER_COUNT`: Update player count in context

**Guards:**
- `hasEnoughPlayers`: Prevents game start with < 3 players

**Future:** Will be expanded with lobby sub-states (voting, ready-check, countdown) per #30

### Round Machine (`round-machine.ts`)

**Purpose:** Manages individual round phases within a game

**States:**
- `submit`: Players submitting answers
- `vote`: Players voting on answers
- `results`: Displaying round results
- `complete`: Round finished (final state)

**Events:**
- `TIME_UP`: Advance to next phase (blocked if paused)
- `ADMIN_SKIP`: Force advance to next phase (overrides pause)
- `PAUSE`: Pause timer progression
- `RESUME`: Resume timer progression

**Guards:**
- `isNotPaused`: Blocks TIME_UP transitions when paused

**Context:**
- `submitTimer`: Seconds for submit phase
- `voteTimer`: Seconds for vote phase
- `resultsTimer`: Seconds for results phase
- `isPaused`: Whether timers are paused

## Client State Machines

### Connection Machine (`packages/client/src/fsm/connection-machine.ts`)

**Purpose:** Manages WebSocket connection with auto-reconnect

**States:**
- `disconnected`: Not connected
- `connecting`: Attempting to connect
- `connected`: Active connection
- `reconnecting`: Connection lost, retrying

**Events:**
- `CONNECT`: Start connection
- `CONNECTED`: Connection successful
- `DISCONNECT`: Intentional disconnect
- `CONNECTION_LOST`: Unexpected disconnect
- `CONNECT_ERROR`: Connection failed
- `RETRY`: Retry connection
- `GIVE_UP`: Stop retrying

**Features:**
- Exponential backoff: 1s → 2s → 4s → 8s → 16s (max 5 retries)
- Mobile chaos tolerance (handles screen locks, network drops)

## Visualizer (Development)

### Server Inspector

Enable XState inspector for server-side machines:

```bash
# .env
XSTATE_INSPECT=true
```

Start server, then visit: https://stately.ai/registry/inspect

### Client Inspector

Automatically enabled in development mode (Vite's `import.meta.env.DEV`).

To disable:
```javascript
localStorage.setItem('xstate-inspect-disabled', 'true')
```

Then refresh the page.

### Using the Inspector

1. Start the app (server/client in dev mode)
2. Visit https://stately.ai/registry/inspect
3. Select your running machines from the list
4. See real-time state transitions, events, and context changes

**Pro tip:** Inspector is invaluable for debugging lobby voting logic and reconnection scenarios!

## Testing State Machines

All machines have corresponding `.test.ts` files with full coverage.

**Testing pattern:**
```typescript
import { createActor } from 'xstate'
import { roomMachine } from './room-machine'

it('should prevent game start with < 3 players', () => {
  const actor = createActor(roomMachine, {
    input: { playerCount: 2 }
  })
  actor.start()

  actor.send({ type: 'START_GAME' })

  // Should stay in lobby (guard blocked transition)
  expect(actor.getSnapshot().value).toBe('lobby')
})
```

Run tests:
```bash
npm test
```

## Architecture Decisions

### Why Discriminated Unions for RoomState?

XState handles transitions, but we use discriminated unions (`RoomState` in `packages/shared/src/types/room-state.ts`) for serializing state to clients. This gives us:

- **Type narrowing**: TypeScript infers exact state properties
- **Serialization**: Easy to send over WebSocket
- **Client-side rendering**: Components render based on phase

**Flow:**
1. XState manages server-side transitions
2. Server serializes current state → `RoomState` discriminated union
3. Broadcast to clients via WebSocket
4. Clients render UI based on `phase` property

### Why Separate Machines?

- **Room Machine**: Persistent (lasts entire party session)
- **Round Machine**: Ephemeral (created per round, discarded after)
- **Connection Machine**: Client-side only (network layer)

This separation keeps concerns clear and makes testing easier.

## Future Enhancements

### Lobby Sub-states (#30, #39, #40, #41)

Room machine will expand to:

```
lobby
├── voting (game selection)
├── ready-check (waiting for all players to mark ready)
└── countdown (5 → 0 countdown before game starts)
```

This enables proper voting UI, ready states, and countdown transitions.

### Persistent Machine States (#29)

Room machines will be serialized to SQLite for crash recovery:
- Serialize machine snapshot on every transition
- Restore from storage on server restart
- Players can reconnect to in-progress games

### Admin Controls

- Pause/resume game (already supported in round machine)
- Force advance round (ADMIN_SKIP event)
- Kick player (future)

## Resources

- [XState v5 Docs](https://stately.ai/docs/xstate)
- [Stately Inspector](https://stately.ai/registry/inspect)
- [Visualizer Guide](https://stately.ai/docs/developer-tools)
- [Testing Guide](https://stately.ai/docs/testing)

---

**Built with:** XState v5.24.0
**Inspector:** Stately AI
**Framework:** Gordo v0.8.0+
