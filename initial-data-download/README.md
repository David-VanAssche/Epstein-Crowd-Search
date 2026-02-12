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

## Execution Ordering (Build Plan Integration)

Data ingestion runs as a **parallel track** alongside the main build phases. It does NOT block the build — the platform works at zero data.

**Recommended sequence:**
1. Complete Build Phase 2 (Database) — this creates the shared migrations including `data_sources`, provenance columns, and `flights` table
2. Run Ingest-0 (Setup) + Ingest-1 (Community Data) — immediately after Phase 2
3. Continue Build Phases 3-6 in parallel with ingestion
4. Documents from community ingestion use `processing_status = 'community'` — tells the worker pipeline to skip stages already satisfied by community data

**Dependency on Build Phase 2:**
- The `data_sources` table must exist before ingestion scripts can track source status
- Provenance columns (`ocr_source`, `embedding_model`, `source`) on `documents`, `chunks`, and `entities` tables must exist before inserting community data
- The `flights` table must exist for structured flight log data

**Integration points with worker pipeline (Build Phase 6):**
- Worker OCR stage skips documents where `ocr_source` is set (preserves community OCR, especially s0fskr1p's under-redaction text)
- Worker chunking stage skips documents with existing embedded chunks
- Worker entity extraction skips documents with existing entity mentions
- Worker embedding stage records `embedding_model` and can upgrade community embeddings to target model

See `project/MASTER_PLAN.md` → "Data Ingestion Integration" section for the full parallel track diagram.

## Task Tracking

Each phase has a checklist of tasks. Agents should update task status as they work:
- [ ] = pending
- [x] = completed
- [!] = blocked/failed (note reason)
