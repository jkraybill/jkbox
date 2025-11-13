-- Fake Facts system schema extension
-- Adds tables and columns for generating trivia questions from weird news articles

-- Add columns to articles table for tracking Fake Facts processing
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS fake_facts_processed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fake_facts_processed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fake_facts_eligible BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fake_facts_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS article_summary TEXT, -- 50-word summary for question generation
  ADD COLUMN IF NOT EXISTS full_content_fetched BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS full_content_fetched_at TIMESTAMP;

-- Index for finding unprocessed articles
CREATE INDEX IF NOT EXISTS idx_articles_fake_facts_processed ON articles(fake_facts_processed) WHERE fake_facts_processed = false;

-- Fake Facts questions table
CREATE TABLE IF NOT EXISTS fake_facts_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,

  -- The question with blank(s)
  question_text TEXT NOT NULL, -- e.g., "In California, _____ are legally classified as fish."

  -- The blanked-out term/phrase
  blank_text TEXT NOT NULL, -- e.g., "bees"

  -- Generation metadata
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generator_model VARCHAR(100) NOT NULL, -- e.g., "claude-3-5-haiku-20241022"
  generation_cost NUMERIC(10, 6), -- Cost in USD

  -- Quality/usage tracking
  times_used INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  difficulty_score NUMERIC(3, 2), -- 0.0-1.0, calculated from usage stats

  -- Flags
  is_active BOOLEAN DEFAULT TRUE,
  is_reviewed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fake_facts_questions_article_id ON fake_facts_questions(article_id);
CREATE INDEX IF NOT EXISTS idx_fake_facts_questions_is_active ON fake_facts_questions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fake_facts_questions_difficulty ON fake_facts_questions(difficulty_score);

-- Fake Facts answers table (both real and house answers)
CREATE TABLE IF NOT EXISTS fake_facts_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES fake_facts_questions(id) ON DELETE CASCADE,

  -- Answer content
  answer_text TEXT NOT NULL,

  -- Type of answer
  is_real BOOLEAN NOT NULL, -- true = correct answer, false = house answer

  -- For house answers
  answer_order INTEGER, -- Display order (1-5 for house answers)

  -- Generation metadata (for house answers)
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generator_model VARCHAR(100), -- Only for house answers

  -- Usage tracking
  times_selected INTEGER DEFAULT 0, -- How many times this answer was chosen

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fake_facts_answers_question_id ON fake_facts_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_fake_facts_answers_is_real ON fake_facts_answers(is_real);

-- Constraints
ALTER TABLE fake_facts_answers
  ADD CONSTRAINT check_house_answer_order
  CHECK ((is_real = true AND answer_order IS NULL) OR (is_real = false AND answer_order IS NOT NULL));

-- Comments for documentation
COMMENT ON TABLE fake_facts_questions IS 'Generated trivia questions from weird news articles';
COMMENT ON COLUMN fake_facts_questions.question_text IS 'Question with blank(s), e.g., "In California, _____ are legally classified as fish."';
COMMENT ON COLUMN fake_facts_questions.blank_text IS 'The correct answer that fills the blank';
COMMENT ON COLUMN fake_facts_questions.difficulty_score IS 'Calculated from times_correct/times_used ratio';

COMMENT ON TABLE fake_facts_answers IS 'Answers for questions: 1 real + 5 house (fake) answers per question';
COMMENT ON COLUMN fake_facts_answers.is_real IS 'true = correct answer, false = house (fake) answer';
COMMENT ON COLUMN fake_facts_answers.answer_order IS 'Display order for house answers (1-5), NULL for real answer';
COMMENT ON COLUMN fake_facts_answers.times_selected IS 'Track which wrong answers players choose most often';
