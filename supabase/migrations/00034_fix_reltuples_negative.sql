-- 00034_fix_reltuples_negative.sql
-- Fix -1 values from pg_class.reltuples for unanalyzed tables.

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
