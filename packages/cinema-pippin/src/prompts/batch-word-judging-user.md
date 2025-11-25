# Batch Word Judging - User Prompt

Judge these 6 versions of the same film scene. Each has a different word filling the blank.

🎯 YOUR TASK:
Rank the TOP 3 FUNNIEST versions - the ones that:
• Maximize HUMOR and make people LAUGH HARDEST
• Have the best SURPRISE/SHOCK value
• Create the most ABSURD or CLEVER juxtaposition
• Fit the context while being UNEXPECTED
• Have broad ADULT APPEAL for a party game

📽️ THE 6 VERSIONS:

{{VERSIONS}}

⚠️ OUTPUT FORMAT:
Provide EXACTLY 3 numbers (1-6) separated by spaces, ranked from funniest to third-funniest.
Example: "3 1 5" means Version 3 is funniest, Version 1 is second, Version 5 is third.

🚨 CRITICAL VALIDATION RULES:
• ONLY use numbers 1, 2, 3, 4, 5, or 6
• DO NOT use 0, 7, 8, 9, or any number outside 1-6
• There are exactly 6 versions - you CANNOT select version 7 or higher
• Using invalid numbers will cause an error

Your response should be ONLY the 3 numbers separated by spaces. No explanations, no other text.
