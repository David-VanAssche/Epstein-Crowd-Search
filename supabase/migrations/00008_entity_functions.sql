-- 00008_entity_functions.sql

-- BFS connection graph from a starting entity
CREATE OR REPLACE FUNCTION get_entity_connection_graph(
  start_entity_id UUID,
  max_depth INTEGER DEFAULT 2,
  max_nodes INTEGER DEFAULT 50
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  mention_count INTEGER,
  depth INTEGER,
  connected_from UUID,
  relationship_type TEXT,
  relationship_strength FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE graph AS (
    -- Base case: the starting entity
    SELECT
      e.id AS entity_id,
      e.name AS entity_name,
      e.entity_type,
      e.mention_count,
      0 AS depth,
      NULL::UUID AS connected_from,
      NULL::TEXT AS relationship_type,
      NULL::FLOAT AS relationship_strength
    FROM entities e
    WHERE e.id = start_entity_id

    UNION ALL

    -- Recursive case: follow relationships in both directions
    SELECT
      CASE WHEN er.entity_a_id = g.entity_id THEN er.entity_b_id ELSE er.entity_a_id END AS entity_id,
      e.name AS entity_name,
      e.entity_type,
      e.mention_count,
      g.depth + 1 AS depth,
      g.entity_id AS connected_from,
      er.relationship_type,
      er.strength AS relationship_strength
    FROM graph g
    JOIN entity_relationships er
      ON er.entity_a_id = g.entity_id OR er.entity_b_id = g.entity_id
    JOIN entities e
      ON e.id = CASE WHEN er.entity_a_id = g.entity_id THEN er.entity_b_id ELSE er.entity_a_id END
    WHERE g.depth < max_depth
  )
  SELECT DISTINCT ON (graph.entity_id)
    graph.entity_id,
    graph.entity_name,
    graph.entity_type,
    graph.mention_count,
    graph.depth,
    graph.connected_from,
    graph.relationship_type,
    graph.relationship_strength
  FROM graph
  ORDER BY graph.entity_id, graph.depth ASC
  LIMIT max_nodes;
$$;

-- Search entities by name embedding (vector similarity)
CREATE OR REPLACE FUNCTION search_entities_by_embedding(
  query_embedding VECTOR(1024),
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  aliases TEXT[],
  mention_count INTEGER,
  document_count INTEGER,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id AS entity_id,
    e.name AS entity_name,
    e.entity_type,
    e.aliases,
    e.mention_count,
    e.document_count,
    1 - (e.name_embedding <=> query_embedding)::FLOAT AS similarity
  FROM entities e
  WHERE e.name_embedding IS NOT NULL
  ORDER BY e.name_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Entity mention aggregation by document
CREATE OR REPLACE FUNCTION get_entity_mention_stats(
  target_entity_id UUID
)
RETURNS TABLE (
  document_id UUID,
  document_filename TEXT,
  document_classification TEXT,
  dataset_name TEXT,
  mention_count BIGINT,
  mention_types TEXT[],
  first_mention TIMESTAMPTZ,
  last_mention TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
  SELECT
    em.document_id,
    d.filename AS document_filename,
    d.classification AS document_classification,
    ds.name AS dataset_name,
    COUNT(*) AS mention_count,
    ARRAY_AGG(DISTINCT em.mention_type) AS mention_types,
    MIN(em.created_at) AS first_mention,
    MAX(em.created_at) AS last_mention
  FROM entity_mentions em
  JOIN documents d ON d.id = em.document_id
  LEFT JOIN datasets ds ON ds.id = d.dataset_id
  WHERE em.entity_id = target_entity_id
  GROUP BY em.document_id, d.filename, d.classification, ds.name
  ORDER BY mention_count DESC;
$$;

-- Search entities by name (trigram fuzzy match)
CREATE OR REPLACE FUNCTION search_entities_by_name(
  search_query TEXT,
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  aliases TEXT[],
  mention_count INTEGER,
  document_count INTEGER,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id AS entity_id,
    e.name AS entity_name,
    e.entity_type,
    e.aliases,
    e.mention_count,
    e.document_count,
    similarity(e.name, search_query)::FLOAT AS similarity
  FROM entities e
  WHERE e.name % search_query
     OR search_query % ANY(e.aliases)
  ORDER BY similarity(e.name, search_query) DESC
  LIMIT match_count;
$$;
