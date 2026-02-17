-- 00043: Fix image/audio counts and backfill OCR stage tracking
--
-- Problems fixed:
--   1. corpus_totals() counted empty images/audio_files tables instead of
--      using datasets.image_count / video_count aggregates.
--   2. No audio_count column on datasets table.
--   3. Documents enriched with OCR text (via ai_summary from epsteininvestigation.org)
--      were never marked in completed_stages or ocr_source, so the pipeline
--      showed 0% OCR progress.

-- 1. Add audio_count to datasets
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS audio_count INTEGER DEFAULT 0;

-- 2. Fix corpus_totals() to prefer datasets aggregates for media counts
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
    -- Use actual images table if populated, otherwise fall back to datasets.image_count
    greatest(
      greatest(0, (SELECT reltuples::bigint FROM pg_class WHERE relname = 'images')),
      (SELECT coalesce(sum(image_count), 0) FROM datasets)
    ),
    greatest(
      greatest(0, (SELECT reltuples::bigint FROM pg_class WHERE relname = 'videos')),
      (SELECT coalesce(sum(video_count), 0) FROM datasets)
    ),
    greatest(
      greatest(0, (SELECT reltuples::bigint FROM pg_class WHERE relname = 'audio_files')),
      (SELECT coalesce(sum(audio_count), 0) FROM datasets)
    );
$$;

-- 3. Backfill completed_stages for documents that have OCR text via enrichment.
--    These were imported by apply_enrichment.py which set ai_summary but not
--    ocr_source or completed_stages.
UPDATE documents
SET
  ocr_source = 'epsteininvestigation.org',
  completed_stages = array_append(completed_stages, 'ocr'),
  updated_at = now()
WHERE ai_summary IS NOT NULL
  AND (ocr_source IS NULL)
  AND NOT ('ocr' = ANY(coalesce(completed_stages, '{}')));
