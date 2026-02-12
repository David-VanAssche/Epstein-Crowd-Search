# The Epstein Archive — Master Plan

> **Purpose:** Single source of truth for the multi-phase build. Any Claude agent picks up here.

## Project Overview

A production-ready, open-source (MIT) multimodal RAG platform for searching 3.5M pages of Epstein files (DOJ release). Features include AI-powered semantic search, crowdsourced redaction solving, entity relationship mapping, timeline reconstruction, video/audio transcript search, collaborative annotations, investigation threads, geographic mapping, and a chat interface with cited sources.

The platform is designed to maximize community participation in consuming evidence and contributing to unredaction through familiar UI metaphors, gamification, daily challenges, guided investigations, and collaborative research tools.

**Repository:** `EpsteinCrowdResearch`
**Domain (placeholder):** `EpsteinArchive.org`
**License:** MIT
**Package Manager:** pnpm (strictly — never npm/yarn)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase (PostgreSQL 15 + pgvector, Auth, Storage, Edge Functions) |
| Worker | Node.js 20+ standalone pipeline (Express + BullMQ/polling) |
| Search | pgvector (cosine) + pg_trgm + tsvector (BM25) + RRF fusion |
| Embeddings | Amazon Nova Multimodal Embeddings v1 (1024d unified text/image/video/audio via AWS Bedrock) |
| OCR | Google Cloud Document AI |
| Reranking | Cohere rerank-english-v3.0 |
| Chat LLM | Gemini 2.0 Flash (free tier), Claude Sonnet/Opus (paid tier) |
| Auth | Supabase Auth (email + OAuth via Google/GitHub) |
| Deployment | Vercel (frontend), Supabase (DB/auth/storage), Cloud Run (worker) |

## Key Decisions

- **AI providers use abstract interfaces** — factory pattern in `lib/ai/` allows swapping providers (Fireworks.ai, x.ai, etc.) without changing consuming code
- **Gamification deferred to Phase 10** (v2) — database tables created in Phase 2 but UI/logic built last
- **Funding/domain not yet live** — placeholder URLs throughout
- **Supabase project:** "Epstein-Crowd-Research" org, free tier, East US, RLS enabled
- **Dark theme only** — no light mode for v1
- **Every search result must cite source document + page number**

## Build Sequence — Interleaved Build + Data + Test

The build is a single interleaved sequence where each step includes building features, importing specific data, and testing against that real data. No "build everything first, add data later" — bugs are caught immediately.

### Summary Table

| Step | Build | Data Loaded | Primary Test |
|------|-------|-------------|--------------|
| 0 | — | Archive Tsardoz (Feb 15 deadline) | Clone is complete and intact |
| 1 | Phase 1 (Foundation) + Supabase Pro setup | Empty buckets created | `pnpm build` passes, Supabase connects |
| 2 | Phase 2 (Database) + seed reference data | 24 `data_sources` rows, 13 `datasets` rows | Migrations applied, RLS correct, types compile |
| 3 | Python ingest scripts | OCR text (s0fskr1p, tensonaut, markramm): ~28K docs, ~5GB | Text in storage, document rows deduplicated |
| 4 | Parquet/ChromaDB ingest scripts | Chunks + embeddings (svetfm x2, benbaessler): 305K+ chunks | Vector search works, tsvector populated, no orphans |
| 5 | SQLite/JSON ingest + dedup engine | Entities (LMSBAND, epstein-docs, ErikVeland, maxandrews): 86K+ entities | Single entity per person, mentions link to documents |
| 6 | CSV/text parsing scripts | Structured data (black book, emails, Kaggle, flight logs) | Flights queryable, email entities linked |
| 7 | Phase 3 (Core UI) + Phase 4 (Backend API) | — (refresh materialized views) | Search returns real results with working citations |
| 8 | ZIP streaming module | DOJ Datasets 5+6 (~112MB PDFs) | PDFs merge with existing OCR rows, not duplicate |
| 9 | Phase 5 (Interactive Features) | — | Chat cites real docs, annotations persist |
| 10 | Phase 6 (Worker Pipeline) | — (process Step 8 PDFs) | Skip logic preserves community data |
| 11 | — | DOJ Datasets 1-4, 7, 8, 12 (~13GB PDFs) | All ZIPs uploaded, document counts match |
| 12 | Phase 7 (Funding/Stats) | — | Coverage heatmap accurate, stats reflect real data |
| 13 | Phase 8 (Visualization) | — | Graph renders 86K entities, map has real markers |
| 14 | Scraper + torrent handler | Datasets 9-11 + House Oversight (~200GB) | Pipeline runs at scale, cost tracking works |
| 15 | Verification scripts | Master index cross-reference | No missing docs, coverage report generated |
| 16 | Phase 9 (Polish/Deploy) | — | Lighthouse 90+, rate limits work, production live |
| 17 | Phase 10 (Gamification) | — | XP awards, leaderboard updates, achievements unlock |
| 18 | — | — (refresh all views) | Full end-to-end acceptance across all user journeys |

### Dependency Chain

```
Step 0 (archive Tsardoz) — independent, do immediately
Step 1 (Foundation + Supabase) → Step 2 (Database + seeds)
  → Step 3 (OCR text import) → Step 4 (chunks + embeddings) → Step 5 (entities) → Step 6 (structured data)
    → Step 7 (Core UI + API — tested against real data)
      → Step 8 (DOJ ZIP test) → Step 9 (Interactive Features) → Step 10 (Worker Pipeline)
        → Step 11 (Full DOJ upload) → Step 12 (Funding/Stats) → Step 13 (Visualization)
          → Step 14 (Large-scale ingestion) → Step 15 (Verification) → Step 16 (Deploy) → Step 17 (Gamification) → Step 18 (Final acceptance)

Parallel: Steps 3-4 can run concurrently with Steps 5-6 if two engineers available
```

### Key Design Principles

1. **Build a feature, import its data, test immediately** — no empty-state-only development
2. **Data import IS the test** — vector dimension mismatches, dedup failures, foreign key violations surface on import, not months later
3. **Worker pipeline tests against community data** — skip logic can only be validated when documents already have OCR/chunks/entities
4. **Smallest data first** — markramm (2,895 files) before s0fskr1p (5GB), svetfm/nov11 (69K) before svetfm/fbi (236K)
5. **Search is the E2E MVP** — Step 7 is the first time a user can search, see results, and click into a real document

### Data Import → Feature Testing Map

| Data Source | Step | Features It Unlocks | Test |
|---|---|---|---|
| markramm (2,895 .txt) | 3 | Keyword search, Document viewer, OCR skip | Search "subpoena" → results with highlights |
| svetfm/nov11 (69K chunks) | 4 | Semantic search, Chat (RAG), Chunk skip | Vector query "travel arrangements" → semantic matches |
| epsteinsblackbook (1,971 CSV) | 6 | Entity profiles, Flight explorer, Map, Timeline | Filter aircraft "N908JE" → flight list |
| LMSBAND (835MB SQLite) | 5 | Entity graph (D3), Entity skip | Epstein node → connected entities render |
| notesbymuneeb (5,082 threads) | 6 | Email thread view, Timeline | Open thread → chronological email view |
| s0fskr1p (5GB OCR) | 3 | Redaction dashboard, Under-redaction text | View redaction → highlighted region with hidden text |
| DOJ ZIPs (13GB) | 8, 11 | PDF viewer, Worker pipeline at scale | PDFs merge with community OCR rows |

### Highest-Risk Integration Points

1. **Chunk-to-document mapping (Step 4)** — Community data identifies documents by filename; the database uses UUIDs. If the mapping is wrong, every citation in the application is broken.
2. **Worker skip logic (Step 10)** — If the pipeline overwrites community data, thousands of dollars of free processing are destroyed. Can only be tested with community data already present.
3. **Entity deduplication (Step 5)** — 86K entities from 4 sources with name variations ("Ghislaine Maxwell" / "GHISLAINE MAXWELL" / "G. Maxwell"). The `name_normalized` + `pg_trgm` approach gets its first real test.

### Key Reconciliation Decisions

1. **Unified embedding model**: All embeddings use Amazon Nova Multimodal Embeddings v1 (1024d) via AWS Bedrock. One model, one vector space for text, images, video, and audio. Community data (nomic-embed-text 768d) is re-embedded with Nova during Phase 6 pipeline processing (~$19 for 365K chunks). The `embedding_model` column tracks which model was used; the pipeline re-embeds any chunk where `embedding_model !== TARGET_MODEL`. Cross-modal search works natively — a text query matches documents, images, video frames, and audio in a single cosine similarity pass.
2. **Entity deduplication**: `name_normalized` column catches case/whitespace/title differences at ingest time. `pg_trgm` batch job merges similar entities post-ingest. Pipeline embedding-based dedup handles semantic matches.
3. **HNSW over IVFFlat**: IVFFlat on empty tables creates degenerate indexes. HNSW works at any table size. Can switch back after data loads if memory is tight.
4. **Worker skip logic**: Pipeline stages check document state before running. Community OCR (especially s0fskr1p's under-redaction text) is never overwritten. Community chunks with embeddings are never deleted.

## File Counts by Phase

| Phase | Estimated Files |
|---|---|
| 1 | ~25 (scaffold, config, shared components, CI/CD) |
| 2 | ~25 (18 migrations + 3 clients + 6 type files) |
| 3 | ~35 (10 pages + 20 components + 5 hooks) |
| 4 | ~35 (AI abstractions + search lib + 20 API routes + middleware) |
| 5 | ~35 (chat + redaction + contribution + annotations + investigation threads) |
| 6 | ~35 (worker scaffold + 12 services + chatbot + audio + scripts) |
| 7 | ~20 (funding + stats + coverage heatmap + daily features) |
| 8 | ~20 (graph + timeline + cascade + map + pinboard) |
| 9 | ~25 (loading states + tests + deploy config + SEO + safety) |
| 10 | ~20 (gamification + leaderboard + achievements + bounties) |
| **Total** | **~275 files** |

## Directory Structure Summary

```
epstein-archive/
├── .github/workflows/          # CI/CD
├── app/                        # Next.js App Router
│   ├── (public)/              # No auth required (search, entity, graph, etc.)
│   ├── (auth)/                # Auth required (contribute, proposals, profile)
│   ├── (researcher)/          # Researcher tier (export, API docs)
│   ├── api/                   # API routes
│   └── login/                 # Login page
├── components/                 # React components
│   ├── layout/                # Header, Footer, Sidebar
│   ├── search/                # Search bar, results, filters
│   ├── chat/                  # Chat panel, messages, FAB
│   ├── document/              # Document viewer, metadata
│   ├── entity/                # Entity cards, profiles
│   ├── graph/                 # D3 relationship graph
│   ├── timeline/              # Timeline components
│   ├── redaction/             # Redaction dashboard, proposals
│   ├── stats/                 # Processing progress, stats
│   ├── funding/               # Funding tracker, impact calc
│   ├── contribute/            # Contribution hub, forms
│   ├── gamification/          # Leaderboard, achievements, XP
│   ├── ui/                    # shadcn/ui (auto-generated)
│   └── shared/                # EmptyState, LoadingState, ErrorBoundary
├── lib/
│   ├── supabase/              # Client, server, admin Supabase clients
│   ├── ai/                    # Abstract AI provider interfaces + factories
│   ├── search/                # Hybrid, multimodal, entity search
│   ├── chat/                  # Chat service, streaming utils
│   ├── utils/                 # Citations, dates, storage
│   └── hooks/                 # useSearch, useChat, useEntity, useRedaction
├── worker/                    # Standalone Node.js pipeline
│   └── src/
│       ├── pipeline/          # Orchestrator, job queue, stages
│       ├── services/          # OCR, chunking, embedding, entity extraction
│       ├── chatbot/           # Chat orchestrator + 8 tools
│       └── api/               # Express chat route
├── scripts/                   # Download, seed, ingest, cost estimation
├── supabase/migrations/       # 15 SQL migrations
├── types/                     # TypeScript type definitions
└── public/                    # Static assets
```

## Design System

**Theme:** Dark, Serious, Investigative

| Token | Value | Usage |
|---|---|---|
| Background | `#0a0a0f` | Page backgrounds |
| Surface | `#12121a` | Cards, panels |
| Surface Elevated | `#1a1a2e` | Hover states, modals |
| Border | `#2a2a3e` | Subtle borders |
| Border Accent | `#3a3a5e` | Active/focus borders |
| Text Primary | `#e4e4e7` | Main text (zinc-200) |
| Text Secondary | `#a1a1aa` | Secondary text (zinc-400) |
| Text Muted | `#71717a` | Muted text (zinc-500) |
| Accent | `#dc2626` | Redaction highlights, primary actions (red-600) |
| Info | `#3b82f6` | Entity links (blue-500) |
| Success | `#22c55e` | Solved redactions (green-500) |
| Warning | `#f59e0b` | Pending/proposed (amber-500) |

**Typography:** Inter (headings/body), JetBrains Mono (document content, code, citations)

## Database Schema

15 migrations in `supabase/migrations/`:

1. **Extensions** — pgvector, pg_trgm, uuid-ossp
2. **Core tables** — datasets, documents, chunks, images, videos, video_chunks, processing_jobs
3. **Entity tables** — entities, entity_mentions, entity_relationships
4. **Redaction tables** — redactions, redaction_proposals, user_profiles, proposal_votes
5. **Timeline tables** — timeline_events
6. **User tables** — saved_searches, bookmarks, chat_conversations
7. **Search functions** — hybrid_search_chunks_rrf, multimodal_search_rrf, find_similar_redactions
8. **Entity functions** — entity connection graph, entity search, mention aggregation
9. **Redaction functions** — solvable feed, cascade tree, stats, confidence scoring
10. **Indexes** — All vector (ivfflat), GIN, B-tree indexes
11. **RLS policies** — Public read, auth write, service role for worker
12. **Stats views** — corpus_stats materialized view
13. **Funding tables** — funding_status, processing_spend_log, donation_impact_tiers
14. **Contribution tables** — image_match_submissions, intelligence_hints, contribution_activity
15. **Gamification tables** — achievements, user_achievements, xp_transactions, weekly_leaderboard view

## Crowdsourced Research Philosophy

The platform is designed around maximizing community contribution at every level:

### Discovery Mechanisms
- **Random Document** button — surface overlooked evidence through serendipity
- **"This Day in the Files"** — daily hook showing documents from today's date in history
- **Daily Challenge** — featured high-cascade-potential redaction rotated daily
- **Corpus Coverage Heatmap** — shows under-researched areas to direct attention
- **Smart Priority Queue** — AI-ranked "needs eyes" feed for high-value unreviewed documents
- **"More Like This"** — semantic similarity to find related documents

### Collaborative Tools
- **Annotations** — per-paragraph margin notes on documents, visible to all, upvotable
- **Investigation Threads** — collaborative case files bundling documents, entities, and findings
- **Evidence Pinboard** — drag-and-drop canvas for building visual connection maps
- **OCR Correction** — side-by-side original scan + OCR text for crowdsourced fixes
- **Entity Disambiguation** — community voting to merge/split ambiguous entity records
- **Photo Identification** — "Who's in this photo?" crowdsourced tagging

### Content-Type Specific Views
- **Photo Gallery** — Google Photos-style grid with filtering and lightbox
- **Flight Log Explorer** — structured table view with passenger filtering
- **Audio Player** — Spotify-style interface for court recordings and depositions
- **Document Comparison** — side-by-side diff view for comparing document versions

### Engagement & Retention
- **Guided Investigations** — tutorial missions that teach the platform through real research tasks
- **Research Bounties** — targeted requests for investigation on specific entities or questions
- **Notification Center** — alerts for proposals, annotations, saved search matches
- **Saved Search Alerts** — email/in-app notifications when new matching documents are processed
- **Shareable Discovery Cards** — social media cards for confirmed findings

### Trust & Verification
- **Source Provenance Chain** — full audit trail for every data point
- **Fact Registry** — verified facts with supporting evidence and confidence levels
- **Content Sensitivity Warnings** — configurable warnings for disturbing content
- **Anti-Disinformation Safeguards** — rate limits, minimum account age, coordinated voting detection

## Agent Onboarding Protocol

Any new Claude agent working on this project:

1. Read `CLAUDE.md` — project-level instructions
2. Read `project/MASTER_PLAN.md` (this file) — overall architecture
3. Read the relevant `project/phase-NN-*.md` — current phase checklist
4. Read `project/CONVENTIONS.md` — coding standards
5. Read `project/AI_PROVIDER_INTERFACES.md` — if working on AI integration
6. Mark checklist items `- [x]` when complete
7. Leave `<!-- NOTE: reason -->` HTML comments if something is incomplete or deferred

## Prosecutorial Goal

A core objective of this platform is to **identify crimes, identify perpetrators, and prepare the evidence so prosecutors can act on it**. Every feature should move toward this goal:

- **Entity dossiers** auto-compile all evidence for a person into a prosecutor-ready brief with full citations
- **Criminal activity indicator scoring** flags documents and entities with patterns suggesting trafficking, obstruction, conspiracy, and financial crimes
- **Evidence chain tracking** maintains source provenance for every data point so findings are admissible
- **Prosecutor dashboard** provides a dedicated interface for law enforcement with exportable evidence packages
- **Investigation threads** allow researchers to build collaborative case files that prosecutors can follow
- **Fact registry** maintains a verified-fact database with community confidence levels
- The platform does "most of the work" so that prosecutors can focus on legal strategy rather than evidence discovery

## Critical Requirements

- Every search result **must** include a citation linking to source document + page number
- Dark theme throughout — no light mode for v1
- Mobile responsive — search and chat must work on phones
- Source code link in footer pointing to GitHub repo
- GoFundMe/donation link visible on every page
- No hallucination in chat — must say "I don't have information about that" when unsure
- Processing progress visible globally
- MIT License present from start
- pnpm as package manager (not npm)
- Funding transparency — every dollar spent is logged publicly
- Contribution attribution — solver's username permanently credited on solved redactions
- Shareable impact — cascade replays and profiles have OpenGraph meta tags

## Environment Variables

See `.env.example` for the complete list. Key categories:
- Supabase (URL, anon key, service role key)
- AWS Bedrock (region, access key, secret key — for Nova embeddings)
- Google Cloud (Document AI for OCR)
- Cohere (reranking)
- Chat LLMs (Gemini, Anthropic)
- Application (site URL, GoFundMe URL)
- Worker (concurrency, port, Redis)
- Funding (GoFundMe widget URL, admin secret)

## Monetization (Future — Infrastructure Only)

| Tier | Price | Features |
|---|---|---|
| Free | $0 | 20 chat/day (Gemini Flash), unlimited search |
| Researcher | $9/mo | Unlimited chat (Gemini Flash), bulk export, API |
| Pro | $29/mo | Claude-powered chat, advanced analytics |

Build tier infrastructure (model routing, rate limiting) but don't implement payments yet.
