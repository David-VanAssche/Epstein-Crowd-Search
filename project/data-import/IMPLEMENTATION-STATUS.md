# Data Import Implementation Status

> Last updated: 2026-02-15

## Executive Summary

We have **259 GiB / 1.53M files** in Supabase Storage and **1.38M document rows** in the database. Reference tables, documents, entities, flights, and relationships have been seeded. The database has **zero chunks** because no community source contains pre-chunked EFTA text — chunks require running the OCR + chunking pipeline on the actual DOJ PDFs.

**Next high-impact work:** Fix API routes (flights, blackbook, datasets, timeline pages query wrong tables), then run OCR/chunking on priority documents to unlock keyword search, entity mentions, and embeddings.

---

## Database State

| Table | Rows | Notes |
|-------|------|-------|
| `datasets` | 12 | All 12 DOJ datasets seeded |
| `data_sources` | 13 | 11 authoritative sources + 2 extra |
| `documents` | 1,380,964 | Parsed from OPT load files across all 12 datasets |
| `entities` | 96 | From epsteininvestigation.org (curated, high-quality) |
| `entity_relationships` | 1,000 | From CSV + co-flight analysis |
| `flights` | 3,416 | 1,708 from epstein-exposed + co-flight pairs |
| `chunks` | **0** | **Blocked** — no pre-chunked EFTA text in storage |
| `entity_mentions` | **0** | **Blocked** — depends on chunks |

---

## What's Been Run

| Script | Result | Date |
|--------|--------|------|
| `seed-datasets.ts` | 12 datasets upserted | 2026-02-15 |
| `seed-sources.ts` | 11 authoritative sources inserted | 2026-02-15 |
| `parse-opt-files.ts` | 1,380,964 documents (idempotent skip — already populated) | 2026-02-15 |
| `import-entities.ts` | 96 entities from epsteininvestigation.org JSONL. epstein-docs had 0 entity JSONs. lmsband SQLite had 0 entity tables. | 2026-02-15 |
| `import-structured.ts` | 1,708 flights from epstein-exposed. Blackbook JSON files were HTML artifacts (0 entities). Emails blocked by document_id NOT NULL. | 2026-02-15 |
| `import-chunks.ts` | **0 chunks** — benbaessler is `HOUSE_OVERSIGHT` data (wrong dataset), svetfm-fbi has only raw PDFs, svetfm-nov11 has only parquet. None match EFTA documents. | 2026-02-15 |
| `import-relationships.ts` | 1,000 relationships from CSV (type mapping fixed: `associate`→`associate_of`, `co-mentioned`→`mentioned_together`, etc.). Co-flight relationships from flights table. | 2026-02-15 |
| `build-entity-mentions.ts` | **Not run** — depends on chunks (0 chunks = 0 possible mentions) | — |

---

## Import Scripts (all in `scripts/import/`)

| Script | Target Table(s) | Status |
|--------|-----------------|--------|
| `seed-datasets.ts` | `datasets` (12 rows) | **DONE** |
| `parse-opt-files.ts` | `documents` (1.38M rows) | **DONE** |
| `seed-sources.ts` | `data_sources` (13 rows) | **DONE** |
| `import-entities.ts` | `entities` (96 rows) | **DONE** |
| `import-structured.ts` | `flights` (3,416 rows) | **DONE** (partial — blackbook/emails failed) |
| `import-chunks.ts` | `chunks` | **BLOCKED** — no matching data |
| `import-relationships.ts` | `entity_relationships` (1,000 rows) | **DONE** |
| `build-entity-mentions.ts` | `entity_mentions` | **BLOCKED** — depends on chunks |

### Data Issues Discovered

1. **Blackbook data is HTML** — `websites/blackbook/*.json` and `.csv` are scraped HTML pages, not actual structured data. Need to re-scrape or find clean source.
2. **benbaessler is wrong dataset** — `HOUSE_OVERSIGHT` documents, not EFTA. 1,500 JSONL files at `packages/backend/data/chunks/` from a different archive.
3. **svetfm has no pre-chunked text** — Only raw PDFs and a 341MB parquet file. The script can't process parquet.
4. **lmsband SQLite has no entity tables** — `epstein_lite.db` tables don't match entity/person/organization patterns.
5. **Emails blocked by NOT NULL** — `emails.document_id` and `structured_data_extractions.document_id` both require document references. Community emails are standalone.

---

## Frontend Feature Impact Matrix

### What Works Now

| Feature | Status | Why |
|---------|--------|-----|
| Pipeline Dashboard | **WORKS** | RPC functions count documents and stages |
| Data Sources Page | **WORKS** | Reads from seeded `data_sources` table |
| Entity List | **WORKS** (partial) | Shows 96 names/types; `mention_count` and `document_count` are 0 |
| Stats Page | **PARTIAL** | Document counts work. Entity/relationship counts show. |

### What's Broken (fixable without LLM)

| Feature | Problem | Fix |
|---------|---------|-----|
| **Keyword Search** | 0 chunks — nothing to search | Need OCR + chunking first |
| **Flights Page** | Queries `structured_data_extractions` WHERE `extraction_type='flight_manifest'` but import writes to `flights` table | Change API route to query `flights` table directly |
| **Black Book** | Queries `structured_data_extractions` WHERE `extraction_type='address_book_entry'` but blackbook data is HTML, not real data | Re-scrape blackbook source OR find clean data |
| **Emails** | `emails.document_id` is NOT NULL; standalone community emails can't be inserted | Make `document_id` nullable or create synthetic document rows |
| **Entity mentions** | `entity_mentions` table is empty — no entity<->document linkage | Depends on chunks existing |
| **Entity counters** | `documents.entity_count` stays at 0 | Depends on entity_mentions |
| **Timeline page** | Page hardcodes `events = []`, never calls its own API | Wire the React component to `/api/timeline` |
| **Datasets page** | Hardcoded static array, never queries DB | Wire to `datasets` table |

### What Requires LLM/OCR Pipeline (can't skip)

| Feature | Required Pipeline Stage | Estimated Cost |
|---------|------------------------|---------------|
| OCR + Chunking | `ocr` + `chunk` | ~$0.003/page (Textract) |
| Semantic/Vector Search | `embed` (Nova 1024d) | ~$5-9 per 100K chunks |
| Date & Type Filters | `classify` | ~$0.0002/page |
| AI Chat (full) | `embed` + `entity_extract` + `relationship_map` | Per-stage costs |
| Document Summaries | `summarize` | ~$0.0003/page |
| Redaction Detection | `redaction_detect` | ~$0.0005/page |
| Criminal Indicators | `criminal_indicators` | ~$0.0008/page |

### Stubs (UI exists, no backend)

| Page | Status |
|------|--------|
| `/map` (Evidence Map) | Hardcoded `locations = []` |
| `/cascade/[id]` (Cascade Replay) | Hardcoded `cascadeData = null` |
| `/bookmarks` | EmptyState only |
| `/pinboard` | UI scaffolding, no API |

---

## Community Enrichment Data Inventory

### OCR Text Coverage

| Source | Documents | Coverage | Quality | Usable? |
|--------|-----------|----------|---------|---------|
| s0fskr1p | ~1,644 merged files | DS1-12 court exhibits | Highest — reveals text under redactions | Needs audit script |
| benbaessler | 1,500 JSONL files | **HOUSE_OVERSIGHT** (not EFTA) | N/A | **NO** — wrong dataset |
| epstein-docs | ~29,525 JSON files | Structured with metadata | Good | UNKNOWN — no entity files found |
| markramm | ~2,915 files | Partial overlap with s0fskr1p | Standard OCR | Not yet inspected |
| svetfm-fbi | Raw PDFs only | Flight logs, evidence lists | N/A | **NO** — no pre-processed text |
| svetfm-nov11 | 1 parquet file (341 MB) | HuggingFace format | Standard | BLOCKED — needs parquet parsing |

### Entity Data

| Source | Count | Format | Usable? |
|--------|-------|--------|---------|
| epsteininvestigation.org | 96 curated entities | JSONL | **IMPORTED** |
| blackbook | 0 (files are HTML artifacts) | HTML (not usable) | **NO** — re-scrape needed |
| lmsband | 0 entity tables found | SQLite | **NO** |

### Structured Data

| Type | Source | Records | Notes |
|------|--------|---------|-------|
| Flights | epstein-exposed | 1,708 | **IMPORTED** |
| Relationships | epsteininvestigation.org | 1,000 | **IMPORTED** (with type mapping fix) |
| Emails | muneeb (HuggingFace) | ~7 files | Blocked by NOT NULL constraint |

---

## Recommended Next Steps (in order)

### Immediate (no cost, maximum impact)

1. **Fix flights API route** — query `flights` table instead of `structured_data_extractions`
2. **Wire datasets page** to `datasets` table instead of hardcoded array
3. **Wire timeline page** to its API endpoint
4. **Re-scrape blackbook** from original source (epstein-exposed or Gawker PDF)
5. **Inspect maxandrews SQLite** (309 MB) — potential goldmine of entities/relationships

### Short-term (requires OCR spend)

6. **Run OCR + chunking on priority documents** (DS1-8, ~70K docs) — this unblocks everything
7. **Build entity_mentions** via text grep once chunks exist
8. **Generate Nova embeddings** for all chunks — enables semantic search + AI chat
9. **Fix emails constraint** — make `document_id` nullable or create synthetic docs

### Medium-term (requires crowdfunding)

10. Run classify stage on priority documents (~$14)
11. Run entity_extract + relationship_map on priority docs (~$125)
12. Run remaining pipeline stages
