-- Add soft delete support to literature table
ALTER TABLE literature ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for faster trash queries
CREATE INDEX IF NOT EXISTS idx_literature_deleted_at ON literature(deleted_at) WHERE deleted_at IS NOT NULL;
