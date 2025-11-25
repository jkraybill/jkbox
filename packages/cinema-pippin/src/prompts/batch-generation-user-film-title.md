# Batch Film Title Generation - User Prompt

You just watched 3 clips from a foreign film with the following WINNING ANSWERS that were voted the funniest:

**Act I Winner:** {{ACT1_WINNER}}
**Act II Winner:** {{ACT2_WINNER}}
**Act III Winner:** {{ACT3_WINNER}}

Generate EXACTLY {{NUM_CONSTRAINTS}} HILARIOUS FILM TITLES, one per constraint listed above, that would be perfect for this absurd foreign film.

🎯 RULES:
• 2-6 words per title (aim for punchy and memorable)
• Each title MUST satisfy its numbered constraint
• Titles should feel inspired by the 3 winning answers (reference them, riff on them, or tie them together)
• Use proper title capitalization (First Letter Of Each Major Word)
• NO punctuation at end (film titles don't have periods)
• Think foreign/arthouse film titles meets absurdist comedy

📤 OUTPUT FORMAT:
Return ONLY a JSON map of {{NUM_CONSTRAINTS}} couplets, with constraint title and film title:
{ "{{CONSTRAINT_1}}": "Film Title One",
  "{{CONSTRAINT_2}}": "Film Title Two",
  "{{CONSTRAINT_3}}": "Film Title Three", ...}

NO explanations, NO markdown, NO extra text. ONLY the JSON map. Make them HILARIOUS!
