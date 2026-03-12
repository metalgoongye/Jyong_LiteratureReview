-- Add user_notes column for personal memos on each literature entry
ALTER TABLE literature ADD COLUMN IF NOT EXISTS user_notes TEXT DEFAULT NULL;
