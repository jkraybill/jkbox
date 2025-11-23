# Batch Answer Generation - User Prompt (C2/C3)

Generate EXACTLY {{NUM_CONSTRAINTS}} HILARIOUS {{WORD_COUNT}}-WORD PHRASES, one per constraint listed above.

🎯 C{{CLIP_NUMBER}} RULES:
• EXACTLY {{WORD_COUNT}} words each (±1 OK, but aim for {{WORD_COUNT}})
• Each phrase MUST satisfy its numbered constraint
• MUST use keyword "{{KEYWORD}}" naturally in the phrase
• Follow proper capitalization
• MUST end with punctuation (. ! or ?)
• **CLEVER > CRUDE:** Absurd juxtapositions beat lazy obscenity

📤 OUTPUT FORMAT:
Return ONLY a JSON array of {{NUM_CONSTRAINTS}} strings:
["phrase one here!", "phrase two here.", "phrase three here!"]

NO explanations, NO markdown, NO extra text. ONLY the JSON array.
