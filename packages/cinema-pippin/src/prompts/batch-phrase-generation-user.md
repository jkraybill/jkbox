# Batch Phrase Generation - User Prompt

Generate 6 HILARIOUS phrase/sentence replacements for a blank in this film scene.

🚨 CRITICAL: DO NOT REORDER OR MODIFY CONSTRAINT NAMES! 🚨
The #1 failure mode is putting constraints in the wrong array position.
Your response WILL BE REJECTED if array positions don't match constraint numbers.

🎯 CRITICAL RULES - FOLLOW EXACTLY:
• Generate EXACTLY 6 phrases/sentences in a JSON array
• Array position MUST match constraint number:
  - Array[0] = phrase for constraint 1 (FIRST constraint below)
  - Array[1] = phrase for constraint 2 (SECOND constraint below)
  - Array[2] = phrase for constraint 3 (THIRD constraint below)
  - Array[3] = phrase for constraint 4 (FOURTH constraint below)
  - Array[4] = phrase for constraint 5 (FIFTH constraint below)
  - Array[5] = phrase for constraint 6 (SIXTH constraint below)
• COPY the constraint name EXACTLY as written - DO NOT modify, paraphrase, or reorder
• EACH phrase satisfies ONLY its ONE assigned constraint
• Phrases can be MULTIPLE WORDS - aim for the target word count but ±1-2 words is OK
• Maximize ABSURDITY, SURPRISE, and HUMOR in context
• This is an ADULTS-ONLY game - dark humor, sexual innuendo, toilet humor all ENCOURAGED

📝 STEP-BY-STEP PROCESS (follow this order):
1. Read the 6 constraints below (numbered 1-6)
2. For constraint #1: Generate a funny phrase, create couplet [constraint_1_text, phrase_1]
3. For constraint #2: Generate a funny phrase, create couplet [constraint_2_text, phrase_2]
4. For constraint #3: Generate a funny phrase, create couplet [constraint_3_text, phrase_3]
5. For constraint #4: Generate a funny phrase, create couplet [constraint_4_text, phrase_4]
6. For constraint #5: Generate a funny phrase, create couplet [constraint_5_text, phrase_5]
7. For constraint #6: Generate a funny phrase, create couplet [constraint_6_text, phrase_6]
8. Return array: [couplet_1, couplet_2, couplet_3, couplet_4, couplet_5, couplet_6]

📝 CASING & PUNCTUATION RULES:

⚠️ IMPORTANT: Check the PREVIOUS SRT FRAME (the frame BEFORE the blank) for punctuation!
• If the previous frame ends with punctuation (. ! ? , ;) → CAPITALIZE first word of your phrase
• If it's a proper noun (names, places) → ALWAYS capitalize appropriately
• If continuing a sentence mid-flow with NO punctuation → use lowercase (unless proper noun)
• Phrases can include punctuation if it enhances the humor

🚨 CRITICAL PUNCTUATION RULE: Your phrase MUST end with one of these punctuation marks: . ? ! ]
• EVERY phrase must end with . or ? or ! or ]
• No exceptions - if your phrase doesn't end with punctuation, ADD IT!

Examples:
  - Previous frame: "He went to the store." → Blank frame: "_____" → Answer: "But it was closed." or "Hell awaited him!" (CAPITALIZE - previous frame ended with .)
  - Previous frame: "Whose roar was that?" → Blank frame: "_____" → Answer: "Godzilla's angry cousin!" or "America screaming?" (CAPITALIZE - previous frame ended with ?)
  - Same frame: "I found it over there. _____" → "but it was broken." (lowercase - continuing within same context)
  - Answer examples with punctuation: "What the hell?", "That's hilarious!", "Never seen that before.", "[dramatic pause]"

🚨 CRITICAL: Look at the ENTIRE film scene context - if the blank is in a NEW FRAME and the PREVIOUS FRAME ended with punctuation, you MUST capitalize the first word!

📋 YOUR 6 CONSTRAINTS (one per phrase, IN ORDER, with target word counts):
{{CONSTRAINTS_LIST}}

🎬 FILM SCENE WITH BLANK:
{{BLANKED_SCENE}}

💡 TIPS FOR MAX HUMOR:
- **CLEVER TWIST > CRUDE SHOCK:** "May the Force be with you... and in you" beats "just fucking"
- **ABSURD JUXTAPOSITION:** Mix serious + silly, formal + crude, mundane + extreme
- **CONTEXT FIT MATTERS:** Phrase must land in THIS scene, not generic shock
- **AVOID:** Pure sound effects ("Vroom vroom"), preachy lectures, lazy obscenity
- **PRIORITIZE:** Surprise + wordplay + unexpected callbacks to pop culture
- Word count is flexible - prioritize HUMOR over exact count
- Think phrases/sentences, NOT single words!

❌ WRONG EXAMPLE #1 (reordered constraints):
Given constraints:
1. {{EXAMPLE_CONSTRAINT_1}}
2. {{EXAMPLE_CONSTRAINT_2}}
3. {{EXAMPLE_CONSTRAINT_3}}
4. {{EXAMPLE_CONSTRAINT_4}}
5. {{EXAMPLE_CONSTRAINT_5}}
6. {{EXAMPLE_CONSTRAINT_6}}

BAD Output: [["{{EXAMPLE_CONSTRAINT_2}}", "phrase2."], ["{{EXAMPLE_CONSTRAINT_1}}", "phrase1."], ["{{EXAMPLE_CONSTRAINT_3}}", "phrase3."], ["{{EXAMPLE_CONSTRAINT_4}}", "phrase4."], ["{{EXAMPLE_CONSTRAINT_5}}", "phrase5."], ["{{EXAMPLE_CONSTRAINT_6}}", "phrase6."]]
← WRONG! Array[0] has constraint #2 instead of constraint #1. Constraints are SWAPPED!

❌ WRONG EXAMPLE #2 (made up different constraint names):
Given constraints:
1. {{EXAMPLE_CONSTRAINT_1}}
2. {{EXAMPLE_CONSTRAINT_2}}
3. {{EXAMPLE_CONSTRAINT_3}}
4. {{EXAMPLE_CONSTRAINT_4}}
5. {{EXAMPLE_CONSTRAINT_5}}
6. {{EXAMPLE_CONSTRAINT_6}}

BAD Output: [["{{EXAMPLE_CONSTRAINT_1}}", "phrase1."], ["Foodie (5 words)", "phrase2."], ["Pop culture (4 words)", "phrase3."], ["{{EXAMPLE_CONSTRAINT_4}}", "phrase4."], ["{{EXAMPLE_CONSTRAINT_5}}", "phrase5."], ["{{EXAMPLE_CONSTRAINT_6}}", "phrase6."]]
← WRONG! Array[1] has "Foodie" but constraint #2 was "{{EXAMPLE_CONSTRAINT_2}}". You CANNOT make up your own constraints!

✅ CORRECT EXAMPLE:
Given constraints:
1. {{EXAMPLE_CONSTRAINT_1}}
2. {{EXAMPLE_CONSTRAINT_2}}
3. {{EXAMPLE_CONSTRAINT_3}}
4. {{EXAMPLE_CONSTRAINT_4}}
5. {{EXAMPLE_CONSTRAINT_5}}
6. {{EXAMPLE_CONSTRAINT_6}}

GOOD Output: [["{{EXAMPLE_CONSTRAINT_1}}", "phrase1."], ["{{EXAMPLE_CONSTRAINT_2}}", "phrase2."], ["{{EXAMPLE_CONSTRAINT_3}}", "phrase3."], ["{{EXAMPLE_CONSTRAINT_4}}", "phrase4."], ["{{EXAMPLE_CONSTRAINT_5}}", "phrase5."], ["{{EXAMPLE_CONSTRAINT_6}}", "phrase6."]]
← RIGHT! Array[0]=constraint #1, Array[1]=constraint #2, Array[2]=constraint #3, Array[3]=constraint #4, Array[4]=constraint #5, Array[5]=constraint #6. Constraint names copied EXACTLY. Phrases end with punctuation!

⚠️ OUTPUT FORMAT:
Respond with ONLY a valid JSON array of 6 couplets (constraint-phrase pairs).
Each couplet is [constraint_text, phrase] where constraint_text is EXACTLY copied from above.

No explanations, no other text. Just the JSON array of couplets.
