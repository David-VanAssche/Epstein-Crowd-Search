-- 00009_redaction_functions.sql

-- Get solvable redactions sorted by cascade impact
CREATE OR REPLACE FUNCTION get_solvable_redactions(
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0,
  status_filter TEXT DEFAULT 'unsolved',
  type_filter TEXT DEFAULT NULL,
  dataset_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  redaction_id UUID,
  document_id UUID,
  document_filename TEXT,
  dataset_name TEXT,
  page_number INTEGER,
  redaction_type TEXT,
  char_length_estimate INTEGER,
  surrounding_text TEXT,
  sentence_template TEXT,
  status TEXT,
  potential_cascade_count INTEGER,
  proposal_count BIGINT,
  top_proposal_confidence FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.id AS redaction_id,
    r.document_id,
    d.filename AS document_filename,
    ds.name AS dataset_name,
    r.page_number,
    r.redaction_type,
    r.char_length_estimate,
    r.surrounding_text,
    r.sentence_template,
    r.status,
    r.potential_cascade_count,
    COUNT(rp.id) AS proposal_count,
    MAX(rp.composite_confidence) AS top_proposal_confidence
  FROM redactions r
  JOIN documents d ON d.id = r.document_id
  LEFT JOIN datasets ds ON ds.id = d.dataset_id
  LEFT JOIN redaction_proposals rp ON rp.redaction_id = r.id AND rp.status = 'pending'
  WHERE r.status = status_filter
    AND (type_filter IS NULL OR r.redaction_type = type_filter)
    AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
  GROUP BY r.id, r.document_id, d.filename, ds.name, r.page_number,
           r.redaction_type, r.char_length_estimate, r.surrounding_text,
           r.sentence_template, r.status, r.potential_cascade_count
  ORDER BY r.potential_cascade_count DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
$$;

-- Get cascade tree (recursive CTE following cascade_source_id)
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
      r.resolved_at
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
      r.resolved_at
    FROM redactions r
    JOIN tree t ON r.cascade_source_id = t.redaction_id
    LEFT JOIN entities e ON e.id = r.resolved_entity_id
    JOIN documents d ON d.id = r.document_id
    WHERE r.status IN ('confirmed', 'corroborated')
  )
  SELECT * FROM tree
  ORDER BY cascade_depth, resolved_at;
$$;

-- Get redaction statistics
CREATE OR REPLACE FUNCTION get_redaction_stats()
RETURNS TABLE (
  total_redactions BIGINT,
  unsolved BIGINT,
  proposed BIGINT,
  corroborated BIGINT,
  confirmed BIGINT,
  disputed BIGINT,
  total_cascades BIGINT,
  avg_cascade_depth FLOAT,
  total_proposals BIGINT,
  total_contributors BIGINT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COUNT(*) AS total_redactions,
    COUNT(*) FILTER (WHERE status = 'unsolved') AS unsolved,
    COUNT(*) FILTER (WHERE status = 'proposed') AS proposed,
    COUNT(*) FILTER (WHERE status = 'corroborated') AS corroborated,
    COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
    COUNT(*) FILTER (WHERE status = 'disputed') AS disputed,
    COALESCE(SUM(cascade_count), 0) AS total_cascades,
    COALESCE(AVG(cascade_depth) FILTER (WHERE cascade_depth > 0), 0)::FLOAT AS avg_cascade_depth,
    (SELECT COUNT(*) FROM redaction_proposals) AS total_proposals,
    (SELECT COUNT(DISTINCT user_id) FROM redaction_proposals) AS total_contributors
  FROM redactions;
$$;

-- Calculate proposal confidence score (weighted combination)
CREATE OR REPLACE FUNCTION calculate_proposal_confidence(
  target_proposal_id UUID
)
RETURNS FLOAT
LANGUAGE plpgsql
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
