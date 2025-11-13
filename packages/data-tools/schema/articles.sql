-- Unified articles table for RSS + historical + Reddit content
-- "Same bucket" - all content is equally legit question inspiration / weird news

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source information
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('rss', 'historical', 'reddit')),
  source_id VARCHAR(255), -- feed_id for RSS, subreddit for Reddit
  source_url TEXT NOT NULL, -- RSS feed URL, Reddit permalink, etc.

  -- Core content (the noun: question inspiration / weird news item)
  title TEXT NOT NULL,
  description TEXT, -- Article summary / Reddit post text
  content TEXT, -- Full HTML content if available
  link TEXT, -- Article/post URL

  -- Metadata
  author VARCHAR(255),
  pub_date TIMESTAMP, -- When article was published
  collected_at TIMESTAMP NOT NULL DEFAULT NOW(), -- When we scraped it

  -- Classification
  is_weird BOOLEAN DEFAULT NULL, -- Ollama classification result
  weird_confidence INTEGER, -- Classification confidence 0-100
  categories TEXT[], -- Article categories/tags

  -- Quality metrics
  engagement_score INTEGER, -- Reddit upvotes, or engagement metric
  quality_score INTEGER, -- Overall quality score

  -- Language/region
  language VARCHAR(10) NOT NULL, -- ISO 639-1 code
  country VARCHAR(10), -- ISO 3166-1 code

  -- Deduplication
  content_hash VARCHAR(64), -- SHA256 of title+description for deduplication

  -- Indexes for fast querying
  CONSTRAINT unique_content UNIQUE (content_hash)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_source_type ON articles(source_type);
CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_weird ON articles(is_weird) WHERE is_weird = true;
CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);
CREATE INDEX IF NOT EXISTS idx_articles_collected_at ON articles(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);

-- Comments for documentation
COMMENT ON TABLE articles IS 'Unified storage for all content: RSS feeds, historical snapshots, and Reddit posts';
COMMENT ON COLUMN articles.source_type IS 'Type of content: rss (current), historical (wayback), reddit';
COMMENT ON COLUMN articles.source_id IS 'Feed ID for RSS/historical, subreddit name for Reddit';
COMMENT ON COLUMN articles.content_hash IS 'SHA256(title + description) for deduplication';
COMMENT ON COLUMN articles.engagement_score IS 'Reddit upvotes or other engagement metric';
