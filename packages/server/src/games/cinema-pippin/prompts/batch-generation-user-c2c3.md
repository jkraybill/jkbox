# Batch Answer Generation - User Prompt (C2/C3)

Generate EXACTLY {{NUM_CONSTRAINTS}} HILARIOUS PHRASES, one per constraint listed above, that fill in the following subtitled movie scene:

{{QUESTION_SRT}}

🎯 RULES:
• aim for {{WORD_COUNT}}) total words, but your answer will replace all the blanked out ("___" etc) text
• Each phrase MUST satisfy its numbered constraint
• Follow proper capitalization
• MUST end with punctuation (. ! or ?)
• Optimize for comedic potential!

📤 OUTPUT FORMAT:
Return ONLY a JSON map of {{NUM_CONSTRAINTS}} couplets, with constraint title and answer that fills in the blanked text:
{ "{{CONSTRAINT_1}}": "answer1", 
  "{{CONSTRAINT_2}}": "answer2",
  "{{CONSTRAINT_3}}": "answer3", ...}

NO explanations, NO markdown, NO extra text. ONLY the JSON array.
