# Data Import Pipeline

Bridges raw files in Supabase Storage (`raw-archive/` bucket) into the application database, leveraging community-contributed OCR, chunks, embeddings, and entities where available.

> **Temporary plan**: The full corpus is still being downloaded and uploaded to Storage. This plan covers the sources available so far and will be revisited once the full download completes.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 0](./phase-0-prerequisites.md) | Prerequisites (CLI, migrations, seed data) | Not started |
| [Phase 1](./phase-1-import-framework.md) | Shared import framework (`scripts/import/lib/`) | Not started |
| [Phase 2](./phase-2-source-imports.md) | Per-source import scripts (9 sources) | Not started |
| [Phase 3](./phase-3-embedding.md) | Re-embed all chunks with Nova 1024d | Not started |
| [Phase 4](./phase-4-entity-extraction.md) | Entity extraction across all documents | Not started |
| [Phase 5](./phase-5-post-processing.md) | Post-import pipeline stages + materialized views | Not started |
| [Audit Findings](./AUDIT-FINDINGS.md) | Critical/High/Medium issues to address | Reference |

## Architecture

```
Supabase Storage (raw-archive/)       scripts/import/          Database
  github/s0fskr1p/*.txt        -->  import-s0fskr1p.ts   -->  documents + chunks
  github/benbaessler/*.txt      -->  import-benbaessler.ts -->  documents + chunks
  github/epstein-docs/*.json    -->  import-epstein-docs.ts -> documents + chunks
  huggingface/svetfm-*/*.parquet -> import-svetfm.ts      -->  documents + chunks
  github/maxandrews/*.sqlite    -->  import-entity-dbs.ts  -->  entities + relationships
  github/lmsband/*.sqlite       -->  import-entity-dbs.ts  -->  entities + relationships
  github/markramm/*.txt         -->  import-markramm.ts    -->  documents + chunks
  github/muneeb-emails/*.json   -->  import-emails.ts      -->  documents + emails
  github/blackbook/*.csv        -->  import-structured.ts  -->  entities + flights
  doj/dataset-*/*.pdf           -->  import-raw-pdfs.ts    -->  documents (metadata only)
  kaggle/jazivxt/*.pdf          -->  import-raw-pdfs.ts    -->  documents (metadata only)
```

## Key Constraints

- **Supabase Pro plan**: 8GB database limit (~5.5-6.5GB estimated with TOAST + HNSW index overhead)
- **Raw PDFs not stored in DB**: Only metadata registered; content stays in Storage
- **Embeddings**: All re-embedded with Amazon Nova 1024d (unified text/image/video space)
- **Entity dedup**: `UNIQUE(name_normalized, entity_type)` constraint on `entities` table
- **Idempotent**: All scripts can be safely re-run (upsert/skip patterns)

## Storage Inventory

| Source | Files | Size | Type | Import Priority |
|--------|------:|-----:|------|:---------------:|
| kaggle-jazivxt | 26,066 | 36.7GB | Raw PDFs | 9 (register only) |
| doj-dataset-8 | 11,036 | 10.7GB | Raw PDFs | 9 (register only) |
| zenodo | 3,955 | 4.1GB | Mixed | 9 |
| s0fskr1p | 1,644 | 4.0GB | OCR text | **1** |
| svetfm-fbi | 133 | 2.4GB | Chunks+embeddings | 4 |
| doj-dataset-1 | 3,163 | 1.2GB | Raw PDFs | 9 |
| svetfm-nov11 | 7 | 341MB | Chunks+embeddings | 4 |
| maxandrews | 29,823 | 309MB | SQLite entities | 5 |
| benbaessler | 23,225 | 146MB | Pre-chunked text | **2** |
| epstein-docs | 29,525 | 137MB | JSON documents | **3** |
| markramm | 2,915 | 54MB | OCR text | 6 |
| lmsband | 21 | 29MB | SQLite entities | 5 |
| muneeb-emails | 7 | 4.4MB | Email threads | 7 |
| blackbook | 6 | 0.1MB | Contact CSV | 8 |
| archive-flights | 1 | 0.2MB | Flight logs | 8 |

## Supabase Project

- **Project ID**: `evcxibwuuhvvkrplazyk`
- **URL**: Set in `NEXT_PUBLIC_SUPABASE_URL` env var
- **Storage bucket**: `raw-archive`
