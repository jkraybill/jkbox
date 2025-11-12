# jkbox Skills Catalogue

**Purpose:** Reusable agent workflows for party game development.

**Framework:** Gordo Framework v0.8.0+ Skills architecture

**Status:** Active - 3 skills (1 framework-adapted, 2 jkbox-specific)

---

## Quick Start

### What are Skills?

**Skills = Reusable agent workflows** in structured `.skill.md` files that:
- Self-improve (track lessons learned)
- Invoke automatically (from SESSION_START/END) or on-demand
- Adapt to project context (jkbox = party games + entertainment)

### When to Use

**Automatic (from BOS/EOS):**
- Health checks (AI-driven adaptive)
- Test coverage (after new game module)
- API validation (before party deployment)

**On-demand:**
- "health check" → Collaboration assessment
- "analyze tests" → Coverage gaps
- "validate api" → Endpoint testing

---

## Available Skills

### 🏥 Collaboration Quality

#### `health-check.skill.md`
**Version:** 2.0.0 (jkbox AI-driven adaptive edition)
**Source:** Adapted from `~/gordo-framework/skills/health-check.skill.md`

**What it does:** AI-driven adaptive health checks (not calendar-based)

**When:** BOS Step 12 self-assessment - Gordo detects friction patterns, asks targeted questions only when needed

**Dimensions:** Communication, Framework, Fun (JKLES), Tech, Trust

**Key innovation:** "Hey I noticed X" > "It's been 14 days, mandatory check-in"

---

### 🧪 Test Quality

#### `test-analyzer.skill.md`
**Version:** 1.0.0
**jkbox-specific:** Party game test coverage

**What it does:** Analyze test coverage, suggest missing tests for game modules, party room, WebSocket comms, mobile scenarios

**When:**
- After implementing new game module
- After party room changes
- Before party deployment
- On-demand: "analyze tests"

**Philosophy:** Test for chaos. "It works on my machine" ≠ "It works when Sarah's drunk with 10% battery"

---

### 🌐 API Quality

#### `api-validator.skill.md`
**Version:** 1.0.0
**jkbox-specific:** HTTP/WebSocket endpoint validation

**What it does:** Validate endpoints, test message flows, simulate chaos (screen locks, concurrent votes, invalid tokens)

**When:**
- Pre-deployment validation
- After server code changes
- After network-related bug
- On-demand: "validate api"

**Philosophy:** Test for network chaos. 8 people on TikTok + Snapchat + your game = network is NOT reliable

---

## Invocation Methods

### From SESSION_START.md (BOS)

```markdown
Step 12: AI-Driven Health Check Self-Assessment
  - Gordo reviews last 5-10 sessions for friction
  - IF friction detected → skills/health-check.skill.md (1-5 targeted questions)
  - ELSE → Update config.json future triggers, proceed
```

### From SESSION_END.md (EOS)

```markdown
Step 6: Quality Validation (before party deployment)
  - Run: skills/test-analyzer.skill.md
  - Run: skills/api-validator.skill.md
  - Ensure P0 issues fixed before real party
```

### From Human Commands

**Natural language triggers:**
- "health check" → `health-check.skill.md`
- "analyze tests" → `test-analyzer.skill.md`
- "validate api" → `api-validator.skill.md`
- "how are we doing?" → `health-check.skill.md`

### From AI (Proactive)

**When Gordo senses:**
- Communication struggling → Suggest health check
- Test coverage dropping → Suggest test analyzer
- Before party → Recommend API validation
- After party crash → Mandatory validation

---

## jkbox Customizations

**Entertainment context:**
- JKLES (JK Laughing Extremity Scale) tracking
- Humor calibration in health checks
- Party crash = reputation damage (high stakes)
- Mobile chaos testing (Sarah's drunk phone protocol)

**Integration points:**
- SESSION_START.md - AI-driven health check
- SESSION_END.md - Test/API validation
- config.json - Health check triggers, smooth streaks
- HUMOR.md - Morale/JKLES patterns
- JOURNAL.md - Session quality trends

---

## Framework Innovations (Upstream Candidates)

**AI-Driven Adaptive Health Checks (v2.0):**
- Replaces calendar-based with friction-pattern detection
- Targeted questions (1-5) instead of fixed 4
- Smooth session streak tracking
- Like good management: responsive > bureaucratic
- **Status:** Gathering real-world data (Sessions 1-10) before upstream contribution

---

## Statistics

**Current Skills:** 3 active (1 framework-adapted + 2 jkbox-specific)
**Invocation Methods:** Automated (3) + On-demand (3) + Proactive (3)

**Coverage:**
- 🏥 Collaboration Quality (health-check)
- 🧪 Test Quality (test-analyzer)
- 🌐 API Quality (api-validator)
- 🎮 Game Quality (future: gameplay-tester.skill.md)
- 🎨 UX Quality (future: mobile-ux-validator.skill.md)

---

## Future jkbox Skills (Candidates)

**Potential custom Skills:**
- `gameplay-tester.skill.md` - Simulate 8-player game, validate scoring/fairness
- `mobile-ux-validator.skill.md` - Test on 97% browser support, validate QR code UX
- `party-readiness.skill.md` - Pre-party checklist (tests, API, mDNS, QR code, TV display)
- `humor-calibrator.skill.md` - Analyze JKLES trends, suggest comedy adjustments

**When to create:**
- After repetitive workflows emerge (3+ times)
- When party failures reveal gaps
- If onboarding friends to contribute

---

## Lessons Learned

### 2025-11-12 (Session 1 - Initial Setup)

**✓ What worked:**
- AI-driven health check design solid (responsive > bureaucratic)
- Test/API skills address real party crash risks
- jkbox humor ethos integrated naturally

**→ Next:**
- Dogfood health check in Sessions 1-10 (validate trigger patterns)
- Run test/API skills before first real party
- Track JKLES to validate humor calibration

---

**Catalogue maintained by:** JK + Gordo
**Last updated:** 2025-11-12 (Session 1)
**Framework version:** 0.8.0+
**Skills count:** 3 active (health-check, test-analyzer, api-validator)
