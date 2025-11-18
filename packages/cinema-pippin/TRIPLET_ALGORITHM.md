# Cinema Pippin: Triplet Finding Algorithm
## Complete Rule Set & Algorithm Documentation

---

## Overview

The algorithm searches an SRT subtitle file to find **sequences of 3 triplets** that share a common keyword. Each triplet consists of 3 official frames plus 0-6 filler frames between Frame 1 and Frame 2.

**Output:** Sets of 3 triplets, each containing 3-9 frames total (3 official + 0-6 fillers), all sharing the same keyword.

---

## Data Structure

### Triplet
```typescript
{
  allEntries: SRTEntry[]  // All 3-9 frames (F1, 0-6 fillers, F2, F3)
  frame1: SRTEntry        // Official Frame 1
  frame2: SRTEntry        // Official Frame 2
  frame3: SRTEntry        // Official Frame 3
  keyword: string         // Shared keyword (lowercase)
}
```

### SRTEntry
```typescript
{
  index: number           // Subtitle index
  startTime: string       // HH:MM:SS,mmm
  endTime: string         // HH:MM:SS,mmm
  text: string            // All lines joined with SPACE (for comparison)
  rawText: string[]       // Individual lines (preserved)
}
```

**Important:** Multiline subtitles are collapsed with spaces:
- `"THEN SHE\nSAID"` → `"THEN SHE SAID"`
- `"WHY?\nBecause"` → `"WHY? Because"`

---

## Algorithm Flow

### 1. Parse SRT File
Parse all subtitle entries starting from **index 1** (to allow for "previous frame" validation).

### 2. Search for First Triplet (T1)
Starting from frame index 1, try all possible combinations:

**Structure:**
```
[Prev Frame] [F1] [0-6 Filler Frames] [F2] [F3]
```

**Indices:**
- `F1 Index = i` (starts at 1)
- `F2 Index = i + 1 + fillerCount` (where fillerCount ∈ {0, 1, 2, 3, 4, 5, 6})
- `F3 Index = F2 Index + 1`

**Validation:** Must pass `isValidFirstTriplet()` (see T1 Rules below)

**Keyword Extraction:** Extract last word from T1 F3 text (lowercase, punctuation stripped)

### 3. Search for Second Triplet (T2)
Starting **after T1 ends** (T1_F3_Index + 1), try all possible combinations:

**Structure:**
```
[Prev Frame] [F1] [2-5 Filler Frames] [F2] [F3]
```

**Validation:** Must pass `isValidSubsequentTriplet()` with:
- Keyword from T1
- `minWords = 1`, `maxWords = 5` (T2 F3 must have 1-5 words)

### 4. Search for Third Triplet (T3)
Starting **after T2 ends** (T2_F3_Index + 1), try all possible combinations:

**Structure:** Same as T2

**Validation:** Must pass `isValidSubsequentTriplet()` with:
- Keyword from T1
- `minWords = 6` (T3 F3 must have ≥6 words)

### 5. Deduplication
Group all found sequences by **T1 F3 last word**. For each group:
- If only 1 sequence: keep it
- If multiple sequences: keep the one with **highest total alphabetic character count** across all 9 frames

---

## Validation Rules

### Common Rules (All Triplets)

**Previous Frame Punctuation:**
- Frame before F1 must end with: `.` `!` `?` `-` `;` `)` `]`

**Duration:**
- Total duration from F1 start to F3 end: **5-20 seconds** (inclusive)

---

### T1 (First Triplet) Specific Rules

#### T1 Frame 3 Requirements

**Must satisfy ALL of:**

1. **Must have at least one word**
   - Any non-empty text after trimming whitespace
   - No minimum character requirement
   - No punctuation requirements
   - No separator requirements
   - Examples:
     - `"BANANA"` ✓
     - `"BANANA."` ✓
     - `"A BANANA"` ✓
     - `"A -- BANANA."` ✓
     - `"word ... thing"` ✓
     - `""` ✗ (empty)
     - `"   "` ✗ (only whitespace)

2. **Keyword Extraction:**
   - Extract **last word** from F3 text
   - Strip punctuation
   - Lowercase
   - Example: `"...freedom of Middle-earth."` → keyword = `"middle-earth"`

3. **Keyword Uniqueness:**
   - The keyword **cannot appear as a standalone word** earlier in T1
   - Checked in: F1, F2, and F3 (excluding the final word)
   - Uses word boundary matching (case-insensitive)
   - Example:
     - F1: `"In the beginning"`, F2: `"Something arrived"`, F3: `"banana"` → **Valid** (banana doesn't appear earlier)
     - F1: `"In the beginning"`, F2: `"The banana arrived"`, F3: `"banana"` → **Invalid** (banana appears in F2)
   - This ensures the keyword is a climactic reveal, not mentioned before

4. **Excluded Words (keyword cannot be):**
   - `the`, `yes`, `no`, `why`, `how`, `when`, `where`, `me`, `i`, `you`
   - `good`, `bad`, `yep`, `yeah`, `nah`, `nope`
   - `one`, `two`, `three`, `none`, `nada`, `nothing`

#### T1 Frame 2 Requirements
- **Any text** (no restrictions)
- No minimum character requirement
- No punctuation requirement

---

### T2/T3 (Subsequent Triplets) Specific Rules

#### Keyword Presence (CRITICAL)
- Keyword must appear as **standalone word** in at least one of: F1, F2, or F3 (for EACH of T2 and T3)
- **ADDITIONAL REQUIREMENT:** Keyword must appear in at least one of: **{ T2 F1, T2 F2, T3 F1, T3 F2 }**
  - This ensures keyword appears in setup frames (F1/F2), not only punchline frames (F3)
  - Sequences where keyword only appears in T2 F3 and/or T3 F3 are rejected
- Uses word boundary matching (case-insensitive)
- Example: keyword `"you"` matches in `"You are here"` but NOT in `"Yours"`

#### Frame 2 Requirements
- Must end with: `.` `!` `?` `-` `;` `,` **IF AND ONLY IF** Frame 3 starts with a lowercase letter
- No punctuation requirement if Frame 3 starts with uppercase letter

#### Frame 3 Requirements
- Must end with **strong punctuation**: `.` `!` `?` `-` (excludes `;` `,` `:`)
- **T2 F3:** 1-5 words (inclusive)
- **T3 F3:** 6+ words (minimum)

---

## Search Algorithm Details

### Nested Loop Structure

```
FOR each possible T1 starting position (i = 1 to N):
  FOR each filler count (0, 1, 2, 3, 4, 5, 6):
    Calculate T1 F2 and F3 indices
    IF T1 is valid:
      Extract keyword

      FOR each possible T2 starting position (after T1):
        FOR each filler count (0, 1, 2, 3, 4, 5, 6):
          Calculate T2 F2 and F3 indices
          IF T2 is valid (with keyword, minWords=1, maxWords=5):

            FOR each possible T3 starting position (after T2):
              FOR each filler count (0, 1, 2, 3, 4, 5, 6):
                Calculate T3 F2 and F3 indices
                IF T3 is valid (with keyword, minWords=6):

                  ✅ Found valid sequence!
                  Add [T1, T2, T3] to results
```

**Time Complexity:** O(N³ × 7³) = O(N³) where N = number of subtitle frames

### Index Calculations

**For a triplet starting at index `i` with `f` fillers:**
```
F1_Index = i
F2_Index = i + 1 + f
F3_Index = F2_Index + 1 = i + 2 + f

Total frames in triplet: 1 + f + 2 = f + 3 frames
```

**Filler count `f` ∈ {0, 1, 2, 3, 4, 5, 6}:**
- f=0: 3 total frames (F1, F2, F3)
- f=1: 4 total frames (F1, filler, F2, F3)
- f=2: 5 total frames (F1, filler, filler, F2, F3)
- f=3: 6 total frames
- f=4: 7 total frames
- f=5: 8 total frames
- f=6: 9 total frames

---

## Deduplication Logic

**Problem:** Multiple sequences may share the same T1 F3 last word (keyword)

**Solution:** Group by T1 F3 last word, keep only the sequence with highest total alphabetic character count

**Algorithm:**
```
1. Group all sequences by lowercase(lastWord(T1.F3.text))
2. For each group:
   - If 1 sequence: keep it
   - If multiple: calculate total alpha chars across all 9 frames
   - Keep sequence with highest count
```

**Total Alpha Char Count:**
```
sum(alphaChars(T1.F1) + alphaChars(T1.F2) + alphaChars(T1.F3) +
    alphaChars(T2.F1) + alphaChars(T2.F2) + alphaChars(T2.F3) +
    alphaChars(T3.F1) + alphaChars(T3.F2) + alphaChars(T3.F3))
```

where `alphaChars(text)` = count of a-zA-Z characters only

---

## Example Walkthrough

### Input SRT Frames
```
1. [Prev] "Something happened."
2. [F1]   "In the beginning..."
3. [Filler] "there was"
4. [Filler] "only darkness"
5. [F2]   "But then light arrived."
6. [F3]   "And it was good!"

... more frames ...

10. [F1]  "The light shone brightly."
11. [Filler] "across"
12. [Filler] "the land"
13. [F2]  "Everyone could see."
14. [F3]  "It brought hope and light."

... more frames ...

18. [F1]  "Without light, we are lost."
19. [Filler] "in"
20. [Filler] "total"
21. [F2]  "We need it to survive."
22. [F3]  "Please keep the light burning."
```

### T1 Validation
- **F1 Index:** 2
- **Fillers:** 2 (indices 3, 4)
- **F2 Index:** 5
- **F3 Index:** 6

**Checks:**
- ✅ Prev frame (1) ends with `.`
- ✅ F1, F2, F3 each have ≥2 alpha chars
- ✅ F3 `"And it was good!"` ends with `!`
- ✅ F3 is single word `"good!"` with punctuation ✓
- ✅ F3 has ≥3 alpha chars
- ✅ Keyword `"good"` → **FAIL** (excluded word)

**T1 INVALID** (keyword in excluded list)

### Alternative T1 with keyword "light"
If T1 F3 was `"...brought light."`:
- ✅ Keyword = `"light"` (not excluded)
- **T1 VALID**

### T2 Validation
- Must contain keyword `"light"` in F1, F2, or F3
- ✅ F3: `"It brought hope and light."` contains `"light"`
- ✅ F2 ends with `.`
- ✅ F3 ends with `.`
- ✅ F3 has ≥2 words
- **T2 VALID**

### T3 Validation
- Must contain keyword `"light"` in F1, F2, or F3
- ✅ F3: `"Please keep the light burning."` contains `"light"`
- ✅ F2 ends with `.`
- ✅ F3 ends with `.`
- ✅ F3 has ≥3 words
- **T3 VALID**

### Result
✅ **Sequence found:** [T1, T2, T3] with keyword `"light"`

---

## Key Implementation Notes

### Word Boundary Matching
```typescript
// Keyword "you" should match:
"You are here"     ✓
"Me or you?"       ✓
// But NOT:
"Yours!"           ✗
"Youth"            ✗
```

### Last Word Extraction
```typescript
// From multi-word:
"freedom of Middle-earth." → "middle-earth"
"A big BANANA."            → "banana"

// From single word:
"Lost!"                    → "lost"
"BANANA."                  → "banana"
```

### Alphabetic Word Detection
For multi-word T1 F3 validation, alphabetic words are sequences matching `/[a-zA-Z']+/g`:
- `"A : BANANA"` → words: `["A", "BANANA"]`
- `"word...thing"` → words: `["word", "thing"]`

---

## Current Limitations & Potential Issues

### 1. No Frame Position Tracking
The algorithm doesn't track which SRT frame index corresponds to which triplet frame. This could make debugging difficult.

### 2. Deduplication May Discard Good Sequences
When multiple sequences share a T1 F3 last word, we only keep the one with most alpha chars. This might discard sequences with better semantic coherence.

### 3. No Semantic Validation
The algorithm doesn't check if the keyword usage makes semantic sense across the 3 triplets. It only checks presence.

### 4. Excluded Words List is Hardcoded
The excluded words list is small and hardcoded. May need expansion or dynamic configuration.

### 5. Filler Frame Content Not Validated
Filler frames between F1 and F2 aren't validated for quality or relevance. They could be gibberish or overly short.

### 6. No Minimum Keyword Frequency
Very rare keywords (appearing only in these 3 triplets) are treated the same as common keywords.

---

## Next Steps / Questions

1. **Should we validate filler frame quality?**
   - Minimum alphabetic character count?
   - Punctuation requirements?

2. **Should deduplication consider semantic coherence?**
   - Not just total alpha chars, but keyword relevance?

3. **Should we track frame indices for debugging?**
   - Add source frame index to each Triplet?

4. **Should excluded words be configurable?**
   - Move to external file or parameter?

5. **Should we use word frequency as a filter?**
   - Reject keywords that are too common (e.g., top 100 words)?
   - Prefer keywords in a "sweet spot" frequency range?

---

**Document Version:** 2.0
**Last Updated:** 2025-11-18
**Code Reference:** `packages/cinema-pippin/src/triplet-finder.ts`

### Changelog
- **v2.0 (2025-11-18):** Added stricter keyword requirement - keyword must now appear in at least one of { T2 F1, T2 F2, T3 F1, T3 F2 }, ensuring keyword appears in setup frames (F1/F2), not only punchline frames (F3)
- **v1.9 (2025-11-18):** Changed T2/T3 Frame 3 word count requirements - T2 F3 now requires 1-5 words (was ≥2), T3 F3 now requires ≥6 words (was ≥3)
- **v1.8 (2025-11-18):** T2/T3 Frame 2 punctuation requirement now only applies IF Frame 3 starts with lowercase letter - no requirement if F3 starts with uppercase
- **v1.7 (2025-11-18):** Added comma (`,`) to T2/T3 Frame 2 allowed ending punctuation - now accepts `.` `!` `?` `-` `;` `,`
- **v1.6 (2025-11-17):** T2/T3 Frame 3 must end with strong punctuation only (`.` `!` `?` `-`) - excludes semicolon, comma, and colon
- **v1.5 (2025-11-17):** Removed opening brackets from previous frame allowed punctuation - "(" and "[" no longer allowed, only closing brackets ")" and "]" allowed
- **v1.4 (2025-11-17):** Major simplification - removed ALL minimum character requirements; T1 F3 now just requires at least one word (no punctuation or separator requirements); T1 F2 has no restrictions
- **v1.3 (2025-11-16):** Added keyword uniqueness restriction for T1 - keyword cannot appear as standalone word earlier in any T1 frame
- **v1.2 (2025-11-16):** Updated duration range from 5-35s back to 5-20s for better quality
- **v1.1 (2025-11-16):** Updated filler range from 2-5 to 0-6 fillers; updated duration range from 5-20s to 5-35s
- **v1.0 (2025-11-16):** Initial documentation
