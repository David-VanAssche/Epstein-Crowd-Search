-- 00029_stage_tracking.sql
-- Per-stage tracking for the 17-stage document processing pipeline.
-- Replaces the coarse processing_status with a fine-grained completed_stages array.

-- Track which pipeline stages are complete for each document
ALTER TABLE documents ADD COLUMN IF NOT EXISTS completed_stages TEXT[] DEFAULT '{}';

-- Index for fast per-stage counting (GIN supports @> "contains" and ANY() lookups)
CREATE INDEX IF NOT EXISTS idx_documents_completed_stages ON documents USING gin(completed_stages);

-- Fast aggregate function for pipeline stats dashboard.
-- Returns one row per stage with completed_count and total_count.
-- Uses a single table scan instead of 17 separate scans.
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
  total AS (SELECT count(*) AS cnt FROM documents),
  counts AS (
    SELECT unnest(completed_stages) AS stage_name, count(*) AS cnt
    FROM documents
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

-- Corpus-wide totals: documents, pages, images, videos, audio files.
-- Replaces the broken media_type queries and client-side page_count sum.
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
    (SELECT count(*) FROM documents),
    (SELECT coalesce(sum(page_count), 0) FROM documents),
    (SELECT count(*) FROM images),
    (SELECT count(*) FROM videos),
    (SELECT count(*) FROM audio_files);
$$;

-- Helper: append a stage to completed_stages if not already present.
-- Uses deduplication to be safe under concurrent calls.
CREATE OR REPLACE FUNCTION append_completed_stage(p_document_id UUID, p_stage TEXT)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE documents
  SET completed_stages = (
    SELECT ARRAY(SELECT DISTINCT e FROM unnest(completed_stages || ARRAY[p_stage]) e)
  ),
      updated_at = now()
  WHERE id = p_document_id;
$$;
