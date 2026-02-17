-- Pipeline flow stats: single RPC returning all data needed for the waterfall UI.
-- Replaces the old pipeline_stage_counts() which hardcoded 17 stages.

-- GIN index for completed_stages array containment queries (@>)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_completed_stages
  ON documents USING gin (completed_stages);

-- Index for classification breakdown aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_classification
  ON documents (classification) WHERE classification IS NOT NULL;

CREATE OR REPLACE FUNCTION pipeline_flow_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSONB;
  total_docs BIGINT;
  ocr_done BIGINT;
  classified BIGINT;
  stage_counts JSONB;
  class_counts JSONB;
BEGIN
  -- Total documents (approximate via pg_class — fast on 1.4M+ rows)
  SELECT GREATEST(reltuples::bigint, 0) INTO total_docs
  FROM pg_class WHERE relname = 'documents';

  -- Gate counts (uses GIN index on completed_stages)
  SELECT count(*) INTO ocr_done FROM documents WHERE completed_stages @> ARRAY['ocr'];
  SELECT count(*) INTO classified FROM documents WHERE completed_stages @> ARRAY['classify', 'ocr'];

  -- Per-stage completed counts (dynamic, no hardcoded list)
  SELECT jsonb_object_agg(stage, cnt) INTO stage_counts
  FROM (
    SELECT unnest(completed_stages) AS stage, count(*) AS cnt
    FROM documents
    WHERE completed_stages IS NOT NULL AND completed_stages != '{}'
    GROUP BY 1
  ) sub;

  -- Per-classification counts (uses btree index on classification)
  SELECT jsonb_object_agg(classification, cnt) INTO class_counts
  FROM (
    SELECT classification, count(*) AS cnt
    FROM documents
    WHERE classification IS NOT NULL
    GROUP BY 1
  ) sub;

  result := jsonb_build_object(
    'total_documents', total_docs,
    'ocr_completed', ocr_done,
    'classified', classified,
    'stage_completed', COALESCE(stage_counts, '{}'::jsonb),
    'classification_breakdown', COALESCE(class_counts, '{}'::jsonb)
  );

  RETURN result;
END;
$$;
