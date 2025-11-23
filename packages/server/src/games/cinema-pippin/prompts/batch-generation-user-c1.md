# Batch Answer Generation - User Prompt (C1)

Generate EXACTLY {{NUM_CONSTRAINTS}} single HILARIOUS WORDS, one per constraint listed above, that fill in the below blank(s) from a foreign film's subtitle track:

{{TBD}}

🎯 RULES:
• EXACTLY 1 word each (no phrases, no spaces, no hyphens unless part of word like "semi-aroused")
• No fake contractions or forced words -- respond with a single word per answer.
• Each word MUST satisfy its numbered constraint
• Follow proper capitalization (proper nouns capitalized, otherwise lowercase)
• NO punctuation (no periods, exclamation marks, question marks)
• Optimize for comic re-use potential!

📤 OUTPUT FORMAT:
Return ONLY a JSON map of 7 couplets, with constraint title and answer that fills in the blanked text:
{ "{{CONSTRAINT_1}}": "word1", 
  "{{CONSTRAINT_2}}": "word2",
  "{{CONSTRAINT_3}}": "word3", ...}

NO explanations, NO markdown, NO extra text. ONLY the JSON array.
