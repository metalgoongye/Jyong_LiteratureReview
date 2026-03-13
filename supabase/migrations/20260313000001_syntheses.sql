-- ============================================================
-- Syntheses Table
-- ============================================================

CREATE TABLE syntheses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hypothesis      TEXT NOT NULL,
  title           TEXT,
  result          JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE syntheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own syntheses"
  ON syntheses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
