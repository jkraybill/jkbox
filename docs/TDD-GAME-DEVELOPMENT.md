# TDD Strategy for Game Development

## The Problem
Manually testing game phase transitions in the browser is:
- **Slow**: Need to reload, click through UI, wait for timers
- **Error-prone**: Easy to miss edge cases
- **Not repeatable**: Hard to test the same scenario consistently

## The Solution: 3-Layer Testing Pyramid

### Layer 1: Unit Tests (Core Game Logic)
**Location**: `packages/server/src/games/cinema-pippin/*.test.ts`

**What to test**:
- Phase transitions
- State mutations
- Score calculations
- Player answer handling

**Example**:
```typescript
it('should advance from clip_intro to clip_playback', () => {
  game.advancePhase()
  expect(game.getPhase()).toBe('clip_playback')
})
```

**When to run**: Every time you change game logic
```bash
npm test -- cinema-pippin.test
```

### Layer 2: Component Integration Tests (Timer/Event Flow)
**Location**: `packages/client/src/games/*/ComponentName.test.tsx`

**What to test**:
- Timers fire correctly
- Events are sent to server
- UI renders correct phases
- State changes trigger correct behaviors

**Example**:
```typescript
it('should auto-advance after 3 seconds', async () => {
  vi.useFakeTimers()
  const sendToServer = vi.fn()

  render(<Component state={{phase: 'clip_intro'}} sendToServer={sendToServer} />)

  vi.advanceTimersByTime(3000)

  expect(sendToServer).toHaveBeenCalledWith({
    type: 'INTRO_COMPLETE',
    ...
  })
})
```

**When to run**: When you add timers, auto-transitions, or event handlers
```bash
npm test -- CinemaPippinJumbotron.test
```

### Layer 3: E2E Tests (Full Game Flow - FUTURE)
**Location**: `packages/e2e/` (not yet implemented)

**What to test**:
- Full game from start to finish
- Multi-player interactions
- Network disconnections

**Tools**: Playwright/Cypress

## TDD Workflow

### Before Browser Testing
1. **Write the test first**
   ```bash
   # Create test file
   touch packages/client/src/games/my-game/MyComponent.test.tsx
   ```

2. **Run test (it should fail)**
   ```bash
   npm test -- MyComponent.test
   ```

3. **Implement the feature**
   - Add timer
   - Add event handler
   - Add state logic

4. **Run test again (it should pass)**
   ```bash
   npm test -- MyComponent.test
   ```

5. **Only then** check in browser to verify UX/polish

### Example: Adding a New Phase Transition

**Bad (old) way**:
1. Code the timer
2. Reload browser
3. Click through UI
4. Wait for timer
5. See if it worked
6. Repeat 10 times to debug

**Good (TDD) way**:
1. Write test for timer behavior
2. Run test (fails)
3. Implement timer
4. Run test (passes)
5. Check browser once for UX

## Key Testing Patterns

### Pattern 1: Timer Testing
```typescript
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.restoreAllMocks())

it('should do something after delay', () => {
  // Render component
  render(<Component />)

  // Fast-forward time
  vi.advanceTimersByTime(3000)

  // Assert behavior
  expect(mockFn).toHaveBeenCalled()
})
```

### Pattern 2: Event Handler Testing
```typescript
it('should send event on user action', () => {
  const sendToServer = vi.fn()
  const { getByRole } = render(<Component sendToServer={sendToServer} />)

  // Simulate user action
  fireEvent.click(getByRole('button'))

  // Assert event was sent
  expect(sendToServer).toHaveBeenCalledWith({
    type: 'EXPECTED_ACTION',
    payload: { ... }
  })
})
```

### Pattern 3: Phase-Based Rendering
```typescript
it.each([
  ['clip_intro', 'Get Ready!'],
  ['clip_playback', 'video'],
  ['answer_collection', 'Submit Your Answer!']
])('should render %s phase correctly', (phase, expectedText) => {
  const { getByText, container } = render(<Component state={{ phase }} />)

  if (expectedText === 'video') {
    expect(container.querySelector('video')).toBeTruthy()
  } else {
    expect(getByText(expectedText)).toBeTruthy()
  }
})
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test file
```bash
npm test -- MyComponent.test
```

### Run in watch mode (re-run on file changes)
```bash
npm run test:watch -- MyComponent.test
```

### Run with coverage
```bash
npm test -- --coverage
```

## When to Write Tests

### ✅ Always Test
- Phase transitions with timers
- Auto-advance logic
- Event emission
- Score calculations
- Player state mutations

### ⚠️ Consider Testing
- Complex rendering logic
- Conditional UI display
- Animation sequences

### ❌ Don't Bother Testing
- Simple static UI
- Styling/CSS
- Third-party library behavior

## Benefits You'll See

1. **Faster development**: No more reload-click-wait cycles
2. **Fewer bugs**: Catch issues before browser testing
3. **Refactoring confidence**: Tests catch regressions
4. **Documentation**: Tests show how components work
5. **Debugging speed**: Failing test pinpoints exact problem

## Current Test Coverage

- ✅ Cinema Pippin game logic (server)
- ✅ Cinema Pippin Jumbotron (client) - basic
- ⚠️ Cinema Pippin Controller (client) - needs tests
- ❌ Scratchpad1 - needs tests
- ❌ E2E tests - not implemented

## Next Steps

1. Fix the 2 failing tests in CinemaPippinJumbotron.test.tsx
2. Add tests for CinemaPippinController
3. Add tests for any new phases you add
4. Run tests before every commit (enforced by pre-commit hook)
