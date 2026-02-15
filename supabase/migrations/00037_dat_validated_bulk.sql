-- Migration: Create mark_dat_validated RPC function
-- Creates a function to bulk-update documents with dat_validated flag
-- Called from scripts/parse_dat_opt.py one dataset at a time
--
-- Concordance DAT files across all 12 DOJ datasets only contain Begin/End Bates
-- (no rich metadata like dates, custodians, or subjects)
-- This function marks documents as cross-validated against DAT/OPT source files

CREATE OR REPLACE FUNCTION mark_dat_validated(p_dataset_id uuid)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  affected bigint;
BEGIN
  UPDATE documents
  SET metadata = metadata
    || jsonb_build_object(
         'dat_validated', true,
         'dat_begin_bates', metadata->>'efta_start',
         'dat_end_bates', metadata->>'efta_end'
       ),
      updated_at = now()
  WHERE dataset_id = p_dataset_id
    AND (metadata->>'dat_validated') IS NULL
    AND (metadata->>'efta_start') IS NOT NULL;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
