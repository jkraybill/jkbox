-- ============================================================================
-- NUCLEAR RESET: Clear ALL post-processing data for clean slate
-- ============================================================================
-- Run this when you want to re-classify and re-generate everything from scratch
-- with new, improved prompts.
--
-- Usage: psql $DATABASE_URL -f scripts/nuclear-reset.sql
-- ============================================================================

BEGIN;

-- Step 1: DELETE all generated questions (they used old prompts)
DELETE FROM fake_facts_questions;

-- Step 2: RESET all classification data on articles
UPDATE articles SET
  is_weird = NULL,
  weird_confidence = NULL,
  article_summary = NULL  -- Force re-summarization with new "funny details" prompt
WHERE TRUE;  -- All articles, regardless of source

-- Step 3: Show what we nuked
SELECT
  'Questions deleted' AS action,
  (SELECT COUNT(*) FROM fake_facts_questions) AS remaining_count;

SELECT
  'Articles reset' AS action,
  COUNT(*) AS total_articles,
  COUNT(*) FILTER (WHERE is_weird IS NULL) AS unclassified,
  COUNT(*) FILTER (WHERE article_summary IS NULL) AS needs_summary
FROM articles;

COMMIT;

-- ============================================================================
-- Next steps after running this:
--
-- 1. Re-classify all articles:
--    npm run classify-articles --workspace=@jkbox/data-tools
--
-- 2. Generate fresh questions (slow, careful, high-quality):
--    npm run generate-fake-facts --workspace=@jkbox/data-tools -- --batch-size 10
--
-- 3. Or run full bakeoff to test prompts:
--    npm run bakeoff-scoring --workspace=@jkbox/data-tools
-- ============================================================================
