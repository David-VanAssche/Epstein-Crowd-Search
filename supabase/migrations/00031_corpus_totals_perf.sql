-- 00031_corpus_totals_perf.sql
-- Fix corpus_totals() and pipeline_stage_counts() timeouts on large tables.
-- With 1.38M documents, full-table scans hit statement_timeout.

-- corpus_totals: sum page_count from datasets table (12 rows) instead of documents (1.38M)
CREATE OR REPLACE FUNCTION corpus_totals()
RETURNS TABLE(
  total_documents BIGINT,
  total_pages BIGINT,
  total_images BIGINT,
  total_videos BIGINT,
  total_audio BIGINT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'documents'),
    (SELECT coalesce(sum(page_count), 0) FROM datasets),
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'images'),
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'videos'),
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'audio_files');
$$;

-- pipeline_stage_counts: skip scanning empty completed_stages arrays.
-- The WHERE clause uses the GIN index to avoid full table scan.
CREATE OR REPLACE FUNCTION pipeline_stage_counts()
RETURNS TABLE(stage TEXT, completed_count BIGINT, total_count BIGINT)
LANGUAGE sql STABLE
AS $$
  WITH stage_list AS (
    SELECT unnest(ARRAY[
      'ocr','classify','chunk','contextual_headers','embed','visual_embed',
      'entity_extract','relationship_map','redaction_detect','timeline_extract',
      'summarize','criminal_indicators','email_extract','financial_extract',
      'co_flight_links','network_metrics','risk_score'
    ]) AS stage_name
  ),
  total AS (SELECT reltuples::bigint AS cnt FROM pg_class WHERE relname = 'documents'),
  counts AS (
    SELECT unnest(completed_stages) AS stage_name, count(*) AS cnt
    FROM documents
    WHERE completed_stages != '{}'
    GROUP BY 1
  )
  SELECT
    s.stage_name,
    COALESCE(c.cnt, 0) AS completed_count,
    t.cnt AS total_count
  FROM stage_list s
  CROSS JOIN total t
  LEFT JOIN counts c ON c.stage_name = s.stage_name;
$$;
