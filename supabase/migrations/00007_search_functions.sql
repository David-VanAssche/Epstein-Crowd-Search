-- 00007_search_functions.sql

-- Hybrid search with Reciprocal Rank Fusion (text chunks)
CREATE OR REPLACE FUNCTION hybrid_search_chunks_rrf(
  query_text TEXT,
  query_embedding VECTOR(1024),
  match_count INTEGER DEFAULT 20,
  rrf_k INTEGER DEFAULT 60,
  dataset_filter UUID DEFAULT NULL,
  doc_type_filter TEXT DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  contextual_header TEXT,
  page_number INTEGER,
  section_title TEXT,
  document_filename TEXT,
  document_classification TEXT,
  dataset_name TEXT,
  rrf_score FLOAT,
  semantic_rank INTEGER,
  keyword_rank INTEGER
)
LANGUAGE sql STABLE
AS $$
  WITH semantic_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.contextual_header,
      c.page_number,
      c.section_title,
      ROW_NUMBER() OVER (ORDER BY c.content_embedding <=> query_embedding) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
      AND (doc_type_filter IS NULL OR d.classification = doc_type_filter)
      AND (date_from IS NULL OR d.date_extracted >= date_from)
      AND (date_to IS NULL OR d.date_extracted <= date_to)
    ORDER BY c.content_embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.contextual_header,
      c.page_number,
      c.section_title,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', query_text)) DESC) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.content_tsv @@ plainto_tsquery('english', query_text)
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
      AND (doc_type_filter IS NULL OR d.classification = doc_type_filter)
      AND (date_from IS NULL OR d.date_extracted >= date_from)
      AND (date_to IS NULL OR d.date_extracted <= date_to)
    ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', query_text)) DESC
    LIMIT match_count * 2
  )
  SELECT
    COALESCE(s.id, k.id) AS chunk_id,
    COALESCE(s.document_id, k.document_id) AS document_id,
    COALESCE(s.content, k.content) AS content,
    COALESCE(s.contextual_header, k.contextual_header) AS contextual_header,
    COALESCE(s.page_number, k.page_number) AS page_number,
    COALESCE(s.section_title, k.section_title) AS section_title,
    d.filename AS document_filename,
    d.classification AS document_classification,
    ds.name AS dataset_name,
    (COALESCE(1.0 / (rrf_k + s.rank), 0.0) + COALESCE(1.0 / (rrf_k + k.rank), 0.0))::FLOAT AS rrf_score,
    s.rank::INTEGER AS semantic_rank,
    k.rank::INTEGER AS keyword_rank
  FROM semantic_search s
  FULL OUTER JOIN keyword_search k ON s.id = k.id
  JOIN documents d ON d.id = COALESCE(s.document_id, k.document_id)
  LEFT JOIN datasets ds ON ds.id = d.dataset_id
  ORDER BY rrf_score DESC
  LIMIT match_count;
$$;

-- NOTE: multimodal_search_rrf is in 00019 (after audio tables are created in 00018)

-- Find similar redactions by context (for cascade engine)
CREATE OR REPLACE FUNCTION find_similar_redactions(
  source_redaction_id UUID,
  similarity_threshold FLOAT DEFAULT 0.80,
  match_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  redaction_id UUID,
  similarity FLOAT,
  surrounding_text TEXT,
  document_id UUID,
  page_number INTEGER,
  char_length_estimate INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.id AS redaction_id,
    1 - (r.context_embedding <=> src.context_embedding)::FLOAT AS similarity,
    r.surrounding_text,
    r.document_id,
    r.page_number,
    r.char_length_estimate
  FROM redactions r
  CROSS JOIN (SELECT context_embedding, char_length_estimate, redaction_type FROM redactions WHERE id = source_redaction_id) src
  WHERE r.id != source_redaction_id
    AND r.status = 'unsolved'
    AND r.context_embedding IS NOT NULL
    AND 1 - (r.context_embedding <=> src.context_embedding) >= similarity_threshold
    AND (src.char_length_estimate IS NULL OR ABS(r.char_length_estimate - src.char_length_estimate) <= 3)
    AND (src.redaction_type IS NULL OR r.redaction_type = src.redaction_type)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
