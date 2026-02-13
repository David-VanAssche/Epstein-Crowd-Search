-- Migration 00022: Network Analysis
-- Phase 12: Temporal proximity functions, shortest path, materialized views, network metrics

-- ============================================================
-- Section 1: Temporal proximity function
-- ============================================================

-- Find all activity (flights, emails, timeline events, financial transactions)
-- for an entity within N-day windows
CREATE OR REPLACE FUNCTION find_temporal_clusters(
  target_entity_id UUID,
  window_days INT DEFAULT 7,
  max_results INT DEFAULT 100
)
RETURNS TABLE (
  activity_type TEXT,
  activity_id UUID,
  activity_date TIMESTAMPTZ,
  description TEXT,
  related_entity_ids UUID[],
  document_id UUID
) AS $$
BEGIN
  RETURN QUERY
  -- Flights (from structured_data_extractions)
  SELECT
    'flight'::TEXT AS activity_type,
    sde.id AS activity_id,
    (sde.extracted_data->>'date')::TIMESTAMPTZ AS activity_date,
    CONCAT(
      sde.extracted_data->>'origin', ' → ', sde.extracted_data->>'destination',
      ' (', sde.extracted_data->>'aircraft', ')'
    ) AS description,
    ARRAY[]::UUID[] AS related_entity_ids,
    sde.document_id
  FROM structured_data_extractions sde
  WHERE sde.extraction_type = 'flight_manifest'
    AND sde.extracted_data->>'date' IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM entity_mentions em
      WHERE em.document_id = sde.document_id
        AND em.entity_id = target_entity_id
    )

  UNION ALL

  -- Emails
  SELECT
    'email'::TEXT,
    e.id,
    e.sent_date,
    CONCAT('Email: ', COALESCE(e.subject, '(no subject)'), ' from ', COALESCE(e.from_raw, 'unknown')),
    e.to_entity_ids || e.cc_entity_ids,
    e.document_id
  FROM emails e
  WHERE (e.from_entity_id = target_entity_id
    OR target_entity_id = ANY(e.to_entity_ids)
    OR target_entity_id = ANY(e.cc_entity_ids))
    AND e.sent_date IS NOT NULL

  UNION ALL

  -- Timeline events
  SELECT
    'timeline_event'::TEXT,
    te.id,
    te.event_date,
    te.description,
    te.entity_ids,
    te.document_id
  FROM timeline_events te
  WHERE target_entity_id = ANY(te.entity_ids)
    AND te.event_date IS NOT NULL

  UNION ALL

  -- Financial transactions
  SELECT
    'financial_transaction'::TEXT,
    ft.id,
    ft.transaction_date::TIMESTAMPTZ,
    CONCAT(
      COALESCE(ft.from_raw, '?'), ' → ', COALESCE(ft.to_raw, '?'),
      ': $', ft.amount::TEXT
    ),
    ARRAY_REMOVE(ARRAY[ft.from_entity_id, ft.to_entity_id], NULL),
    ft.document_id
  FROM financial_transactions ft
  WHERE ft.from_entity_id = target_entity_id
    OR ft.to_entity_id = target_entity_id

  ORDER BY activity_date DESC NULLS LAST
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Section 2: Co-temporal entity search
-- ============================================================

-- Find entities active near a given date
CREATE OR REPLACE FUNCTION find_co_temporal_entities(
  target_date TIMESTAMPTZ,
  window_days INT DEFAULT 7,
  max_results INT DEFAULT 50
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  activity_count BIGINT,
  activity_types TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH activities AS (
    -- Entities from emails near the date
    SELECT e.from_entity_id AS eid, 'email'::TEXT AS atype
    FROM emails e
    WHERE e.sent_date BETWEEN target_date - (window_days || ' days')::INTERVAL
                          AND target_date + (window_days || ' days')::INTERVAL
      AND e.from_entity_id IS NOT NULL
    UNION ALL
    SELECT UNNEST(e.to_entity_ids), 'email'
    FROM emails e
    WHERE e.sent_date BETWEEN target_date - (window_days || ' days')::INTERVAL
                          AND target_date + (window_days || ' days')::INTERVAL

    UNION ALL

    -- Entities from timeline events
    SELECT UNNEST(te.entity_ids), 'timeline'
    FROM timeline_events te
    WHERE te.event_date BETWEEN target_date - (window_days || ' days')::INTERVAL
                            AND target_date + (window_days || ' days')::INTERVAL

    UNION ALL

    -- Entities from financial transactions
    SELECT ft.from_entity_id, 'financial'
    FROM financial_transactions ft
    WHERE ft.transaction_date BETWEEN (target_date - (window_days || ' days')::INTERVAL)::DATE
                                  AND (target_date + (window_days || ' days')::INTERVAL)::DATE
      AND ft.from_entity_id IS NOT NULL
    UNION ALL
    SELECT ft.to_entity_id, 'financial'
    FROM financial_transactions ft
    WHERE ft.transaction_date BETWEEN (target_date - (window_days || ' days')::INTERVAL)::DATE
                                  AND (target_date + (window_days || ' days')::INTERVAL)::DATE
      AND ft.to_entity_id IS NOT NULL
  )
  SELECT
    ent.id AS entity_id,
    ent.name AS entity_name,
    ent.entity_type::TEXT AS entity_type,
    COUNT(DISTINCT a.atype || a.eid::TEXT) AS activity_count,
    ARRAY_AGG(DISTINCT a.atype) AS activity_types
  FROM activities a
  JOIN entities ent ON ent.id = a.eid
  GROUP BY ent.id, ent.name, ent.entity_type
  ORDER BY activity_count DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Section 3: Shortest path finder (BFS with temp table)
-- ============================================================

CREATE OR REPLACE FUNCTION find_shortest_path(
  source_entity_id UUID,
  target_entity_id UUID,
  max_depth INT DEFAULT 6
)
RETURNS TABLE (
  step_number INT,
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  relationship_type TEXT,
  from_entity_id UUID,
  evidence_document_ids UUID[]
) AS $$
DECLARE
  current_depth INT := 0;
  found BOOLEAN := FALSE;
  target_found_at INT := -1;
BEGIN
  -- Create temp tables (ON COMMIT DROP for connection pooler safety)
  CREATE TEMP TABLE IF NOT EXISTS bfs_visited (
    entity_id UUID PRIMARY KEY,
    depth INT NOT NULL,
    parent_entity_id UUID,
    relationship_type TEXT,
    evidence_doc_ids UUID[]
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS bfs_frontier (
    entity_id UUID PRIMARY KEY,
    depth INT NOT NULL,
    parent_entity_id UUID,
    relationship_type TEXT,
    evidence_doc_ids UUID[]
  ) ON COMMIT DROP;

  -- Clear temp tables (in case of connection reuse)
  TRUNCATE bfs_visited;
  TRUNCATE bfs_frontier;

  -- Initialize with source
  INSERT INTO bfs_visited VALUES (source_entity_id, 0, NULL, NULL, NULL);
  INSERT INTO bfs_frontier VALUES (source_entity_id, 0, NULL, NULL, NULL);

  -- BFS loop
  WHILE current_depth < max_depth AND NOT found LOOP
    current_depth := current_depth + 1;

    -- Clear frontier for next level
    CREATE TEMP TABLE bfs_next_frontier (
      entity_id UUID PRIMARY KEY,
      depth INT NOT NULL,
      parent_entity_id UUID,
      relationship_type TEXT,
      evidence_doc_ids UUID[]
    ) ON COMMIT DROP;

    -- Expand frontier via entity_relationships
    INSERT INTO bfs_next_frontier
    SELECT DISTINCT ON (neighbor)
      neighbor,
      current_depth,
      f.entity_id,
      er.relationship_type,
      er.evidence_document_ids
    FROM bfs_frontier f
    JOIN entity_relationships er ON (
      er.entity_a_id = f.entity_id OR er.entity_b_id = f.entity_id
    )
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN er.entity_a_id = f.entity_id THEN er.entity_b_id
        ELSE er.entity_a_id
      END AS neighbor
    ) n
    WHERE NOT EXISTS (SELECT 1 FROM bfs_visited v WHERE v.entity_id = n.neighbor)
    ON CONFLICT DO NOTHING;

    -- Move next frontier into visited
    INSERT INTO bfs_visited
    SELECT * FROM bfs_next_frontier
    ON CONFLICT DO NOTHING;

    -- Check if target reached
    IF EXISTS (SELECT 1 FROM bfs_next_frontier WHERE bfs_next_frontier.entity_id = target_entity_id) THEN
      found := TRUE;
      target_found_at := current_depth;
    END IF;

    -- Replace frontier
    TRUNCATE bfs_frontier;
    INSERT INTO bfs_frontier SELECT * FROM bfs_next_frontier;
    DROP TABLE bfs_next_frontier;

    -- If frontier is empty, no path exists
    IF NOT EXISTS (SELECT 1 FROM bfs_frontier) THEN
      EXIT;
    END IF;
  END LOOP;

  -- Reconstruct path via recursive CTE if found
  IF found THEN
    RETURN QUERY
    WITH RECURSIVE path AS (
      SELECT v.entity_id, v.parent_entity_id, v.relationship_type, v.evidence_doc_ids, v.depth
      FROM bfs_visited v
      WHERE v.entity_id = target_entity_id

      UNION ALL

      SELECT v.entity_id, v.parent_entity_id, v.relationship_type, v.evidence_doc_ids, v.depth
      FROM bfs_visited v
      JOIN path p ON v.entity_id = p.parent_entity_id
      WHERE v.depth >= 0
    )
    SELECT
      (p.depth + 1)::INT AS step_number,
      p.entity_id,
      ent.name AS entity_name,
      ent.entity_type::TEXT AS entity_type,
      p.relationship_type,
      p.parent_entity_id AS from_entity_id,
      p.evidence_doc_ids AS evidence_document_ids
    FROM path p
    JOIN entities ent ON ent.id = p.entity_id
    ORDER BY p.depth ASC;
  END IF;

  -- Cleanup
  DROP TABLE IF EXISTS bfs_visited;
  DROP TABLE IF EXISTS bfs_frontier;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Section 4: Materialized views
-- ============================================================

-- Flight passenger statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS flight_passenger_stats AS
SELECT
  em.entity_id,
  ent.name AS entity_name,
  ent.entity_type,
  COUNT(DISTINCT sde.id) AS flight_count,
  MIN((sde.extracted_data->>'date')::DATE) AS first_flight_date,
  MAX((sde.extracted_data->>'date')::DATE) AS last_flight_date,
  MODE() WITHIN GROUP (ORDER BY
    CONCAT(sde.extracted_data->>'origin', ' → ', sde.extracted_data->>'destination')
  ) AS top_route,
  ARRAY_AGG(DISTINCT sde.extracted_data->>'aircraft') FILTER (
    WHERE sde.extracted_data->>'aircraft' IS NOT NULL
  ) AS aircraft_used
FROM entity_mentions em
JOIN entities ent ON ent.id = em.entity_id
JOIN structured_data_extractions sde ON sde.document_id = em.document_id
  AND sde.extraction_type = 'flight_manifest'
WHERE ent.entity_type = 'person'
GROUP BY em.entity_id, ent.name, ent.entity_type
HAVING COUNT(DISTINCT sde.id) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fps_entity_id ON flight_passenger_stats (entity_id);

-- Email communication statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS email_communication_stats AS
SELECT
  e_from.id AS entity_id,
  e_from.name AS entity_name,
  COUNT(DISTINCT em.id) AS emails_sent,
  COUNT(DISTINCT em.thread_id) FILTER (WHERE em.thread_id IS NOT NULL) AS thread_count,
  MIN(em.sent_date) AS first_email_date,
  MAX(em.sent_date) AS last_email_date,
  ARRAY_AGG(DISTINCT to_ent.name ORDER BY to_ent.name) FILTER (
    WHERE to_ent.name IS NOT NULL
  ) AS frequent_contacts
FROM entities e_from
JOIN emails em ON em.from_entity_id = e_from.id
LEFT JOIN LATERAL UNNEST(em.to_entity_ids) AS to_id ON TRUE
LEFT JOIN entities to_ent ON to_ent.id = to_id
GROUP BY e_from.id, e_from.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecs_entity_id ON email_communication_stats (entity_id);

-- Entity network metrics (populated by network-metrics.ts batch)
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_network_metrics AS
SELECT
  ent.id AS entity_id,
  ent.name AS entity_name,
  ent.entity_type,
  (SELECT COUNT(*) FROM entity_relationships er
    WHERE er.entity_a_id = ent.id OR er.entity_b_id = ent.id) AS degree,
  COALESCE((ent.metadata->>'pagerank')::FLOAT, 0) AS pagerank,
  COALESCE((ent.metadata->>'betweenness')::FLOAT, 0) AS betweenness,
  COALESCE((ent.metadata->>'cluster_id')::INT, -1) AS cluster_id,
  ent.mention_count,
  ent.document_count
FROM entities ent
WHERE ent.mention_count > 0
  OR EXISTS (
    SELECT 1 FROM entity_relationships er
    WHERE er.entity_a_id = ent.id OR er.entity_b_id = ent.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_enm_entity_id ON entity_network_metrics (entity_id);

-- ============================================================
-- Section 5: View refresh function
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_network_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY flight_passenger_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY email_communication_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY entity_network_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Section 6: Performance indexes for network queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_er_entity_a ON entity_relationships (entity_a_id);
CREATE INDEX IF NOT EXISTS idx_er_entity_b ON entity_relationships (entity_b_id);
CREATE INDEX IF NOT EXISTS idx_er_type ON entity_relationships (relationship_type);
CREATE INDEX IF NOT EXISTS idx_er_strength ON entity_relationships (strength DESC);
CREATE INDEX IF NOT EXISTS idx_em_entity_doc ON entity_mentions (entity_id, document_id);
