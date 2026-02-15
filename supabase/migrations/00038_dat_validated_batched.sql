-- Fix: mark_dat_validated with LIMIT to process in smaller batches
-- Each call processes up to p_batch_size rows and returns the count
-- Call repeatedly from the client until it returns 0

DROP FUNCTION IF EXISTS mark_dat_validated(uuid);
DROP FUNCTION IF EXISTS mark_dat_validated(uuid, int);

CREATE OR REPLACE FUNCTION mark_dat_validated(p_dataset_id uuid, p_batch_size int DEFAULT 5000)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  affected bigint;
BEGIN
  WITH batch AS (
    SELECT id FROM documents
    WHERE dataset_id = p_dataset_id
      AND (metadata->>'dat_validated') IS NULL
      AND (metadata->>'efta_start') IS NOT NULL
    LIMIT p_batch_size
  )
  UPDATE documents d
  SET metadata = d.metadata
    || jsonb_build_object(
         'dat_validated', true,
         'dat_begin_bates', d.metadata->>'efta_start',
         'dat_end_bates', d.metadata->>'efta_end'
       ),
      updated_at = now()
  FROM batch
  WHERE d.id = batch.id;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
