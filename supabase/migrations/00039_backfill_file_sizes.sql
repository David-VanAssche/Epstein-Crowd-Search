-- Migration 00039: Create function to backfill file_size_bytes in small batches.
-- The join between documents and storage.objects is too expensive for large datasets
-- in a single statement (times out). This function processes small batches
-- and is called repeatedly via RPC from scripts/backfill_file_sizes.sh until done.

CREATE OR REPLACE FUNCTION backfill_file_sizes(
  p_dataset_prefix TEXT DEFAULT '',
  p_batch_size INT DEFAULT 10000
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT;
BEGIN
  IF p_dataset_prefix = '' THEN
    -- All documents with NULL file_size_bytes
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
    -- Scoped to a specific dataset prefix
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

-- DS1-8 were already backfilled in a previous manual run.
-- DS9 (~531K), DS10 (~504K), DS11 (~332K), DS12, and non-DOJ sources
-- are backfilled via scripts/backfill_file_sizes.sh calling this RPC.
