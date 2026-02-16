-- Add protection_status to entities table
-- Used by person-categorizer to flag entities needing name protection.
-- Values: 'protected' (victims/minors), 'public' (public figures), 'review_needed' (uncertain)

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS protection_status TEXT
  CHECK (protection_status IN ('protected', 'public', 'review_needed'));

-- Index for querying protected entities (e.g., victim review queue)
CREATE INDEX IF NOT EXISTS idx_entities_protection_status
  ON entities (protection_status)
  WHERE protection_status IS NOT NULL;
