-- Migration 00035: Relationship Type Alignment
-- Adds communicated_with and met_with to the canonical relationship type list.
-- Renames stale types (referenced_together → mentioned_together, witness_against → witness_testimony).
-- Expands CHECK constraint from 20 → 22 types.

-- ============================================================
-- Section 1: Rename stale relationship types in existing data
-- ============================================================

-- Rename referenced_together → mentioned_together (handle dedup)
-- If a renamed row would duplicate an existing (entity_a_id, entity_b_id, relationship_type),
-- keep the higher-strength row and delete the duplicate.
DO $$
DECLARE
  renamed_count INTEGER;
  dup_count INTEGER;
BEGIN
  -- Count rows to rename
  SELECT COUNT(*) INTO renamed_count FROM entity_relationships
    WHERE relationship_type = 'referenced_together';

  IF renamed_count > 0 THEN
    -- Delete duplicates (keep existing mentioned_together, remove referenced_together that would conflict)
    DELETE FROM entity_relationships r1
    USING entity_relationships r2
    WHERE r1.relationship_type = 'referenced_together'
      AND r2.relationship_type = 'mentioned_together'
      AND r1.entity_a_id = r2.entity_a_id
      AND r1.entity_b_id = r2.entity_b_id
      AND r1.strength <= r2.strength;

    GET DIAGNOSTICS dup_count = ROW_COUNT;
    IF dup_count > 0 THEN
      RAISE NOTICE '00035: Deleted % duplicate referenced_together rows (kept higher-strength mentioned_together)', dup_count;
    END IF;

    -- Rename remaining
    UPDATE entity_relationships SET relationship_type = 'mentioned_together'
      WHERE relationship_type = 'referenced_together';
    GET DIAGNOSTICS renamed_count = ROW_COUNT;
    RAISE NOTICE '00035: Renamed % referenced_together → mentioned_together', renamed_count;
  END IF;
END;
$$;

DO $$
DECLARE
  renamed_count INTEGER;
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO renamed_count FROM entity_relationships
    WHERE relationship_type = 'witness_against';

  IF renamed_count > 0 THEN
    DELETE FROM entity_relationships r1
    USING entity_relationships r2
    WHERE r1.relationship_type = 'witness_against'
      AND r2.relationship_type = 'witness_testimony'
      AND r1.entity_a_id = r2.entity_a_id
      AND r1.entity_b_id = r2.entity_b_id
      AND r1.strength <= r2.strength;

    GET DIAGNOSTICS dup_count = ROW_COUNT;
    IF dup_count > 0 THEN
      RAISE NOTICE '00035: Deleted % duplicate witness_against rows (kept higher-strength witness_testimony)', dup_count;
    END IF;

    UPDATE entity_relationships SET relationship_type = 'witness_testimony'
      WHERE relationship_type = 'witness_against';
    GET DIAGNOSTICS renamed_count = ROW_COUNT;
    RAISE NOTICE '00035: Renamed % witness_against → witness_testimony', renamed_count;
  END IF;
END;
$$;

-- ============================================================
-- Section 2: Replace CHECK constraint (20 → 22 types)
-- ============================================================

ALTER TABLE entity_relationships DROP CONSTRAINT IF EXISTS entity_relationships_type_check;

ALTER TABLE entity_relationships ADD CONSTRAINT entity_relationships_type_check CHECK (
  relationship_type IN (
    'traveled_with',
    'employed_by',
    'associate_of',
    'family_member',
    'legal_representative',
    'financial_connection',
    'mentioned_together',
    'witness_testimony',
    'employer_of',
    'guest_of',
    'owns',
    'controlled_by',
    'beneficiary_of',
    'investigated_by',
    'prosecuted_by',
    'victim_of',
    'co_defendant',
    'introduced_by',
    'recruited_by',
    'located_at',
    'communicated_with',
    'met_with'
  )
);

-- ============================================================
-- Section 3: Verify no orphaned types remain
-- ============================================================

DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM entity_relationships
    WHERE relationship_type IS NULL OR relationship_type NOT IN (
      'traveled_with','employed_by','associate_of','family_member',
      'legal_representative','financial_connection','mentioned_together',
      'witness_testimony','employer_of','guest_of','owns','controlled_by',
      'beneficiary_of','investigated_by','prosecuted_by','victim_of',
      'co_defendant','introduced_by','recruited_by','located_at',
      'communicated_with','met_with'
    );
  IF bad_count > 0 THEN
    RAISE EXCEPTION '00035: Cannot validate constraint — % rows have non-conforming or NULL relationship_type. Fix data first.', bad_count;
  ELSE
    RAISE NOTICE '00035: All relationship types conform to the 22-type canonical list';
  END IF;
END;
$$;

-- Validate the constraint for existing rows
ALTER TABLE entity_relationships VALIDATE CONSTRAINT entity_relationships_type_check;
