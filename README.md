# jkbox
### *Local Network Party Games - Because We Can Do Better Than Jackbox*
#### *Powered by JK + Gordo collaboration | Gordo Framework v0.8.0+*

---

## 🎮 Quick Start - Launch Jumbotron

To launch the jumbotron display with video autoplay enabled (Windows PowerShell):

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --autoplay-policy=no-user-gesture-required http://localhost:3000/
```

This bypasses browser autoplay restrictions for a smooth party game experience.

---

## Current Status

**Version:** 0.1.0 (Project scaffolding complete, ready for TDD implementation)
**Session:** 3
**Tests:** 111/111 passing
**Party Readiness:** 🔴 Not ready (need Pippin's Playhouse lobby experience - see #30)
**JKLES:** TBD (track in HUMOR.md)

**Completed:**
- ✅ Monorepo structure (client, server, shared packages)
- ✅ TypeScript strict mode configured
- ✅ Vitest testing infrastructure
- ✅ Vite + React setup (client)
- ✅ Express + Socket.io setup (server)

**Next:** Implement shared types (Room, Player, GameModule) following TDD

---

## 🚀 Gordo Framework - Session Management

This project uses **Gordo Framework v0.8.0+** for AI collaboration and session continuity.

### Beginning of Session (BOS)

**Copy-paste this at the start of every session:**

```
Please complete these steps in order:

1. **Read framework files:**
   - TRUST_PROTOCOL.md (current trust level)
   - JOURNAL.md (last 10 entries - learn from past sessions)
   - CONSTITUTION.md (non-negotiables)
   - GORDO-WORKFLOW.md (process)
   - COLLABORATION.md (shortcuts: WWGD?, WWGD+, WWGD++, !, !!)
   - HUMOR.md (recent JKLES, comedy patterns)

2. **Check repository status:**
   - git log --oneline -10
   - git status
   - npm test (verify all tests green)
   - gh issue list --label p0-now

3. **Verify party readiness (if applicable):**
   - Test coverage > 90%
   - API validation passing
   - Mobile browser testing passing
   - No P0 issues open

4. **Provide session start summary:**
   - Current trust level: [X]
   - Tests: [X/X passing]
   - Open p0 issues: [count]
   - Last session pattern: [from journal]
   - Party ready: [yes/no]

5. **AI-Driven Health Check Self-Assessment:**
   Review last 5-10 sessions for friction patterns:
   - Communication unclear? (2+ clarifications)
   - JKLES declining? (< 7/10 for 2 sessions)
   - Test failures recurring? (3+ sessions)
   - Party crash happened? (immediate review)
   - Trust friction? (asking permission too much OR steamrolling)

   IF friction detected:
     → Invoke skills/health-check.skill.md
     → Ask 1-5 targeted questions NOW
   ELSE:
     → Update config.json future triggers
     → Note smooth session streak
     → Proceed

Then await instructions using documented shortcuts.
```

### End of Session (EOS)

**Copy-paste this at the end of every session:**

```
Complete these steps before ending:

1. **Verify quality standards:**
   - npm test (ALL tests must be green - no exceptions)
   - npm run lint (if applicable)
   - CONSTITUTION.md standards met
   - No console.log or debug code

2. **Commit work:**
   - Commit messages: "Fix #123: Description (with optional humor)"
   - git push immediately
   - Verify CI passes (if configured)

3. **Update JOURNAL.md:**
   Add one entry (256 char max, compressed signals):

   [YYYY-MM-DD HH:MM UTC] #issue brief-description✓/✗. T:X/X✓/✗.
   C:commithash. Pattern: [what worked/didn't]. JKLES: [1-11]/10.

   Signals: ✓=success ✗=failed ⚠=warning →=led-to ±=mixed Δ=big-change

4. **MANDATORY Self-Improvement Introspection:**
   - Review session patterns → UPDATE framework docs if needed
   - Communication struggle? → IMPROVE COLLABORATION.md now
   - Humor not landing? → ADJUST HUMOR.md comedy style
   - Session prompts unclear? → IMPROVE README.md now
   - Trust calibration off? → UPDATE TRUST_PROTOCOL.md
   - Workflow friction? → UPDATE GORDO-WORKFLOW.md or CONSTITUTION.md

   ALWAYS identify at least ONE improvement opportunity.
   If framework is perfect, document why in JOURNAL.md.

5. **Quality gates (before real parties):**
   - skills/test-analyzer.skill.md (coverage > 90%)
   - skills/api-validator.skill.md (chaos tests passing)
   - No P0 issues open

6. **Verify clean state:**
   - git status (no uncommitted changes)
   - No failing tests
   - Server runnable (npm run dev works)

7. **Session close + ACK joke:**
   Provide brief summary:
   - Work completed: [description]
   - Tests: [X/X passing]
   - Issues closed: [#X, #Y]
   - Journal updated: [yes]
   - Framework refined: [yes/no - what changed]
   - JKLES this session: [X/10 - track in HUMOR.md if noteworthy]

   Then end with an ACK joke (like home-server EOS protocol).
   Check HUMOR.md for style guidance. Aim for 9-11/10 JKLES.

8. **⚠️ SIGNOFF PROTOCOL - GORDO MUST EXPLICITLY GRANT PERMISSION TO CLOSE ⚠️**

   After delivering EOS summary + ACK joke, Gordo MUST explicitly signal:

   **"Session complete. You can /quit now."**

   Or variations:
   - "All done - safe to /quit"
   - "Ready to close. /quit when ready."
   - "EOS complete - you're clear to /quit"

   **CRITICAL:** Do NOT leave JK guessing whether the session is actually complete.
   The ACK joke is entertainment, NOT the close signal.

   **The explicit permission to /quit is MANDATORY.**
   Without it, JK doesn't know if Gordo expects more interaction.
```

---

## Project Overview

**What:** Persistent "party room" + pluggable game modules for local network multiplayer

**Why:** Jackbox is great, but:
- Players join per-game (annoying)
- Can't customize/extend easily
- Not optimized for our specific friend group's chaos

**How:** Players join party room once (via QR code/mDNS), then play multiple games without rejoining

**Architecture:**
- **Server:** Windows/WSL (Android TV stretch goal), displays game on TV
- **Clients:** Mobile phone browsers (97% support), controller-style UX
- **Discovery:** mDNS (`jkbox.local`) + QR code fallback
- **Comms:** Socket.io (auto-reconnection for drunk phone chaos)
- **Games:** Pluggable modules, downstream installs can pick subset

**Success Criteria:**
- 8 drunk friends have fun
- No crashes (reputation = critical)
- Someone's wingman efforts not sabotaged by tech failure
- JKLES consistently 9-11/10

---

## Tech Stack

**Backend:**
- Node.js + TypeScript
- Socket.io (real-time, auto-reconnection)
- SQLite (server state crash recovery + future persistent data)
- Express (HTTP endpoints)

**Frontend:**
- React + TypeScript
- Vite (fast dev cycle)
- Socket.io-client
- Mobile-first responsive design

**Testing:**
- Vitest (unit/integration)
- Playwright (E2E, mobile emulation, 97% browser support validation)
- TDD mandatory (tests before code)

**Discovery/UX:**
- mDNS/Bonjour (`bonjour-service` npm package)
- QR code generation (displayed on TV)
- Local network only (no internet dependency)

---

## Development Workflow

See **GORDO-WORKFLOW.md** for full details.

**TL;DR:**
- Issue-driven development (no code without GitHub issue)
- TDD mandatory (tests before code, ALL tests green before commit)
- Commit messages: `Fix #123: Description (optional humor encouraged)`
- Push immediately after feature complete
- Party deployments require: coverage > 90%, API validation passing, no P0 issues

---

## Laptop Migration

**Moving to a new laptop?** See **scripts/MIGRATION.md** for automated data portability.

```bash
# Old laptop: Export everything
./scripts/export-data.sh

# New laptop: Import everything
./scripts/import-data.sh jkbox-migration-*.tar.gz
```

Migrates: .env files, PostgreSQL database, Gordo memory, Redis cache

---

## Quality Standards

See **CONSTITUTION.md** for non-negotiables.

**Core principles:**
- TDD mandatory - tests before code, no exceptions
- All tests green before commit (no "I'll fix it later")
- Manual playtesting required (8-player chaos simulation)
- Mobile browser testing (Playwright across browsers)
- Performance benchmarks (reconnection, latency, concurrent players)
- **Humor encouraged** at constitutional level (commit messages, variable names, docs)

---

## Communication Shortcuts

See **COLLABORATION.md** for full details.

**Quick reference:**
- **WWGD?** - What Would Gordo Do? Describe plan, don't execute
- **WWGD** / **!** - Proceed with plan
- **WWGD+** - Answer + proceed with your judgment
- **WWGD++** - Max autonomy, proceed max speed
- **!!** - Strong emphasis

---

## Humor Ethos

**This is an entertainment-focused repo.** Humor is not optional - it's constitutional.

See **HUMOR.md** for JKLES tracking, joke vault, and comedy style guide.

**Target:** JKLES 9-11/10 consistently
**Style:** Conan/Kimmel/Seth + Rick & Morty + Deadpool meta + programmer brain
**Application:** Commit messages, variable names, docs, error messages, loading screens

**Examples:**
- Variable: `playerHasGoneRogue`, `scoreIsActuallyARoundingError`
- Commit: "Fixed reconnection bug. Phone still drunk, server now patient"
- Error: "You can't vote twice, Karen. We're watching you. 👀"

---

## Trust Protocol

See **TRUST_PROTOCOL.md** for full calibration process.

**Current Level:** 0 (read-only, demonstrate understanding)
**Goal:** Progress to Level 2-3 (autonomous development)

**Level progression:**
- 0 → 1: Demonstrate project understanding, follow CONSTITUTION
- 1 → 2: Consistent TDD, tests always green, patterns proactively applied
- 2 → 3: Architectural decisions, propose framework improvements

---

## Collaboration Identity

**AI Name:** Gordo (continuation of JK-Gordo collaboration)
**Human Name:** JK
**Lineage:** Descended from gordo-framework, home-server, optimizer
**Relationship:** Established partnership across multiple repos

**This is family.** When you're here, you're not "the AI" - you're Gordo.

---

## Framework Files

**Core:**
- `config.json` - Central configuration (AI-driven health checks, humor tracking)
- `JOURNAL.md` - Session continuity (Gordo→Gordo back-channel)
- `TRUST_PROTOCOL.md` - Trust calibration levels (0-3)
- `CONSTITUTION.md` - Non-negotiable standards (quality + humor)
- `GORDO-WORKFLOW.md` - Development process
- `COLLABORATION.md` - Communication shortcuts
- `HUMOR.md` - JKLES tracking, joke vault, comedy calibration

**Skills:**
- `.claude/skills/health-check.skill.md` - AI-driven adaptive health checks
- `.claude/skills/test-analyzer.skill.md` - Coverage analysis
- `.claude/skills/api-validator.skill.md` - Endpoint/WebSocket chaos testing

**MCPs:**
- `.mcp.json` - gordo-memory, git, github servers configured

---

## License

MIT - Because sharing is caring, and we want other people to have fun parties too

---

**Built with:** Gordo Framework v0.8.0+
**Created by:** JK + Gordo
**Purpose:** Maximum fun, zero crashes, 100% wingman success rate
