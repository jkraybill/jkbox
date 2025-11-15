-- ============================================================================
-- RESET FAKE FACTS: Clear generated questions, reset processing flags
-- ============================================================================
-- Run this when you want to regenerate all questions with improved prompts,
-- but KEEP existing is_weird classifications.
--
-- Usage: psql -d jkbox_data -f packages/data-tools/scripts/reset-fake-facts.sql
-- ============================================================================

BEGIN;

-- Step 1: DELETE all generated questions (cascades to answers)
DELETE FROM fake_facts_questions;

-- Step 2: RESET processing flags on articles (but KEEP is_weird classifications!)
UPDATE articles SET
  fake_facts_processed = FALSE,
  fake_facts_processed_at = NULL,
  fake_facts_eligible = NULL,
  fake_facts_rejection_reason = NULL,
  last_considered = NULL
WHERE TRUE;  -- All articles

-- Step 3: Show what we did
SELECT
  'Questions deleted' AS action,
  (SELECT COUNT(*) FROM fake_facts_questions) AS remaining_count;

SELECT
  'Articles reset for reprocessing' AS action,
  COUNT(*) AS total_articles,
  COUNT(*) FILTER (WHERE is_weird = true) AS weird_articles,
  COUNT(*) FILTER (WHERE last_considered IS NULL) AS never_considered,
  COUNT(*) FILTER (WHERE fake_facts_processed = false) AS unprocessed
FROM articles;

COMMIT;

-- ============================================================================
-- Result: All weird articles are now fresh candidates for question generation
-- Next: Run your pipeline to generate questions with improved prompts!
-- ============================================================================
