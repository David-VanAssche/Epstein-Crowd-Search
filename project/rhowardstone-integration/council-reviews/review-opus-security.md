# Council Review: Security & Risk Assessment
**Reviewer:** Security Reviewer (Claude Opus 4.6)
**Focus:** Security risks from importing external research data, PII exposure, legal hazards

## Findings by Severity

### CRITICAL: PII Exposure in Entity Metadata

**Issue:** The `entities` table has a `metadata JSONB` column that may contain phone numbers, physical addresses, email addresses, and other PII from sources like the Black Book and rhowardstone's person registry. Current RLS policies allow public (anon) read access to the full entity row including metadata.

**Risk:** Publishing PII of victims, witnesses, or even associates without consent violates privacy laws and could endanger individuals. Some PII in the Black Book belongs to victims.

**Fix:**
```sql
-- Option A: Column-level security (preferred)
-- Create a view that strips PII for public access
CREATE VIEW entities_public AS
SELECT
  id, name, name_normalized, entity_type, description,
  -- Strip PII fields from metadata
  metadata - 'phone' - 'address' - 'email' - 'ssn' - 'dob' AS metadata_safe
FROM entities;

-- RLS: anon users read from view, authenticated researchers read full table

-- Option B: Row-level filter
-- Add a `pii_reviewed` boolean, only show entities where PII has been scrubbed
ALTER TABLE entities ADD COLUMN pii_reviewed BOOLEAN DEFAULT false;
```

**Recommendation:** Implement Option A before any entity data import. Create a migration that:
1. Creates the `entities_public` view
2. Updates RLS to route anon users through the view
3. Adds `pii_fields TEXT[]` column to track which PII fields exist (for admin review)

### HIGH: Court-Sealed Redaction Content

**Issue:** Some redactions in the DOJ documents cover court-sealed information. rhowardstone's redaction analysis may contain text recovered from under these seals. Publishing court-sealed content could expose the project to legal liability.

**Risk:** Contempt of court, injunctions, project takedown.

**Fix:**
1. Add `seal_status` enum to redaction data: `unknown`, `likely_sealed`, `confirmed_unsealed`
2. Default all imported redactions to `unknown`
3. Redactions with `seal_status = 'likely_sealed'` are hidden from public view
4. Community voting can only propose unsealing after legal review flag
5. Add banner: "Some redaction content may be court-sealed. Report concerns to [contact]."

### HIGH: Missing .gitignore for Database Files

**Issue:** rhowardstone's SQLite databases (6+ GB) could accidentally be committed to git if downloaded into the project directory for import scripts.

**Fix:**
```gitignore
# SQLite databases (import artifacts)
*.db
*.sqlite
*.sqlite3

# Except our test fixtures
!__tests__/fixtures/*.db
```

### HIGH: No Provenance Tracking for AI-Generated Content

**Issue:** Once rhowardstone's human-curated data is imported alongside our LLM-generated extractions, there's no way to distinguish human-verified facts from AI hallucinations. This is dangerous for a research platform.

**Fix:** Add provenance columns to key tables:
```sql
ALTER TABLE entities ADD COLUMN provenance_source TEXT; -- 'rhowardstone', 'pipeline_llm', 'community', 'manual'
ALTER TABLE entity_relationships ADD COLUMN provenance_source TEXT;
ALTER TABLE chunks ADD COLUMN provenance_source TEXT; -- already has ocr_source, but expand

-- Provenance enum
COMMENT ON COLUMN entities.provenance_source IS
  'Origin of this data: rhowardstone (imported research), pipeline_llm (AI extraction), community (user contribution), manual (admin entry)';
```

Display provenance badges in the UI: `[Imported]` `[AI Extracted]` `[Community]` `[Verified]`

### MEDIUM: SQL Injection via Entity Names

**Issue:** rhowardstone's entity names are free-text strings that will be inserted into Supabase. If import scripts use string interpolation instead of parameterized queries, entity names containing SQL metacharacters could cause injection.

**Risk:** Low probability (Supabase JS client uses parameterized queries by default), but import scripts using raw SQL or batch inserts might bypass this.

**Fix:** Ensure all import scripts use Supabase client's `.insert()` method (parameterized) or explicit `$1, $2` placeholders in raw SQL. Code review checkpoint in Phase 1.

### MEDIUM: Rate Limiting on Import Endpoints

**Issue:** Import scripts will make thousands of sequential Supabase inserts. Without rate limiting awareness, scripts could hit Supabase's connection pool limits or trigger abuse detection.

**Fix:**
1. Use batch inserts (1000 rows per `.insert()` call)
2. Add `--batch-size` and `--delay-ms` CLI flags to import scripts
3. Use service role key (bypasses RLS) with connection pooling
4. Monitor Supabase dashboard during imports for connection saturation

### MEDIUM: Storage Bucket Permissions for Imported Media

**Issue:** If rhowardstone's image analysis includes direct image URLs or paths, and we store derived images, ensure they go through the same storage bucket RLS as existing media.

**Fix:** All imported media goes into `raw-archive/` bucket with existing RLS. No new buckets needed. Verify RLS allows public read for images but not for raw import artifacts.

### LOW: Stale Data Divergence

**Issue:** rhowardstone's repo is actively maintained. If we import a snapshot and they update their data, our copy diverges silently.

**Fix:**
1. Record import timestamp and rhowardstone commit hash in `data_sources` table
2. Add a `/admin/data-sources` page showing last import date per source
3. Periodic check: compare our import hash against rhowardstone's latest release

## Pre-Import Checklist

Before any rhowardstone data enters Supabase:

- [ ] Entity PII stripping migration applied (CRITICAL)
- [ ] Court-sealed redaction handling migration applied (HIGH)
- [ ] `.gitignore` updated for `.db` files (HIGH)
- [ ] Provenance tracking columns added (HIGH)
- [ ] Import scripts reviewed for parameterized queries (MEDIUM)
- [ ] Supabase connection pool settings verified for bulk import (MEDIUM)
- [ ] Storage bucket RLS verified (MEDIUM)
- [ ] rhowardstone commit hash recorded (LOW)
