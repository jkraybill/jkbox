# Gordo Workflow
## *How We Actually Build This Thing*

---

## Development Philosophy

**Issue-driven + TDD + Push immediately + Party-ready gates**

No code without:
1. GitHub issue (why are we building this?)
2. Failing test (what does success look like?)
3. Green tests (did we actually succeed?)
4. Immediate push (no hoarding commits)

**Simple. Rigorous. Effective.**

---

## Workflow Steps

### 1. Issue Creation

**Before ANY code:**

```bash
gh issue create --title "Feature: Description" --body "
## Problem
[What needs to be built/fixed?]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] All tests green

## Context
[Why does this matter? Party crash? Feature request? Technical debt?]
"
```

**Required labels:**
- Priority: `p0-now` (party-breaking), `p1-soon` (annoying), `p2-someday` (nice-to-have)
- Type: `feature`, `bug`, `refactor`, `docs`
- Component: `party-room`, `game-module`, `websocket`, `mobile-ux`

### 2. TDD Cycle

**The Iron Law: Test → Fail → Code → Pass**

```typescript
// Step 1: Write failing test
describe('Player reconnection', () => {
  it('preserves state after screen lock', async () => {
    const player = await joinGame('Alice')
    await submitAnswer(player, 'banana')

    // Simulate screen lock (disconnect)
    await player.disconnect()
    await sleep(10000)

    // Reconnect
    const reconnected = await rejoinGame('Alice', player.sessionToken)

    // State should be intact
    expect(reconnected.answer).toBe('banana')
    expect(reconnected.hasVoted).toBe(true)
  })
})

// Step 2: Run test → watch it fail
// npm test
// ❌ FAIL: Player state lost after reconnect

// Step 3: Write minimal code to pass
// [Implementation here]

// Step 4: Run test → watch it pass
// npm test
// ✅ PASS: All tests passing (47/47)
```

**No code before failing test. NO EXCEPTIONS.**

### 3. Implementation

**While coding:**
- ✅ TypeScript properly (no `any`, types for everything)
- ✅ Error handling (see CONSTITUTION § 3.2)
- ✅ Mobile-first (chaos-tolerant, touch-friendly)
- ✅ Humor when appropriate (CONSTITUTION § 6)
- ❌ console.log (use proper logging)
- ❌ TODOs without issues (`TODO: Fix this` → create issue, link it)

**Before commit:**
```bash
npm test          # ALL tests must pass
npm run lint      # No warnings
npm run build     # Verify compiles
```

### 4. Commit & Push

**Format:** `Fix #123: Description (optional humor)`

```bash
# Good examples
git commit -m "Fix #42: Add idempotency keys to prevent double-votes after reconnect"
git commit -m "Fix #69: Prevent duplicate votes. Nice try, cheaters. (heh, 69)"

# Bad examples
git commit -m "fix stuff"              # ❌ No issue link
git commit -m "WIP"                    # ❌ Not descriptive
git commit -m "Fixed the thing lol"    # ❌ What thing??
```

**Push immediately:**
```bash
git push origin main
# Don't hoard commits. Push frequently.
```

**Issue auto-closes when commit reaches main.**

### 5. Party Deployment Gates

**Before hosting REAL parties, MUST pass:**

```bash
# Coverage check
npm run test:coverage
# ✅ Game modules: >90%
# ✅ Party room: >95%
# ✅ WebSocket: >85%

# API validation
# Run: skills/api-validator.skill.md
# ✅ All endpoints returning expected responses
# ✅ WebSocket messages validated
# ✅ Chaos tests passing (screen lock, concurrent, etc.)

# Test analysis
# Run: skills/test-analyzer.skill.md
# ✅ No missing critical tests
# ✅ Mobile scenarios covered
# ✅ Edge cases tested

# Manual checks
# ✅ No P0 issues open
# ✅ QR code / mDNS working
# ✅ TV display rendering correctly
# ✅ Dry-run with friends successful
```

**If ANY gate fails → Fix before party.**

**Why:** Your reputation > shipping fast. Fix it right.

---

## Branch Strategy

**Main branch:**
- Always deployable (party-ready)
- All tests passing
- No WIP commits

**Feature branches (optional for solo dev):**
- One branch per issue: `feature/42-reconnection-logic`
- Merge via PR when ready
- Delete after merge

**For solo dev, committing to main is fine IF:**
- Tests are green
- Quality gates pass
- Commit messages descriptive

**No force push to main. Ever.**

---

## Code Review (Self-Review)

**Before every commit, ask:**

1. **Quality:**
   - [ ] All tests passing?
   - [ ] Coverage sufficient?
   - [ ] TypeScript happy (no `any`, no `@ts-ignore`)?

2. **Party-readiness:**
   - [ ] Would this survive 8 drunk people?
   - [ ] Graceful error handling?
   - [ ] Clear user feedback?

3. **Code quality:**
   - [ ] No console.log statements?
   - [ ] No commented-out code?
   - [ ] Humor appropriate (if included)?

4. **Framework:**
   - [ ] CONSTITUTION standards met?
   - [ ] JOURNAL entry planned for EOS?
   - [ ] Framework friction identified for improvement?

**If any answer is "no" → Fix before commit.**

---

## Testing Strategy

### Unit Tests (Vitest)

**Cover:**
- Pure functions (game logic, scoring, validation)
- State management (Redux/Zustand)
- Utility functions

**Example:**
```typescript
describe('Scoring logic', () => {
  it('awards points for correct answers', () => {
    const result = calculateScore('banana', 'banana', 1000)
    expect(result.points).toBe(1000)
  })

  it('awards zero for incorrect answers', () => {
    const result = calculateScore('banana', 'apple', 1000)
    expect(result.points).toBe(0)
  })
})
```

### Integration Tests (Vitest)

**Cover:**
- WebSocket message flows
- API endpoints
- Database interactions

**Example:**
```typescript
describe('Vote submission flow', () => {
  it('records vote and broadcasts to all players', async () => {
    const game = await createGame()
    const [p1, p2] = await joinPlayers(game, ['Alice', 'Bob'])

    await p1.vote('option-a')

    expect(await getVotes(game)).toEqual({
      'option-a': ['Alice']
    })

    expect(p2.receivedMessages).toContainEqual({
      type: 'vote-recorded',
      player: 'Alice'
    })
  })
})
```

### E2E Tests (Playwright)

**Cover:**
- Full user flows (join → play → score)
- Mobile browser scenarios
- Cross-browser compatibility (Chrome, Safari, Samsung Internet)

**Example:**
```typescript
test('Player can join via QR code and submit answer', async ({ page }) => {
  // Host creates game
  await page.goto('http://localhost:3000')
  await page.click('button:has-text("Create Party")')

  // Get QR code URL
  const qrCodeUrl = await page.locator('[data-testid="qr-code"]').getAttribute('data-url')

  // Mobile player scans QR (simulate)
  const mobile = await browser.newPage({
    viewport: { width: 375, height: 667 },  // iPhone size
    userAgent: 'iPhone Safari...'
  })
  await mobile.goto(qrCodeUrl)

  // Join game
  await mobile.fill('[name="nickname"]', 'Alice')
  await mobile.click('button:has-text("Join")')

  // Submit answer
  await mobile.fill('[name="answer"]', 'banana')
  await mobile.click('button:has-text("Submit")')

  // Verify on TV display
  await expect(page.locator('[data-testid="player-list"]')).toContainText('Alice')
  await expect(page.locator('[data-testid="answer-submitted"]')).toBeVisible()
})
```

### Chaos Tests (Custom)

**Cover:**
- Phone screen locks mid-game
- 8+ players voting simultaneously
- Network drops and reconnects
- Invalid session tokens
- Race conditions

**Example:**
```typescript
describe('Chaos: Screen lock scenario', () => {
  it('preserves state after 30 second disconnect', async () => {
    const player = await joinGame('Alice')
    await player.submitAnswer('banana')

    // Simulate screen lock
    await player.disconnect()
    await sleep(30000)

    // Reconnect
    await player.reconnect()

    // State preserved
    expect(player.answer).toBe('banana')
    expect(player.hasVoted).toBe(true)
  })
})
```

---

## Session Workflow

### Start of Session (BOS)

See README.md BOS section for full protocol.

**Quick checklist:**
- [ ] Read framework files
- [ ] Check git status + recent commits
- [ ] Verify tests green
- [ ] Review p0 issues
- [ ] AI-driven health check (if friction detected)
- [ ] Await instructions

### During Session

**Continuous:**
- Run tests frequently (`npm test --watch`)
- Commit often (green tests = commit)
- Update JOURNAL.md notes for EOS
- Track humor for HUMOR.md (JKLES ratings)

**Before breaks:**
- Commit work-in-progress (even if incomplete, tests can fail temporarily)
- Push to remote (backup)

### End of Session (EOS)

See README.md EOS section for full protocol.

**Mandatory:**
- [ ] ALL tests green
- [ ] No console.log / debug code
- [ ] Commit + push all work
- [ ] Update JOURNAL.md (compressed entry)
- [ ] Framework self-improvement introspection
- [ ] Quality gates (if pre-party)
- [ ] ACK joke (signals ready to close)

**Never end session with failing tests.**

---

## Emergency Procedures

### Party Crash During Event

**Immediate:**
1. Apologize to guests (buy them drinks)
2. Document error message / stack trace (take photo if needed)
3. Fall back to Jackbox or other backup activity
4. Don't try to debug live (makes it worse)

**Post-party:**
1. Create P0 issue with full details
2. Write reproduction test
3. Fix immediately
4. Add to chaos test suite
5. Update party deployment gates
6. Document lesson in JOURNAL.md

**Next party:** Mandatory dry-run before real guests arrive.

### Test Suite Failure (CI/CD)

**If CI fails:**
1. Don't push more code (compound the problem)
2. Pull latest → run tests locally
3. Fix failing tests immediately
4. Push fix
5. Verify CI green

**If tests fail locally:**
- Fix immediately (don't commit)
- No "I'll fix it later"
- No "skip this test for now"
- Fix. It. Now.

### Framework Friction

**If workflow feels clunky:**
1. Note friction in JOURNAL.md
2. Identify root cause (EOS introspection)
3. Update framework docs (GORDO-WORKFLOW, CONSTITUTION, etc.)
4. Apply fix next session
5. Verify improved workflow

**Framework should enable, not hinder.**

If it's getting in the way → fix it. That's the point of self-improvement.

---

## Prompt Optimization Workflow (LLM Quality Improvement)

**When LLM outputs are consistently failing quality standards:**

1. **Sample real outputs** (10-20 examples from production)
2. **Interactive review session** with human:
   - Show one output at a time
   - Get specific feedback on what's good/bad and WHY
   - Distill patterns (verb constraints, semantic violations, etc.)
   - Continue until human feedback becomes predictable (3 in a row)
3. **Rebuild prompts** with:
   - Explicit rules derived from failures
   - Multiple examples (good AND bad with explanations)
   - Validation techniques (forced sentence completion)
   - Clear section headers for readability
4. **Test on small batch** (5-10) before scaling up
5. **Document learnings** in session journal

**Key insight from Session 5:** Iterative feedback with distilled rules dramatically outperforms theoretical prompt design.

---

## Summary

**The Flow:**
1. Create issue → 2. Write failing test → 3. Write code → 4. Pass test → 5. Commit → 6. Push → 7. Repeat

**The Gates:**
- Every commit: Tests green
- Every session: Framework improved
- Every party: Coverage >90%, API validated, chaos tests passing

**The Goal:**
- Maximum quality + maximum entertainment
- Zero party crashes
- 100% wingman success rate
- JKLES 9-11/10 consistently

**Simple. Rigorous. Fun.**

---

**Workflow v1.1**
**Created:** 2025-11-12 (Session 1)
**Updated:** 2025-11-15 (Session 5 - Added prompt optimization workflow)
**Based on:** Gordo Framework best practices + home-server production patterns
