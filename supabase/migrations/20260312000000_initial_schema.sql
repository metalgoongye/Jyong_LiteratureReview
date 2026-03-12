-- ============================================================
-- Literature Review App - Initial Schema
-- ============================================================



-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE upload_source_type AS ENUM ('pdf', 'url', 'image');
CREATE TYPE extraction_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE paper_language AS ENUM ('korean', 'english', 'other');

-- ============================================================
-- AI_PROMPTS TABLE (created first for FK reference)
-- ============================================================
CREATE TABLE ai_prompts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  is_default      BOOLEAN DEFAULT FALSE,
  is_system       BOOLEAN DEFAULT FALSE,
  system_prompt   TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  model           TEXT DEFAULT 'anthropic/claude-opus-4-6',
  temperature     NUMERIC(3,2) DEFAULT 0.2,
  max_tokens      INTEGER DEFAULT 4096,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_prompts_user_id ON ai_prompts(user_id);

-- ============================================================
-- LITERATURE TABLE
-- ============================================================
CREATE TABLE literature (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type     upload_source_type NOT NULL,
  source_url      TEXT,
  storage_path    TEXT,
  original_filename TEXT,
  title           TEXT,
  authors         TEXT[],
  year            INTEGER,
  journal_name    TEXT,
  volume          TEXT,
  issue           TEXT,
  pages           TEXT,
  publisher       TEXT,
  country         TEXT,
  doi             TEXT,
  abstract        TEXT,
  language        paper_language DEFAULT 'english',
  fields          TEXT[],
  extraction_status   extraction_status DEFAULT 'pending',
  extraction_accuracy NUMERIC(5,2),
  ai_feedback         TEXT,
  ai_model_used       TEXT DEFAULT 'anthropic/claude-opus-4-6',
  extraction_prompt_id UUID REFERENCES ai_prompts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_literature_user_id   ON literature(user_id);
CREATE INDEX idx_literature_year      ON literature(year);
CREATE INDEX idx_literature_fields    ON literature USING GIN(fields);
CREATE INDEX idx_literature_authors   ON literature USING GIN(authors);
CREATE INDEX idx_literature_status    ON literature(extraction_status);

-- ============================================================
-- LITERATURE_CONTENT TABLE
-- ============================================================
CREATE TABLE literature_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  literature_id   UUID NOT NULL REFERENCES literature(id) ON DELETE CASCADE,
  section_type    TEXT NOT NULL,
  section_order   INTEGER NOT NULL DEFAULT 0,
  bullets_original  JSONB,
  bullets_korean    JSONB,
  raw_text_original TEXT,
  raw_text_korean   TEXT,
  highlight_ranges  JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_literature_id ON literature_content(literature_id);
CREATE INDEX idx_content_section_type  ON literature_content(section_type);

-- ============================================================
-- EMPIRICAL_EVIDENCE TABLE
-- ============================================================
CREATE TABLE empirical_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  literature_id   UUID NOT NULL REFERENCES literature(id) ON DELETE CASCADE,
  evidence_text   TEXT NOT NULL,
  metric_name     TEXT,
  metric_value    TEXT,
  metric_unit     TEXT,
  page_reference  TEXT,
  original_quote  TEXT,
  highlight_ranges JSONB,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_literature_id ON empirical_evidence(literature_id);

-- ============================================================
-- BATCH_JOBS TABLE
-- ============================================================
CREATE TABLE batch_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_files     INTEGER NOT NULL,
  completed_files INTEGER DEFAULT 0,
  failed_files    INTEGER DEFAULT 0,
  overall_status  extraction_status DEFAULT 'pending',
  overall_accuracy NUMERIC(5,2),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE batch_literature (
  batch_id        UUID REFERENCES batch_jobs(id) ON DELETE CASCADE,
  literature_id   UUID REFERENCES literature(id) ON DELETE CASCADE,
  position        INTEGER,
  PRIMARY KEY (batch_id, literature_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE literature         ENABLE ROW LEVEL SECURITY;
ALTER TABLE literature_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE empirical_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_literature   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_literature" ON literature
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "own_content" ON literature_content
  FOR ALL USING (
    literature_id IN (SELECT id FROM literature WHERE user_id = auth.uid())
  );

CREATE POLICY "own_evidence" ON empirical_evidence
  FOR ALL USING (
    literature_id IN (SELECT id FROM literature WHERE user_id = auth.uid())
  );

CREATE POLICY "own_prompts" ON ai_prompts
  FOR ALL USING (auth.uid() = user_id OR is_system = TRUE);

CREATE POLICY "own_batches" ON batch_jobs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "own_batch_literature" ON batch_literature
  FOR ALL USING (
    batch_id IN (SELECT id FROM batch_jobs WHERE user_id = auth.uid())
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_literature_updated_at
  BEFORE UPDATE ON literature
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Storage bucket setup (run manually in Supabase Dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('literature-files', 'literature-files', false);
--
-- CREATE POLICY "user_files" ON storage.objects
--   FOR ALL USING (
--     bucket_id = 'literature-files'
--     AND auth.uid()::text = (storage.foldername(name))[1]
--   );
