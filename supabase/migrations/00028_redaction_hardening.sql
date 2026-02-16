-- 00028_redaction_hardening.sql
-- Security fixes, atomic cascade engine, system bot, cycle protection, dedup index

-- =========================================================
-- Phase 1a: Fix calculate_proposal_confidence — add SECURITY DEFINER
-- The original function updates redaction_proposals but lacks SECURITY DEFINER,
-- so when user B votes on user A's proposal, RLS blocks the confidence update.
-- =========================================================

CREATE OR REPLACE FUNCTION calculate_proposal_confidence(
  target_proposal_id UUID
)
RETURNS FLOAT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proposal RECORD;
  confidence FLOAT := 0;
  vote_score FLOAT;
  length_bonus FLOAT;
  context_bonus FLOAT;
  graph_bonus FLOAT;
BEGIN
  SELECT rp.*, r.char_length_estimate
  INTO proposal
  FROM redaction_proposals rp
  JOIN redactions r ON r.id = rp.redaction_id
  WHERE rp.id = target_proposal_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Vote score (0-0.3): community agreement
  vote_score := LEAST(
    (COALESCE(proposal.upvotes, 0) + COALESCE(proposal.corroborations, 0) * 2 - COALESCE(proposal.downvotes, 0))::FLOAT
    / GREATEST(COALESCE(proposal.upvotes, 0) + COALESCE(proposal.downvotes, 0) + COALESCE(proposal.corroborations, 0), 1)::FLOAT,
    1.0
  ) * 0.3;

  -- Length match bonus (0 or 0.15)
  IF proposal.char_length_estimate IS NOT NULL AND proposal.length_match THEN
    length_bonus := 0.15;
  ELSE
    length_bonus := 0;
  END IF;

  -- Context match score (0-0.35)
  context_bonus := COALESCE(proposal.context_match_score, 0) * 0.35;

  -- Entity graph consistency (0-0.20)
  graph_bonus := COALESCE(proposal.entity_graph_consistency, 0) * 0.20;

  confidence := vote_score + length_bonus + context_bonus + graph_bonus;

  -- Update the proposal
  UPDATE redaction_proposals
  SET composite_confidence = confidence
  WHERE id = target_proposal_id;

  RETURN confidence;
END;
$$;

-- =========================================================
-- Phase 1c: Ensure all redaction status transitions happen via SECURITY DEFINER functions.
-- No direct UPDATE policy on redactions — status changes only via DB functions.
-- (redactions already has RLS enabled with SELECT-only policy from 00011)
-- =========================================================

-- Helper: transition redaction status (used by propose/vote APIs via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION transition_redaction_status(
  p_redaction_id UUID,
  p_new_status TEXT,
  p_allowed_from TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_allowed_from IS NOT NULL THEN
    UPDATE redactions
    SET status = p_new_status, updated_at = now()
    WHERE id = p_redaction_id
      AND status = ANY(p_allowed_from);
  ELSE
    UPDATE redactions
    SET status = p_new_status, updated_at = now()
    WHERE id = p_redaction_id;
  END IF;

  RETURN FOUND;
END;
$$;

-- =========================================================
-- Phase 1d: Cycle protection for get_cascade_tree
-- Depth limit of 20, cycle detection via path array, self-reference guard
-- =========================================================

-- Self-reference CHECK constraint (idempotent via NOT VALID + IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_no_self_cascade'
  ) THEN
    ALTER TABLE redactions ADD CONSTRAINT chk_no_self_cascade
      CHECK (cascade_source_id IS NULL OR cascade_source_id != id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_cascade_tree(
  root_redaction_id UUID
)
RETURNS TABLE (
  redaction_id UUID,
  parent_id UUID,
  resolved_text TEXT,
  resolved_entity_name TEXT,
  document_filename TEXT,
  page_number INTEGER,
  cascade_depth INTEGER,
  resolved_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE tree AS (
    -- Root node
    SELECT
      r.id AS redaction_id,
      r.cascade_source_id AS parent_id,
      r.resolved_text,
      e.name AS resolved_entity_name,
      d.filename AS document_filename,
      r.page_number,
      0 AS cascade_depth,
      r.resolved_at,
      ARRAY[r.id] AS path
    FROM redactions r
    LEFT JOIN entities e ON e.id = r.resolved_entity_id
    JOIN documents d ON d.id = r.document_id
    WHERE r.id = root_redaction_id

    UNION ALL

    -- Children (redactions that cascaded from parent)
    SELECT
      r.id AS redaction_id,
      r.cascade_source_id AS parent_id,
      r.resolved_text,
      e.name AS resolved_entity_name,
      d.filename AS document_filename,
      r.page_number,
      t.cascade_depth + 1,
      r.resolved_at,
      t.path || r.id
    FROM redactions r
    JOIN tree t ON r.cascade_source_id = t.redaction_id
    LEFT JOIN entities e ON e.id = r.resolved_entity_id
    JOIN documents d ON d.id = r.document_id
    WHERE r.status IN ('confirmed', 'corroborated')
      AND t.cascade_depth < 20            -- depth limit
      AND r.id != ALL(t.path)             -- cycle detection
  )
  SELECT
    tree.redaction_id,
    tree.parent_id,
    tree.resolved_text,
    tree.resolved_entity_name,
    tree.document_filename,
    tree.page_number,
    tree.cascade_depth,
    tree.resolved_at
  FROM tree
  ORDER BY tree.cascade_depth, tree.resolved_at;
$$;

-- =========================================================
-- Phase 2d: System bot user for cascade proposals
-- Uses a deterministic UUID derived from the email, so it's idempotent.
-- =========================================================

DO $$
DECLARE
  v_system_user_id UUID := '00000000-0000-4000-a000-000000000001';
BEGIN
  -- Insert into auth.users if not exists
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, role, aud,
    banned_until, created_at, updated_at
  )
  VALUES (
    v_system_user_id,
    '00000000-0000-0000-0000-000000000000',
    'system-cascade@epsteincrowdresearch.internal',
    '',  -- empty password — banned_until prevents auth
    now(),
    'authenticated',
    'authenticated',
    'infinity',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert matching user_profile
  INSERT INTO user_profiles (id, display_name, tier)
  VALUES (v_system_user_id, 'Cascade Bot', 'system')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- =========================================================
-- Phase 2f: Unique index for cascade dedup
-- Prevents the same text from being cascade-proposed twice for the same redaction
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_cascade_dedup
  ON redaction_proposals (redaction_id, proposed_text)
  WHERE evidence_type = 'cascade' AND status = 'pending';

-- =========================================================
-- Phase 2a: Atomic auto-confirm + cascade SQL function
-- Single transaction: lock → check thresholds → confirm → cascade
-- =========================================================

CREATE OR REPLACE FUNCTION auto_confirm_and_cascade(
  p_proposal_id UUID,
  p_redaction_id UUID,
  p_system_user_id UUID DEFAULT '00000000-0000-4000-a000-000000000001',
  p_min_confidence FLOAT DEFAULT 0.78,
  p_min_corroborations INT DEFAULT 3,
  p_min_total_votes INT DEFAULT 7,
  p_max_downvote_ratio FLOAT DEFAULT 0.25,
  p_cascade_similarity FLOAT DEFAULT 0.88,
  p_max_cascade_depth INT DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_redaction RECORD;
  v_total_votes INT;
  v_downvote_ratio FLOAT;
  v_cascade_count INT := 0;
  v_is_cascade BOOLEAN;
  v_effective_min_confidence FLOAT;
  v_effective_min_corroborations INT;
BEGIN
  -- 1. Lock the proposal row to prevent concurrent auto-confirm
  SELECT * INTO v_proposal
  FROM redaction_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'proposal_not_found');
  END IF;

  -- Already accepted — another concurrent request got here first
  IF v_proposal.status != 'pending' THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'proposal_already_resolved');
  END IF;

  -- 2. Check if this is a cascade proposal (stricter thresholds)
  v_is_cascade := v_proposal.evidence_type = 'cascade';
  v_effective_min_confidence := CASE WHEN v_is_cascade THEN GREATEST(p_min_confidence, 0.80) ELSE p_min_confidence END;
  v_effective_min_corroborations := CASE WHEN v_is_cascade THEN GREATEST(p_min_corroborations, 4) ELSE p_min_corroborations END;

  -- 3. Check thresholds
  v_total_votes := COALESCE(v_proposal.upvotes, 0) + COALESCE(v_proposal.downvotes, 0) + COALESCE(v_proposal.corroborations, 0);

  IF COALESCE(v_proposal.composite_confidence, 0) < v_effective_min_confidence THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'confidence_too_low',
      'confidence', v_proposal.composite_confidence, 'required', v_effective_min_confidence);
  END IF;

  IF COALESCE(v_proposal.corroborations, 0) < v_effective_min_corroborations THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'insufficient_corroborations');
  END IF;

  IF v_total_votes < p_min_total_votes THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'insufficient_votes');
  END IF;

  v_downvote_ratio := CASE WHEN v_total_votes > 0
    THEN COALESCE(v_proposal.downvotes, 0)::FLOAT / v_total_votes
    ELSE 0 END;

  IF v_downvote_ratio > p_max_downvote_ratio THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'too_many_downvotes');
  END IF;

  -- 4. Confirm the redaction — guard against already-confirmed/disputed
  UPDATE redactions
  SET
    status = 'confirmed',
    resolved_text = v_proposal.proposed_text,
    resolved_entity_id = v_proposal.proposed_entity_id,
    resolved_at = now(),
    resolved_method = 'community_consensus',
    confidence = v_proposal.composite_confidence,
    updated_at = now()
  WHERE id = p_redaction_id
    AND status NOT IN ('confirmed', 'disputed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'redaction_already_resolved');
  END IF;

  -- 5. Accept winning proposal, supersede all others for same redaction
  UPDATE redaction_proposals
  SET status = 'accepted', reviewed_at = now()
  WHERE id = p_proposal_id;

  UPDATE redaction_proposals
  SET status = 'superseded', reviewed_at = now()
  WHERE redaction_id = p_redaction_id
    AND id != p_proposal_id
    AND status = 'pending';

  -- 6. Fetch current cascade_depth of the confirmed redaction
  SELECT cascade_depth INTO v_redaction
  FROM redactions WHERE id = p_redaction_id;

  -- 7. Batch insert cascade proposals only if within depth limit
  IF COALESCE((SELECT cascade_depth FROM redactions WHERE id = p_redaction_id), 0) < p_max_cascade_depth THEN
    WITH similar_redactions AS (
      SELECT
        r.id AS target_redaction_id,
        1 - (r.context_embedding <=> src.context_embedding)::FLOAT AS similarity
      FROM redactions r
      CROSS JOIN (
        SELECT context_embedding, char_length_estimate, redaction_type
        FROM redactions WHERE id = p_redaction_id
      ) src
      WHERE r.id != p_redaction_id
        AND r.status = 'unsolved'
        AND r.context_embedding IS NOT NULL
        AND 1 - (r.context_embedding <=> src.context_embedding) >= p_cascade_similarity
        AND (src.char_length_estimate IS NULL OR ABS(r.char_length_estimate - src.char_length_estimate) <= 3)
        AND (src.redaction_type IS NULL OR r.redaction_type = src.redaction_type)
      LIMIT 50
    ),
    inserted AS (
      INSERT INTO redaction_proposals (
        redaction_id, user_id, proposed_text, proposed_entity_id,
        evidence_type, evidence_description, evidence_sources,
        context_match_score, length_match, status
      )
      SELECT
        s.target_redaction_id,
        p_system_user_id,
        v_proposal.proposed_text,
        v_proposal.proposed_entity_id,
        'cascade',
        format('Auto-cascaded from confirmed redaction. Context similarity: %s', round(s.similarity::NUMERIC, 2)),
        ARRAY[p_redaction_id::TEXT],
        s.similarity,
        true,
        'pending'
      FROM similar_redactions s
      ON CONFLICT (redaction_id, proposed_text)
        WHERE evidence_type = 'cascade' AND status = 'pending'
        DO NOTHING
      RETURNING redaction_id
    )
    SELECT COUNT(*) INTO v_cascade_count FROM inserted;

    -- Update cascade metadata on matched redactions
    UPDATE redactions r
    SET
      cascade_source_id = p_redaction_id,
      cascade_depth = COALESCE((SELECT cascade_depth FROM redactions WHERE id = p_redaction_id), 0) + 1,
      status = CASE WHEN r.status = 'unsolved' THEN 'proposed' ELSE r.status END,
      updated_at = now()
    FROM (
      SELECT target_redaction_id FROM similar_redactions
    ) s
    WHERE r.id = s.target_redaction_id
      AND r.status = 'unsolved';

    -- Update cascade count on the source redaction
    UPDATE redactions
    SET cascade_count = v_cascade_count, updated_at = now()
    WHERE id = p_redaction_id;
  END IF;

  RETURN jsonb_build_object(
    'confirmed', true,
    'cascade_count', v_cascade_count,
    'proposal_id', p_proposal_id,
    'redaction_id', p_redaction_id
  );
END;
$$;

-- =========================================================
-- Phase 2e: Cascade count pre-computation
-- =========================================================

-- Refresh cascade count for a single redaction (how many unsolved redactions
-- would receive cascade proposals if this one were solved)
CREATE OR REPLACE FUNCTION refresh_cascade_count(target_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM redactions r
  CROSS JOIN (
    SELECT context_embedding, char_length_estimate, redaction_type
    FROM redactions WHERE id = target_id
  ) src
  WHERE r.id != target_id
    AND r.status = 'unsolved'
    AND r.context_embedding IS NOT NULL
    AND src.context_embedding IS NOT NULL
    AND 1 - (r.context_embedding <=> src.context_embedding) >= 0.88
    AND (src.char_length_estimate IS NULL OR ABS(r.char_length_estimate - src.char_length_estimate) <= 3)
    AND (src.redaction_type IS NULL OR r.redaction_type = src.redaction_type);

  UPDATE redactions
  SET potential_cascade_count = v_count, updated_at = now()
  WHERE id = target_id;

  RETURN v_count;
END;
$$;

-- Batch refresh all unsolved redactions
CREATE OR REPLACE FUNCTION refresh_all_cascade_counts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id FROM redactions
    WHERE status = 'unsolved' AND context_embedding IS NOT NULL
  LOOP
    PERFORM refresh_cascade_count(v_row.id);
    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

-- =========================================================
-- Phase 4b: Revert cascade tree (admin reversal)
-- =========================================================

CREATE OR REPLACE FUNCTION revert_cascade_tree(
  p_root_redaction_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tree_ids UUID[];
  v_reverted_count INT;
  v_deleted_proposals INT;
BEGIN
  -- Collect all redaction IDs in the cascade tree
  SELECT ARRAY_AGG(redaction_id) INTO v_tree_ids
  FROM get_cascade_tree(p_root_redaction_id);

  IF v_tree_ids IS NULL OR array_length(v_tree_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('reverted', false, 'reason', 'redaction_not_found');
  END IF;

  -- Revert all redactions in the tree to unsolved
  UPDATE redactions
  SET
    status = 'unsolved',
    resolved_text = NULL,
    resolved_entity_id = NULL,
    resolved_at = NULL,
    resolved_method = NULL,
    cascade_source_id = CASE WHEN id = p_root_redaction_id THEN cascade_source_id ELSE NULL END,
    cascade_depth = CASE WHEN id = p_root_redaction_id THEN cascade_depth ELSE 0 END,
    cascade_count = 0,
    confidence = 0,
    updated_at = now()
  WHERE id = ANY(v_tree_ids);

  GET DIAGNOSTICS v_reverted_count = ROW_COUNT;

  -- Delete cascade proposals that originated from this tree
  DELETE FROM redaction_proposals
  WHERE evidence_type = 'cascade'
    AND evidence_sources && (SELECT ARRAY_AGG(id::TEXT) FROM unnest(v_tree_ids) AS id);

  GET DIAGNOSTICS v_deleted_proposals = ROW_COUNT;

  -- Mark the root's winning proposal as rejected
  UPDATE redaction_proposals
  SET status = 'rejected', reviewed_at = now()
  WHERE redaction_id = p_root_redaction_id
    AND status = 'accepted';

  -- Re-activate superseded proposals on root
  UPDATE redaction_proposals
  SET status = 'pending', reviewed_at = NULL
  WHERE redaction_id = p_root_redaction_id
    AND status = 'superseded';

  RETURN jsonb_build_object(
    'reverted', true,
    'reverted_count', v_reverted_count,
    'deleted_proposals', v_deleted_proposals,
    'admin_user_id', p_admin_user_id,
    'reason', p_reason,
    'root_redaction_id', p_root_redaction_id
  );
END;
$$;

-- Filter system bot from leaderboard/contributor queries
CREATE INDEX IF NOT EXISTS idx_proposals_exclude_system
  ON redaction_proposals (user_id)
  WHERE user_id != '00000000-0000-4000-a000-000000000001';
