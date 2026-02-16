# Phase 4: Entity Extraction

Extract named entities from all document chunks and populate the `entities`, `entity_mentions`, and `entity_relationships` tables.

## Existing Infrastructure

### Current entity extractor
- `lib/pipeline/services/entity-extractor.ts` — uses Gemini Flash 2.0 (`generativelanguage.googleapis.com`)
- `lib/pipeline/services/relationship-mapper.ts` — maps entity-to-entity relationships
- Entity types: `person`, `organization`, `location`, `aircraft`, `vessel`, `property`, `account`
- Dedup: `findOrCreateEntity()` matches by exact `name` + `entity_type`

> **CRITICAL (Audit C3)**: `findOrCreateEntity()` (line 122-127) matches on exact `name` + `entity_type`, but the DB constraint is `UNIQUE(name_normalized, entity_type)`. Without computing `name_normalized`, inserts will either fail on the constraint or create duplicates. **Must be fixed before running entity extraction** — see Entity Deduplication section below.

### Database schema
- `entities` table: `UNIQUE(name_normalized, entity_type)` constraint
- `entity_mentions` table: links entity → chunk → document with confidence scores
- `entity_relationships` table: `UNIQUE(entity_a_id, entity_b_id, relationship_type)`

## Approach: Two-Track Entity Population

### Track A: Community entities (from Phase 2 Priority 5)

Already imported from maxandrews/lmsband SQLite databases in Phase 2. These provide a base of known entities to match against.

### Track B: Pipeline entity extraction

For documents that don't have entities yet, run NER extraction.

#### Option 1: Gemini Flash (existing code, higher quality)
```bash
npx tsx scripts/batch/run-all.ts --stage entity_extract
```
- **Cost**: ~$0.001/page × estimated 70K documents × ~10 pages = ~$700
- **Quality**: Excellent — structured JSON output, high confidence
- **API key needed**: `GOOGLE_AI_API_KEY` (Gemini API, not Vertex AI)

#### Option 2: Fireworks AI with Llama/Qwen (cheaper, open-source)

Create `scripts/import/extract-entities-fireworks.ts`:
- Use Fireworks API with `accounts/fireworks/models/llama-v3p1-8b-instruct`
- Same prompt pattern as existing entity-extractor
- **Cost**: ~$0.20/M tokens × ~150M tokens = ~$30
- **Quality**: Good for common entities, may miss domain-specific ones

#### Option 3: GLiNER zero-shot NER (free, local)

Create `scripts/import/extract-entities-gliner.ts`:
- Run GLiNER locally via Python subprocess
- Zero API cost
- **Quality**: Good for standard NER categories, less effective for domain-specific entities
- **Limitation**: Requires Python + torch installed

### Recommended approach

1. **Start with existing Gemini extractor** on a subset (`--limit 100`) to validate quality
2. **Switch to Fireworks Llama** for bulk if budget is a concern
3. **Community entities from Phase 2** serve as ground truth for validation

## Entity Deduplication

Critical step: the `name_normalized` column must be computed for all entities.

### normalizeEntityName() logic

```
"Jeffrey E. Epstein"  → "jeffrey e epstein"
"Mr. Epstein"         → "epstein"
"Epstein, Jeffrey"    → "jeffrey epstein"
"GHISLAINE MAXWELL"   → "ghislaine maxwell"
"Dr. John Doe"        → "john doe"
"Jean Luc Brunel"     → "jean luc brunel"
```

### Handling duplicates

When inserting an entity that conflicts on `(name_normalized, entity_type)`:
1. Keep the existing entity ID
2. Merge aliases: `SET aliases = array_cat(aliases, new_aliases)`
3. Increment mention_count
4. Update `first_seen_date`/`last_seen_date` if new dates are earlier/later

## Entity Enrichment (stretch goal)

After base entities exist, Phase 11 migration (00021) adds enrichment columns:
- `category`: Classify into 15 categories (victim, perpetrator, enabler, witness, etc.)
- `wikidata_id`: Link to Wikidata for public figures
- `photo_url`: For entity cards in UI
- `birth_date`, `death_date`: For timeline placement

These can be populated later via:
```bash
npx tsx scripts/batch/categorize-persons.ts
npx tsx scripts/batch/enrich-wikidata.ts
```

## Relationship Mapping

After entities exist, run relationship mapping:
```bash
npx tsx scripts/batch/run-all.ts --stage relationship_map
```

This identifies relationships like:
- `associated_with`, `employed_by`, `traveled_with`, `communicated_with`
- Evidence stored as `evidence_chunk_ids` and `evidence_document_ids`

## Verification

```sql
-- Entity counts by type
SELECT entity_type, COUNT(*) FROM entities GROUP BY entity_type ORDER BY count DESC;

-- Entity counts by source
SELECT source, COUNT(*) FROM entities GROUP BY source ORDER BY count DESC;

-- Top entities by mention count
SELECT name, entity_type, mention_count FROM entities ORDER BY mention_count DESC LIMIT 20;

-- Entity mentions coverage
SELECT COUNT(DISTINCT document_id) as docs_with_entities,
       (SELECT COUNT(*) FROM documents WHERE ocr_text IS NOT NULL) as docs_with_text
FROM entity_mentions;

-- Relationship counts
SELECT relationship_type, COUNT(*) FROM entity_relationships GROUP BY relationship_type;
```

## Checklist

- [ ] `findOrCreateEntity()` refactored to compute `name_normalized` before insert (Audit C3)
- [ ] `normalizeEntityName()` handles edge cases (tested with examples above)
- [ ] Community entities imported (Phase 2 Priority 5)
- [ ] Entity extraction tested on 100 documents
- [ ] Full entity extraction run completed
- [ ] Entity dedup verified (no obvious duplicates in top 50 entities)
- [ ] Relationship mapping completed
- [ ] `/entities` page shows populated entity list
- [ ] Entity search works on `/search` page
