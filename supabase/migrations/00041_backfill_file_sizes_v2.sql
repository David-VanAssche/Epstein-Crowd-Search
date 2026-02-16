-- Migration 00041: Improved file_size_bytes backfill function.
-- The original function (00039) timed out even at 50 rows because the
-- join between documents and storage.objects hits Supabase's statement_timeout.
-- This version extends the timeout internally (SECURITY DEFINER runs as postgres).

DROP FUNCTION IF EXISTS backfill_file_sizes(TEXT, INT);

CREATE OR REPLACE FUNCTION backfill_file_sizes(
  p_dataset_prefix TEXT DEFAULT '',
  p_batch_size INT DEFAULT 5000
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '600000'  -- 10 minutes per call
AS $$
DECLARE
  updated_count INT;
BEGIN
  IF p_dataset_prefix = '' THEN
    WITH batch AS (
      SELECT d.id, (so.metadata->>'size')::BIGINT AS file_size
      FROM documents d
      JOIN storage.objects so
        ON so.bucket_id = 'raw-archive'
        AND so.name = d.storage_path
      WHERE d.file_size_bytes IS NULL
        AND so.metadata->>'size' IS NOT NULL
      LIMIT p_batch_size
    )
    UPDATE documents d
    SET file_size_bytes = batch.file_size
    FROM batch
    WHERE d.id = batch.id;
  ELSE
    WITH batch AS (
      SELECT d.id, (so.metadata->>'size')::BIGINT AS file_size
      FROM documents d
      JOIN storage.objects so
        ON so.bucket_id = 'raw-archive'
        AND so.name = d.storage_path
      WHERE d.storage_path LIKE p_dataset_prefix || '%'
        AND d.file_size_bytes IS NULL
        AND so.metadata->>'size' IS NOT NULL
      LIMIT p_batch_size
    )
    UPDATE documents d
    SET file_size_bytes = batch.file_size
    FROM batch
    WHERE d.id = batch.id;
  END IF;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
