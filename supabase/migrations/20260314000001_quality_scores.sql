-- Six Is quality scores + accuracy details columns
ALTER TABLE literature
  ADD COLUMN IF NOT EXISTS six_is_scores JSONB,
  ADD COLUMN IF NOT EXISTS accuracy_details JSONB;

-- six_is_scores structure:
-- {
--   "inaccurate": 10, "inaccurate_reason": "...",
--   "imprecise": 25, "imprecise_reason": "...",
--   "inconsistent": 5, "inconsistent_reason": "...",
--   "incoherent": 10, "incoherent_reason": "...",
--   "incomplete": 12.5,        -- derived: (4개 합) / 4
--   "imperfect": 20, "imperfect_reason": "...",
--   "base_total": 50,          -- 4개 합 (max 400)
--   "grade": "A",
--   "verified_at": "2026-03-14T..."
-- }

-- accuracy_details structure:
-- {
--   "abstract_alignment": 88,  -- null if no abstract
--   "field_completeness": 75,
--   "overall": 82,
--   "verified_at": "2026-03-14T..."
-- }
