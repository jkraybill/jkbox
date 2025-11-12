# Skill: Test Coverage Analyzer

**Status:** active
**Version:** 1.0.0
**Created:** 2025-11-12 (Session 1)

---

## Purpose

Analyze test coverage and suggest missing tests. Because "it works on my machine" doesn't cut it when 8 drunk friends are watching your game crash.

**Focus areas:**
1. **Game modules** - Each pluggable game 100% covered
2. **Party room** - Player join/leave, session management
3. **Real-time comms** - WebSocket reconnection, message ordering
4. **Mobile scenarios** - Screen lock, backgrounding, network drops
5. **Edge cases** - 1 player, 20 players, mid-game join

---

## When to Use

**Automatic (SESSION_END):**
- After implementing new game module
- After party room changes
- Before party deployment (stakes = high)

**On-demand:**
- "analyze tests" or "test coverage"
- Before adding complex feature
- When bug reveals test gap

---

## Process

### Phase 1: Coverage Analysis

Run coverage tool, identify gaps:
```bash
npm run test:coverage
```

**Red flags:**
- Game module < 90% coverage
- Party room core < 95% coverage
- WebSocket handlers < 85% coverage
- No mobile scenario tests

### Phase 2: Suggest Missing Tests

**Examples:**

**Game module gap:**
```
GameModule: drawingGame.ts - 72% coverage

Missing tests:
1. Player submits drawing after time expires (edge case)
2. Two players submit simultaneously (race condition)
3. Player disconnects mid-drawing (cleanup)
```

**Party room gap:**
```
PartyRoom: sessionManager.ts - 68% coverage

Missing tests:
1. 20 players join simultaneously (stress)
2. Host disconnects during game (failover)
3. Player rejoins with stale session token (security)
```

**Mobile scenario gap:**
```
Mobile: No tests for screen lock/background scenarios

Missing tests:
1. Phone locks mid-game → unlock → reconnects
2. Player switches to different app → returns → state intact
3. Network drops → reconnects → doesn't duplicate votes
```

### Phase 3: Prioritize

**P0 (fix before party):**
- Party-breaking bugs (crashes, data loss)
- Security issues (session hijacking)
- Reputation damage (scores wrong, unfair gameplay)

**P1 (fix soon):**
- Annoying bugs (need manual recovery)
- UX degradation (slow, janky)

**P2 (nice to have):**
- Edge cases (1 in 100 occurrence)
- Minor polish

---

## Outputs

**Test gap report:**
```markdown
## Test Coverage Analysis (Session X)

**Overall:** 78% (target: 90%+)

**Gaps:**
- drawingGame.ts: 72% (missing timeout/race/disconnect tests)
- sessionManager.ts: 68% (missing stress/failover tests)
- Mobile scenarios: 0% (no tests exist)

**Recommended P0 tests:**
1. [ ] drawingGame: timeout edge case
2. [ ] sessionManager: host disconnect failover
3. [ ] Mobile: screen lock reconnection

**Next:** Write tests in priority order, re-run coverage
```

---

## Success Criteria

- [ ] Coverage measured for all game modules
- [ ] Gaps identified with specific missing tests
- [ ] Priorities assigned (P0/P1/P2)
- [ ] At least 3 missing tests suggested
- [ ] "Party-breaking" scenarios called out explicitly

---

## jkbox Philosophy

**"It works on my machine" ≠ "It works when Sarah's drunk and her phone is at 10% battery on her carrier's shitty network while simultaneously trying to send a selfie to her crush."**

Test for the chaos. Your party reputation depends on it.

---

**Skill maintained by:** JK + Gordo
