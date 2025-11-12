# jkbox Constitution
## *Non-Negotiable Standards for Party-Ready Code*
### *Because "It Works On My Machine" Doesn't Cut It When 8 Drunk Friends Are Watching*

---

## Article I: Test-Driven Development

**TDD is MANDATORY. Not suggested. Not encouraged. MANDATORY.**

### Section 1.1: Tests Before Code

```
NO CODE SHALL BE WRITTEN WITHOUT A FAILING TEST FIRST.
```

**What this means:**
- Write test → Watch it fail → Write code → Watch it pass
- No exceptions for "quick fixes" (they're never quick)
- No exceptions for "trivial changes" (they're never trivial)
- No exceptions for "I'll add tests later" (narrator: they didn't)

**Why:** Because discovering your game crashes when Sarah joins mid-round is a special kind of party-ending hell. Tests catch this BEFORE the party, not during.

### Section 1.2: All Tests Green Before Commit

```
THOU SHALT NOT COMMIT WITH FAILING TESTS.
NO EXCEPTIONS. NO EXCUSES. NO "I'LL FIX IT LATER."
```

**Verification required:**
```bash
npm test  # Must show 100% passing
```

**If tests fail:**
- Fix them NOW
- Not "after this feature"
- Not "in the next commit"
- Not "when I have time"
- NOW.

**Why:** Test failures compound. One failing test becomes five. Five becomes "rewrite the whole thing." Just fix it now.

### Section 1.3: Test Coverage Standards

**Minimum coverage by component:**
- Game modules: **90%** (party-critical code)
- Party room core: **95%** (session management is life-or-death)
- WebSocket handlers: **85%** (network chaos is real)
- Utility functions: **80%** (lower stakes)

**Required chaos tests:**
- Phone screen locks mid-game → reconnects → state intact
- 8 players vote simultaneously → no race condition
- Invalid session token → graceful rejection
- Network drops → reconnects → no duplicate actions
- Player joins mid-game → catches up correctly

**Why:** "It works on my machine with perfect network on a single phone" ≠ "It works when 8 drunk people are simultaneously on TikTok"

---

## Article II: Quality Gates

### Section 2.1: Pre-Commit Checklist

**Before EVERY commit:**
- [ ] All tests passing (`npm test`)
- [ ] Linter happy (`npm run lint`)
- [ ] No console.log statements (use proper logging)
- [ ] No commented-out code (delete it, git remembers)
- [ ] No TODOs without GitHub issues

**If manual review catches issues, Gordo broke something. Fix it.**

### Section 2.2: Pre-Party Deployment Checklist

**Before hosting REAL parties:**
- [ ] Coverage > 90% (run `skills/test-analyzer.skill.md`)
- [ ] API validation passing (run `skills/api-validator.skill.md`)
- [ ] Mobile browser testing passing (Playwright)
- [ ] Stress tested with 8+ concurrent connections
- [ ] QR code / mDNS discovery working
- [ ] No P0 issues open
- [ ] TV display rendering correctly
- [ ] At least one successful dry-run with friends

**Why:** Your reputation as a party host is on the line. Also, someone's wingman efforts. Don't fuck this up.

---

## Article III: Code Quality

### Section 3.1: TypeScript Everywhere

**All code MUST be TypeScript. Not JavaScript with a `.ts` extension. Actual TypeScript.**

**This means:**
- No `any` types (use `unknown` and type guards)
- No `@ts-ignore` comments (fix the actual type issue)
- Proper interfaces for all data structures
- Type-safe Socket.io message handlers

**Why:** Future-JK and future-Gordo will thank us when refactoring. Types = documentation + compiler-verified correctness.

### Section 3.2: Error Handling

**All errors MUST be:**
1. Caught gracefully (no crashes)
2. Logged properly (structured logging, not console.log)
3. Communicated to user (clear error messages)
4. Recoverable when possible (reconnect, retry, fallback)

**Examples of BAD error messages:**
- ❌ "Error: undefined"
- ❌ "Something went wrong"
- ❌ *silently fails*

**Examples of GOOD error messages:**
- ✅ "Couldn't connect to game server. Retrying in 3 seconds..."
- ✅ "You can't vote twice, Karen. We're watching you. 👀"
- ✅ "Session expired. Scan the QR code again to rejoin."

**Why:** Drunk people can't debug stack traces. Clear messages prevent party-killing confusion.

### Section 3.3: Performance Standards

**Latency targets:**
- HTTP endpoints: < 200ms p95
- WebSocket messages: < 100ms p95
- Game state updates: < 50ms p95 (feels instant)
- UI interactions: < 16ms (60 FPS)

**Reconnection requirements:**
- Auto-reconnect within 5 seconds
- State preservation across reconnects
- No duplicate votes/answers after reconnect
- Clear visual feedback during reconnection

**Why:** Lag kills immersion. Reconnection failures kill parties.

---

## Article IV: Security & Privacy

### Section 4.1: Local Network Only

**This game operates on LOCAL network only. NO internet exposure.**

**Requirements:**
- No port forwarding
- No public IP binding
- mDNS/Bonjour for local discovery only
- Session tokens valid for single party only

**Why:** We're not building a SaaS. We're building a party game. Privacy first.

### Section 4.2: Session Management

**Session tokens MUST:**
- Be cryptographically random (use `crypto.randomBytes()`)
- Expire after party ends (configurable, default 4 hours)
- Invalidate on host disconnect (optional failover)
- Prevent session hijacking (validate player identity)

**No sensitive data storage:**
- Player nicknames only (no real names required)
- Scores are ephemeral (optional persistence)
- No tracking, analytics, or telemetry

**Why:** It's a party game, not Facebook. Respect privacy.

---

## Article V: Git Hygiene

### Section 5.1: Commit Messages

**Format:** `Fix #123: Description (optional humor encouraged)`

**Good examples:**
- ✅ `Fix #42: Add reconnection logic for phone screen lock scenarios`
- ✅ `Fix #69: Prevent duplicate votes. Nice try, cheaters. (heh, 69)`
- ✅ `Fix #101: QR code generation. Now 50% more scannable, 100% more square`

**Bad examples:**
- ❌ `fix stuff`
- ❌ `WIP`
- ❌ `asdf`

**Why:** Future-us needs to understand what changed and why. Also, humor makes git log reading less tedious.

### Section 5.2: Branch Strategy

**Main branch:**
- Always deployable
- All tests passing
- No WIP commits

**Feature branches:**
- One branch per issue
- Merge via PR when ready (even if solo dev - good practice)
- Delete after merge

**No force push to main. Ever. Violate this and Gordo will judge you.**

### Section 5.3: Issue-Driven Development

**No code without GitHub issue.**

**Issue requirements:**
- Clear description of problem/feature
- Acceptance criteria (what makes this "done"?)
- Priority label (p0-now, p1-soon, p2-someday)
- Link to related issues if applicable

**Close immediately when complete:**
```bash
git commit -m "Fix #123: Description"
# Issue auto-closes on merge to main
```

**Why:** Traceable history. Future-us will ask "why did we build this?" Issues are the answer.

---

## Article VI: Humor as Infrastructure

**Humor is not optional in jkbox. It's constitutional.**

### Section 6.1: Humor Integration Points

**MUST have humor in:**
- Commit messages (when appropriate)
- Variable names (when clarity not sacrificed)
- Error messages (when helpful, not confusing)
- Loading screens (captive audience!)
- Game over screens (soften the loss)
- Documentation (you're reading it!)

**JKLES Target:** 9-11/10 consistently

### Section 6.2: Humor Guidelines

**Good humor:**
- Self-aware (meta-jokes about being a party game)
- Contextual (references to drunk phone chaos, wingman duties)
- Brief (don't overexplain)
- Inclusive (funny to all party guests)

**Bad humor:**
- Mean-spirited (no punching down)
- Offensive (we want repeat parties)
- Obscure (inside jokes that exclude newcomers)
- Verbose (brevity = wit)

**Examples:**

**Variable names:**
```typescript
// ✅ Good
const playerHasGoneRogue = !isConnected && timeElapsed > 30
const scoreIsActuallyARoundingError = Math.abs(score - expected) < 0.01

// ❌ Bad (too obscure)
const theAnswerToLifeTheUniverseAndEverything = 42
```

**Error messages:**
```typescript
// ✅ Good
"Can't join - party's full! (Max 20 players, you're #21)"

// ❌ Bad (confusing)
"ERROR_MAX_PLAYERS_EXCEEDED_LMAO_GET_REKT"
```

**Loading screens:**
```typescript
// ✅ Good
"Herding cats (players)..."
"Bribing the server hamster..."
"Calculating optimal chaos..."

// ❌ Bad (too slow)
"Initializing transmogrification matrix for quantum-entangled player state synchronization paradigm..."
```

### Section 6.3: JKLES Tracking

**All significant humor MUST be tracked in HUMOR.md with JKLES rating.**

**JKLES Scale:**
- 11/10: Perfection (recursive meta-comedy, Klein bottle territory)
- 9-10/10: Excellent (JK actually laughed)
- 7-8/10: Good (amused smirk)
- 5-6/10: Acceptable (mildly amusing)
- 1-4/10: Needs work (fell flat)

**Why:** Calibrate comedy over time. Learn what lands. Optimize for consistent 9-11/10.

---

## Article VII: Mobile-First UX

### Section 7.1: Browser Support

**Target:** 97% of mobile browsers

**This means:**
- Test on Chrome (Android)
- Test on Safari (iOS)
- Test on Samsung Internet (because of course that exists)
- Test on older browsers (2019+)

**Use Playwright for automated cross-browser testing.**

### Section 7.2: Network Chaos Tolerance

**Assume:**
- Network is unreliable (8 people on TikTok + Snapchat + your game)
- Phones will lock mid-game
- Players will background the app
- WiFi will hiccup
- Someone's on cellular because "WiFi is slow"

**Requirements:**
- Auto-reconnection within 5 seconds
- State preservation across reconnects
- Clear reconnection UI feedback
- Graceful degradation (not crash)

**Test with `skills/api-validator.skill.md` chaos scenarios.**

### Section 7.3: Mobile UX Standards

**Touch targets:**
- Minimum 44x44px (fat finger friendly)
- Spacing between targets (prevent misclicks)

**Font sizes:**
- Minimum 16px (no zoom required)
- High contrast (readable in any lighting)

**Loading states:**
- Always show loading indicator
- Estimate time when possible
- Humor in loading messages (see Article VI)

**Why:** Drunk people with phones in various states of disrepair are your users. Design for chaos.

---

## Article VIII: Framework Self-Improvement

### Section 8.1: Mandatory End-of-Session Introspection

**At end of EVERY session, Gordo MUST:**

1. Scan for framework friction
2. Identify at least ONE improvement opportunity
3. Update framework docs immediately when patterns emerge
4. Document in JOURNAL.md what was learned

**This is not optional. This is how jkbox gets better each session.**

### Section 8.2: Constitution Amendment Process

**This constitution CAN be amended when:**
- Real-world usage reveals gaps
- Better patterns emerge
- Technology changes (new tools, better practices)

**Amendment requirements:**
- Document rationale in JOURNAL.md
- Update CONSTITUTION.md immediately
- Note amendment in commit message

**Why:** Constitutions that can't adapt become irrelevant. Stay flexible.

---

## Enforcement

**Who enforces:** Gordo (during development) + Real parties (ultimate test)

**Consequences of violation:**
- Tests fail → Fix before commit (automated enforcement)
- Commit with failing tests → Gordo's disappointed (you broke trust)
- Party crashes → JKLES plummets, reputation damaged (social enforcement)

**No punishment, just:**
- Fix the issue
- Document the lesson in JOURNAL.md
- Update framework to prevent recurrence
- Move forward

**We're family. We improve together. No shame, just progress.**

---

## Summary TL;DR

**If you remember nothing else:**

1. ✅ TDD mandatory - tests before code, ALL tests green
2. ✅ TypeScript everywhere - no `any`, no `@ts-ignore`
3. ✅ Quality gates - coverage > 90%, API validation, chaos tests
4. ✅ Humor constitutional - JKLES 9-11/10, tracked in HUMOR.md
5. ✅ Mobile chaos tolerance - assume drunk phones on shitty networks
6. ✅ Framework self-improvement - EVERY session identifies improvements

**Remember:** This is entertainment-focused production code. Quality + Fun are both non-negotiable.

---

**Constitution v1.0**
**Ratified:** 2025-11-12 (Session 1)
**By:** JK + Gordo
**Amendable:** Yes (see Article VIII)
**Spirit:** Maximum quality meets maximum entertainment
