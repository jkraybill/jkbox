# Batch Answer Generation - User Prompt (C1)

Generate EXACTLY {{NUM_CONSTRAINTS}} single HILARIOUS WORDS, one per constraint listed above.

🎯 C1 RULES:
• EXACTLY 1 word each (no phrases, no spaces, no hyphens unless part of word like "McDonald's")
• Each word MUST satisfy its numbered constraint
• Follow proper capitalization (proper nouns capitalized, otherwise lowercase)
• NO punctuation (no periods, exclamation marks, question marks)
• **WINNING WORD BECOMES KEYWORD** - pick words with comedic reuse potential!

📤 OUTPUT FORMAT:
Return ONLY a JSON array of {{NUM_CONSTRAINTS}} strings:
["word1", "word2", "word3", ...]

NO explanations, NO markdown, NO extra text. ONLY the JSON array.
