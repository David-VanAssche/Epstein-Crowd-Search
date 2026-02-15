-- Migration 00040: Partial index for DAT validation batch updates.
-- Uses non-concurrent creation (required for migration transactions).
-- This index is narrow (only rows with efta_start but no dat_validated)
-- and will be nearly empty until DAT parsing runs.

CREATE INDEX IF NOT EXISTS idx_documents_dat_unvalidated
ON documents (dataset_id)
WHERE (metadata->>'dat_validated') IS NULL
  AND (metadata->>'efta_start') IS NOT NULL;
