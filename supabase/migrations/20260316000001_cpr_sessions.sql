CREATE TABLE IF NOT EXISTS cpr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  title TEXT,
  original_text TEXT,
  reviewer_comments TEXT,
  synthesis_id UUID REFERENCES syntheses(id) ON DELETE SET NULL,
  expert_review JSONB,
  annotated_html TEXT,
  status TEXT DEFAULT 'pending'
);

ALTER TABLE cpr_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own cpr_sessions" ON cpr_sessions
  FOR ALL USING (auth.uid() = user_id);
