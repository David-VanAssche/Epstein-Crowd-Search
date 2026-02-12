# The Epstein Archive — Full Project Scaffold Prompt

> Copy everything below this line into a fresh Claude Code session.

---

## Project: The Epstein Archive (EpsteinArchive.org)

Build a complete, production-ready, open-source (MIT license) multimodal RAG platform for searching the 3.5 million pages of Epstein files released by the U.S. Department of Justice. The platform includes AI-powered semantic search, a crowdsourced redaction-solving engine, entity relationship mapping, timeline reconstruction, video transcript search, and a chat interface for asking natural-language questions with cited sources.

**This is a full scaffold — build everything in one session.** Create the repo, all directories, database schema, frontend pages, backend services, worker pipeline, and configuration. The system should be deployable (Vercel + Supabase) with "empty state" UI that works before data is processed, plus a seed data pipeline for ~$200 worth of sample document processing.

---

## 1. TECH STACK

```
Frontend:      Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui
Backend:       Supabase (PostgreSQL 15 + pgvector, Auth, Storage, Edge Functions)
Worker:        Node.js 20+ document processing pipeline (standalone process)
Search:        pgvector (cosine similarity) + pg_trgm + tsvector (BM25) + RRF fusion
Embeddings:    Google Vertex AI text-embedding-004 (768d text), multimodalembedding@001 (1408d images)
OCR:           Google Cloud Document AI
Reranking:     Cohere rerank-english-v3.0
Chat LLM:      Gemini 2.0 Flash (free tier), Claude Sonnet/Opus (paid tier)
Auth:          Supabase Auth (email + OAuth via Google/GitHub)
Deployment:    Vercel (frontend), Supabase (DB/auth/storage), Cloud Run (worker)
License:       MIT
```

---

## 2. DIRECTORY STRUCTURE

Create this exact structure:

```
epstein-archive/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                          # TypeScript check, lint, test
│   │   └── deploy.yml                      # Vercel preview + production
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── app/                                     # Next.js App Router
│   ├── layout.tsx                           # Root layout (dark theme, fonts)
│   ├── page.tsx                             # Landing/home page
│   ├── globals.css                          # Tailwind + custom dark theme
│   ├── (public)/                            # No auth required
│   │   ├── search/
│   │   │   └── page.tsx                     # Main search interface
│   │   ├── document/[id]/
│   │   │   └── page.tsx                     # Document viewer with page navigation
│   │   ├── entity/[id]/
│   │   │   └── page.tsx                     # Entity profile (person/org/location)
│   │   ├── entities/
│   │   │   └── page.tsx                     # Entity directory/browser
│   │   ├── timeline/
│   │   │   └── page.tsx                     # Interactive timeline view
│   │   ├── datasets/
│   │   │   └── page.tsx                     # Browse 12 DOJ datasets
│   │   ├── graph/
│   │   │   └── page.tsx                     # Entity relationship graph visualization
│   │   ├── redactions/
│   │   │   └── page.tsx                     # Redaction puzzle dashboard (public view)
│   │   ├── stats/
│   │   │   └── page.tsx                     # Corpus statistics and processing progress
│   │   ├── funding/
│   │   │   └── page.tsx                     # Live funding tracker + donation impact page
│   │   ├── leaderboard/
│   │   │   └── page.tsx                     # Gamification leaderboard (all-time + weekly)
│   │   ├── cascade/[id]/
│   │   │   └── page.tsx                     # Animated cascade replay for a solved redaction
│   │   ├── achievements/
│   │   │   └── page.tsx                     # All available achievements (earned + locked)
│   │   └── about/
│   │       └── page.tsx                     # About, methodology, FAQ
│   ├── (auth)/                              # Auth required
│   │   ├── contribute/
│   │   │   ├── page.tsx                     # Contribution hub (choose contribution type)
│   │   │   ├── unredact/
│   │   │   │   └── page.tsx                 # Direct unredaction (specific redaction)
│   │   │   ├── image-match/
│   │   │   │   └── page.tsx                 # Submit known image to match redacted one
│   │   │   └── intelligence/
│   │   │       └── page.tsx                 # Submit general intelligence hints
│   │   ├── proposals/
│   │   │   └── page.tsx                     # Review/vote on proposals
│   │   ├── profile/
│   │   │   └── page.tsx                     # User profile, reputation, contributions
│   │   └── saved/
│   │       └── page.tsx                     # Saved searches and bookmarks
│   ├── (researcher)/                        # Researcher tier (future)
│   │   ├── export/
│   │   │   └── page.tsx                     # Bulk data export
│   │   └── api-docs/
│   │       └── page.tsx                     # API documentation
│   ├── api/
│   │   ├── search/
│   │   │   └── route.ts                     # Hybrid search endpoint
│   │   ├── search/multimodal/
│   │   │   └── route.ts                     # Cross-modal search (text→images, etc.)
│   │   ├── chat/
│   │   │   └── route.ts                     # Chat/Q&A endpoint (streaming SSE)
│   │   ├── entity/[id]/
│   │   │   └── route.ts                     # Entity details + connections
│   │   ├── entity/[id]/connections/
│   │   │   └── route.ts                     # Entity relationship graph data
│   │   ├── timeline/
│   │   │   └── route.ts                     # Timeline events query
│   │   ├── document/[id]/
│   │   │   └── route.ts                     # Document metadata + chunks
│   │   ├── redaction/[id]/propose/
│   │   │   └── route.ts                     # Submit redaction proposal (auth required)
│   │   ├── redaction/[id]/vote/
│   │   │   └── route.ts                     # Vote on proposal (auth required)
│   │   ├── redactions/dashboard/
│   │   │   └── route.ts                     # Redaction stats + leaderboard
│   │   ├── redactions/solvable/
│   │   │   └── route.ts                     # "Almost solvable" feed
│   │   ├── contribute/image-match/
│   │   │   └── route.ts                     # Image upload + visual similarity match
│   │   ├── contribute/intelligence/
│   │   │   └── route.ts                     # Submit intelligence hint
│   │   ├── contribute/unredact/
│   │   │   └── route.ts                     # Direct unredaction submission
│   │   ├── funding/
│   │   │   ├── status/
│   │   │   │   └── route.ts                 # Live funding status (GoFundMe proxy + cache)
│   │   │   ├── impact/
│   │   │   │   └── route.ts                 # Calculate donation impact for any amount
│   │   │   └── spend-log/
│   │   │       └── route.ts                 # Public transparency log of processing spend
│   │   ├── gamification/
│   │   │   ├── leaderboard/
│   │   │   │   └── route.ts                 # Global + weekly leaderboards
│   │   │   ├── achievements/
│   │   │   │   └── route.ts                 # User achievements/badges
│   │   │   └── cascade-replay/[id]/
│   │   │       └── route.ts                 # Replay a cascade chain (animated)
│   │   ├── stats/
│   │   │   └── route.ts                     # Corpus processing stats
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts                 # Supabase auth callback
│   └── login/
│       └── page.tsx                         # Login page
├── components/
│   ├── layout/
│   │   ├── Header.tsx                       # Top nav (logo, search bar, auth)
│   │   ├── Footer.tsx                       # Footer (about, GitHub, GoFundMe link)
│   │   └── Sidebar.tsx                      # Filters sidebar for search
│   ├── search/
│   │   ├── SearchBar.tsx                    # Main search input with suggestions
│   │   ├── SearchResults.tsx                # Result cards with citations
│   │   ├── SearchFilters.tsx                # Date, dataset, doc type, entity filters
│   │   ├── ResultCard.tsx                   # Individual search result
│   │   ├── ImageResult.tsx                  # Image search result with preview
│   │   └── VideoResult.tsx                  # Video transcript result
│   ├── chat/
│   │   ├── ChatPanel.tsx                    # Slide-out chat drawer
│   │   ├── ChatMessage.tsx                  # Message bubble with citations
│   │   ├── ChatInput.tsx                    # Input with send button
│   │   ├── SourceCitation.tsx               # Clickable source reference
│   │   └── ChatFAB.tsx                      # Floating "Ask a question" button
│   ├── document/
│   │   ├── DocumentViewer.tsx               # PDF/image viewer with page nav
│   │   ├── DocumentMetadata.tsx             # Metadata sidebar (date, type, dataset)
│   │   ├── RedactionHighlight.tsx           # Highlight redacted areas
│   │   ├── ChunkNavigator.tsx               # Navigate between relevant chunks
│   │   └── RelatedDocuments.tsx             # Similar documents panel
│   ├── entity/
│   │   ├── EntityCard.tsx                   # Person/org/location card
│   │   ├── EntityProfile.tsx                # Full entity page content
│   │   ├── EntityTimeline.tsx               # Timeline of entity mentions
│   │   ├── EntityConnections.tsx            # Relationship graph for one entity
│   │   └── EntityMentions.tsx               # All document mentions
│   ├── graph/
│   │   ├── RelationshipGraph.tsx            # D3/vis.js force-directed graph
│   │   ├── GraphControls.tsx                # Zoom, filter, highlight controls
│   │   └── GraphTooltip.tsx                 # Hover card for nodes/edges
│   ├── timeline/
│   │   ├── TimelineView.tsx                 # Vertical scrolling timeline
│   │   ├── TimelineEvent.tsx                # Individual event card
│   │   └── TimelineFilters.tsx              # Filter by entity, date, event type
│   ├── redaction/
│   │   ├── RedactionDashboard.tsx           # Global progress + stats
│   │   ├── RedactionCard.tsx                # Individual redaction puzzle card
│   │   ├── ProposalForm.tsx                 # Submit a proposal with evidence
│   │   ├── ProposalVoting.tsx               # Vote/corroborate on proposals
│   │   ├── CascadeTree.tsx                  # Visualization of cascade chains
│   │   ├── SolvableFeed.tsx                 # "Highest impact unsolved" feed
│   │   └── UserReputation.tsx               # Reputation badge/score display
│   ├── stats/
│   │   ├── ProcessingProgress.tsx           # Processing progress bars
│   │   ├── CorpusStats.tsx                  # Total docs, chunks, entities
│   │   └── FundingProgress.tsx              # GoFundMe integration/progress
│   ├── funding/
│   │   ├── FundingTracker.tsx               # Live donation total + goal progress
│   │   ├── DonationImpactCalc.tsx           # "Your $X processes Y pages" calculator
│   │   ├── DonationImpactTiers.tsx          # Visual tier cards ($1, $25, $100, etc.)
│   │   ├── SpendTransparencyLog.tsx         # Public log of every dollar spent
│   │   ├── ProcessingLiveFeed.tsx           # Real-time "just processed" feed
│   │   └── DonationCTA.tsx                  # Reusable donate call-to-action
│   ├── contribute/
│   │   ├── ContributeHub.tsx                # Choose contribution type (wizard entry)
│   │   ├── DirectUnredactForm.tsx           # Identify specific redaction with evidence
│   │   ├── ImageMatcher.tsx                 # Upload known image → find redacted matches
│   │   ├── ImageComparisonView.tsx          # Side-by-side: submitted vs. redacted image
│   │   ├── IntelligenceHintForm.tsx         # Submit general intel (e.g., senator's statement)
│   │   ├── EvidenceAttacher.tsx             # Attach URLs, screenshots, doc refs as evidence
│   │   ├── ContributionImpactView.tsx       # "Your contribution unlocked X connections"
│   │   └── ContributionTypeCards.tsx        # Cards explaining each contribution type
│   ├── gamification/
│   │   ├── Leaderboard.tsx                  # Top contributors (all-time + weekly)
│   │   ├── AchievementBadge.tsx             # Individual badge display
│   │   ├── AchievementGrid.tsx              # All achievements (earned + locked)
│   │   ├── CascadeReplay.tsx                # Animated replay of a cascade chain
│   │   ├── UserScoreCard.tsx                # Compact user stats (rank, score, streaks)
│   │   ├── XPProgressBar.tsx                # Experience points toward next level
│   │   ├── ContributionStreak.tsx           # Daily/weekly streak tracker
│   │   └── ImpactRipple.tsx                 # Animated visualization: "your solve → cascade"
│   ├── ui/                                  # shadcn/ui components (auto-generated)
│   └── shared/
│       ├── EmptyState.tsx                   # "Not yet processed" placeholder
│       ├── LoadingState.tsx                 # Skeleton loaders
│       └── ErrorBoundary.tsx                # Error handling wrapper
├── lib/
│   ├── supabase/
│   │   ├── client.ts                        # Browser Supabase client
│   │   ├── server.ts                        # Server-side Supabase client
│   │   └── admin.ts                         # Service role client (API routes)
│   ├── search/
│   │   ├── hybrid-search.ts                 # RPC wrapper for hybrid_search_rrf
│   │   ├── multimodal-search.ts             # RPC wrapper for multimodal_search_rrf
│   │   └── entity-search.ts                 # Entity-specific search
│   ├── chat/
│   │   ├── chat-service.ts                  # Chat orchestration (client-side)
│   │   └── streaming.ts                     # SSE streaming utilities
│   ├── utils/
│   │   ├── citations.ts                     # Citation formatting helpers
│   │   ├── dates.ts                         # Date parsing and formatting
│   │   └── storage.ts                       # Signed URL generation
│   └── hooks/
│       ├── useSearch.ts                     # Search state management
│       ├── useChat.ts                       # Chat state management
│       ├── useEntity.ts                     # Entity data fetching
│       └── useRedaction.ts                  # Redaction state management
├── worker/                                   # Standalone Node.js worker process
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                         # Worker entry point (Express API + job loop)
│   │   ├── pipeline/
│   │   │   ├── orchestrator.ts              # Pipeline orchestration (stage management)
│   │   │   ├── job-queue.ts                 # BullMQ job queue configuration
│   │   │   └── stages.ts                    # Pipeline stage definitions
│   │   ├── services/
│   │   │   ├── document-ai-ocr.ts           # Google Document AI OCR
│   │   │   ├── document-converter.ts        # File format conversion
│   │   │   ├── smart-chunker.ts             # Structure-aware chunking (800-1500 chars)
│   │   │   ├── contextual-header-gen.ts     # AI contextual headers per chunk
│   │   │   ├── embedding-service.ts         # Text embeddings (text-embedding-004, 768d)
│   │   │   ├── visual-embedding-service.ts  # Image embeddings (multimodal, 1408d)
│   │   │   ├── embedding-cache.ts           # Two-tier embedding cache (L1 memory + L2 DB)
│   │   │   ├── classifier.ts               # Document type classification
│   │   │   ├── entity-extractor.ts          # Extract people, orgs, locations, dates
│   │   │   ├── relationship-mapper.ts       # Build entity-to-entity connections
│   │   │   ├── redaction-detector.ts        # Detect and catalog redacted regions
│   │   │   ├── cohere-reranker.ts           # Cohere rerank-english-v3.0
│   │   │   ├── video-transcriber.ts         # Whisper integration for video→text
│   │   │   └── cascade-engine.ts            # Redaction cascade propagation
│   │   ├── chatbot/
│   │   │   ├── chat-orchestrator.ts         # Agentic tool-calling loop
│   │   │   ├── rag-retrieval.ts             # RAG retrieval with citations
│   │   │   ├── intent-classifier.ts         # Query intent detection
│   │   │   ├── conversation-memory.ts       # Conversation history management
│   │   │   └── tools/
│   │   │       ├── search-documents.ts      # Semantic document search tool
│   │   │       ├── search-images.ts         # Image search tool
│   │   │       ├── lookup-entity.ts         # Entity lookup + all mentions
│   │   │       ├── map-connections.ts       # Entity relationship graph traversal
│   │   │       ├── build-timeline.ts        # Timeline reconstruction tool
│   │   │       ├── cross-reference.ts       # Cross-dataset comparison tool
│   │   │       ├── search-by-date.ts        # Date-range search tool
│   │   │       └── find-similar.ts          # Similar document finder
│   │   └── api/
│   │       └── chat.ts                      # Express route handler for /chat
│   └── .env.example
├── scripts/
│   ├── download-datasets.sh                 # Download all 12 DOJ datasets
│   ├── download-dataset.sh                  # Download a specific dataset by number
│   ├── seed-sample-data.ts                  # Process ~$200 worth of sample docs
│   ├── ingest-directory.ts                  # Ingest a local directory of files
│   ├── setup-types.sh                       # Regenerate Supabase TypeScript types
│   └── estimate-costs.ts                    # Estimate processing cost for a directory
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 00001_extensions.sql             # pgvector, pg_trgm, uuid-ossp
│       ├── 00002_core_tables.sql            # datasets, documents, chunks, images
│       ├── 00003_entity_tables.sql          # entities, entity_mentions, relationships
│       ├── 00004_redaction_tables.sql       # redactions, proposals, reputation
│       ├── 00005_timeline_tables.sql        # timeline_events
│       ├── 00006_user_tables.sql            # user_profiles, saved_searches, bookmarks
│       ├── 00007_search_functions.sql       # hybrid_search_rrf, multimodal_search_rrf
│       ├── 00008_entity_functions.sql       # entity search, connection graph queries
│       ├── 00009_redaction_functions.sql    # cascade queries, solvable feed, stats
│       ├── 00010_indexes.sql               # All vector, GIN, B-tree indexes
│       ├── 00011_rls_policies.sql          # Row Level Security policies
│       ├── 00012_stats_views.sql           # Materialized views for dashboard stats
│       ├── 00013_funding_tables.sql        # Funding tracker, spend log, donation impact
│       ├── 00014_contribution_tables.sql   # Intelligence hints, image matches, activity log
│       └── 00015_gamification_tables.sql   # Achievements, XP, streaks, leaderboard
├── types/
│   ├── supabase.ts                          # Auto-generated Supabase types
│   ├── entities.ts                          # Entity type definitions
│   ├── search.ts                            # Search request/response types
│   ├── chat.ts                              # Chat message types
│   └── redaction.ts                         # Redaction and proposal types
├── public/
│   ├── og-image.png                         # Social media preview image
│   └── favicon.ico
├── .env.example                             # All required env vars documented
├── .gitignore
├── CLAUDE.md                                # Project instructions for Claude Code
├── CONTRIBUTING.md                          # Contribution guidelines
├── LICENSE                                  # MIT license
├── README.md                                # Project overview and setup instructions
├── next.config.js
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
└── postcss.config.js
```

---

## 3. DATABASE SCHEMA

Create these migrations in order. This is the complete schema.

### Migration 00001: Extensions

```sql
-- 00001_extensions.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### Migration 00002: Core Tables

```sql
-- 00002_core_tables.sql

-- DOJ dataset groupings (1-12)
CREATE TABLE datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_number INTEGER UNIQUE NOT NULL,        -- 1-12
  name TEXT NOT NULL,                             -- "Dataset 4: Flight Logs"
  description TEXT,
  source_url TEXT,                                -- justice.gov URL
  zip_size_gb NUMERIC,                            -- size of original ZIP
  document_count INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',        -- pending, downloading, processing, complete
  date_range TSTZRANGE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual documents (PDFs, standalone files)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id),
  filename TEXT NOT NULL,
  original_path TEXT,                              -- path within the ZIP/dataset
  storage_path TEXT,                               -- Supabase Storage path
  file_type TEXT NOT NULL,                         -- pdf, jpg, png, doc, mp4, etc.
  mime_type TEXT,
  file_size_bytes BIGINT,
  page_count INTEGER,
  ocr_text TEXT,                                   -- full OCR output (for full-text backup)
  classification TEXT,                             -- deposition, flight_log, fbi_302, financial,
                                                   -- email, court_filing, police_report, estate_doc,
                                                   -- handwritten_note, photo, video, news_clipping,
                                                   -- correspondence, memo, property_record, other
  classification_confidence FLOAT,
  date_extracted TIMESTAMPTZ,                      -- primary date found in the document
  date_range TSTZRANGE,                            -- full date range if multiple dates
  is_redacted BOOLEAN DEFAULT false,               -- contains any redactions
  redaction_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',         -- pending, ocr, chunking, embedding, entity_extraction, complete, failed
  processing_error TEXT,
  metadata JSONB DEFAULT '{}',                     -- flexible metadata (bates numbers, exhibit IDs, etc.)
  hierarchy_json JSONB,                            -- document structure (headings, sections)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Text chunks with embeddings
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  contextual_header TEXT,                          -- AI-generated context summary (50-100 tokens)
  page_number INTEGER,
  page_range INT4RANGE,                            -- if chunk spans pages
  section_title TEXT,
  hierarchy_path TEXT[],                            -- ["Deposition", "Day 2", "Cross Examination"]
  content_embedding VECTOR(768),                   -- text-embedding-004
  content_tsv TSVECTOR,                            -- BM25 full-text search
  char_count INTEGER,
  token_count_estimate INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

-- Auto-generate tsvector on insert/update
CREATE OR REPLACE FUNCTION chunks_tsv_trigger() RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsv := to_tsvector('english', COALESCE(NEW.contextual_header, '') || ' ' || NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chunks_tsv_update
  BEFORE INSERT OR UPDATE OF content, contextual_header ON chunks
  FOR EACH ROW EXECUTE FUNCTION chunks_tsv_trigger();

-- Images (standalone photos + extracted from PDFs)
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,   -- source PDF if extracted
  dataset_id UUID REFERENCES datasets(id),
  filename TEXT,
  storage_path TEXT NOT NULL,
  file_type TEXT,                                  -- jpg, png, tiff, bmp
  file_size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  page_number INTEGER,                             -- page in source PDF if extracted
  description TEXT,                                -- AI-generated description
  ocr_text TEXT,                                   -- any text found in the image
  visual_embedding VECTOR(1408),                   -- image-to-image similarity
  description_embedding VECTOR(1408),              -- text-to-image search
  is_redacted BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',                     -- exif data, labels, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video transcripts
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  dataset_id UUID REFERENCES datasets(id),
  filename TEXT,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  transcript TEXT,                                  -- full Whisper transcript
  transcript_language TEXT DEFAULT 'en',
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video transcript chunks (same embedding pattern as document chunks)
CREATE TABLE video_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  timestamp_start FLOAT,                           -- seconds into video
  timestamp_end FLOAT,
  content_embedding VECTOR(768),
  content_tsv TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(video_id, chunk_index)
);

CREATE TRIGGER video_chunks_tsv_update
  BEFORE INSERT OR UPDATE OF content ON video_chunks
  FOR EACH ROW EXECUTE FUNCTION chunks_tsv_trigger();

-- Processing job queue
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  job_type TEXT NOT NULL,                          -- ocr, classify, chunk, embed, entity_extract, redaction_detect
  status TEXT DEFAULT 'pending',                    -- pending, processing, complete, failed
  priority INTEGER DEFAULT 0,                       -- higher = process first
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Migration 00003: Entity Tables

```sql
-- 00003_entity_tables.sql

-- Extracted entities (people, organizations, locations, etc.)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,                       -- person, organization, location, aircraft, vessel, property, account
  aliases TEXT[] DEFAULT '{}',                     -- ["Bill Clinton", "WJC", "BC", "President Clinton"]
  description TEXT,                                -- AI-generated summary
  name_embedding VECTOR(768),                      -- for fuzzy name matching
  first_seen_date TIMESTAMPTZ,                     -- earliest mention
  last_seen_date TIMESTAMPTZ,                      -- latest mention
  mention_count INTEGER DEFAULT 0,                 -- total mentions across corpus
  document_count INTEGER DEFAULT 0,                -- unique documents mentioned in
  metadata JSONB DEFAULT '{}',                     -- type-specific: birth_date, title, role, address, etc.
  is_verified BOOLEAN DEFAULT false,               -- confirmed by multiple sources
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, entity_type)
);

-- Entity mentions in specific chunks
CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  video_chunk_id UUID REFERENCES video_chunks(id) ON DELETE CASCADE,
  mention_text TEXT NOT NULL,                      -- exact text that matched
  context_snippet TEXT,                            -- surrounding 300 chars
  mention_type TEXT DEFAULT 'direct',              -- direct, indirect, implied, co_occurrence
  confidence FLOAT DEFAULT 1.0,
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entity-to-entity relationships
CREATE TABLE entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  entity_b_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,                 -- traveled_with, employed_by, associate_of,
                                                   -- family_member, legal_representative,
                                                   -- financial_connection, mentioned_together,
                                                   -- witness_testimony, employer_of, guest_of
  description TEXT,                                -- "Flew together on N908JE, March 2003"
  evidence_chunk_ids UUID[],                       -- chunks supporting this relationship
  evidence_document_ids UUID[],                    -- documents supporting this relationship
  date_range TSTZRANGE,
  strength FLOAT DEFAULT 1.0,                      -- how strong the connection (mentions, evidence)
  is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_relationship CHECK (entity_a_id != entity_b_id),
  UNIQUE(entity_a_id, entity_b_id, relationship_type)
);
```

### Migration 00004: Redaction Tables

```sql
-- 00004_redaction_tables.sql

-- Every detected redaction in the corpus
CREATE TABLE redactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  page_number INTEGER,

  -- Context clues (the "crossword clues")
  redaction_type TEXT,                             -- name, date, location, organization, amount, unknown
  char_length_estimate INTEGER,                    -- estimated character count of hidden text
  surrounding_text TEXT NOT NULL,                   -- 300 chars before + after
  sentence_template TEXT,                          -- "████ traveled to [location] on [date]"
  context_embedding VECTOR(768),                   -- embedding of surrounding context
  co_occurring_entity_ids UUID[],                  -- known entities mentioned nearby
  document_date TIMESTAMPTZ,
  document_type TEXT,                              -- from parent document classification
  position_in_page JSONB,                          -- {x, y, width, height} if detectable

  -- Resolution state
  status TEXT DEFAULT 'unsolved',                  -- unsolved, proposed, corroborated, confirmed, disputed
  resolved_text TEXT,
  resolved_entity_id UUID REFERENCES entities(id),
  confidence FLOAT DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  resolved_method TEXT,                            -- crowdsource, cascade, official, ai_inference

  -- Cascade tracking
  cascade_source_id UUID REFERENCES redactions(id),
  cascade_depth INTEGER DEFAULT 0,
  cascade_count INTEGER DEFAULT 0,                 -- how many other redactions this one unlocked

  -- Impact score (how many others would solving this unlock)
  potential_cascade_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User-submitted proposals
CREATE TABLE redaction_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redaction_id UUID NOT NULL REFERENCES redactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  proposed_text TEXT NOT NULL,
  proposed_entity_id UUID REFERENCES entities(id),

  -- Evidence
  evidence_type TEXT NOT NULL,                     -- public_statement, cross_reference,
                                                   -- context_deduction, document_comparison,
                                                   -- official_release, media_report, other
  evidence_description TEXT NOT NULL,
  evidence_sources TEXT[],                         -- URLs, references
  supporting_chunk_ids UUID[],

  -- Community validation
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  corroborations INTEGER DEFAULT 0,

  -- Algorithmic scoring
  context_match_score FLOAT,                       -- how well answer fits surrounding text
  length_match BOOLEAN,                            -- character count matches
  entity_graph_consistency FLOAT,                  -- fits known relationships
  composite_confidence FLOAT,                      -- weighted combination

  status TEXT DEFAULT 'pending',                   -- pending, accepted, rejected, superseded
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User reputation
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  proposals_submitted INTEGER DEFAULT 0,
  proposals_confirmed INTEGER DEFAULT 0,
  cascades_triggered INTEGER DEFAULT 0,
  accuracy_rate FLOAT DEFAULT 0,
  reputation_score FLOAT DEFAULT 0,
  expertise_areas TEXT[],
  tier TEXT DEFAULT 'contributor',                  -- contributor, trusted_researcher, verified_expert
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Proposal votes
CREATE TABLE proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES redaction_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL,                         -- upvote, downvote, corroborate
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);
```

### Migration 00005: Timeline Tables

```sql
-- 00005_timeline_tables.sql

CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date TIMESTAMPTZ,
  date_precision TEXT DEFAULT 'exact',             -- exact, day, month, year, approximate
  date_display TEXT,                               -- "March 14, 2003" or "Early 2003"
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,                        -- travel, meeting, legal_proceeding, financial,
                                                   -- communication, arrest, raid, testimony, other
  location TEXT,
  source_chunk_ids UUID[],
  source_document_ids UUID[],
  entity_ids UUID[],                               -- entities involved
  content_embedding VECTOR(768),
  is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Migration 00006: User Feature Tables

```sql
-- 00006_user_tables.sql

CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable for anonymous
  session_id TEXT NOT NULL,                                    -- anonymous session tracking
  title TEXT,
  messages JSONB DEFAULT '[]',
  model_tier TEXT DEFAULT 'free',                              -- free (gemini flash), paid (claude)
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Migration 00007: Search Functions

```sql
-- 00007_search_functions.sql

-- Hybrid search with Reciprocal Rank Fusion (text chunks)
CREATE OR REPLACE FUNCTION hybrid_search_chunks_rrf(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INTEGER DEFAULT 20,
  rrf_k INTEGER DEFAULT 60,
  dataset_filter UUID DEFAULT NULL,
  doc_type_filter TEXT DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  contextual_header TEXT,
  page_number INTEGER,
  section_title TEXT,
  document_filename TEXT,
  document_classification TEXT,
  dataset_name TEXT,
  rrf_score FLOAT,
  semantic_rank INTEGER,
  keyword_rank INTEGER
)
LANGUAGE sql STABLE
AS $$
  WITH semantic_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.contextual_header,
      c.page_number,
      c.section_title,
      ROW_NUMBER() OVER (ORDER BY c.content_embedding <=> query_embedding) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
      AND (doc_type_filter IS NULL OR d.classification = doc_type_filter)
      AND (date_from IS NULL OR d.date_extracted >= date_from)
      AND (date_to IS NULL OR d.date_extracted <= date_to)
    ORDER BY c.content_embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.contextual_header,
      c.page_number,
      c.section_title,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', query_text)) DESC) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.content_tsv @@ plainto_tsquery('english', query_text)
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
      AND (doc_type_filter IS NULL OR d.classification = doc_type_filter)
      AND (date_from IS NULL OR d.date_extracted >= date_from)
      AND (date_to IS NULL OR d.date_extracted <= date_to)
    ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', query_text)) DESC
    LIMIT match_count * 2
  )
  SELECT
    COALESCE(s.id, k.id) AS chunk_id,
    COALESCE(s.document_id, k.document_id) AS document_id,
    COALESCE(s.content, k.content) AS content,
    COALESCE(s.contextual_header, k.contextual_header) AS contextual_header,
    COALESCE(s.page_number, k.page_number) AS page_number,
    COALESCE(s.section_title, k.section_title) AS section_title,
    d.filename AS document_filename,
    d.classification AS document_classification,
    ds.name AS dataset_name,
    (COALESCE(1.0 / (rrf_k + s.rank), 0.0) + COALESCE(1.0 / (rrf_k + k.rank), 0.0))::FLOAT AS rrf_score,
    s.rank::INTEGER AS semantic_rank,
    k.rank::INTEGER AS keyword_rank
  FROM semantic_search s
  FULL OUTER JOIN keyword_search k ON s.id = k.id
  JOIN documents d ON d.id = COALESCE(s.document_id, k.document_id)
  JOIN datasets ds ON ds.id = d.dataset_id
  ORDER BY rrf_score DESC
  LIMIT match_count;
$$;

-- Multimodal search across documents, images, and video transcripts
CREATE OR REPLACE FUNCTION multimodal_search_rrf(
  query_text TEXT,
  query_embedding_768 VECTOR(768),
  query_embedding_1408 VECTOR(1408),
  match_count INTEGER DEFAULT 20,
  rrf_k INTEGER DEFAULT 60,
  search_documents BOOLEAN DEFAULT true,
  search_images BOOLEAN DEFAULT true,
  search_videos BOOLEAN DEFAULT true,
  dataset_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  result_id UUID,
  source_type TEXT,               -- 'document', 'image', 'video'
  content TEXT,
  document_id UUID,
  page_number INTEGER,
  storage_path TEXT,
  filename TEXT,
  dataset_name TEXT,
  rrf_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH doc_semantic AS (
    SELECT c.id AS result_id, 'document'::TEXT AS source_type,
           c.content, c.document_id, c.page_number,
           NULL::TEXT AS storage_path, d.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY c.content_embedding <=> query_embedding_768) AS rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    JOIN datasets ds ON ds.id = d.dataset_id
    WHERE search_documents AND c.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR d.dataset_id = dataset_filter)
    ORDER BY c.content_embedding <=> query_embedding_768
    LIMIT match_count
  ),
  img_semantic AS (
    SELECT i.id AS result_id, 'image'::TEXT AS source_type,
           COALESCE(i.description, i.ocr_text, 'Image') AS content,
           i.document_id, i.page_number,
           i.storage_path, i.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY i.description_embedding <=> query_embedding_1408) AS rank
    FROM images i
    LEFT JOIN datasets ds ON ds.id = i.dataset_id
    WHERE search_images AND i.description_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR i.dataset_id = dataset_filter)
    ORDER BY i.description_embedding <=> query_embedding_1408
    LIMIT match_count
  ),
  vid_semantic AS (
    SELECT vc.id AS result_id, 'video'::TEXT AS source_type,
           vc.content, v.document_id, NULL::INTEGER AS page_number,
           v.storage_path, v.filename, ds.name AS dataset_name,
           ROW_NUMBER() OVER (ORDER BY vc.content_embedding <=> query_embedding_768) AS rank
    FROM video_chunks vc
    JOIN videos v ON v.id = vc.video_id
    LEFT JOIN datasets ds ON ds.id = v.dataset_id
    WHERE search_videos AND vc.content_embedding IS NOT NULL
      AND (dataset_filter IS NULL OR v.dataset_id = dataset_filter)
    ORDER BY vc.content_embedding <=> query_embedding_768
    LIMIT match_count
  ),
  all_results AS (
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM doc_semantic
    UNION ALL
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM img_semantic
    UNION ALL
    SELECT *, 1.0 / (rrf_k + rank) AS score FROM vid_semantic
  )
  SELECT result_id, source_type, content, document_id, page_number,
         storage_path, filename, dataset_name, score::FLOAT AS rrf_score
  FROM all_results
  ORDER BY score DESC
  LIMIT match_count;
$$;

-- Find similar redactions by context (for cascade engine)
CREATE OR REPLACE FUNCTION find_similar_redactions(
  source_redaction_id UUID,
  similarity_threshold FLOAT DEFAULT 0.80,
  match_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  redaction_id UUID,
  similarity FLOAT,
  surrounding_text TEXT,
  document_id UUID,
  page_number INTEGER,
  char_length_estimate INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.id AS redaction_id,
    1 - (r.context_embedding <=> src.context_embedding)::FLOAT AS similarity,
    r.surrounding_text,
    r.document_id,
    r.page_number,
    r.char_length_estimate
  FROM redactions r
  CROSS JOIN (SELECT context_embedding, char_length_estimate, redaction_type FROM redactions WHERE id = source_redaction_id) src
  WHERE r.id != source_redaction_id
    AND r.status = 'unsolved'
    AND r.context_embedding IS NOT NULL
    AND 1 - (r.context_embedding <=> src.context_embedding) >= similarity_threshold
    AND (src.char_length_estimate IS NULL OR ABS(r.char_length_estimate - src.char_length_estimate) <= 3)
    AND (src.redaction_type IS NULL OR r.redaction_type = src.redaction_type)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

### Migration 00008-00012

```sql
-- 00008_entity_functions.sql
-- Entity connection graph query, entity search by name embedding, mention aggregation
-- (Generate these based on the entity table patterns above)

-- 00009_redaction_functions.sql
-- get_solvable_redactions (sorted by potential_cascade_count DESC)
-- get_cascade_tree (recursive CTE following cascade_source_id)
-- get_redaction_stats (counts by status)
-- calculate_proposal_confidence (weighted scoring function)

-- 00010_indexes.sql
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 200);
CREATE INDEX idx_chunks_tsv ON chunks USING gin (content_tsv);
CREATE INDEX idx_chunks_document_id ON chunks (document_id);
CREATE INDEX idx_images_visual_emb ON images USING ivfflat (visual_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_images_desc_emb ON images USING ivfflat (description_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_entities_name_emb ON entities USING ivfflat (name_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_entities_name_trgm ON entities USING gin (name gin_trgm_ops);
CREATE INDEX idx_entity_mentions_entity ON entity_mentions (entity_id);
CREATE INDEX idx_entity_mentions_document ON entity_mentions (document_id);
CREATE INDEX idx_entity_relationships_a ON entity_relationships (entity_a_id);
CREATE INDEX idx_entity_relationships_b ON entity_relationships (entity_b_id);
CREATE INDEX idx_redactions_embedding ON redactions USING ivfflat (context_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_redactions_status ON redactions (status);
CREATE INDEX idx_redactions_document ON redactions (document_id);
CREATE INDEX idx_timeline_date ON timeline_events (event_date);
CREATE INDEX idx_timeline_embedding ON timeline_events USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_processing_jobs_status ON processing_jobs (status, priority DESC);
CREATE INDEX idx_documents_dataset ON documents (dataset_id);
CREATE INDEX idx_documents_classification ON documents (classification);
CREATE INDEX idx_video_chunks_embedding ON video_chunks USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_video_chunks_tsv ON video_chunks USING gin (content_tsv);

-- 00011_rls_policies.sql
-- Public read access to all content tables (documents, chunks, entities, etc.)
-- Authenticated write access to proposals, votes, bookmarks, saved_searches
-- Service role for worker operations (ingestion, cascade engine)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON documents FOR SELECT USING (true);
-- (Generate full RLS policies for all tables following this pattern)

-- 00012_stats_views.sql
CREATE MATERIALIZED VIEW corpus_stats AS
SELECT
  (SELECT COUNT(*) FROM documents) AS total_documents,
  (SELECT COUNT(*) FROM documents WHERE processing_status = 'complete') AS processed_documents,
  (SELECT SUM(page_count) FROM documents) AS total_pages,
  (SELECT COUNT(*) FROM chunks) AS total_chunks,
  (SELECT COUNT(*) FROM images) AS total_images,
  (SELECT COUNT(*) FROM videos) AS total_videos,
  (SELECT COUNT(*) FROM entities) AS total_entities,
  (SELECT COUNT(*) FROM entity_relationships) AS total_relationships,
  (SELECT COUNT(*) FROM redactions) AS total_redactions,
  (SELECT COUNT(*) FROM redactions WHERE status = 'confirmed') AS solved_redactions,
  (SELECT COUNT(*) FROM redactions WHERE status = 'corroborated') AS corroborated_redactions,
  (SELECT COUNT(*) FROM redaction_proposals) AS total_proposals,
  (SELECT COUNT(DISTINCT user_id) FROM redaction_proposals) AS total_contributors;
-- Refresh this periodically via cron or after batch processing
```

---

## 4. DESIGN SYSTEM

### Theme: Dark, Serious, Investigative

```
Color Palette:
  Background:        #0a0a0f (near-black with slight blue)
  Surface:           #12121a (cards, panels)
  Surface Elevated:  #1a1a2e (hover states, modals)
  Border:            #2a2a3e (subtle borders)
  Border Accent:     #3a3a5e (active/focus borders)

  Text Primary:      #e4e4e7 (zinc-200)
  Text Secondary:    #a1a1aa (zinc-400)
  Text Muted:        #71717a (zinc-500)

  Accent:            #dc2626 (red-600, for redaction highlights and primary actions)
  Accent Hover:      #ef4444 (red-500)
  Accent Muted:      #991b1b (red-800, backgrounds)

  Info:              #3b82f6 (blue-500, for entity links)
  Success:           #22c55e (green-500, for solved redactions)
  Warning:           #f59e0b (amber-500, for proposed/pending)

  Code/Document:     #1e1e2e (code blocks, document viewer background)

Typography:
  Headings:          "Inter" or "Space Grotesk" - clean, modern sans-serif
  Body:              "Inter" - highly readable at all sizes
  Monospace/Docs:    "JetBrains Mono" or "Fira Code" - for document content, code, citations

  Scale: Use Tailwind's default scale. Headings large and bold. Body at base size.

Components:
  Cards:             bg-surface, border border-border, rounded-lg, subtle shadow
  Buttons Primary:   bg-accent text-white hover:bg-accent-hover
  Buttons Secondary: bg-surface border border-border hover:bg-surface-elevated
  Search Bar:        Large, centered, with subtle glow on focus (ring-accent/20)
  Document Viewer:   bg-code-document, monospace font, line numbers
  Redaction Boxes:   bg-black with red dashed border when unsolved, green when solved
  Entity Tags:       Colored pills (blue for people, purple for orgs, green for locations)

Layout:
  Max width:         1400px for content, full-width for search/graph
  Sidebar:           280px collapsible filters panel
  Chat Panel:        400px slide-out from right
```

### Empty State Design

When data isn't processed yet, show compelling empty states:
- Search page: "This search will query 3.5 million pages once processing is funded. [See what's possible →]" with link to sample data demo
- Entity page: Skeleton with "XX entities extracted so far. Help us process more. [GoFundMe →]"
- Stats page: Progress bars showing processing percentage with GoFundMe embed
- Global banner: Subtle top banner "Processing: XX% complete — [Support the project]"

---

## 5. KEY PAGE SPECIFICATIONS

### Home Page (/)
- Hero: Large headline "3.5 Million Pages of Truth. Now Searchable." with search bar
- Below fold: How it works (3 columns: Search → Discover → Unredact)
- Stats ticker: Documents processed, entities found, redactions solved (live from DB)
- Sample searches: 6 clickable example queries that demonstrate capability
- GoFundMe embed: Progress bar + donate button
- Dark, dramatic, full-bleed sections with subtle background textures

### Search Page (/search)
- Full-width search bar at top (persists on scroll)
- Left sidebar: Filters (dataset, doc type, date range, entity, has redactions)
- Results area: Tabbed (All, Documents, Images, Videos, Entities)
- Each result: Title, snippet with highlighted matches, source doc link, dataset tag, date
- Image results: Thumbnail grid with descriptions
- Pagination or infinite scroll
- "Ask AI" button to convert search into a chat question

### Chat Interface
- Floating action button (bottom-right) on all pages
- Opens slide-out panel (400px from right)
- Chat messages with markdown rendering
- Source citations as clickable chips below each AI response
- Model tier indicator (🟢 Free / 🔵 Premium)
- Rate limit display for free tier

### Entity Profile (/entity/[id])
- Header: Name, type badge, alias list, mention count, document count
- Tabs: Overview, Documents, Connections, Timeline, Redactions
- Overview: AI-generated summary, key facts, first/last seen dates
- Documents: List of all documents mentioning this entity
- Connections: Mini relationship graph (force-directed, D3)
- Timeline: Chronological appearances
- Redactions: Redactions where this entity might be the hidden text

### Redaction Dashboard (/redactions)
- Global progress bar (solved / total)
- "Most impactful unsolved" feed (sorted by potential_cascade_count)
- Recent solves ticker
- Cascade chain visualizations (tree diagrams)
- Leaderboard (top contributors by cascades triggered)
- "I know something" CTA button → contribute page

### Graph Visualization (/graph)
- Full-screen force-directed graph (D3.js or vis.js)
- Nodes: Entities (colored by type, sized by mention count)
- Edges: Relationships (colored by type, weighted by strength)
- Controls: Zoom, filter by entity type, filter by date range, search to highlight
- Click node: Opens entity sidebar with details
- Click edge: Shows evidence documents

---

## 6. WORKER PIPELINE SPECIFICATION

The worker is a standalone Node.js process with an Express API (for chat) and a BullMQ job processing loop (for document ingestion).

### Pipeline Stages (per document):
1. **OCR** → Google Document AI, outputs Markdown with heading structure
2. **Classification** → Gemini Flash, outputs document type + confidence
3. **Chunking** → Structure-aware, 800-1500 char chunks with hierarchy
4. **Contextual Headers** → Gemini Flash, 50-100 token context per chunk
5. **Embedding** → text-embedding-004 (768d) per chunk
6. **Entity Extraction** → Gemini Flash, extracts people/orgs/locations/dates
7. **Relationship Mapping** → Gemini Flash, identifies entity-to-entity connections
8. **Redaction Detection** → Gemini Flash, catalogs all redacted regions
9. **Timeline Extraction** → Gemini Flash, extracts dated events
10. **Storage** → Insert all data into Supabase tables

### Chat API:
- `POST /chat` → Streaming SSE responses
- Agentic loop: LLM calls tools (search_documents, lookup_entity, build_timeline, etc.)
- Citations in every response
- Rate limiting by session/user
- Model routing: free tier → Gemini Flash, paid tier → Claude

---

## 7. DOWNLOAD SCRIPTS

### scripts/download-datasets.sh
- Downloads all 12 datasets from justice.gov/epstein
- Handles resume on interrupted downloads (wget --continue)
- Verifies checksums where available
- Extracts ZIPs to organized directory structure: `data/raw/dataset-{N}/`
- Logs progress and estimated time remaining
- Usage: `./scripts/download-datasets.sh [dataset_number]` (optional single dataset)

### scripts/seed-sample-data.ts
- Processes a curated sample of ~1,000 high-interest pages for demo purposes
- Targets: known flight log pages, key deposition excerpts, notable photos
- Budget: ~$200 of API costs
- Creates realistic data in all tables so the UI has something to show
- Run: `npx tsx scripts/seed-sample-data.ts`

---

## 8. ENVIRONMENT VARIABLES

```env
# .env.example

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Cloud (Document AI + Vertex AI)
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_LOCATION=us-central1
DOCUMENT_AI_PROCESSOR_ID=

# Cohere (reranking)
COHERE_API_KEY=

# Chat LLM
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Whisper (video transcription)
WHISPER_MODEL=large-v3
# Or OpenAI Whisper API:
# OPENAI_API_KEY=

# Application
NEXT_PUBLIC_SITE_URL=https://epsteinarchive.org
NEXT_PUBLIC_GOFUNDME_URL=

# Worker
WORKER_CONCURRENCY=5
WORKER_PORT=8080
REDIS_URL=redis://localhost:6379
```

---

## 9. MONETIZATION (FUTURE)

The free tier uses Gemini Flash with rate limits. Future paid tiers:
- **Free**: 20 chat questions/day (Gemini Flash), unlimited search
- **Researcher ($9/mo)**: Unlimited chat (Gemini Flash), bulk export, API access
- **Pro ($29/mo)**: Claude-powered chat, advanced analytics, priority support

Build the tier infrastructure now (model routing, rate limiting, Stripe placeholder) but don't implement payments yet.

---

## 10. IMPLEMENTATION PRIORITIES

Build in this order:
1. **Project setup**: repo init, Next.js, Tailwind, shadcn/ui, Supabase project
2. **Database**: All 15 migrations applied (core + funding + contributions + gamification)
3. **Design system**: globals.css with dark theme, layout components
4. **Home page**: Hero + search bar + stats + funding bar + GoFundMe embed
5. **Search page**: Full UI with empty states, filters sidebar, result cards
6. **Document viewer**: PDF/image viewer page with metadata sidebar + redaction highlights
7. **Entity pages**: Entity profile + directory
8. **Chat panel**: FAB + slide-out panel + message UI (mock responses initially)
9. **Funding page**: Live tracker, donation impact calculator, spend transparency log, impact tier cards
10. **Redaction dashboard**: Progress, solvable feed, cascade tree visualization, XP rewards shown
11. **Contribution hub**: All 4 contribution types with full forms (direct unredact, image match, intelligence, cross-ref)
12. **Image matcher**: Upload + visual similarity results + side-by-side comparison
13. **Gamification**: Leaderboard (all-time + weekly), achievement grid, cascade replay animation, XP system
14. **Timeline view**: Vertical scrollable timeline with filters
15. **Graph visualization**: D3 force-directed entity graph
16. **Auth**: Supabase auth, login page, user profiles with XP/achievements/stats
17. **API routes**: All API endpoints (search, chat, entity, redaction, funding, contribute, gamification)
18. **Worker scaffold**: Pipeline stages as stub functions, Express chat API, cascade engine, hint processor
19. **Download scripts**: Dataset download + seed data scripts
20. **Stats page**: Processing progress, corpus stats, funding progress
21. **About page**: Methodology, FAQ, contributing guidelines
22. **README + CLAUDE.md + CONTRIBUTING.md + LICENSE**

All pages should be functional with empty states and skeleton loaders where data isn't available yet. The UI should feel complete even before a single document is processed.

---

## 11. CRITICAL REQUIREMENTS

- **Every search result MUST include a citation** linking to the source document + page number. This is non-negotiable for credibility.
- **Dark theme throughout** — no light mode needed for v1.
- **Mobile responsive** — search and chat must work on phones.
- **Source code link** in footer pointing to GitHub repo.
- **GoFundMe/donation link** visible on every page (subtle banner or footer).
- **No hallucination in chat** — if the system doesn't have relevant documents, it must say "I don't have information about that in the processed documents" rather than making something up.
- **Processing progress** visible globally — users should always know what % of the corpus is searchable.
- **MIT License** — file must be present from the start.
- **pnpm** as package manager (not npm).
- **Gamification must feel rewarding** — Every contribution shows immediate XP gain, cascade potential, and a "what your solve unlocked" view. The cascade replay animation is the hero feature for engagement.
- **Funding transparency** — Every dollar spent is logged publicly. The spend transparency log is not optional.
- **Contribution attribution** — When a redaction is solved by a user, their username is permanently credited on that redaction (in document view, search results, and cascade trees).
- **Shareable impact** — Cascade replays and user profiles should have OpenGraph meta tags for social sharing. A user should be able to share "I just uncovered 47 connections in the Epstein files" with a link that shows their cascade tree.

---

## 12. LIVE FUNDING TRACKER & DONATION IMPACT

### Concept

Every dollar donated goes directly to processing. The site shows this in real-time: what was funded, what was processed as a result, and what's still waiting. Donors see their specific impact — not just "thanks for your $25" but "your $25 just processed 12,000 pages of FBI interview summaries from Dataset 3, uncovering 47 entity mentions and 3 new connections."

### GoFundMe Integration

GoFundMe does NOT have a public read API. Use one of these strategies (implement the first that works):

1. **GoFundMe widget embed** — Embed the official GoFundMe widget/iframe on the `/funding` page and home page. This shows live donation totals natively.
2. **Manual sync** — Admin can update the funding total via a protected API endpoint. The site caches and displays it.
3. **Scrape proxy** (fallback) — A server-side Edge Function periodically fetches the GoFundMe page HTML, extracts the current total via regex/DOM parsing, and caches it in Supabase. Refresh every 15 minutes max.

Store the funding state locally regardless of source:

```sql
-- 00013_funding_tables.sql

-- Current funding state (single row, updated by admin or sync)
CREATE TABLE funding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gofundme_url TEXT,
  goal_amount NUMERIC NOT NULL DEFAULT 16000,      -- $16,000 target
  raised_amount NUMERIC NOT NULL DEFAULT 0,
  donor_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Every dollar spent on processing (full transparency)
CREATE TABLE processing_spend_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,                          -- dollars spent
  service TEXT NOT NULL,                            -- 'document_ai_ocr', 'vertex_embeddings',
                                                    -- 'gemini_flash', 'cohere_rerank', 'supabase',
                                                    -- 'cloud_compute', 'whisper'
  description TEXT NOT NULL,                        -- "OCR processing of 2,847 pages from Dataset 4"
  pages_processed INTEGER,
  chunks_created INTEGER,
  entities_extracted INTEGER,
  redactions_detected INTEGER,
  images_processed INTEGER,
  dataset_id UUID REFERENCES datasets(id),
  triggered_by TEXT,                                -- 'donation', 'seed_fund', 'monthly_ops'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Donation-to-impact mapping (precalculated tiers shown on the site)
-- This is a reference table, not dynamic — seeded at deploy time
CREATE TABLE donation_impact_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  pages_processed INTEGER,
  entities_extracted INTEGER,
  analogy TEXT,                                     -- human-friendly comparison
  sort_order INTEGER DEFAULT 0
);
```

### Donation Impact Tiers (Seed Data)

Insert these at deploy time. Based on the real cost model ($2.10 per 1,000 pages fully processed):

| Amount | Pages | What It Processes | Analogy |
|---|---|---|---|
| **$1** | ~475 | A small stack of FBI interview summaries | "About the size of a paperback novel" |
| **$5** | ~2,400 | A full deposition transcript | "One person's entire testimony under oath" |
| **$10** | ~4,750 | A batch of flight logs spanning several months | "Every passenger who flew on the Lolita Express for a quarter" |
| **$25** | ~12,000 | An entire FBI case subfolder | "More pages than the entire 9/11 Commission Report" |
| **$50** | ~24,000 | A major court proceeding with all exhibits | "The complete legal record of one Epstein case" |
| **$100** | ~48,000 | Half of a small DOJ dataset | "Enough to surface ~500 entity connections the public has never seen" |
| **$250** | ~119,000 | An entire mid-sized dataset | "Processing a whole filing cabinet of evidence" |
| **$500** | ~238,000 | A large dataset with full entity extraction | "More pages than every Harry Potter book combined — times ten" |
| **$1,500** | ~714,000 | 20% of the entire corpus | "One-fifth of everything the DOJ released" |
| **$5,000** | ~2,380,000 | Two-thirds of the entire corpus | "Most of the truth, searchable in weeks" |

### Funding Page (/funding)

- **Hero**: Giant progress bar — "$X raised of $16,000 goal" with animated fill
- **"Your Dollar, Visualized"**: Interactive calculator — user drags a slider from $1 to $500+, and a live visualization shows pages flipping, entities appearing, connections drawing on a mini-graph
- **Impact tier cards**: The table above rendered as visual cards with icons. Each shows "Donate $X → Process Y pages → Uncover ~Z connections." Each card has a direct GoFundMe donate link with the amount prefilled
- **Spend transparency log**: Scrollable feed showing every batch processed — "Feb 12: $47.20 spent processing 22,500 pages from Dataset 4 (OCR + embedding + entity extraction). Result: 312 new entities, 1,847 new searchable chunks, 89 redactions cataloged."
- **Live processing feed**: When the worker is actively processing, show a real-time ticker: "Just processed: FBI_302_report_2003_04_17.pdf (12 pages, 3 entities found)"
- **"Every penny accounted for"** section: Pie chart of spend by category (OCR 72%, entity extraction 12%, etc.)

### Funding Components on Other Pages

- **Home page**: Compact funding bar below hero — "$X of $16K raised — Your $5 processes 2,400 pages [Donate →]"
- **Search results (empty state)**: "This search would find results across 3.5M pages. We've processed X so far. [Fund the rest →]"
- **Global top banner** (dismissible): "XX% of documents processed. Help unlock the rest → [Donate]"
- **Every processed document page**: Footer shows "This document was made searchable thanks to community funding. [Process more →]"

### Environment Variables (add to .env.example)

```env
# Funding
NEXT_PUBLIC_GOFUNDME_URL=https://www.gofundme.com/f/the-epstein-archive
NEXT_PUBLIC_GOFUNDME_WIDGET_URL=               # GoFundMe widget embed URL
FUNDING_ADMIN_SECRET=                           # Secret for admin funding sync endpoint
```

---

## 13. MULTI-TYPE CONTRIBUTION SYSTEM

### Overview

Users can contribute information in FOUR distinct ways, each with different evidence requirements and different effects on the system. The contribution hub (`/contribute`) presents these as clear choices with explanations.

### Contribution Type 1: Direct Unredaction

**When:** User knows exactly what a specific redaction says.
**Example:** A court order unseals a name, or the user found the same passage in an unredacted version of the document.

**UI Flow:**
1. User navigates to a specific redaction (from the redactions dashboard, a document view, or search)
2. Clicks "I know what this says"
3. Form: Proposed text + evidence type dropdown + evidence description + source URLs
4. If the proposed text matches an existing entity, auto-link it
5. If it's a new name, create a proposed entity
6. Submit → Community review queue

**Evidence types (dropdown):**
- "Official release" — Court unsealed it, DOJ released unredacted version
- "Public statement" — Politician, official, or journalist named this publicly
- "Cross-reference" — Found the same info unredacted in another document in the corpus
- "Context deduction" — Logical deduction from surrounding text + known facts
- "Media report" — News article identifying this information
- "Other" — Free text explanation

**This uses the existing `redaction_proposals` table from Migration 00004.**

### Contribution Type 2: Image Matching

**When:** A redacted/blurred image in the corpus is actually a publicly known image. User uploads the known original.
**Example:** A photo in the files shows a blurred group at a party. The same unblurred photo was published in a magazine. User uploads the magazine version.

**UI Flow:**
1. User clicks "Match a known image" on the contribute hub
2. Uploads an image (drag-and-drop or file picker)
3. System immediately runs visual similarity search against ALL images in the corpus
4. Shows top matches: side-by-side comparison (submitted vs. corpus image) with similarity score
5. User selects which corpus image(s) match and describes the source
6. Submit → System links the unredacted image to the redacted one

**Backend process on match confirmation:**
1. Store the submitted image in `contributed_images` bucket
2. Run visual embedding on the submitted image
3. Compare against all corpus images with `visual_embedding <=> submitted_embedding`
4. When confirmed: update the corpus image's `description` with newly visible information
5. Re-extract entities from the now-unredacted image (Gemini vision analysis)
6. **CASCADE:** Any newly identified people/locations trigger entity graph updates, which update redaction candidates across the corpus

```sql
-- 00014_contribution_tables.sql

-- Submitted images matched against corpus
CREATE TABLE image_match_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_image_path TEXT NOT NULL,              -- path in 'contributed-images' bucket
  submitted_image_embedding VECTOR(1408),          -- visual embedding of submitted image
  source_description TEXT NOT NULL,                -- "Published in Vanity Fair, March 2003"
  source_url TEXT,                                 -- link to original public source

  -- Match results
  matched_image_id UUID REFERENCES images(id),     -- corpus image it matched
  similarity_score FLOAT,
  status TEXT DEFAULT 'pending',                   -- pending, matched, confirmed, rejected

  -- What the unredacted image revealed
  revealed_entities UUID[],                        -- entities newly visible
  revealed_description TEXT,                       -- AI-generated description of what's now visible

  -- Community validation
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Contribution Type 3: Intelligence Hints

**When:** User has general information that doesn't tie to a specific document but should help the system find connections. This is the "senator named names on C-SPAN" scenario.
**Example:** A representative announces "I saw files mentioning a sultan from [country], a well-known businessman from [city], and a former president." We don't know which documents — but the system should use these hints to search smarter.

**UI Flow:**
1. User clicks "Submit intelligence" on the contribute hub
2. Form with structured fields:
   - **Hint type**: Person identified, Organization identified, Location identified, Relationship identified, General context
   - **Entity name** (if known): "Sultan [Name] of [Country]"
   - **Entity type**: Person, organization, location, etc.
   - **Aliases** (optional): Other names this entity might appear as
   - **Known associations**: Other entities they're connected to
   - **Source**: URL, video timestamp, news article, congressional record
   - **Date context**: When this information was made public
   - **Verbatim quote** (optional): Exact words from the source
   - **Free text description**: Anything else relevant
3. Submit → System creates/updates entity records and re-scores redaction candidates

**Backend process:**
1. Create or merge entity in `entities` table (with aliases)
2. Generate embedding for the entity name + aliases
3. Run the entity against ALL unsolved redactions — score how well it fits each:
   - Name length matches redaction char_length_estimate?
   - Context embedding similarity with surrounding text?
   - Entity type matches redaction type?
   - Date range overlaps?
   - Co-occurring entities match known associations?
4. Queue high-scoring matches for community review
5. Store the hint permanently so future document processing benefits from it

```sql
-- Intelligence hints (general knowledge, not tied to specific redaction)
CREATE TABLE intelligence_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What the hint says
  hint_type TEXT NOT NULL,                         -- person_identified, org_identified,
                                                   -- location_identified, relationship_identified,
                                                   -- general_context
  entity_name TEXT,                                -- the name/identifier if known
  entity_type TEXT,                                -- person, organization, location, etc.
  aliases TEXT[],                                  -- alternative names
  known_associations TEXT[],                       -- related entity names (free text, matched later)
  associated_entity_ids UUID[],                    -- if matched to existing entities
  description TEXT NOT NULL,                       -- full explanation
  verbatim_quote TEXT,                             -- exact quote from source

  -- Source credibility
  source_type TEXT NOT NULL,                       -- congressional_record, news_article, court_filing,
                                                   -- video_statement, social_media, other
  source_url TEXT,
  source_date TIMESTAMPTZ,
  source_description TEXT,

  -- Processing state
  status TEXT DEFAULT 'pending',                   -- pending, processed, merged, rejected
  created_entity_id UUID REFERENCES entities(id),  -- entity created/updated from this hint
  redactions_matched INTEGER DEFAULT 0,            -- how many redactions this hint helped score

  -- Embedding for matching against corpus
  hint_embedding VECTOR(768),                      -- embedding of the full hint context

  -- Community validation
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  corroborations INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unified activity log for all contribution types
CREATE TABLE contribution_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_type TEXT NOT NULL,                 -- 'direct_unredact', 'image_match',
                                                   -- 'intelligence_hint', 'vote', 'corroboration'
  target_id UUID,                                  -- redaction_id, image_match_id, or intelligence_hint_id
  target_type TEXT,                                -- 'redaction', 'image', 'hint'
  description TEXT,                                -- human-readable summary
  xp_earned INTEGER DEFAULT 0,                     -- gamification points
  cascades_triggered INTEGER DEFAULT 0,            -- number of cascade solves from this
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Contribution Type 4: Cross-Reference Discovery

**When:** User finds that two documents in the corpus reference the same thing but aren't linked.
**Example:** A name in a flight log matches a name in a deposition, but the system hasn't connected them because of spelling differences.

**This is handled through the existing Direct Unredaction flow** with evidence_type = "cross_reference". The user selects the redaction, provides the proposed text, and points to the other document as evidence. The contribution hub explains this pathway clearly.

### Contribution Hub Page (/contribute)

Visual layout: 4 large cards in a 2x2 grid, each with:
- Icon (magnifying glass, image icon, lightbulb, chain link)
- Title ("I Know What This Says", "I Have the Unredacted Image", "I Have a Lead", "I Found a Connection")
- 2-3 sentence description of when to use this
- "Start →" button
- Counter: "X contributions of this type so far"

Below the cards:
- "How contributions work" expandable section explaining the review process
- "Your contribution impact" section (for logged-in users) showing their stats
- Recent contribution feed: "2 hours ago: User X confirmed a name in Dataset 4, triggering 12 cascade matches"

---

## 14. GAMIFICATION SYSTEM

### Philosophy

This isn't a game — it's a public accountability tool. But gamification mechanics (points, streaks, achievements, leaderboards) are proven to drive engagement. The goal is to make solving redactions feel as compelling as solving puzzles on Reddit or contributing to Wikipedia. Users should feel ownership over their discoveries and see the tangible downstream impact.

### XP (Experience Points) System

Every contribution earns XP. Different actions earn different amounts based on effort and impact:

| Action | Base XP | Multiplier |
|---|---|---|
| Submit a redaction proposal | 10 | × evidence quality (1-3x) |
| Proposal gets corroborated by others | 25 | × number of corroborations |
| Proposal confirmed as correct | 100 | × 1 |
| Cascade triggered (per downstream solve) | 50 | × cascade depth bonus |
| Submit image match | 15 | × 1 |
| Image match confirmed | 75 | × revealed entities count |
| Submit intelligence hint | 10 | × 1 |
| Intelligence hint leads to confirmed solve | 150 | × redactions matched |
| Vote/corroborate another's proposal | 5 | × 1 |
| Daily login streak (consecutive days) | 5 | × streak length (caps at 30) |
| First contribution of the day | 10 | × 1 |

### Levels

| Level | Title | XP Required | Unlocks |
|---|---|---|---|
| 1 | Observer | 0 | Search, browse, vote |
| 2 | Contributor | 50 | Submit proposals |
| 3 | Investigator | 250 | Submit intel hints, priority review queue |
| 4 | Analyst | 1,000 | Image matching, bulk export |
| 5 | Senior Analyst | 5,000 | Weighted votes (2x), suggest entity merges |
| 6 | Lead Investigator | 15,000 | Moderate proposals, flag spam |
| 7 | Chief Investigator | 50,000 | Admin dashboard access, cascade engine tuning |

### Achievements (Badges)

Achievements are displayed on user profiles and in the leaderboard. Each has a name, icon, and unlock condition:

**Discovery badges:**
- "First Blood" — First confirmed proposal
- "Chain Reaction" — Triggered a cascade of 10+ solves
- "Domino Effect" — Triggered a cascade of 50+ solves
- "Butterfly Effect" — Single contribution cascaded to 100+ solves
- "Across the Aisle" — Solved redactions in 5+ different datasets
- "Pattern Recognition" — Identified the same entity across 10+ documents
- "Cold Case Cracker" — Solved a redaction that was unsolved for 30+ days
- "Deep Diver" — Made contributions in every dataset (1-12)

**Community badges:**
- "Corroborator" — Corroborated 25 proposals
- "Eagle Eye" — 90%+ accuracy rate over 20+ proposals
- "Early Bird" — Among first 100 contributors
- "Validator" — Reviewed and voted on 100+ proposals
- "Mentor" — 5 of your proposals were used as evidence by others

**Effort badges:**
- "Streak: 7" through "Streak: 365" — Consecutive daily contributions
- "Centurion" — 100 confirmed contributions
- "Image Sleuth" — 10 confirmed image matches
- "Intelligence Asset" — 10 intelligence hints that led to solves

**Special badges:**
- "Cascade King/Queen" — Highest single cascade chain
- "Most Wanted" — Solved the #1 "most impactful unsolved" redaction
- "Founding Investigator" — Contributed during the first month

### Leaderboard

Two views:
- **All-time**: Ranked by total XP. Shows top 100 + your position.
- **This week**: Ranked by XP earned in the last 7 days. Resets weekly.
- **By cascade impact**: Ranked by total cascades triggered (how many downstream solves your work enabled).

Each leaderboard entry shows: Rank, display name, avatar, level badge, XP, achievements count, cascades triggered.

### Cascade Replay (The "Impact Visualization")

This is the dopamine hit. When a user solves a redaction that cascades, they can watch an **animated replay** of their impact:

1. Their solve appears as a glowing node
2. Lines animate outward to each cascaded redaction
3. Those cascade to more (if applicable)
4. Final tally fades in: "Your discovery unlocked 47 connections across 23 documents in 8 datasets"
5. Shareable: User can screenshot/share a link to this replay

**Implementation:** Pre-computed cascade tree stored in `redactions.cascade_source_id`. The frontend traverses the tree and animates with D3/Framer Motion. The replay is a page: `/cascade/[redaction_id]`.

### Database Tables

```sql
-- 00015_gamification_tables.sql

-- User XP and level tracking
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS level_title TEXT DEFAULT 'Observer';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_contribution_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_cascades_triggered INTEGER DEFAULT 0;

-- Achievement definitions (seeded at deploy time)
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,                       -- 'first_blood', 'chain_reaction', etc.
  name TEXT NOT NULL,                              -- "First Blood"
  description TEXT NOT NULL,                       -- "First confirmed proposal"
  icon TEXT NOT NULL,                              -- emoji or icon name
  category TEXT NOT NULL,                          -- discovery, community, effort, special
  requirement_type TEXT NOT NULL,                  -- 'count', 'streak', 'cascade', 'special'
  requirement_value INTEGER,                       -- threshold value
  xp_reward INTEGER DEFAULT 0,                     -- bonus XP when earned
  rarity TEXT DEFAULT 'common',                    -- common, uncommon, rare, epic, legendary
  sort_order INTEGER DEFAULT 0
);

-- User achievements (earned badges)
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  trigger_contribution_id UUID,                    -- which contribution earned this
  UNIQUE(user_id, achievement_id)
);

-- XP transaction log (every XP change)
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,                         -- positive or negative
  reason TEXT NOT NULL,                            -- 'proposal_confirmed', 'cascade_triggered', etc.
  contribution_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly leaderboard snapshot (materialized for performance)
CREATE MATERIALIZED VIEW weekly_leaderboard AS
SELECT
  up.id AS user_id,
  up.display_name,
  up.avatar_url,
  up.level,
  up.level_title,
  COALESCE(SUM(xt.amount), 0) AS weekly_xp,
  up.xp AS total_xp,
  up.total_cascades_triggered,
  COUNT(DISTINCT ua.achievement_id) AS achievement_count
FROM user_profiles up
LEFT JOIN xp_transactions xt ON xt.user_id = up.id
  AND xt.created_at >= now() - INTERVAL '7 days'
LEFT JOIN user_achievements ua ON ua.user_id = up.id
GROUP BY up.id, up.display_name, up.avatar_url, up.level, up.level_title, up.xp, up.total_cascades_triggered
ORDER BY weekly_xp DESC;
-- Refresh every hour via pg_cron or application-level cron
```

### Gamification on Every Page

- **Redaction dashboard**: "Solving this would earn you ~150 XP and could cascade to 47 others"
- **Search results**: When a result was unredacted by a user, show "Uncovered by @username (Cascade: 23 solves)"
- **Document viewer**: Solved redactions show a green glow with hover tooltip: "Solved by @username on Feb 10, 2026. This triggered 12 cascade matches."
- **Chat responses**: When citing an unredacted source, mention "This information was uncovered by community contributor @username"
- **Profile page**: Full stats dashboard — XP chart over time, achievement grid, cascade impact tree, contribution history

---

## 15. CONTRIBUTION SYSTEM — DETAILED UI FLOWS

### Flow A: "I Know What This Says" (Direct Unredaction)

```
REDACTION CARD (on dashboard or document viewer)
┌─────────────────────────────────────────────────────┐
│  REDACTION #4,271                     Dataset 3     │
│  FBI 302 Report, Page 12              March 2003    │
│                                                     │
│  "████████ was present at the dinner on March 14,   │
│   2005 with Epstein and [Ghislaine Maxwell]"        │
│                                                     │
│  Type: Person name    Length: ~8-10 characters       │
│  Nearby entities: Epstein, Maxwell, Palm Beach       │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  🔓 I Know What This Says                    │    │
│  │  ❓ 3 proposals pending (highest: 72%)       │    │
│  │  📊 Solving this could cascade to ~47 others │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘

        ↓ User clicks "I Know What This Says"

PROPOSAL FORM
┌─────────────────────────────────────────────────────┐
│  What does this redaction say?                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ [Text input: "Prince Andrew"]                │    │
│  └─────────────────────────────────────────────┘    │
│  ⚡ Character count: 14 (redaction estimate: 8-10)  │
│  ⚠️ Length mismatch — are you sure? [Y/N]           │
│                                                     │
│  How do you know?                                   │
│  ┌─────────────────┐                                │
│  │ [Dropdown]       │                                │
│  │ • Public statement by official                    │
│  │ • Found unredacted in another document            │
│  │ • Cross-reference with known facts                │
│  │ • Media report                                    │
│  │ • Court unsealed this                             │
│  │ • Logical deduction from context                  │
│  └─────────────────┘                                │
│                                                     │
│  Describe your evidence:                            │
│  ┌─────────────────────────────────────────────┐    │
│  │ [Textarea: "Rep. Tim Burchett stated on      │    │
│  │  C-SPAN on Feb 3, 2026 that..."]             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Source URLs (one per line):                        │
│  ┌─────────────────────────────────────────────┐    │
│  │ https://c-span.org/video/...                  │    │
│  │ https://reuters.com/article/...               │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Supporting documents in this archive (optional):   │
│  [Search box to find + link other docs/chunks]      │
│                                                     │
│  [Submit Proposal — Earn 10 XP]                     │
└─────────────────────────────────────────────────────┘
```

### Flow B: "I Have the Unredacted Image" (Image Matching)

```
IMAGE MATCH PAGE (/contribute/image-match)
┌─────────────────────────────────────────────────────┐
│  MATCH A KNOWN IMAGE                                 │
│                                                     │
│  Upload a publicly known image that matches a        │
│  redacted or blurred image in the archive.           │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │                                               │    │
│  │     📁 Drag & drop image here                 │    │
│  │        or click to browse                     │    │
│  │                                               │    │
│  │     Supports: JPG, PNG, TIFF (max 20MB)       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Where is this image from?                          │
│  ┌─────────────────────────────────────────────┐    │
│  │ [Textarea: "Published in Vanity Fair,         │    │
│  │  March 2003 issue, page 47"]                  │    │
│  └─────────────────────────────────────────────┘    │
│  Source URL: [________________________________]      │
└─────────────────────────────────────────────────────┘

        ↓ User uploads image → system runs visual similarity search

MATCH RESULTS (appears within seconds)
┌─────────────────────────────────────────────────────┐
│  POTENTIAL MATCHES FOUND: 3                          │
│                                                     │
│  Match #1 — 94.2% similarity                        │
│  ┌──────────────────┬──────────────────┐            │
│  │  YOUR IMAGE       │  CORPUS IMAGE    │            │
│  │  [clear photo]    │  [blurred/redact] │            │
│  │                   │                  │            │
│  │  Full resolution  │  Dataset 9,      │            │
│  │  party photo      │  Image #45,291   │            │
│  │  showing 4 people │  [REDACTED]       │            │
│  └──────────────────┴──────────────────┘            │
│  [✅ This is a match] [❌ Not a match]               │
│                                                     │
│  Match #2 — 87.1% similarity                        │
│  [Similar side-by-side layout]                      │
│  ...                                                │
│                                                     │
│  [Submit Confirmed Matches — Earn 15 XP per match]  │
└─────────────────────────────────────────────────────┘

        ↓ On confirmation, system:
        1. Links submitted image to corpus image
        2. Runs Gemini vision on the clear image
        3. Extracts newly visible faces/text/locations
        4. Creates/updates entity records
        5. Triggers cascade engine for any new entities
        6. Awards XP + checks for achievement unlocks
```

### Flow C: "I Have a Lead" (Intelligence Hints)

```
INTELLIGENCE FORM (/contribute/intelligence)
┌─────────────────────────────────────────────────────┐
│  SUBMIT INTELLIGENCE                                 │
│                                                     │
│  Share information that could help identify          │
│  redacted content across the archive. You don't     │
│  need to know which specific document — the system   │
│  will search for matches automatically.             │
│                                                     │
│  What kind of information do you have?              │
│  ┌─────────────────┐                                │
│  │ ○ A person was named (e.g., politician named     │
│  │   someone on the record)                          │
│  │ ○ An organization was identified                  │
│  │ ○ A location was identified                       │
│  │ ○ A relationship between people was revealed      │
│  │ ○ General context / background information        │
│  └─────────────────┘                                │
│                                                     │
│  ── IF "A person was named" ──                      │
│                                                     │
│  Person's name: [________________________________]   │
│  Also known as (aliases, one per line):             │
│  ┌─────────────────────────────────────────────┐    │
│  │ [e.g., "Sultan of ___", "The businessman",   │    │
│  │  alternate spellings]                         │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  What's their role/connection?                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ [Textarea: "Named as a client/associate who   │    │
│  │  visited Little St. James multiple times"]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Known associates (who else are they connected to?):│
│  [Tag input — search existing entities or add new]  │
│                                                     │
│  Time period (when were they involved?):            │
│  [Date range picker: ____ to ____]                  │
│                                                     │
│  Source:                                            │
│  ┌─────────────────┐                                │
│  │ ○ Congressional record / floor statement          │
│  │ ○ News article / investigative report             │
│  │ ○ Court filing / legal document                   │
│  │ ○ Video statement (TV, social media)              │
│  │ ○ Other                                           │
│  └─────────────────┘                                │
│  Source URL: [________________________________]      │
│  Exact quote (if available):                        │
│  ┌─────────────────────────────────────────────┐    │
│  │ [Textarea: verbatim quote from source]        │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [Submit Intelligence — Earn 10 XP]                 │
│                                                     │
│  After submission, the system will:                 │
│  • Search all 3.5M pages for possible matches       │
│  • Score unsolved redactions against this hint       │
│  • Queue high-probability matches for review        │
│  • Notify you when your hint leads to discoveries   │
└─────────────────────────────────────────────────────┘
```

### Intelligence Hint Processing Pipeline (Worker)

When an intelligence hint is submitted, the worker runs this asynchronously:

```
HINT SUBMITTED: "Sultan [Name] of [Country], identified by Rep. Burchett"
        │
        ▼
1. CREATE/UPDATE ENTITY
   ├── Name: "Sultan [Name]"
   ├── Type: person
   ├── Aliases: ["Sultan of [Country]", "[Name]", "The Sultan"]
   ├── Generate name_embedding (768d)
   └── Metadata: { "title": "Sultan", "country": "[Country]", "source": "Congressional statement" }
        │
        ▼
2. SEARCH ENTIRE CORPUS FOR MENTIONS
   ├── Vector search: name_embedding against all chunk embeddings
   ├── Keyword search: all aliases against content_tsv
   ├── Result: 14 chunks mention related terms
   └── Create entity_mentions for any direct matches
        │
        ▼
3. SCORE UNSOLVED REDACTIONS
   ├── For each unsolved redaction:
   │   ├── Does character length match any alias? (±3 chars)
   │   ├── Context embedding similarity > 0.70?
   │   ├── Document date overlaps with known involvement period?
   │   ├── Co-occurring entities include known associates?
   │   └── Compute fit_score (0-1)
   ├── Result: 7 redactions score > 0.60
   └── Auto-create proposals for top matches (status: 'ai_suggested')
        │
        ▼
4. NOTIFY
   ├── Hint submitter: "Your intel matched 7 possible redactions"
   ├── Community: New proposals in review queue
   └── Dashboard: "Most impactful unsolved" list updated
```

---

## BEGIN SCAFFOLDING

Initialize the repository and build everything described above. Start with `pnpm create next-app` and work through the implementation priorities in order. Create real, functional components — not placeholder "TODO" stubs. Every page should render with appropriate empty states. The database schema should be complete and ready for `supabase db push`.

Make it impressive. This is going to be the first thing potential donors see.
