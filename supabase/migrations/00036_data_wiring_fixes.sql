-- Migration 00036: Data Wiring Fixes
-- Fixes broken column references, relaxes NOT NULL constraints for community data import.

-- ============================================================
-- 1a. Fix compute_entity_risk_score: d.original_filename → d.filename
-- ============================================================

CREATE OR REPLACE FUNCTION compute_entity_risk_score(p_entity_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  evidence_score REAL := 0.0;
  relationship_score REAL := 0.0;
  indicator_score REAL := 0.0;
  total_score REAL;
  top_docs JSONB := '[]'::JSONB;
  contributing_rels JSONB := '[]'::JSONB;
  indicator_cats JSONB := '{}'::JSONB;
  result JSONB;
BEGIN
  -- === Evidence Score (max 2.0) ===
  SELECT coalesce(sum(best_weight), 0) / 10.0
  INTO evidence_score
  FROM (
    SELECT document_id, max(evidence_weight) AS best_weight
    FROM entity_mentions
    WHERE entity_id = p_entity_id
      AND evidence_weight IS NOT NULL
    GROUP BY document_id
    ORDER BY max(evidence_weight) DESC
    LIMIT 20
  ) top20;
  evidence_score := least(evidence_score, 2.0);

  -- Top documents for transparency
  SELECT coalesce(jsonb_agg(doc_info), '[]'::JSONB)
  INTO top_docs
  FROM (
    SELECT jsonb_build_object(
      'id', em.document_id,
      'filename', coalesce(d.filename, d.id::TEXT),
      'weight', max(em.evidence_weight)
    ) AS doc_info
    FROM entity_mentions em
    LEFT JOIN documents d ON d.id = em.document_id
    WHERE em.entity_id = p_entity_id
      AND em.evidence_weight IS NOT NULL
    GROUP BY em.document_id, d.filename, d.id
    ORDER BY max(em.evidence_weight) DESC
    LIMIT 5
  ) td;

  -- === Relationship Score (max 1.5) ===
  SELECT coalesce(sum(rel_weight), 0), coalesce(jsonb_agg(rel_info), '[]'::JSONB)
  INTO relationship_score, contributing_rels
  FROM (
    SELECT
      CASE er.relationship_type
        WHEN 'victim_of' THEN 1.0
        WHEN 'recruited_by' THEN 1.0
        WHEN 'co_defendant' THEN 0.8
        WHEN 'witness_testimony' THEN 0.5
        WHEN 'financial_connection' THEN 0.4
        WHEN 'traveled_with' THEN 0.3
        ELSE 0
      END AS rel_weight,
      jsonb_build_object(
        'type', er.relationship_type,
        'entity_name', other_e.name,
        'weight', CASE er.relationship_type
          WHEN 'victim_of' THEN 1.0
          WHEN 'recruited_by' THEN 1.0
          WHEN 'co_defendant' THEN 0.8
          WHEN 'witness_testimony' THEN 0.5
          WHEN 'financial_connection' THEN 0.4
          WHEN 'traveled_with' THEN 0.3
          ELSE 0
        END
      ) AS rel_info
    FROM entity_relationships er
    JOIN entities other_e ON other_e.id = CASE
      WHEN er.entity_a_id = p_entity_id THEN er.entity_b_id
      ELSE er.entity_a_id
    END
    WHERE (er.entity_a_id = p_entity_id OR er.entity_b_id = p_entity_id)
      AND er.relationship_type IN (
        'victim_of', 'recruited_by', 'co_defendant',
        'witness_testimony', 'financial_connection', 'traveled_with'
      )
  ) contributing;
  relationship_score := least(relationship_score, 1.5);

  -- === Indicator Score (max 1.5) ===
  SELECT coalesce(sum(cat_max), 0), coalesce(jsonb_object_agg(category, cat_max), '{}'::JSONB)
  INTO indicator_score, indicator_cats
  FROM (
    SELECT
      cat.key AS category,
      max(
        CASE WHEN cat.value ~ '^\d+(\.\d+)?$' THEN cat.value::REAL ELSE 0.0 END
        * coalesce(em.evidence_weight, 0.1)
      ) AS cat_max
    FROM entity_mentions em
    JOIN documents d ON d.id = em.document_id
    CROSS JOIN LATERAL jsonb_each_text(
      coalesce(d.metadata->'criminal_indicators', '{}'::JSONB)
    ) AS cat(key, value)
    WHERE em.entity_id = p_entity_id
      AND cat.key IN (
        'trafficking', 'obstruction', 'conspiracy',
        'financial_crimes', 'witness_tampering', 'exploitation'
      )
    GROUP BY cat.key
  ) per_cat;
  indicator_score := least(indicator_score, 1.5);

  -- === Final Score ===
  total_score := least(5.0, evidence_score + relationship_score + indicator_score);

  result := jsonb_build_object(
    'evidence_score', round(evidence_score::NUMERIC, 3),
    'relationship_score', round(relationship_score::NUMERIC, 3),
    'indicator_score', round(indicator_score::NUMERIC, 3),
    'top_documents', top_docs,
    'contributing_relationships', contributing_rels,
    'indicator_categories', indicator_cats
  );

  -- Update entity row
  UPDATE entities
  SET risk_score = round(total_score::NUMERIC, 2)::REAL,
      risk_factors = result,
      risk_score_updated_at = now()
  WHERE id = p_entity_id;

  RETURN result;
END;
$$;

-- ============================================================
-- 1b. Make emails.document_id nullable
-- ============================================================

ALTER TABLE emails ALTER COLUMN document_id DROP NOT NULL;

-- ============================================================
-- 1c. Make structured_data_extractions.document_id nullable
-- ============================================================

ALTER TABLE structured_data_extractions ALTER COLUMN document_id DROP NOT NULL;

-- ============================================================
-- 1d. Partial index for standalone emails (no linked document)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_emails_standalone
  ON emails (created_at DESC) WHERE document_id IS NULL;

-- ============================================================
-- 1e. Partial index for standalone extractions (no linked document)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_structured_data_standalone
  ON structured_data_extractions (created_at DESC) WHERE document_id IS NULL;
