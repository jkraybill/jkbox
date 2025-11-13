-- jkbox data collection tools - PostgreSQL schema
-- Version: 0.1.0

-- Feed sources catalogue
CREATE TABLE IF NOT EXISTS feed_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  newspaper_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  country TEXT NOT NULL,
  language TEXT NOT NULL,
  category TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]',

  title TEXT NOT NULL,
  description TEXT,
  last_build_date TIMESTAMPTZ,

  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_successful_fetch_at TIMESTAMPTZ,

  article_count INTEGER DEFAULT 0,
  update_frequency NUMERIC DEFAULT 0,
  quality_score INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,
  is_validated BOOLEAN DEFAULT FALSE,
  errors JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_sources_domain ON feed_sources(domain);
CREATE INDEX IF NOT EXISTS idx_feed_sources_category ON feed_sources(category);
CREATE INDEX IF NOT EXISTS idx_feed_sources_country ON feed_sources(country);
CREATE INDEX IF NOT EXISTS idx_feed_sources_language ON feed_sources(language);
CREATE INDEX IF NOT EXISTS idx_feed_sources_is_active ON feed_sources(is_active);

-- Articles
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  link TEXT NOT NULL UNIQUE,
  description TEXT,
  content TEXT,
  author TEXT,
  pub_date TIMESTAMPTZ NOT NULL,

  is_weird BOOLEAN,
  weirdness_score INTEGER,
  categories JSONB DEFAULT '[]',

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  language TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_weird ON articles(is_weird) WHERE is_weird = TRUE;
CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);

-- Domain discovery tracking
CREATE TABLE IF NOT EXISTS domain_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  authority_rank INTEGER,
  has_ssl BOOLEAN NOT NULL,
  domain_age NUMERIC,
  feeds_found INTEGER DEFAULT 0,

  sample_articles_tested INTEGER DEFAULT 0,
  weird_articles_found INTEGER DEFAULT 0,

  feeds_added JSONB DEFAULT '[]',
  rejection_reason TEXT,

  content_types JSONB DEFAULT '[]',
  notes TEXT,

  session_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_discovery_domain ON domain_discovery(domain);
CREATE INDEX IF NOT EXISTS idx_domain_discovery_session ON domain_discovery(session_id);
CREATE INDEX IF NOT EXISTS idx_domain_discovery_checked_at ON domain_discovery(checked_at DESC);

-- Discovery sessions
CREATE TABLE IF NOT EXISTS discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  seed_domains JSONB NOT NULL,
  domains_evaluated INTEGER DEFAULT 0,
  feeds_discovered INTEGER DEFAULT 0,
  feeds_validated INTEGER DEFAULT 0,
  feeds_failed INTEGER DEFAULT 0,

  errors JSONB DEFAULT '[]',
  stats JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_sessions_started_at ON discovery_sessions(started_at DESC);

-- Add foreign key constraint after discovery_sessions table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'domain_discovery_session_id_fkey'
  ) THEN
    ALTER TABLE domain_discovery
    ADD CONSTRAINT domain_discovery_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES discovery_sessions(id);
  END IF;
END $$;
