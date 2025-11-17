# Triplet Judging Pipeline

## Overview

The triplet judging pipeline uses Ollama/Qwen (local LLM) to reduce the initial 18 triplet sets down to the 6 best candidates for the Cinema Pippin game.

## Pipeline Flow

For each triplet file (e.g., `test4.srt.1.txt`, `test4.srt.2.txt`, etc.):

1. **Parse first scene** - Extract the first of three scenes (delimited by `\n---\n`)
2. **Extract keyword** - Get the last word from the last frame's text
3. **Blank keyword** - Replace keyword with `_____` in the scene
4. **Load constraints** - Load from `assets/constraints.txt`
5. **Random selection** - Pick 5 random constraints per prompt
6. **Generate words** (Prompt 1) - Ask Qwen to generate 5 funny replacement words
7. **Shuffle words** - Randomize the order of generated words
8. **Judge words** (Prompt 2) - Ask Qwen to pick the funniest version
9. **Track winner** - Store the best word and its index for later use

## Usage

### Generate Triplets First

```bash
# Generate triplets from an SRT file
npm run cli find test4.srt

# This creates files like:
# /home/jk/jkbox/generated/test4.srt.1.txt
# /home/jk/jkbox/generated/test4.srt.2.txt
# ... up to test4.srt.18.txt (depending on how many are found)
```

### Judge Triplets

```bash
# Judge all triplets for a given SRT file
npm run cli judge test4.srt
```

This will:
- Find all generated triplet files for `test4.srt`
- Process each one through the judging pipeline
- Output verbose logging showing:
  - Keyword extraction
  - Constraints selected
  - Full prompts sent to Ollama
  - Full responses from Ollama
  - Winner selection

## Example Output

```
================================================================================
🎭 JUDGING TRIPLET 1: test4.srt.1.txt
================================================================================

📄 First scene loaded
🔑 Keyword extracted: "mystery"
✏️  Keyword blanked out

🎲 Randomly selected 5 constraints:
   1. Suggestive -- this punchline should maximize humorous adult innuendo...
   2. The letter "E" -- this punchline must begin with the letter "E".
   3. Bizarro world -- this punchline should maximize for being completely...
   4. Political -- this punchline should maximize for political but funny...
   5. Animals -- this punchline should be animal-related. Bestiality is allowed.

================================================================================
🎬 PROMPT 1: GENERATE REPLACEMENT WORDS
================================================================================
Model: qwen2.5:14b
Temperature: 0.7

Prompt:
[Full prompt with constraints and blanked scene]
================================================================================

================================================================================
📥 OLLAMA RESPONSE (PROMPT 1)
================================================================================
["enigma", "elephant", "erection", "election", "echidna"]
================================================================================

✅ Generated 5 words: ["enigma","elephant","erection","election","echidna"]
🔀 Shuffled order: ["election","echidna","erection","enigma","elephant"]

================================================================================
⚖️  PROMPT 2: JUDGE FUNNIEST WORD
================================================================================
[Full judging prompt with 5 versions]
================================================================================

================================================================================
📥 OLLAMA RESPONSE (PROMPT 2)
================================================================================
3
================================================================================

🏆 WINNER: Version 3 - "erection"
```

## Prompt Engineering

The judging pipeline uses carefully crafted prompts optimized for Qwen 2.5:

### System Prompts (Role Definition)
- **Prompt 1 System**: Defines Comedy Writer role - emphasizes HILARIOUS, ABSURD, CLEVER punchlines for adults-only game
- **Prompt 2 System**: Defines Expert Comedy Judge role - emphasizes comedic impact, surprise, absurdity, and adult appeal

### Task Prompts (Specific Instructions)
- **Prompt 1 (Generation)**:
  - **Couplet format**: Returns `[["constraint text", "word"], ...]` instead of just words
  - **Automatic constraint validation**: Verifies LLM copied constraint text exactly and in order
  - **Explicit array position mapping**: Array[0]=constraint 1, Array[1]=constraint 2, etc.
  - **Concrete wrong vs right example** showing constraint mismatches (swapped order)
  - **Casing rules**: Proper capitalization based on context (punctuation, proper nouns, sentence flow)
  - Repeated reinforcement: "EACH word satisfies ONLY its ONE assigned constraint"
  - Emphasizes maximizing ABSURDITY, SURPRISE, and HUMOR in context
  - Adults-only encouragement (dark humor, sexual innuendo, toilet humor)
  - Tips for maximizing humor (unexpected juxtapositions, context fit, shock value)
  - Strict JSON couplet format with validation

- **Prompt 2 (Judging)**:
  - Clear evaluation criteria (maximum humor, surprise/shock, absurd juxtaposition, contextual fit, adult appeal)
  - Emphasizes picking clear winners
  - Strict single-number output format

Benefits of this separation:
- Qwen 2.5 is "more resilient to diverse system prompts" for better role-play
- System prompts maintain consistent identity across calls
- Task prompts can be updated without changing role definition

### Constraint Validation

The couplet format enables automatic validation:
- Verifies LLM returned exactly 5 constraint-word pairs
- Checks each constraint text matches expected (exact string comparison, trimmed)
- Detects common errors:
  - Swapped constraint order
  - Modified constraint text instead of exact copy
  - Wrong couplet format

Error messages include:
- Which position failed (1-5)
- Expected vs received constraint text
- Full response JSON for debugging
- List of expected constraints in order

This provides immediate feedback for prompt optimization!

## Next Steps

The current implementation:
- ✅ Parses triplet files
- ✅ Extracts and blanks keywords
- ✅ Randomly selects constraints
- ✅ Generates 5 replacement words (with retry logic)
- ✅ Judges and picks the best (with retry logic)
- ✅ Tracks winner for each triplet
- ✅ Robust JSON parsing with fallback extraction
- ✅ Automatic retry on failures (max 3 attempts per prompt)
- ✅ System prompts for better role definition
- ✅ Optimized prompts for humor, rule-following, and creativity

Future enhancements (not yet implemented):
- [ ] Rank all 18 triplets by quality
- [ ] Select the top 6 triplets
- [ ] Generate final output files with the best 6

## Configuration

- **Ollama API**: `http://localhost:11434/api/generate`
- **Model**: `qwen2.5:14b`
- **Constraints file**: `/home/jk/jkbox/assets/constraints.txt`
- **Generated dir**: `/home/jk/jkbox/generated`
- **Max retries**: 2 (3 total attempts per prompt)
- **Temperature (Prompt 1)**: 0.95 (high creativity)
- **Temperature (Prompt 2)**: 0.3 (consistent judgment)
- **System Prompts**: Used to define roles (Comedy Writer vs Judge) - Qwen 2.5 is optimized for system prompt usage

## Testing

```bash
# Run all tests including judging pipeline
npm test

# Tests cover:
# - Keyword extraction and blanking
# - Triplet file parsing
# - Ollama API integration (mocked)
# - Error handling
```
