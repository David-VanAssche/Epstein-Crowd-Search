-- Migration 00024: Tighten RLS policies
-- Ensures contradictions INSERT enforces created_by = auth.uid()

DROP POLICY IF EXISTS contradictions_auth_insert ON contradictions;
CREATE POLICY contradictions_auth_insert ON contradictions FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid() = created_by
);
