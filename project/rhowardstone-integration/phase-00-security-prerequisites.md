# Phase 0: Security Prerequisites

> **Status:** Not started
> **Estimated effort:** 4-6 hours
> **Must complete before:** Phase 1 (any data import)

## Goal

Harden the database and application security before importing external research data that may contain PII, court-sealed content, or other sensitive material.

## Tasks

### 0.1 Entity PII Protection Migration

**File:** `supabase/migrations/00035_entity_pii_protection.sql`

Create a public-facing view that strips PII fields from entity metadata:

```sql
-- Track which PII fields exist per entity (for admin audit)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS pii_fields TEXT[] DEFAULT '{}';

-- Public view strips sensitive metadata keys
CREATE OR REPLACE VIEW entities_public AS
SELECT
  id, name, name_normalized, entity_type, description,
  aliases, mention_count, risk_score,
  metadata - 'phone' - 'phones' - 'address' - 'addresses'
           - 'email' - 'emails' - 'ssn' - 'dob'
           - 'personal_phone' - 'home_address' AS metadata_safe,
  pii_fields,
  created_at, updated_at
FROM entities;

-- RLS: anon key reads from entities_public view
-- Service role / authenticated researchers read full entities table
```

Update relevant API routes to use `entities_public` for unauthenticated requests.

### 0.2 Provenance Tracking Columns

**File:** `supabase/migrations/00036_provenance_tracking.sql`

Add provenance source tracking to key tables:

```sql
ALTER TABLE entities ADD COLUMN IF NOT EXISTS provenance_source TEXT DEFAULT 'pipeline_llm';
ALTER TABLE entity_relationships ADD COLUMN IF NOT EXISTS provenance_source TEXT DEFAULT 'pipeline_llm';

COMMENT ON COLUMN entities.provenance_source IS
  'Data origin: rhowardstone, pipeline_llm, community, manual, epsteininvestigation_org';
```

### 0.3 Court-Sealed Redaction Handling

**File:** Add to migration 00035 or 00036

```sql
-- Seal status for redaction data
-- Applied to document-level redaction metadata
CREATE TYPE seal_status AS ENUM ('unknown', 'likely_sealed', 'confirmed_unsealed', 'confirmed_sealed');

ALTER TABLE documents ADD COLUMN IF NOT EXISTS seal_status seal_status DEFAULT 'unknown';
```

Add UI banner for redaction pages: "Some content may be court-sealed. Verify with original DOJ source before publication."

### 0.4 Update .gitignore

**File:** `.gitignore`

Add:
```
# SQLite databases (import artifacts from rhowardstone, lmsband, etc.)
*.db
*.sqlite
*.sqlite3
!__tests__/fixtures/*.db
```

### 0.5 Entity Corrections Table

**File:** Add to migration 00036

```sql
CREATE TABLE IF NOT EXISTS entity_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source TEXT NOT NULL, -- 'community_vote', 'data_import', 'pipeline_rerun', 'admin'
  changed_by UUID REFERENCES auth.users(id),
  confidence REAL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entity_corrections_entity ON entity_corrections(entity_id);
CREATE INDEX idx_entity_corrections_created ON entity_corrections(created_at DESC);
```

## Checklist

- [ ] 0.1 Entity PII protection migration written and tested
- [ ] 0.2 Provenance tracking columns added
- [ ] 0.3 Seal status enum and column added
- [ ] 0.4 .gitignore updated for .db files
- [ ] 0.5 Entity corrections table created
- [ ] All migrations applied to Supabase
- [ ] API routes updated to use `entities_public` for anon access
- [ ] Manual verification: anon API call to `/api/entities` does NOT return phone/address/email fields

## Dependencies

- None (this phase has no prerequisites)

## Risks

- **Medium:** Existing entity data may already contain PII that was imported from Black Book or epsteininvestigation.org. Run an audit query after migration to identify affected rows.
- **Low:** The `entities_public` view adds a small query overhead. Unlikely to matter at current entity count (~100s, not millions).
