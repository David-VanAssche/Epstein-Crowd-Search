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

## Task Tracking

Each phase has a checklist of tasks. Agents should update task status as they work:
- [ ] = pending
- [x] = completed
- [!] = blocked/failed (note reason)
