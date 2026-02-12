# Initial Data Download

Multi-phase project to ingest all Epstein documents into Supabase from 24 community and official sources. Maximizes free community-processed data (OCR, embeddings, entities) before spending on additional processing.

## Goal

Get all docs/images/videos into Supabase Storage, organized by dataset, with as much community-sourced processing (OCR text, embeddings, entities) pre-loaded — ready for our ingestion pipeline once funding is available.

## Phase Summary

| Phase | What | Where | Time | Cost |
|-------|------|-------|------|------|
| **0: Setup** | Supabase Pro, buckets, migrations, env | Local | ~30 min | $25/mo subscription |
| **1: Community Data** | OCR text, embeddings, entities, structured data from 16 free sources | Local | ~2-4 hours | $0 |
| **2: Validate Pipeline** | Test DOJ ZIP streaming with Datasets 5+6 (~112MB) | Local | ~1 hour | $0 |
| **3: DOJ ZIPs** | Stream all ZIP-based datasets (1-8, 12) ~13GB | Cloud VM | ~4-8 hours | ~$3 |
| **4: Scrape + Torrents** | Datasets 9-11 via scraping + torrents ~200GB | Cloud VM | ~3-7 days | ~$9 |
| **5: Verification** | Cross-reference all sources, coverage report | Local | ~1 hour | $0 |

**After Phase 1 alone:** Search works on ~300K pre-embedded chunks, entity graph has 86K+ entries, flight logs and emails are queryable. Users see real data immediately.

**Total cost:** ~$37 one-time (VM) + $28/mo ongoing (Supabase Pro + storage)
**Processing saved:** ~$2,000-5,000 in OCR + embedding costs by using community data

## What Users See After Ingestion

- **Stats page:** "X of 3.5M pages OCR'd", "Y entities extracted", "Z documents with embeddings"
- **Coverage map:** Which datasets are fully processed vs. need community help
- **Known gaps:** 2,000 videos untranscribed, 180K images unclassified, overlay redactions unsolved
- **Search works immediately** on ~300K pre-embedded chunks from Phase 1

## Prerequisites

- Supabase account (will upgrade to Pro tier in Phase 0)
- Google Cloud account (for VM in Phases 3-4)
- Python 3.11+
- Git

## Execution Ordering (Interleaved with Build)

Data ingestion is **woven into the build sequence**, not a parallel track. Each data source is imported at the specific build step where it provides maximum testing value.

### When Each Ingestion Phase Runs

| Ingestion Phase | Build Step | What Happens |
|---|---|---|
| **Ingest-0 (Setup)** | Step 1-2 | Supabase Pro, buckets, migrations, seed `data_sources` + `datasets` tables |
| **Ingest-1.1-1.3 (OCR text)** | Step 3 | Import s0fskr1p, tensonaut, markramm → enables keyword search testing |
| **Ingest-1.4-1.5, 1.10 (Chunks)** | Step 4 | Import svetfm embeddings, benbaessler chunks → enables semantic search testing |
| **Ingest-1.6-1.9 (Entities)** | Step 5 | Import LMSBAND, epstein-docs, ErikVeland, maxandrews → enables entity graph testing |
| **Ingest-1.11-1.14 (Structured)** | Step 6 | Import black book, emails, Kaggle, flight logs → enables flight/email/timeline testing |
| **Ingest-1.15 (Tsardoz)** | Step 0 | **URGENT** — Archive before Feb 15, 2026 shutdown. Independent of all other steps. |
| **Ingest-2 (DOJ test)** | Step 8 | Stream Datasets 5+6 ZIPs → validates PDF-to-community-data merge logic |
| **Ingest-3 (DOJ full)** | Step 11 | Stream all remaining DOJ ZIPs (~13GB) |
| **Ingest-4 (Scrape+Torrents)** | Step 14 | Datasets 9-11 + House Oversight (~200GB) → production scale test |
| **Ingest-5 (Verification)** | Step 15 | Cross-reference master index, generate coverage report |

### Why Interleaved (Not Parallel)

The original plan ran data ingestion as a parallel track: "the platform works at zero data." This was safe but missed critical bugs:

- **Search quality** — Building search against empty tables means you don't discover that community embeddings produce lower-quality results until weeks later
- **Citation integrity** — The chunk-to-document UUID mapping only gets tested when real chunks reference real documents
- **Worker skip logic** — The pipeline can only prove it won't destroy community data if community data is already present
- **Entity dedup** — 86K entities from 4 sources with name variations can only be tested with real data

The interleaved approach catches these bugs at import time, not deployment time.

### Dependencies on Build Steps

- Steps 1-2 (Foundation + Database) must complete before ANY data import
- The `data_sources` table must exist before ingestion scripts can track source status
- Provenance columns (`ocr_source`, `embedding_model`, `source`) must exist before inserting community data
- The `flights` table must exist before importing structured flight log data
- Steps 3-6 (all community data) must complete before Step 7 (UI + API) to enable real-data testing

### Integration Points with Worker Pipeline (Build Step 10)

- Worker OCR stage skips documents where `ocr_text` exists (preserves community OCR, especially s0fskr1p's under-redaction text)
- Worker chunking stage skips documents with existing embedded chunks (advisory lock prevents TOCTOU race condition)
- Worker entity extraction skips documents with existing entity mentions (unique index prevents duplicates)
- Worker embedding stage records `embedding_model` and can upgrade community embeddings to target model

See `project/MASTER_PLAN.md` → "Build Sequence" section for the full interleaved plan.

## Task Tracking

Each phase has a checklist of tasks. Agents should update task status as they work:
- [ ] = pending
- [x] = completed
- [!] = blocked/failed (note reason)
