# Council Review: Data Import Architecture
**Reviewer:** DeepReason (DeepSeek R1 + Kimi K2.5 via Fireworks AI)
**Focus:** How to get 6 SQLite databases + structured data into Supabase efficiently

## Key Findings

### 1. Import Order Matters — OCR Text First

The `full_text_corpus.db` (6.08 GB) is the foundation everything else references. Import order:

```
Phase 1: OCR text (full_text_corpus.db) → chunks table
Phase 2: Entities (knowledge_graph.db + persons_registry.json) → entities table
Phase 3: Relationships (knowledge_graph.db) → entity_relationships table
Phase 4: Redactions (redaction_analysis_v2.db) → redaction metadata on documents
Phase 5: Images (image_analysis.db) → images table enrichment
Phase 6: Transcripts (transcripts.db) → audio_chunks or new transcript storage
Phase 7: Investigation reports (markdown files) → investigation_reports table
```

### 2. OCR Text Mapping Strategy

rhowardstone's SQLite stores text keyed by EFTA page number. Our `documents` table (from Phase 0 OPT parsing) maps EFTA ranges to logical documents. The import script must:

1. Query `full_text_corpus.db` by EFTA page number
2. Look up which `document_id` owns that EFTA range (via `documents.original_path`)
3. Concatenate pages belonging to the same document
4. Insert as `chunks` with `ocr_source = 'rhowardstone'`
5. Mark document's `completed_stages` to include `'ocr'`

**Performance consideration:** 6 GB SQLite → Supabase over network. Options:
- **Option A:** Run import script on the GCP VM (closer to Supabase, better network)
- **Option B:** Stream via `better-sqlite3` locally with batch inserts (1000 rows/batch)
- **Recommended:** Option A — the VM has 150 GB SSD and fast egress

### 3. Entity Dedup Strategy

rhowardstone has two entity sources:
- `knowledge_graph.db`: 524 entities with typed relationships
- `persons_registry.json`: 1,614 persons with role categorization (victim, associate, staff, legal, etc.)

These overlap. The import must:
1. Import `persons_registry.json` first (more comprehensive)
2. Import `knowledge_graph.db` entities second, using `ON CONFLICT (name_normalized, entity_type)` to merge
3. Preserve rhowardstone's role categorization in `metadata.rhowardstone_role`
4. Use our existing `normalize_entity_name()` function for dedup

### 4. Relationship Canonical Ordering

rhowardstone stores directional relationships (A → B). Our `entity_relationships` table should use canonical ordering (`entity_a_id < entity_b_id` lexicographically) to prevent duplicate inverse relationships. The import script must:
1. Normalize entity names on both sides
2. Look up entity IDs
3. Order (A, B) canonically
4. Insert with `ON CONFLICT` merge on `(entity_a_id, entity_b_id, relationship_type)`

### 5. Redaction Data Requires Filtering

The 2.58M redaction records include:
- Spatial redactions (black rectangles detected by PyMuPDF) — **high confidence**
- OCR-layer "hidden text" — **~98% noise, needs filtering**
- Manual annotations — **high confidence**

Import script must:
1. Import spatial redactions directly (geometry + page number)
2. Filter OCR-layer text using rhowardstone's noise detection heuristics
3. Only import OCR-layer redactions that pass the noise filter
4. Store confidence level: `spatial` (0.9), `ocr_filtered` (0.6), `manual` (1.0)

### 6. Image Analysis Enrichment

38,955 image records from `image_analysis.db` contain:
- Image classification (photo type, content description)
- Face detection results
- OCR text extracted from images
- Location data (where available)

Map to existing `images` table by storage path. Add analysis results to `metadata` JSONB.

## Estimated Import Volume

| Source | Rows | Target Table | Est. Time |
|--------|------|-------------|-----------|
| full_text_corpus.db | ~2.73M pages → ~500K chunks | chunks | 2-4 hrs |
| persons_registry.json | 1,614 | entities | < 1 min |
| knowledge_graph.db entities | 524 | entities (merge) | < 1 min |
| knowledge_graph.db relationships | 2,096 | entity_relationships | < 1 min |
| redaction_analysis_v2.db | ~2.58M → ~50K after filtering | documents.metadata | 30-60 min |
| image_analysis.db | 38,955 | images.metadata | 5-10 min |
| transcripts.db | 375 | audio_chunks | < 1 min |
| Investigation reports | 100+ | investigation_reports | < 1 min |

**Total estimated import time:** 3-5 hours (dominated by OCR text volume)

## Script Architecture

```
scripts/import/
├── import-rhowardstone-ocr.ts      # Phase 1: OCR text → chunks
├── import-rhowardstone-entities.ts  # Phase 2-3: entities + relationships
├── import-rhowardstone-redactions.ts # Phase 4: filtered redaction data
├── import-rhowardstone-media.ts     # Phase 5-6: images + transcripts
├── import-rhowardstone-reports.ts   # Phase 7: investigation reports
└── lib/
    ├── sqlite-reader.ts             # SQLite streaming helper
    ├── efta-mapper.ts               # EFTA page → document_id lookup
    └── noise-filter.ts              # Redaction noise filtering heuristics
```
