# Cinema Pippin State Architecture

## State Scoping and Boundaries

Understanding state scope is **critical** to prevent bugs like keyword pollution between films.

### State Scope Levels

Cinema Pippin has three distinct state scope levels:

```
Game-Scoped (Entire 3-film game)
├─ scores: Map<playerId, totalPoints>
├─ scoresBeforeRound: Map<playerId, pointsBeforeThisFilm>
├─ keywords: string[] // C1 winner for each film [film1_c1, film2_c1, film3_c1]
└─ currentFilmIndex: 0-2

Film-Scoped (Per film, cleared between films)
├─ clipWinners: string[] // Winners for this film's 3 clips
├─ voteCountsThisRound: Map<playerId, votesReceivedThisFilm>
└─ currentClipIndex: 0-3

Clip-Scoped (Per clip, cleared between clips)
├─ playerAnswers: Map<playerId, answer>
├─ votes: Map<playerId, answerId>
├─ allAnswers: Answer[]
└─ phase: GamePhase
```

## Critical State Transitions

### Between Clips (within same film)
**Function:** `advanceToNextClip()`
**What gets cleared:**
- `playerAnswers` (clip-scoped)
- `votes` (clip-scoped)
- `allAnswers` (clip-scoped)

**What gets preserved:**
- `clipWinners` ✅ (accumulates across clips 1→2→3)
- `keywords` ✅ (game-scoped)
- `scores` ✅ (game-scoped)

### Between Films (Film 1 → Film 2 → Film 3)
**Function:** `advanceToNextFilm()`
**What gets cleared:**
- `playerAnswers` (clip-scoped)
- `votes` (clip-scoped)
- `allAnswers` (clip-scoped)
- **`clipWinners`** ⚠️ **CRITICAL** (film-scoped, MUST be cleared)
- `voteCountsThisRound` (film-scoped)

**What gets preserved:**
- `keywords` ✅ (game-scoped, keeps all films' C1 winners)
- `scores` ✅ (game-scoped)
- `scoresBeforeRound` ✅ (updated at film start)

## The Keyword System

### How Keywords Flow Through Films

**Film 1:**
- C1: Player answers stored in `clipWinners[0]`
- C1 winner stored in `keywords[0]` (e.g., "pizza")
- C2: Uses `clipWinners[0]` as keyword → subtitles replace `[keyword]` with "pizza"
- C3: Uses `clipWinners[0]` as keyword → subtitles replace `[keyword]` with "pizza"

**Transition to Film 2:**
- ⚠️ **MUST clear `clipWinners = []`** before starting Film 2
- `keywords[0]` is preserved (contains Film 1's C1 winner)

**Film 2:**
- C1: Player answers stored in `clipWinners[0]`
- C1 winner stored in `keywords[1]` (e.g., "tacos")
- C2: Uses `clipWinners[0]` as keyword → subtitles replace `[keyword]` with "tacos" (NOT "pizza"!)
- C3: Uses `clipWinners[0]` as keyword → subtitles replace `[keyword]` with "tacos"

### The Bug (Fixed)

**Before Fix:**
```typescript
advanceToNextFilm() {
  this.state.currentFilmIndex++
  this.clearAnswers()
  this.clearVotes()
  // clipWinners NOT cleared! 🐛
}
```

**Impact:**
- Film 1 ends with `clipWinners = ['pizza', 'spaghetti', 'lasagna']`
- Film 2 starts, clipWinners still contains Film 1 data
- Film 2 C2 uses `clipWinners[0]` → gets "pizza" (Film 1's keyword!)
- Film 2 C1 winner "tacos" is ignored

**After Fix:**
```typescript
advanceToNextFilm() {
  this.state.currentFilmIndex++
  this.clearAnswers()
  this.clearVotes()
  this.state.clipWinners = [] // ✅ Clear film-scoped state
}
```

## Implementation Guidelines

### When Adding New State

Ask these questions:

1. **What is the scope of this state?**
   - Game-scoped: Preserved across all films
   - Film-scoped: Cleared when advancing to next film
   - Clip-scoped: Cleared when advancing to next clip

2. **Where should it be cleared?**
   - Game-scoped: Only cleared at game end
   - Film-scoped: Clear in `advanceToNextFilm()`
   - Clip-scoped: Clear in `advanceToNextClip()`

3. **Does it reference other state?**
   - Be careful with arrays indexed by `currentFilmIndex` or `currentClipIndex`
   - Ensure the referenced state exists at that scope

### Code Review Checklist

When reviewing state changes:

- [ ] Is new state properly scoped?
- [ ] Is it cleared at the right boundary?
- [ ] Does `advanceToNextFilm()` clear all film-scoped state?
- [ ] Does `advanceToNextClip()` clear all clip-scoped state?
- [ ] Are there tests verifying state isolation?

## Testing State Boundaries

Always test state transitions:

```typescript
it('should clear film-scoped state between films', () => {
  // Populate Film 1 state
  game.getState().clipWinners = ['f1c1', 'f1c2', 'f1c3']

  // Advance to Film 2
  game.advanceToNextFilm()

  // Verify Film 1 state is cleared
  expect(game.getState().clipWinners).toHaveLength(0)
})
```

See `state-isolation.test.ts` for comprehensive examples.

## Common Pitfalls

### ❌ Using wrong array index
```typescript
// BAD: Uses currentClipIndex to access game-scoped array
const keyword = this.state.keywords[this.state.currentClipIndex]
```

### ❌ Forgetting to clear film-scoped state
```typescript
advanceToNextFilm() {
  this.state.currentFilmIndex++
  // Forgot to clear clipWinners, voteCountsThisRound, etc.
}
```

### ❌ Clearing game-scoped state
```typescript
advanceToNextFilm() {
  this.state.keywords = [] // BAD! Loses all films' keywords
}
```

### ✅ Correct patterns
```typescript
// Use currentFilmIndex for game-scoped arrays
const keyword = this.state.keywords[this.state.currentFilmIndex]

// Use clipWinners[0] for current film's C1 winner
const c1Winner = this.state.clipWinners[0]

// Clear film-scoped state at film boundaries
advanceToNextFilm() {
  this.state.clipWinners = []
  this.state.voteCountsThisRound.clear()
}
```

## Debugging State Issues

If you encounter cross-film pollution:

1. Check `advanceToNextFilm()` - is all film-scoped state cleared?
2. Check `advanceToNextClip()` - is all clip-scoped state cleared?
3. Add logging at state transitions
4. Write a regression test before fixing

Example debug logging:
```typescript
advanceToNextFilm() {
  console.log(`[State] Advancing Film ${this.state.currentFilmIndex} → ${this.state.currentFilmIndex + 1}`)
  console.log(`[State] clipWinners before clear:`, this.state.clipWinners)
  this.state.clipWinners = []
  console.log(`[State] clipWinners after clear:`, this.state.clipWinners)
}
```
