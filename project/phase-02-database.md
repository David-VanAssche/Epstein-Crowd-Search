# Phase 2: Database

> **Sessions:** 1-2 | **Dependencies:** Phase 1 | **Parallel with:** Nothing (Phase 3+4 depend on this)

## Summary

Create all 15 Supabase migrations with the exact SQL schema from the scaffold, set up Supabase client libraries, and define TypeScript types for all database entities. This phase creates the complete data layer that all subsequent phases build on.

## Checklist

### Supabase Project Setup

- [ ] Create `supabase/` directory
- [ ] Create `supabase/config.toml` with project configuration
- [ ] Install Supabase CLI dev dependency: `pnpm add -D supabase`

### Migration 00001: Extensions

- [ ] `supabase/migrations/00001_extensions.sql`
  - `uuid-ossp` extension
  - `vector` extension (pgvector)
  - `pg_trgm` extension

### Migration 00002: Core Tables

- [ ] `supabase/migrations/00002_core_tables.sql`
  - `datasets` table (12 DOJ datasets, processing status, counts)
  - `documents` table (files with OCR, classification, processing status)
  - `chunks` table (text chunks with 768d embeddings + tsvector)
  - `chunks_tsv_trigger()` function and trigger
  - `images` table (with 1408d visual + description embeddings)
  - `videos` table (with transcripts)
  - `video_chunks` table (with 768d embeddings + tsvector)
  - `video_chunks_tsv_update` trigger
  - `processing_jobs` table (job queue)

### Migration 00003: Entity Tables

- [ ] `supabase/migrations/00003_entity_tables.sql`
  - `entities` table (people, orgs, locations with 768d name embedding)
  - `entity_mentions` table (entity-chunk-document links)
  - `entity_relationships` table (entity-to-entity with types, evidence, strength)
  - `no_self_relationship` constraint
  - Unique constraint on (entity_a_id, entity_b_id, relationship_type)

### Migration 00004: Redaction Tables

- [ ] `supabase/migrations/00004_redaction_tables.sql`
  - `redactions` table (detected redactions with context, cascade tracking, 768d embedding)
  - `redaction_proposals` table (user-submitted proposals with evidence, scoring)
  - `user_profiles` table (references auth.users, reputation, tier)
  - `proposal_votes` table (upvote/downvote/corroborate with unique constraint)

### Migration 00005: Timeline Tables

- [ ] `supabase/migrations/00005_timeline_tables.sql`
  - `timeline_events` table (dated events with type, location, entities, 768d embedding)

### Migration 00006: User Feature Tables

- [ ] `supabase/migrations/00006_user_tables.sql`
  - `saved_searches` table
  - `bookmarks` table (document, entity, or chunk)
  - `chat_conversations` table (with session tracking, model tier)

### Migration 00007: Search Functions

- [ ] `supabase/migrations/00007_search_functions.sql`
  - `hybrid_search_chunks_rrf()` — text RRF fusion with filters (dataset, doc type, date range)
  - `multimodal_search_rrf()` — cross-modal search (documents + images + videos)
  - `find_similar_redactions()` — context embedding similarity for cascade engine

### Migration 00008: Entity Functions

- [ ] `supabase/migrations/00008_entity_functions.sql`
  - Entity connection graph query (BFS from entity, depth-limited)
  - Entity search by name embedding (vector similarity)
  - Entity mention aggregation (count by document, by type)
  - Entity search by name trigram (pg_trgm fuzzy match)

### Migration 00009: Redaction Functions

- [ ] `supabase/migrations/00009_redaction_functions.sql`
  - `get_solvable_redactions()` — sorted by potential_cascade_count DESC
  - `get_cascade_tree()` — recursive CTE following cascade_source_id
  - `get_redaction_stats()` — counts by status
  - `calculate_proposal_confidence()` — weighted scoring function

### Migration 00010: Indexes

- [ ] `supabase/migrations/00010_indexes.sql`
  - IVFFlat indexes: chunks embedding (lists=200), images visual (100), images desc (100), entities name (50), redactions context (100), timeline (50), video_chunks (50)
  - GIN indexes: chunks_tsv, entities name trigram, video_chunks_tsv
  - B-tree indexes: entity_mentions (entity, document), relationships (a, b), redactions (status, document), timeline (date), processing_jobs (status+priority), documents (dataset, classification)

### Migration 00011: RLS Policies

- [ ] `supabase/migrations/00011_rls_policies.sql`
  - Enable RLS on ALL tables
  - Public read access: datasets, documents, chunks, images, videos, video_chunks, entities, entity_mentions, entity_relationships, redactions, timeline_events
  - Authenticated read+write: redaction_proposals (own), proposal_votes (own), saved_searches (own), bookmarks (own), chat_conversations (own)
  - User profiles: read all, update own
  - Service role bypass for worker operations

### Migration 00012: Stats Views

- [ ] `supabase/migrations/00012_stats_views.sql`
  - `corpus_stats` materialized view (total counts for documents, chunks, images, videos, entities, relationships, redactions, proposals, contributors)

### Migration 00013: Funding Tables

- [ ] `supabase/migrations/00013_funding_tables.sql`
  - `funding_status` table (single row: goal, raised, donor count)
  - `processing_spend_log` table (every dollar spent, transparent)
  - `donation_impact_tiers` table (reference data: 10 tiers from $1 to $5,000)

### Migration 00014: Contribution Tables

- [ ] `supabase/migrations/00014_contribution_tables.sql`
  - `image_match_submissions` table (uploaded images with 1408d embedding, match results)
  - `intelligence_hints` table (structured hints with 768d embedding, source credibility)
  - `contribution_activity` table (unified activity log with XP tracking)

### Migration 00015: Gamification Tables

- [ ] `supabase/migrations/00015_gamification_tables.sql`
  - ALTER `user_profiles`: add xp, level, level_title, streaks, last_contribution_date, total_cascades_triggered
  - `achievements` table (definitions: slug, name, icon, category, rarity)
  - `user_achievements` table (earned badges)
  - `xp_transactions` table (every XP change logged)
  - `weekly_leaderboard` materialized view

### Supabase Client Setup

- [ ] `lib/supabase/client.ts` — Browser client (uses NEXT_PUBLIC env vars)
- [ ] `lib/supabase/server.ts` — Server-side client (cookies-based, for RSC/API routes)
- [ ] `lib/supabase/admin.ts` — Service role client (for worker operations, bypasses RLS)

### TypeScript Types

- [ ] `types/supabase.ts` — Auto-generated types placeholder (regenerated via `scripts/setup-types.sh`)
- [ ] `types/entities.ts` — Entity, EntityMention, EntityRelationship, EntityType enum
- [ ] `types/search.ts` — SearchRequest, SearchResponse, SearchResult, SearchFilters, MultimodalResult
- [ ] `types/chat.ts` — ChatMessage, ChatConversation, ChatStreamEvent, ToolCall
- [ ] `types/redaction.ts` — Redaction, RedactionProposal, ProposalVote, RedactionStatus enum

### Scripts

- [ ] `scripts/setup-types.sh` — Regenerate Supabase TypeScript types from live schema

## Files to Create

```
supabase/
├── config.toml
└── migrations/
    ├── 00001_extensions.sql
    ├── 00002_core_tables.sql
    ├── 00003_entity_tables.sql
    ├── 00004_redaction_tables.sql
    ├── 00005_timeline_tables.sql
    ├── 00006_user_tables.sql
    ├── 00007_search_functions.sql
    ├── 00008_entity_functions.sql
    ├── 00009_redaction_functions.sql
    ├── 00010_indexes.sql
    ├── 00011_rls_policies.sql
    ├── 00012_stats_views.sql
    ├── 00013_funding_tables.sql
    ├── 00014_contribution_tables.sql
    └── 00015_gamification_tables.sql
lib/supabase/
├── client.ts
├── server.ts
└── admin.ts
types/
├── supabase.ts
├── entities.ts
├── search.ts
├── chat.ts
└── redaction.ts
scripts/
└── setup-types.sh
```

## Acceptance Criteria

1. All 15 migration files contain valid SQL
2. SQL can be reviewed for correctness (table references, foreign keys, constraints)
3. All vector dimensions correct: 768d for text, 1408d for visual
4. RRF search functions match the scaffold spec exactly
5. RLS policies correctly separate public read from authenticated write
6. Supabase clients export correctly and TypeScript compiles
7. All TypeScript type files compile without errors
8. Types align with database schema (field names, types, nullability)
9. `setup-types.sh` script is executable and documented

## Notes

- The exact SQL for migrations 00001-00007 and parts of 00010-00015 is provided in the scaffold prompt (`epstein-archive-scaffold-prompt.md` sections 3 and 12-14)
- Migrations 00008-00009 need to be generated based on the table patterns (entity functions, redaction functions)
- IVFFlat indexes require data to exist for optimal `lists` parameter — the values chosen are reasonable defaults
- Materialized views need periodic refresh — handled by cron or application logic in later phases
