-- Test database setup script
-- Drops and recreates all tables with fresh schema
-- Run before tests to ensure clean state

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS fake_facts_answers CASCADE;
DROP TABLE IF EXISTS fake_facts_questions CASCADE;
DROP TABLE IF EXISTS articles CASCADE;

-- Create articles table
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source information
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('rss', 'historical', 'reddit', 'news-of-weird')),
  source_id VARCHAR(255),
  source_url TEXT NOT NULL,

  -- Core content
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  link TEXT,

  -- Metadata
  author VARCHAR(255),
  pub_date TIMESTAMP,
  collected_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Classification
  is_weird BOOLEAN DEFAULT NULL,
  weird_confidence INTEGER,
  categories TEXT[],

  -- Quality metrics
  engagement_score INTEGER,
  quality_score INTEGER,

  -- Language/region
  language VARCHAR(10) NOT NULL,
  country VARCHAR(10),

  -- Deduplication
  content_hash VARCHAR(64),

  -- Fake Facts pipeline tracking
  fake_facts_processed BOOLEAN DEFAULT FALSE,
  fake_facts_processed_at TIMESTAMP,
  fake_facts_eligible BOOLEAN,
  fake_facts_rejection_reason TEXT,
  last_considered TIMESTAMP,
  article_summary TEXT,

  -- Spacetime metadata
  event_year INTEGER,
  location_city TEXT,
  location_state TEXT,

  CONSTRAINT unique_content UNIQUE (content_hash)
);

-- Create fake_facts_questions table
CREATE TABLE fake_facts_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  blank_text TEXT NOT NULL,
  postscript TEXT,
  generator_model VARCHAR(50) NOT NULL,
  generation_cost DECIMAL(10, 6),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create fake_facts_answers table
CREATE TABLE fake_facts_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES fake_facts_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_real BOOLEAN NOT NULL,
  answer_order INTEGER,
  generator_model VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_articles_source_type ON articles(source_type);
CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_weird ON articles(is_weird) WHERE is_weird = true;
CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);
CREATE INDEX IF NOT EXISTS idx_articles_collected_at ON articles(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_articles_fake_facts_processed ON articles(fake_facts_processed);
CREATE INDEX IF NOT EXISTS idx_articles_last_considered ON articles(last_considered) WHERE last_considered IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_event_year ON articles(event_year) WHERE event_year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fake_facts_questions_article_id ON fake_facts_questions(article_id);
CREATE INDEX IF NOT EXISTS idx_fake_facts_answers_question_id ON fake_facts_answers(question_id);
