-- Migration 00027: Risk Scoring, Evidence Weighting, and Entity Deduplication
-- Pre-ingestion data hardening: adds risk scores, evidence weights, entity merge log,
-- and SQL functions for normalization, scoring, and merging.

-- ============================================================
-- Section 1: New columns on entities
-- ============================================================

ALTER TABLE entities ADD COLUMN IF NOT EXISTS risk_score REAL DEFAULT 0.0;
ALTER TABLE entities ADD CONSTRAINT entities_risk_score_range
  CHECK (risk_score >= 0 AND risk_score <= 5);

ALTER TABLE entities ADD COLUMN IF NOT EXISTS risk_factors JSONB DEFAULT '{}';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS risk_score_updated_at TIMESTAMPTZ;

-- ============================================================
-- Section 2: New column on entity_mentions
-- ============================================================

ALTER TABLE entity_mentions ADD COLUMN IF NOT EXISTS evidence_weight REAL;

-- ============================================================
-- Section 3: Entity merge log table
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kept_entity_id UUID NOT NULL REFERENCES entities(id),
  merged_entity_id UUID NOT NULL,  -- no FK, entity will be deleted
  merged_entity_name TEXT NOT NULL,
  merged_entity_type TEXT NOT NULL,
  merge_reason TEXT,
  similarity_score REAL,
  merged_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Section 4: SQL Functions
-- ============================================================

-- 4a. normalize_entity_name(name TEXT) → TEXT — IMMUTABLE
CREATE OR REPLACE FUNCTION normalize_entity_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  result TEXT;
BEGIN
  -- Handle NULL input
  IF name IS NULL OR trim(name) = '' THEN
    RETURN NULL;
  END IF;

  result := name;

  -- Strip outer quotes
  result := regexp_replace(result, '^["'']+|["'']+$', '', 'g');

  -- Strip parenthetical content
  result := regexp_replace(result, '\([^)]*\)', '', 'g');

  -- Lowercase
  result := lower(result);

  -- Strip titles/prefixes
  result := regexp_replace(result, '\m(dr|mr|mrs|ms|prof|sir|hon|rev|gen|col|sgt|lt|cpt|cmdr|adm)\.?\s+', '', 'gi');

  -- Strip suffixes
  result := regexp_replace(result, ',?\s+(jr\.?|sr\.?|iii|ii|iv|esq\.?|md|ph\.?d\.?)$', '', 'gi');

  -- Flip "Last, First" → "first last"
  IF result ~ '^\s*[a-z]+([-''][a-z]+)?\s*,\s*[a-z]' THEN
    result := regexp_replace(result, '^\s*([^,]+),\s*(.+)$', '\2 \1');
  END IF;

  -- Collapse whitespace
  result := regexp_replace(trim(result), '\s+', ' ', 'g');

  -- Return NULL if result is empty after normalization
  IF result = '' THEN
    RETURN NULL;
  END IF;

  RETURN result;
END;
$$;

-- 4b. get_document_probative_weight(classification TEXT) → REAL — IMMUTABLE
CREATE OR REPLACE FUNCTION get_document_probative_weight(classification TEXT)
RETURNS REAL
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(classification, 'other'))
    -- Tier 1: Sworn testimony (1.0)
    WHEN 'deposition' THEN 1.0
    WHEN 'grand_jury_testimony' THEN 1.0
    WHEN 'witness_statement' THEN 1.0
    -- Tier 2: Official documents (0.7)
    WHEN 'court_filing' THEN 0.7
    WHEN 'police_report' THEN 0.7
    WHEN 'fbi_report' THEN 0.7
    -- Tier 3: Records (0.4)
    WHEN 'flight_log' THEN 0.4
    WHEN 'financial_record' THEN 0.4
    WHEN 'phone_record' THEN 0.4
    WHEN 'medical_record' THEN 0.4
    -- Tier 4: Informal (0.2)
    WHEN 'correspondence' THEN 0.2
    WHEN 'property_record' THEN 0.2
    -- Tier 5: Peripheral (0.1)
    WHEN 'address_book' THEN 0.1
    WHEN 'photograph' THEN 0.1
    WHEN 'news_clipping' THEN 0.1
    ELSE 0.1
  END::REAL;
$$;

-- Helper: mention type weight (mirrors TypeScript getMentionTypeWeight)
CREATE OR REPLACE FUNCTION get_mention_type_weight(mention_type TEXT)
RETURNS REAL
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(mention_type, 'co_occurrence'))
    WHEN 'direct' THEN 1.0
    WHEN 'indirect' THEN 0.5
    WHEN 'implied' THEN 0.3
    WHEN 'co_occurrence' THEN 0.15
    ELSE 0.15
  END::REAL;
$$;

-- 4c. compute_entity_risk_score(p_entity_id UUID) → JSONB
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
  -- For each document mentioning this entity, take the best mention weight.
  -- Sort by weight desc, take top 20, sum, divide by 10.
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
      'filename', coalesce(d.original_filename, d.id::TEXT),
      'weight', max(em.evidence_weight)
    ) AS doc_info
    FROM entity_mentions em
    LEFT JOIN documents d ON d.id = em.document_id
    WHERE em.entity_id = p_entity_id
      AND em.evidence_weight IS NOT NULL
    GROUP BY em.document_id, d.original_filename, d.id
    ORDER BY max(em.evidence_weight) DESC
    LIMIT 5
  ) td;

  -- === Relationship Score (max 1.5) ===
  -- Only 6 of 20 relationship types contribute. The other 14 contribute ZERO.
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
        ELSE 0  -- 14 other types contribute ZERO
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
  -- Aggregate criminal indicators from documents mentioning this entity.
  -- Per category, take max weighted indicator. Sum categories, cap at 1.5.
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

-- 4d. merge_entities(p_keep UUID, p_remove UUID) → void
CREATE OR REPLACE FUNCTION merge_entities(p_keep UUID, p_remove UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  removed_entity RECORD;
  kept_entity RECORD;
BEGIN
  -- Lock both rows in UUID order to prevent deadlocks
  IF p_keep < p_remove THEN
    SELECT * INTO kept_entity FROM entities WHERE id = p_keep FOR UPDATE;
    SELECT * INTO removed_entity FROM entities WHERE id = p_remove FOR UPDATE;
  ELSE
    SELECT * INTO removed_entity FROM entities WHERE id = p_remove FOR UPDATE;
    SELECT * INTO kept_entity FROM entities WHERE id = p_keep FOR UPDATE;
  END IF;

  IF kept_entity IS NULL THEN
    RAISE EXCEPTION 'Entity to keep (%) not found', p_keep;
  END IF;

  IF removed_entity IS NULL THEN
    RAISE EXCEPTION 'Entity to remove (%) not found', p_remove;
  END IF;

  -- Reassign entity_mentions
  UPDATE entity_mentions
  SET entity_id = p_keep
  WHERE entity_id = p_remove;

  -- Reassign entity_relationships (entity_a_id side)
  -- Skip if it would create a duplicate relationship
  UPDATE entity_relationships
  SET entity_a_id = p_keep
  WHERE entity_a_id = p_remove
    AND NOT EXISTS (
      SELECT 1 FROM entity_relationships er2
      WHERE er2.entity_a_id = p_keep
        AND er2.entity_b_id = entity_relationships.entity_b_id
        AND er2.relationship_type = entity_relationships.relationship_type
    )
    AND entity_b_id != p_keep;  -- prevent self-relationship

  -- Reassign entity_relationships (entity_b_id side)
  UPDATE entity_relationships
  SET entity_b_id = p_keep
  WHERE entity_b_id = p_remove
    AND NOT EXISTS (
      SELECT 1 FROM entity_relationships er2
      WHERE er2.entity_a_id = entity_relationships.entity_a_id
        AND er2.entity_b_id = p_keep
        AND er2.relationship_type = entity_relationships.relationship_type
    )
    AND entity_a_id != p_keep;

  -- Delete any remaining relationships that couldn't be reassigned (would be duplicates)
  DELETE FROM entity_relationships
  WHERE entity_a_id = p_remove OR entity_b_id = p_remove;

  -- Merge aliases: union of both + removed entity's name
  UPDATE entities
  SET
    aliases = coalesce(
      (SELECT array_agg(DISTINCT a) FROM unnest(
        coalesce(kept_entity.aliases, '{}') ||
        coalesce(removed_entity.aliases, '{}') ||
        ARRAY[removed_entity.name]
      ) AS a WHERE a IS NOT NULL),
      '{}'
    ),
    mention_count = entities.mention_count + coalesce(removed_entity.mention_count, 0),
    document_count = entities.document_count + coalesce(removed_entity.document_count, 0),
    risk_score = greatest(entities.risk_score, coalesce(removed_entity.risk_score, 0)),
    updated_at = now()
  WHERE id = p_keep;

  -- Insert merge log entry
  INSERT INTO entity_merge_log (
    kept_entity_id, merged_entity_id, merged_entity_name,
    merged_entity_type, merge_reason, similarity_score
  ) VALUES (
    p_keep, p_remove, removed_entity.name,
    removed_entity.entity_type, 'entity_dedup', NULL
  );

  -- Delete removed entity (CASCADE handles remaining FKs)
  DELETE FROM entities WHERE id = p_remove;

  -- Recompute risk score for the kept entity after merge
  PERFORM compute_entity_risk_score(p_keep);
END;
$$;

-- ============================================================
-- Section 5: Backfill name_normalized
-- ============================================================

UPDATE entities SET name_normalized = normalize_entity_name(name)
WHERE name_normalized IS NULL;

-- ============================================================
-- Section 6: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entities_risk_score ON entities (risk_score DESC) WHERE risk_score > 0;
CREATE INDEX IF NOT EXISTS idx_entity_mentions_evidence_weight ON entity_mentions (entity_id, evidence_weight DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_entity_merge_log_kept ON entity_merge_log (kept_entity_id);
