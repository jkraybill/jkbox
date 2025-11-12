# Skill: API/WebSocket Validator

**Status:** active
**Version:** 1.0.0
**Created:** 2025-11-12 (Session 1)

---

## Purpose

Validate HTTP/WebSocket endpoints before parties. Because discovering your game server returns 500 when everyone's already gathered around the TV is a special kind of hell.

**Test coverage:**
1. **HTTP endpoints** - Health check, game list, session creation
2. **WebSocket messages** - Join, submit, vote, game state updates
3. **Reconnection** - Phone sleeps, network drops, server restarts
4. **Concurrency** - 8 players spamming votes simultaneously
5. **Error handling** - Malformed messages, invalid session tokens

---

## When to Use

**Automatic (before parties):**
- Pre-deployment validation
- After server code changes
- After adding new game module

**On-demand:**
- "validate api" or "test websocket"
- After network-related bug
- Before showing off to friends

---

## Process

### Phase 1: HTTP Endpoint Validation

**Test each endpoint:**
```typescript
// GET /health
expect(200, { status: 'ok', uptime: number })

// GET /api/games
expect(200, { games: Array<GameInfo> })

// POST /api/party/create
expect(201, { sessionId: string, qrCode: string })

// GET /api/party/:id
expect(200, { players: Array, state: 'waiting' | 'active' })
```

**Red flags:**
- 500 errors (server crash)
- Timeouts > 500ms (too slow)
- Missing CORS headers (mobile browsers blocked)
- No error messages (debugging nightmare)

### Phase 2: WebSocket Message Validation

**Test each message type:**
```typescript
// Client → Server: JOIN
send({ type: 'join', sessionId, nickname })
expect({ type: 'joined', playerId, players: Array })

// Client → Server: SUBMIT_ANSWER
send({ type: 'submit', answer: 'banana' })
expect({ type: 'ack', timestamp })

// Server → Clients: GAME_STATE
expect({ type: 'state', phase: 'voting', answers: Array })
```

**Red flags:**
- Messages arrive out of order
- Duplicate messages after reconnect
- State desync between players
- No acknowledgment (fire-and-forget is asking for trouble)

### Phase 3: Chaos Testing (The "Sarah's Phone" Protocol)

**Simulate party chaos:**
```typescript
// Scenario 1: Phone screen locks mid-game
1. Player joins game
2. Simulate screen lock (close WebSocket)
3. Wait 10 seconds
4. Reconnect with same session token
5. Expect: player state intact, no duplicate vote

// Scenario 2: 8 players vote simultaneously
1. 8 WebSocket clients connect
2. All send VOTE message at exact same time
3. Expect: all votes counted, no race condition, no crash

// Scenario 3: Invalid session token
1. Send JOIN with expired/fake token
2. Expect: 401 error, clear error message, no crash
```

---

## Outputs

**Validation report:**
```markdown
## API Validation (Session X)

**HTTP Endpoints:** 5/5 passing ✓
**WebSocket Messages:** 7/8 passing (1 issue)
**Chaos Tests:** 2/3 passing (1 failure)

**Issues:**
1. ❌ Phone screen lock → reconnect duplicates vote
   - Priority: P0 (party-breaking)
   - Fix: Add idempotency key to VOTE messages

2. ⚠️  8 simultaneous votes → 200ms latency spike
   - Priority: P1 (annoying but not breaking)
   - Fix: Add vote batching/debouncing

**Next:** Fix P0 issue, re-validate before party
```

---

## Success Criteria

- [ ] All HTTP endpoints return expected status/data
- [ ] All WebSocket messages validated
- [ ] Chaos scenarios tested (screen lock, concurrent, invalid)
- [ ] Issues prioritized (P0/P1/P2)
- [ ] Clear fix recommendations

---

## jkbox Philosophy

**"The network is reliable" - Developers who've never been to a party where 8 people are simultaneously on TikTok, Snapchat, and your party game**

Test for chaos. Assume phones will lock, networks will drop, and players will spam buttons. Your reputation depends on it.

---

**Skill maintained by:** JK + Gordo
