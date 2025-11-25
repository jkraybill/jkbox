# Batch Word Generation - User Prompt

Generate 6 HILARIOUS one-word replacements for a blank in this film scene.

🚨 CRITICAL: DO NOT REORDER OR MODIFY CONSTRAINT NAMES! 🚨
The #1 failure mode is putting constraints in the wrong array position.
Your response WILL BE REJECTED if array positions don't match constraint numbers.

🎯 CRITICAL RULES - FOLLOW EXACTLY:
• Generate EXACTLY 6 words in a JSON array
• Array position MUST match constraint number:
  - Array[0] = word for constraint 1 (FIRST constraint below)
  - Array[1] = word for constraint 2 (SECOND constraint below)
  - Array[2] = word for constraint 3 (THIRD constraint below)
  - Array[3] = word for constraint 4 (FOURTH constraint below)
  - Array[4] = word for constraint 5 (FIFTH constraint below)
  - Array[5] = word for constraint 6 (SIXTH constraint below)
• COPY the constraint name EXACTLY as written - DO NOT modify, paraphrase, or reorder
• EACH word satisfies ONLY its ONE assigned constraint
• Words must be SINGLE WORDS (no phrases, no hyphens unless part of one word)
• Maximize ABSURDITY, SURPRISE, and HUMOR in context
• This is an ADULTS-ONLY game - dark humor, sexual innuendo, toilet humor all ENCOURAGED

📝 STEP-BY-STEP PROCESS (follow this order):
1. Read the 6 constraints below (numbered 1-6)
2. For constraint #1: Generate a funny word, create couplet [constraint_1_text, word_1]
3. For constraint #2: Generate a funny word, create couplet [constraint_2_text, word_2]
4. For constraint #3: Generate a funny word, create couplet [constraint_3_text, word_3]
5. For constraint #4: Generate a funny word, create couplet [constraint_4_text, word_4]
6. For constraint #5: Generate a funny word, create couplet [constraint_5_text, word_5]
7. For constraint #6: Generate a funny word, create couplet [constraint_6_text, word_6]
8. Return array: [couplet_1, couplet_2, couplet_3, couplet_4, couplet_5, couplet_6]

📝 WORD FORMAT RULES (CRITICAL):

🚨 SINGLE WORD ONLY - NO PUNCTUATION - NO SPACES!
• Your response must be EXACTLY ONE WORD with NO SPACES
• DO NOT include ANY punctuation (no periods, exclamation marks, question marks, etc.)
• DO NOT use multiple words or phrases - SINGLE WORD ONLY
• Examples of CORRECT format: "McDonald" or "Hell" or "boobies"
• Examples of WRONG format: "McDonald's!" (has punctuation), "New York" (has space), "oh boy" (multiple words)

📝 CASING RULES (follow proper English capitalization):
⚠️ IMPORTANT: Check the PREVIOUS SRT FRAME (the frame BEFORE the blank) for punctuation!
• If the previous frame ends with punctuation (. ! ? , ;) → CAPITALIZE first letter of your word
• If it's a proper noun (names, places) → ALWAYS capitalize appropriately
• If continuing a sentence mid-flow with NO punctuation → use lowercase (unless proper noun)

Examples:
  - Previous frame: "He went to the store." → Blank frame: "_____ was closed" → Answer: "McDonald" or "Hell" (CAPITALIZE - previous frame ended with .)
  - Previous frame: "Whose roar was that?" → Blank frame: "_____" → Answer: "Godzilla" or "America" (CAPITALIZE - previous frame ended with ?)
  - Same frame: "What the _____!" → "fuck" (mid-sentence within same frame, lowercase)
  - Same frame: "I love _____" → "tacos" or "Jesus" (continuation within same frame: lowercase unless proper)

🚨 REMEMBER: The punctuation is already in the film scene! You only provide the WORD!

📋 YOUR 6 CONSTRAINTS (one per word, IN ORDER):
{{CONSTRAINTS_LIST}}

🎬 FILM SCENE WITH BLANK:
{{BLANKED_SCENE}}

💡 TIPS FOR MAX HUMOR:
- Choose words that create absurd/unexpected juxtapositions
- Context matters - how does the word land in THIS scene?
- Shock value + cleverness = gold
- If multiple words fit a constraint, pick the FUNNIEST one

❌ WRONG EXAMPLE #1 (reordered constraints):
Given constraints:
1. {{EXAMPLE_CONSTRAINT_1}}
2. {{EXAMPLE_CONSTRAINT_2}}
3. {{EXAMPLE_CONSTRAINT_3}}
4. {{EXAMPLE_CONSTRAINT_4}}
5. {{EXAMPLE_CONSTRAINT_5}}
6. {{EXAMPLE_CONSTRAINT_6}}

BAD Output: [["{{EXAMPLE_CONSTRAINT_2}}", "word2"], ["{{EXAMPLE_CONSTRAINT_1}}", "word1"], ["{{EXAMPLE_CONSTRAINT_3}}", "word3"], ["{{EXAMPLE_CONSTRAINT_4}}", "word4"], ["{{EXAMPLE_CONSTRAINT_5}}", "word5"], ["{{EXAMPLE_CONSTRAINT_6}}", "word6"]]
← WRONG! Array[0] has constraint #2 instead of constraint #1. Constraints are SWAPPED!

❌ WRONG EXAMPLE #2 (made up different constraint names):
Given constraints:
1. {{EXAMPLE_CONSTRAINT_1}}
2. {{EXAMPLE_CONSTRAINT_2}}
3. {{EXAMPLE_CONSTRAINT_3}}
4. {{EXAMPLE_CONSTRAINT_4}}
5. {{EXAMPLE_CONSTRAINT_5}}
6. {{EXAMPLE_CONSTRAINT_6}}

BAD Output: [["{{EXAMPLE_CONSTRAINT_1}}", "word1"], ["Foodie", "word2"], ["Pop culture", "word3"], ["{{EXAMPLE_CONSTRAINT_4}}", "word4"], ["{{EXAMPLE_CONSTRAINT_5}}", "word5"], ["{{EXAMPLE_CONSTRAINT_6}}", "word6"]]
← WRONG! Array[1] has "Foodie" but constraint #2 was "{{EXAMPLE_CONSTRAINT_2}}". You CANNOT make up your own constraints!

✅ CORRECT EXAMPLE:
Given constraints:
1. {{EXAMPLE_CONSTRAINT_1}}
2. {{EXAMPLE_CONSTRAINT_2}}
3. {{EXAMPLE_CONSTRAINT_3}}
4. {{EXAMPLE_CONSTRAINT_4}}
5. {{EXAMPLE_CONSTRAINT_5}}
6. {{EXAMPLE_CONSTRAINT_6}}

GOOD Output: [["{{EXAMPLE_CONSTRAINT_1}}", "word1"], ["{{EXAMPLE_CONSTRAINT_2}}", "word2"], ["{{EXAMPLE_CONSTRAINT_3}}", "word3"], ["{{EXAMPLE_CONSTRAINT_4}}", "word4"], ["{{EXAMPLE_CONSTRAINT_5}}", "word5"], ["{{EXAMPLE_CONSTRAINT_6}}", "word6"]]
← RIGHT! Array[0]=constraint #1, Array[1]=constraint #2, Array[2]=constraint #3, Array[3]=constraint #4, Array[4]=constraint #5, Array[5]=constraint #6. Constraint names copied EXACTLY. Words are SINGLE WORDS with NO PUNCTUATION!

⚠️ OUTPUT FORMAT:
Respond with ONLY a valid JSON array of 6 couplets (constraint-word pairs).
Each couplet is [constraint_text, word] where constraint_text is EXACTLY copied from above.

No explanations, no other text. Just the JSON array of couplets.
