-- Migration 00025: Expanded Entity Schema
-- Adds CHECK constraints on entity_type, mention_type, relationship_type.
-- Expands entity types (7 → 14), relationship types (10 → 20), person categories (15 → 20).
-- Must run BEFORE large-scale NER pipeline processing.
--
-- Uses NOT VALID to add constraints without scanning existing rows (safe for large tables).
-- Run VALIDATE CONSTRAINT separately after verifying data cleanliness.

-- ============================================================
-- Section 0: Pre-flight — log any non-conforming rows (informational)
-- ============================================================

DO $$
DECLARE
  bad_entity_types INTEGER;
  bad_mention_types INTEGER;
  bad_relationship_types INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_entity_types FROM entities
    WHERE entity_type NOT IN (
      'person','organization','location','aircraft','vessel','property','account',
      'event','legal_case','government_body','trust','phone_number','vehicle','document_reference'
    );
  SELECT COUNT(*) INTO bad_mention_types FROM entity_mentions
    WHERE mention_type NOT IN ('direct','indirect','implied','co_occurrence');
  SELECT COUNT(*) INTO bad_relationship_types FROM entity_relationships
    WHERE relationship_type NOT IN (
      'traveled_with','employed_by','associate_of','family_member',
      'legal_representative','financial_connection','mentioned_together',
      'witness_testimony','employer_of','guest_of','owns','controlled_by',
      'beneficiary_of','investigated_by','prosecuted_by','victim_of',
      'co_defendant','introduced_by','recruited_by','located_at'
    );
  IF bad_entity_types > 0 THEN
    RAISE WARNING '00025: % entities have non-conforming entity_type values — constraint added as NOT VALID', bad_entity_types;
  END IF;
  IF bad_mention_types > 0 THEN
    RAISE WARNING '00025: % entity_mentions have non-conforming mention_type values — constraint added as NOT VALID', bad_mention_types;
  END IF;
  IF bad_relationship_types > 0 THEN
    RAISE WARNING '00025: % entity_relationships have non-conforming relationship_type values — constraint added as NOT VALID', bad_relationship_types;
  END IF;
END;
$$;

-- ============================================================
-- Section 1: entity_type CHECK constraint (14 types)
-- ============================================================

-- Original 7: person, organization, location, aircraft, vessel, property, account
-- New 7: event, legal_case, government_body, trust, phone_number, vehicle, document_reference
ALTER TABLE entities ADD CONSTRAINT entities_entity_type_check CHECK (
  entity_type IN (
    'person',
    'organization',
    'location',
    'aircraft',
    'vessel',
    'property',
    'account',
    'event',
    'legal_case',
    'government_body',
    'trust',
    'phone_number',
    'vehicle',
    'document_reference'
  )
) NOT VALID;

-- ============================================================
-- Section 2: mention_type CHECK constraint (4 types)
-- ============================================================

ALTER TABLE entity_mentions ADD CONSTRAINT entity_mentions_mention_type_check CHECK (
  mention_type IN ('direct', 'indirect', 'implied', 'co_occurrence')
) NOT VALID;

-- ============================================================
-- Section 3: relationship_type CHECK constraint (20 types)
-- ============================================================

-- Original 10: traveled_with, employed_by, associate_of, family_member,
--   legal_representative, financial_connection, mentioned_together,
--   witness_testimony, employer_of, guest_of
-- New 10: owns, controlled_by, beneficiary_of, investigated_by,
--   prosecuted_by, victim_of, co_defendant, introduced_by,
--   recruited_by, located_at
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
    'located_at'
  )
) NOT VALID;

-- ============================================================
-- Section 4: Expand person category CHECK constraint (15 → 20)
-- ============================================================

-- Drop old constraint and add expanded one
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_category_check;
ALTER TABLE entities ADD CONSTRAINT entities_category_check CHECK (
  category IS NULL OR category IN (
    'associate',
    'business_leader',
    'celebrity',
    'diplomat',
    'educator',
    'intelligence',
    'legal',
    'media',
    'medical',
    'military',
    'politician',
    'royalty',
    'staff',
    'victim',
    'other',
    'minor_victim',
    'financier',
    'religious',
    'philanthropist',
    'flight_crew'
  )
);

-- ============================================================
-- Section 5: Add index on entity_type for faster filtered queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities (entity_type);

-- ============================================================
-- Section 6: Validate constraints (safe to run on clean data)
-- If any fail, fix the offending rows first, then re-run these.
-- ============================================================

ALTER TABLE entities VALIDATE CONSTRAINT entities_entity_type_check;
ALTER TABLE entity_mentions VALIDATE CONSTRAINT entity_mentions_mention_type_check;
ALTER TABLE entity_relationships VALIDATE CONSTRAINT entity_relationships_type_check;
