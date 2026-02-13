-- Migration 00023: Research Tools
-- Phase 13: DOJ releases tracking, contradiction votes

-- ============================================================
-- Section 1: DOJ releases table
-- ============================================================

CREATE TABLE IF NOT EXISTS doj_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  release_date DATE,
  description TEXT,
  document_count INT,
  is_processed BOOLEAN DEFAULT FALSE,
  detected_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doj_releases_date ON doj_releases (release_date DESC);
CREATE INDEX IF NOT EXISTS idx_doj_releases_processed ON doj_releases (is_processed);

-- ============================================================
-- Section 2: Contradiction votes table
-- ============================================================

CREATE TABLE IF NOT EXISTS contradiction_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contradiction_id UUID NOT NULL REFERENCES contradictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT cv_vote_type_check CHECK (vote_type IN ('verify', 'dispute')),
  CONSTRAINT cv_unique_vote UNIQUE (contradiction_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cv_contradiction ON contradiction_votes (contradiction_id);

-- Auto-update contradiction counts on vote
CREATE OR REPLACE FUNCTION update_contradiction_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'verify' THEN
      UPDATE contradictions SET verify_count = verify_count + 1, updated_at = now()
        WHERE id = NEW.contradiction_id;
    ELSIF NEW.vote_type = 'dispute' THEN
      UPDATE contradictions SET dispute_count = dispute_count + 1, updated_at = now()
        WHERE id = NEW.contradiction_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'verify' THEN
      UPDATE contradictions SET verify_count = GREATEST(verify_count - 1, 0), updated_at = now()
        WHERE id = OLD.contradiction_id;
    ELSIF OLD.vote_type = 'dispute' THEN
      UPDATE contradictions SET dispute_count = GREATEST(dispute_count - 1, 0), updated_at = now()
        WHERE id = OLD.contradiction_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contradiction_vote_counts ON contradiction_votes;
CREATE TRIGGER trg_contradiction_vote_counts
  AFTER INSERT OR DELETE ON contradiction_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_contradiction_vote_counts();

-- ============================================================
-- Section 3: RLS Policies
-- ============================================================

ALTER TABLE doj_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY doj_releases_public_read ON doj_releases FOR SELECT USING (true);
CREATE POLICY doj_releases_service_write ON doj_releases FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);

ALTER TABLE contradiction_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cv_public_read ON contradiction_votes FOR SELECT USING (true);
CREATE POLICY cv_auth_insert ON contradiction_votes FOR INSERT WITH CHECK (
  auth.uid() = user_id
);
CREATE POLICY cv_auth_delete ON contradiction_votes FOR DELETE USING (
  auth.uid() = user_id
);
