# Game Module FSM Boundary Contract

## Overview

This document defines the **State Machine Boundary** between the **jkbox lobby system** and **individual game modules**. Game modules are pluggable components that manage their own gameplay logic while the lobby system orchestrates high-level transitions.

---

## FSM Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Lobby FSM (jkbox core)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  title → lobby → countdown → ┌──────────────┐ → results → lobby │
│                               │    PLAYING   │                   │
│                               │  (game owns) │                   │
│                               └──────────────┘                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Phases:
1. **title** - Welcome screen with Pippin animation
2. **lobby** - Players join, vote on games, mark ready
3. **countdown** - 5→0 countdown before game starts
4. **playing** - **Game module owns FSM** ← Boundary
5. **results** - Show winners/scores/achievements
6. Back to **lobby** - Ready for next game

---

## Boundary Contract

### 1. ENTER: Lobby → Game (countdown → playing)

**Trigger:** Countdown reaches 0

**Lobby responsibilities:**
- Validate player count against `gameModule.minPlayers`/`maxPlayers`
- Create `GameModuleHost` instance
- Call `gameModuleHost.initialize()`

**Game responsibilities:**
- Accept `initialize(players, context)` call
- Store `context.complete` callback for later use
- Return initial `GameState`
- **Game now owns FSM** until it calls `context.complete()`

```typescript
// Server-side (lobby system)
const gameModule = registry.get('cinema-pippin')
const host = new GameModuleHost({
  roomId,
  gameModule,
  players,
  roomManager
})

const initialState = await host.initialize()

// Transition: countdown → playing
const playingState: PlayingState = {
  phase: 'playing',
  roomId,
  players,
  gameId: gameModule.id,
  gameState: initialState  // Opaque to lobby
}
```

---

### 2. DURING: Game Owns FSM (playing phase)

**Lobby responsibilities:**
- Route player actions to `gameModuleHost.handleAction()`
- Store updated `gameState` (opaque - lobby doesn't interpret it)
- Broadcast state updates to all clients

**Game responsibilities:**
- Process player actions via `handleAction(action, state)`
- Update internal game state (immutable pattern)
- Manage game progression, rounds, scoring, etc.
- **Decide when game is complete**

```typescript
// Player submits action from phone
socket.on('game:action', async (action: GameAction) => {
  const updatedState = await gameModuleHost.handleAction(action)

  // Broadcast new state (lobby doesn't inspect it)
  io.to(roomId).emit('room:state', {
    type: 'room:state',
    state: { ...room, gameState: updatedState }
  })
})
```

**Key point:** Lobby treats `gameState` as **opaque blob**. Only game module interprets it.

---

### 3. EXIT: Game → Lobby (playing → results)

**Trigger:** Game calls `context.complete(results)`

**Game responsibilities:**
- Detect game completion (final round, time limit, etc.)
- Calculate final scores, winners, achievements
- **Call `context.complete(results)`** to request exit

**Lobby responsibilities:**
- Receive completion callback
- Validate results structure
- Transition: `playing → results`
- Broadcast results to clients
- Call `gameModuleHost.cleanup()` after results phase

```typescript
// Inside game module (e.g., after final round)
const results: GameResults = {
  winners: ['player-1', 'player-3'],  // Can have multiple for ties
  scores: {
    'player-1': 150,
    'player-2': 120,
    'player-3': 150
  },
  achievements: [
    { playerId: 'player-1', achievementId: 'perfect', label: 'Perfect Round!' }
  ]
}

// Game signals completion - FSM boundary crossed
context.complete(results)
```

```typescript
// Lobby system receives callback (in GameModuleHost)
private handleGameComplete(results: GameResults): void {
  console.log('Game completed, transitioning to results')

  // FSM transition: playing → results
  this.roomManager.transitionToResults(this.roomId, {
    gameId: this.gameModule.id,
    results
  })
}
```

---

## TypeScript Interfaces

### GameModule Interface

```typescript
export interface GameModule {
  id: GameId
  name: string
  minPlayers: number
  maxPlayers: number

  // ENTER boundary
  initialize(players: Player[], context: GameModuleContext): Promise<GameState>

  // DURING (game owns FSM)
  handleAction(action: GameAction, state: GameState): Promise<GameState>

  // Optional: Fallback polling (deprecated - use context.complete())
  isComplete?(state: GameState): boolean
  getResults?(state: GameState): GameResults

  // Lazy-loaded UI components
  loadJumbotronComponent(): Promise<React.ComponentType<JumbotronProps>>
  loadControllerComponent(): Promise<React.ComponentType<ControllerProps>>

  // EXIT boundary
  cleanup?(): Promise<void>
}
```

### GameModuleContext (passed to game)

```typescript
export interface GameModuleContext {
  roomId: string

  // EXIT callback - game calls this to signal completion
  complete: (results: GameResults) => void
}
```

### GameResults (returned at exit)

```typescript
export interface GameResults {
  winners: string[]  // Player IDs (can have multiple for ties)
  scores: Record<string, number>  // playerId → final score
  achievements?: Achievement[]  // Optional awards/trophies
  stats?: Record<string, unknown>  // Game-specific statistics
}
```

---

## Example: Minimal Game Module

```typescript
import type { GameModule, GameModuleContext, Player, GameState } from '@jkbox/shared'

export const triviaGame: GameModule = {
  id: 'trivia',
  name: 'Trivia Night',
  minPlayers: 2,
  maxPlayers: 8,

  // ENTER: Initialize game
  async initialize(players: Player[], context: GameModuleContext): Promise<GameState> {
    const state = {
      round: 1,
      maxRounds: 5,
      currentQuestion: questions[0],
      answers: {}
    }

    // Store context for later
    this.context = context
    return state
  },

  // DURING: Handle actions
  async handleAction(action, state) {
    if (action.type === 'submit-answer') {
      state.answers[action.playerId] = action.payload.answer

      // Check if round complete
      if (Object.keys(state.answers).length === state.players.length) {
        state.round++
        state.answers = {}

        // Check if game complete
        if (state.round > state.maxRounds) {
          // EXIT: Signal completion
          this.context.complete({
            winners: calculateWinners(state),
            scores: calculateScores(state)
          })
        }
      }
    }

    return state
  },

  // Lazy-load components
  async loadJumbotronComponent() {
    return (await import('./TriviaJumbotron')).TriviaJumbotron
  },

  async loadControllerComponent() {
    return (await import('./TriviaController')).TriviaController
  }
}
```

---

## Server-Side Integration

### GameModuleHost (Orchestrator)

The `GameModuleHost` class manages a single game session:

```typescript
// Lobby creates host when transitioning to playing phase
const host = new GameModuleHost({
  roomId: 'ABC123',
  gameModule: triviaGame,
  players: [...],
  roomManager
})

// ENTER: Initialize game
const initialState = await host.initialize()

// DURING: Route actions
const newState = await host.handleAction(action)

// EXIT: Host automatically handles completion callback
// (game calls context.complete() → host transitions room to results)

// After results phase: cleanup
await host.cleanup()
```

---

## Key Principles

1. **Single Responsibility:** Lobby manages transitions, game manages gameplay
2. **Opaque State:** Lobby never inspects `gameState` - it's a black box
3. **Event-Driven Exit:** Game signals completion via callback (no polling)
4. **Immutability:** `handleAction()` returns new state (functional pattern)
5. **Lazy Loading:** UI components loaded on-demand (code-splitting)

---

## Migration Path (for existing games)

**Old pattern (polling):**
```typescript
// Lobby polls game
if (gameModule.isComplete(state)) {
  const results = gameModule.getResults(state)
  transitionToResults(results)
}
```

**New pattern (event-driven):**
```typescript
// Game signals completion
context.complete(results)
```

**Backward compatibility:** `GameModuleHost.checkCompletion()` provides polling fallback for games not yet migrated.

---

## Testing

### Unit Test Template

```typescript
test('game module FSM boundary', async () => {
  let capturedResults: GameResults | null = null

  // Mock context
  const context: GameModuleContext = {
    roomId: 'TEST',
    complete: (results) => { capturedResults = results }
  }

  // ENTER
  const state = await gameModule.initialize(players, context)

  // DURING
  const updatedState = await gameModule.handleAction(winningAction, state)

  // EXIT
  expect(capturedResults).toBeTruthy()
  expect(capturedResults.winners).toContain('player-1')
})
```

---

## FAQ

**Q: Can a game transition back to lobby mid-game?**
A: No - game must call `context.complete()` to exit. Results phase always shown first.

**Q: Can game access lobby state (e.g., other rooms)?**
A: No - game only receives `roomId` and `players`. Strict boundary enforces modularity.

**Q: How does game communicate with clients?**
A: Game updates `gameState`, lobby broadcasts it. UI components render based on state.

**Q: Can game make HTTP requests?**
A: Yes - game can fetch external data, but should be self-contained.

**Q: What if game crashes?**
A: Host catches errors, lobby can force-exit via admin tools. Crash recovery TBD (#issue).

---

**Status:** ✅ FSM boundary defined
**Next:** Implement first game module (Cinema Pippin) using this pattern
