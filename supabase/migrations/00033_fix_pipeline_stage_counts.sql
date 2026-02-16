-- 00033_fix_pipeline_stage_counts.sql
-- Use GIN-indexed @> lookups per stage instead of full table scan.

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
