# Test Coverage Review - Data Tools Package

**Current Status:** 230 tests total (195 passing + 35 skipped DB integration)

## 🚨 CRITICAL GAPS (New Features - Untested!)

### 1. **Spacetime Metadata Extraction** - NO TESTS
**File:** `src/llm/local-llm.ts::extractSpacetime()`
**What it does:** Extracts year/city/state from article content
**Missing tests:**
- ✗ Successful extraction (year + city + state)
- ✗ Partial extraction (year only, state only, etc.)
- ✗ Fallback to pub_date when extraction fails
- ✗ NULL handling (article says "last week" with no year)
- ✗ Edge cases: future years, invalid cities, ambiguous states
- ✗ Ollama API failure handling

**Risk:** HIGH - Brand new feature, core to question quality

---

### 2. **House Answers: 5+ Answers Handling** - NO TESTS
**File:** `src/llm/claude-service.ts::generateHouseAnswers()`
**What it does:** Fallback extraction when Claude returns 6-7 answers instead of 5
**Missing tests:**
- ✗ Exactly 5 answers (happy path)
- ✗ 6-7 answers (should take first 5) ← **Bug we just fixed!**
- ✗ 3-4 answers (should fail)
- ✗ 0 answers (should fail)
- ✗ Duplicate answers in extraction (should dedupe)

**Risk:** HIGH - Just fixed a production bug here, no test to prevent regression

---

### 3. **Question Generation with Spacetime** - NO TESTS
**File:** `src/llm/claude-service.ts::generateQuestion()` with spacetime param
**Missing tests:**
- ✗ Question generation WITH spacetime metadata
- ✗ Question generation WITHOUT spacetime (optional param)
- ✗ Partial spacetime (year only, state only)
- ✗ Verify spacetime context is included in prompt

**Risk:** MEDIUM - Feature works but could regress

---

## ⚠️ MODERATE GAPS (Edge Cases)

### 4. **JSON Extraction Fallback**
**File:** `src/llm/claude-service.ts::extractJSON()`
**Current tests:** Pattern matching for validation text
**Missing tests:**
- ✗ Malformed JSON (unmatched braces)
- ✗ JSON with trailing text after closing brace
- ✗ Multiple JSON objects in response
- ✗ No JSON found at all

**Risk:** MEDIUM - Could break on weird Claude responses

---

### 5. **Database Queries - Spacetime Fields**
**File:** `src/storage/db/queries.ts`
**Missing tests:**
- ✗ `updateSpacetimeMetadata()` method (brand new!)
- ✗ Article mapping includes eventYear/locationCity/locationState
- ✗ NULL handling for spacetime fields

**Risk:** MEDIUM - DB integration tests are skipped, so this is untested

---

### 6. **Orchestrator - Spacetime Integration**
**File:** `src/services/fake-facts-orchestrator.ts`
**Missing tests:**
- ✗ Spacetime extraction triggered when fields are NULL
- ✗ Spacetime extraction SKIPPED when fields already populated (caching)
- ✗ Spacetime passed to Claude during question generation
- ✗ Error handling if spacetime extraction fails mid-pipeline

**Risk:** MEDIUM - Integration tests are all skipped (DB required)

---

## ✅ GOOD COVERAGE

### What's Well-Tested:
1. **Cost calculation** - 20 tests, thorough (all models, edge cases)
2. **Rate limiting** - 7 tests
3. **Retry handler** - 8 tests with exponential backoff
4. **RSS scraper** - 13 tests
5. **News of Weird scraper** - 15 tests
6. **Category detector** - 19 tests

---

## 📊 RECOMMENDATIONS

### Priority 1 (Add Now - Critical):
1. **Add spacetime extraction tests:**
   - Mock Ollama responses
   - Test parsing logic (YEAR/CITY/STATE extraction)
   - Test fallback to pub_date
   - Test NULL handling

2. **Add house answers fallback tests:**
   - Test with 5, 6, 7 answers (slice logic)
   - Test with <5 answers (should fail)
   - Test deduplication

### Priority 2 (Add Soon - Important):
3. **Add question generation tests:**
   - Test WITH spacetime parameter
   - Test WITHOUT spacetime parameter
   - Verify prompt construction includes spacetime

4. **Add DB spacetime tests:**
   - Test `updateSpacetimeMetadata()`
   - Test article mapping includes new fields

### Priority 3 (Nice to Have):
5. **Add orchestrator integration tests:**
   - Mock DB/Ollama/Claude to avoid skipping
   - Test spacetime extraction flow
   - Test caching behavior

6. **Add JSON extraction edge case tests**

---

## 🎯 TEST STRATEGY

### Quick Wins (1-2 hours):
```typescript
// Add to local-llm.test.ts
describe('extractSpacetime', () => {
  it('should extract year, city, and state from article')
  it('should fallback to pub_date if extraction fails')
  it('should handle NULL gracefully')
  it('should parse YEAR/CITY/STATE format correctly')
})

// Add to claude-service.test.ts
describe('generateHouseAnswers - fallback extraction', () => {
  it('should handle exactly 5 answers')
  it('should take first 5 when Claude returns 6-7 answers')
  it('should fail when <5 answers found')
  it('should deduplicate extracted answers')
})
```

### Pattern for Mocking:
- Mock Ollama responses with `vi.mock()`
- Test parsing logic separately from API calls
- Use fixtures for known Claude response formats

---

## 📈 METRICS

**Current Coverage:**
- Unit tests: ~190 (good)
- Integration tests: 35 (all skipped without DB)
- Total: 230 tests

**Gaps:**
- New features: ~15-20 missing tests
- Edge cases: ~10-15 missing tests

**Goal:**
- Add 25-30 tests to cover critical gaps
- Target: 260 tests total
- Estimated time: 3-4 hours

---

## 🔧 NEXT STEPS

1. **Immediate:** Add spacetime extraction tests (highest risk)
2. **Today:** Add house answers fallback tests (regression prevention)
3. **This week:** Add question generation + DB tests
4. **When time permits:** Mock orchestrator for integration testing

---

**Bottom Line:** We have good coverage on utilities and scrapers, but **zero coverage on new spacetime features** and the **house answers bug we just fixed**. Recommendation: Add ~25 focused tests to cover the critical gaps.
