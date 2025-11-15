-- Add spacetime metadata for better question generation
-- These fields allow Claude to properly format questions with year/location context

BEGIN;

-- Add structured spacetime columns to articles
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS event_year INTEGER,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_state TEXT;

-- Create index for year-based queries (useful for temporal context)
CREATE INDEX IF NOT EXISTS idx_articles_event_year ON articles(event_year) WHERE event_year IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN articles.event_year IS 'Year the event occurred (extracted from pub_date or article content)';
COMMENT ON COLUMN articles.location_city IS 'City where event occurred (extracted from article content)';
COMMENT ON COLUMN articles.location_state IS 'State/province where event occurred (extracted from article content)';

COMMIT;
