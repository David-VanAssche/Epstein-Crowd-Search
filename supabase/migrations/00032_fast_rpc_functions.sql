-- 00032_fast_rpc_functions.sql
-- Fix RPC timeouts: use pg_class reltuples for approximate counts
-- and skip empty completed_stages arrays via WHERE clause.

-- Fast corpus_totals using pg_class for approximate row counts
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
    greatest(0, (SELECT reltuples::bigint FROM pg_class WHERE relname = 'documents')),
    (SELECT coalesce(sum(page_count), 0) FROM datasets),
    greatest(0, (SELECT reltuples::bigint FROM pg_class WHERE relname = 'images')),
    greatest(0, (SELECT reltuples::bigint FROM pg_class WHERE relname = 'videos')),
    greatest(0, (SELECT reltuples::bigint FROM pg_class WHERE relname = 'audio_files'));
$$;

-- Fast pipeline_stage_counts: use GIN-indexed @> lookups per stage
-- instead of full table scan with unnest. Each @> uses the GIN index.
CREATE OR REPLACE FUNCTION pipeline_stage_counts()
RETURNS TABLE(stage TEXT, completed_count BIGINT, total_count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.stage_name,
    (SELECT count(*) FROM documents WHERE completed_stages @> ARRAY[s.stage_name]),
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'documents')
  FROM unnest(ARRAY[
    'ocr','classify','chunk','contextual_headers','embed','visual_embed',
    'entity_extract','relationship_map','redaction_detect','timeline_extract',
    'summarize','criminal_indicators','email_extract','financial_extract',
    'co_flight_links','network_metrics','risk_score'
  ]) AS s(stage_name);
$$;
