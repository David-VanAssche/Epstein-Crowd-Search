-- Add congressional_priority_score to documents table
-- Used by the congressional-scorer pipeline stage to rank documents
-- by investigation priority (0.0 to 1.0 scale).

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS congressional_priority_score REAL;

-- Index for efficient sorting by priority score
CREATE INDEX IF NOT EXISTS idx_documents_congressional_score
  ON documents (congressional_priority_score DESC NULLS LAST)
  WHERE congressional_priority_score IS NOT NULL;
