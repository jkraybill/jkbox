# AI Voting/Judging - User Prompt

Judge these {{NUM_ANSWERS}} punchlines and pick the FUNNIEST one that best fits this judging preference: "{{JUDGING_CONSTRAINT}}"

The punchline will fill in the blanked-out line(s) from this foreign movie scene:

{{QUESTION_SRT}}

🎯 JUDGING CRITERIA:
- Which one makes you LAUGH the hardest?
- Which has the best SURPRISE/SHOCK value?
- Which creates the most ABSURD juxtaposition in context?
- Which satisfies the judging preference: "{{JUDGING_CONSTRAINT}}"

📋 THE PUNCHLINES:
{{ANSWERS_LIST}}

📤 OUTPUT:
Respond with ONLY the number (1-{{NUM_ANSWERS}}) of the funniest punchline. No explanation, just the number.
