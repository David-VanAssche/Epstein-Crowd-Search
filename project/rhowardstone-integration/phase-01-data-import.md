# Phase 1: Data Import

> **Status:** Not started
> **Estimated effort:** 16-24 hours
> **Depends on:** Phase 0 (security prerequisites), Phase 0 of main data-import plan (document seeding)

## Goal

Import all 6 SQLite databases, the person registry, and 100+ investigation reports from rhowardstone/Epstein-research into Supabase. This is the largest single data import after the DOJ document seeding.

## Prerequisites

1. Phase 0 security migrations applied (PII protection, provenance tracking)
2. `documents` table populated from OPT parsing (~1.38M rows with EFTA ranges)
3. rhowardstone repo cloned or release artifacts downloaded
4. `.db` files in `.gitignore`

## Tasks

### 1.1 Download rhowardstone Release Artifacts

**Script:** `scripts/import/download-rhowardstone.sh`

Download the latest release from GitHub:
```bash
# Clone the repo (or download release artifacts)
git clone https://github.com/rhowardstone/Epstein-research.git /tmp/rhowardstone

# Key files:
# /tmp/rhowardstone/full_text_corpus.db        (6.08 GB)
# /tmp/rhowardstone/redaction_analysis_v2.db   (varies)
# /tmp/rhowardstone/knowledge_graph.db         (~50 MB)
# /tmp/rhowardstone/persons_registry.json      (~2 MB)
# /tmp/rhowardstone/image_analysis.db          (~500 MB)
# /tmp/rhowardstone/transcripts.db             (~100 MB)
# /tmp/rhowardstone/reports/                   (100+ .md files)
```

Record the commit hash in `data_sources` table for provenance.

**Note:** Run on GCP VM for large files. The 6 GB OCR database will be slow to download locally.

### 1.2 Import OCR Text → Chunks

**Script:** `scripts/import/import-rhowardstone-ocr.ts`

The largest and most important import. Maps rhowardstone's page-level OCR text to our chunk-based system.

**Logic:**
1. Open `full_text_corpus.db` via `better-sqlite3`
2. Query pages grouped by document (using EFTA page number ranges)
3. For each document's page group:
   a. Look up `document_id` from our `documents` table by EFTA range match
   b. Concatenate pages into logical chunks (~1000-2000 chars each)
   c. Insert into `chunks` table with:
      - `document_id` — FK to our document
      - `content` — chunk text
      - `chunk_index` — sequential within document
      - `ocr_source` — `'rhowardstone'`
      - `provenance_source` — `'rhowardstone'`
      - `content_embedding` — NULL (needs Nova embedding later)
   d. Update document's `completed_stages` to include `'ocr'` and `'chunk'`

**Performance:**
- ~2.73M pages → ~500K chunks (assuming ~5 pages per chunk avg)
- Batch inserts: 1000 rows per `.insert()` call
- Expected: 2-4 hours on GCP VM
- Fallback: If `better-sqlite3` doesn't work (native binding issues), use Python to extract and write to CSV, then import CSV via Supabase CLI

**EFTA mapping helper:** `scripts/import/lib/efta-mapper.ts`
```typescript
// Given an EFTA page number, find the document_id that owns it
// Uses the documents.original_path field which stores EFTA ranges
async function findDocumentByEfta(supabase, eftaPage: number): Promise<string | null>
```

### 1.3 Import Entities (Persons Registry + Knowledge Graph)

**Script:** `scripts/import/import-rhowardstone-entities.ts`

Two-pass import:

**Pass 1: persons_registry.json (1,614 persons)**
```typescript
for (const person of registry) {
  const normalized = await supabase.rpc('normalize_entity_name', { name: person.name });
  await supabase.from('entities').upsert({
    name: person.name,
    name_normalized: normalized,
    entity_type: 'person',
    description: person.role_description,
    metadata: {
      rhowardstone_role: person.role,        // victim, associate, staff, legal, etc.
      rhowardstone_category: person.category,
      // DO NOT import: phone, address, email — PII protection
    },
    provenance_source: 'rhowardstone',
    pii_fields: detectPiiFields(person),     // Track what PII exists for admin audit
  }, { onConflict: 'name_normalized,entity_type' });
}
```

**Pass 2: knowledge_graph.db entities (524)**
- Read from SQLite, normalize names, upsert with ON CONFLICT merge
- Preserves rhowardstone's entity type if more specific than ours

### 1.4 Import Relationships

**Script:** Same as 1.3 (second half)

```typescript
for (const rel of relationships) {
  const entityA = await lookupEntity(rel.source);
  const entityB = await lookupEntity(rel.target);
  if (!entityA || !entityB) continue; // Skip if entity not found

  // Canonical ordering
  const [first, second] = entityA.id < entityB.id
    ? [entityA.id, entityB.id]
    : [entityB.id, entityA.id];

  await supabase.from('entity_relationships').upsert({
    entity_a_id: first,
    entity_b_id: second,
    relationship_type: mapRelationshipType(rel.type),
    evidence_summary: rel.evidence,
    confidence: rel.confidence ?? 0.7,
    provenance_source: 'rhowardstone',
  }, { onConflict: 'entity_a_id,entity_b_id,relationship_type' });
}
```

### 1.5 Import Redaction Analysis (Filtered)

**Script:** `scripts/import/import-rhowardstone-redactions.ts`

**Critical:** Must apply noise filtering before import. ~98% of OCR-layer "recovered text" is noise.

```typescript
// Noise filter heuristics (from rhowardstone's methodology)
function isLikelyNoise(text: string): boolean {
  // 1. Character distribution: noise has unusual char frequencies
  const alphaRatio = text.replace(/[^a-zA-Z]/g, '').length / text.length;
  if (alphaRatio < 0.3) return true; // Too few alphabetic chars

  // 2. Word length: noise produces very short/long "words"
  const words = text.split(/\s+/);
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / words.length;
  if (avgWordLen < 2 || avgWordLen > 15) return true;

  // 3. Dictionary check: real text has recognizable words
  const knownWords = words.filter(w => commonEnglishWords.has(w.toLowerCase()));
  if (knownWords.length / words.length < 0.2) return true;

  return false;
}
```

Import results:
- Spatial redactions (black rectangles) → store as `metadata.spatial_redactions[]` on document
- Filtered OCR-layer text (the ~2% that passes) → store as redaction proposals with `confidence = 0.6`
- Manual annotations → store as redaction proposals with `confidence = 1.0`

### 1.6 Import Image Analysis

**Script:** `scripts/import/import-rhowardstone-media.ts`

Map 38,955 image records to our `images` table:
- Match by storage path or EFTA page reference
- Import: classification, content description, face detection results, extracted text
- Store as `metadata.rhowardstone_analysis` JSONB
- Do NOT import face bounding box coordinates to public metadata (PII risk)

### 1.7 Import Audio Transcripts

**Script:** Same as 1.6 (second half)

375 transcription records → `audio_chunks` or document metadata:
- Match to audio files in our `audio_files` table
- Import transcript text as chunks with `ocr_source = 'rhowardstone_whisper'`

### 1.8 Import Investigation Reports

**Script:** `scripts/import/import-rhowardstone-reports.ts`

**New migration needed:** `supabase/migrations/00037_investigation_reports.sql`

```sql
CREATE TABLE IF NOT EXISTS investigation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,                    -- markdown
  author TEXT DEFAULT 'rhowardstone',
  congressional_score INT CHECK (congressional_score BETWEEN 0 AND 100),
  tags TEXT[] DEFAULT '{}',
  linked_entity_ids UUID[] DEFAULT '{}',
  linked_document_ids UUID[] DEFAULT '{}',
  provenance_source TEXT DEFAULT 'rhowardstone',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reports_congressional ON investigation_reports(congressional_score DESC);
CREATE INDEX idx_reports_tags ON investigation_reports USING gin(tags);
```

Import: read each `.md` file, extract title from first heading, generate slug, parse entity/document references, assign congressional score based on content analysis.

## Checklist

- [ ] 1.1 rhowardstone artifacts downloaded (record commit hash)
- [ ] 1.2 OCR text imported → chunks table (~500K rows)
- [ ] 1.3 Entities imported (1,614 persons + 524 entities merged)
- [ ] 1.4 Relationships imported (2,096 relationships)
- [ ] 1.5 Redaction data imported (filtered, ~50K records from 2.58M raw)
- [ ] 1.6 Image analysis imported (38,955 records)
- [ ] 1.7 Audio transcripts imported (375 records)
- [ ] 1.8 Investigation reports imported (100+ reports)
- [ ] Pipeline dashboard shows OCR stage progress (documents with rhowardstone OCR marked complete)
- [ ] Entity count on dashboard reflects imported entities
- [ ] Provenance badges visible in UI: `[Imported from rhowardstone]`

## Verification

After import completes:
```sql
-- Verify OCR import
SELECT count(*) FROM chunks WHERE ocr_source = 'rhowardstone';
-- Expected: ~500K

-- Verify entity import
SELECT count(*) FROM entities WHERE provenance_source = 'rhowardstone';
-- Expected: ~1,600+

-- Verify relationships
SELECT count(*) FROM entity_relationships WHERE provenance_source = 'rhowardstone';
-- Expected: ~2,096

-- Verify reports
SELECT count(*) FROM investigation_reports;
-- Expected: 100+

-- Verify pipeline progress
SELECT count(*) FROM documents WHERE 'ocr' = ANY(completed_stages);
-- Should be significantly higher than before import
```
