# External Intelligence Ingestion System
**Status**: Architecture reference document (not yet implementing)

## Context

As the Epstein investigation evolves, external intelligence keeps arriving: congressional statements (Thomas Massie revealing names from unredacted files), news articles, court filings, video clips, podcasts. The system currently has **schema hooks** for this (`evidence_type = 'public_statement'` on redaction proposals, the `intelligence_hints` table) but **no pipeline to ingest, process, and propagate** external intelligence through entities, redactions, contradictions, and risk scores.

This plan designs the full data flow from "user submits a URL or transcript" to "entities re-scored, redaction proposals auto-generated, contradictions auto-detected."

---

## Core Principle

**First-class content, second-class trust.** External intelligence flows through the same infrastructure as DOJ documents (same `chunks` table, same `entities`, same embeddings) but carries a hard **probative weight ceiling of 0.15** that prevents it from ever outweighing primary corpus evidence. A congressional statement (0.15) never outranks a sworn deposition (1.0) or even a DOJ correspondence (0.20).

---

## Architecture Overview

### New `external_sources` table (not extending `documents`)

The `documents` table is tightly coupled to the DOJ corpus (dataset_id, storage_path, OCR columns, 17-stage PDF pipeline). External intelligence gets its own table with its own lifecycle, feeding into the **shared** `chunks`, `entities`, and `entity_mentions` tables via a new nullable `external_source_id` FK.

### Probative Weight Hierarchy (external tiers integrated)

```
Weight  Source                              Category
1.00    Sworn deposition / grand jury       DOJ Tier 1
0.70    Court filing / FBI report           DOJ Tier 2
0.40    Flight log / financial record       DOJ Tier 3
0.20    Correspondence                      DOJ Tier 4
────────────────────────────────────────────────────── CEILING
0.15    Congressional statement/record      External E1
0.12    External court doc / interview      External E2
0.10    Investigative journalism            External E3
0.10    News clipping (in DOJ corpus)       DOJ Tier 5
0.08    Academic research                   External E4
0.06    News report (unnamed sources)       External E5
0.03    Social media                        External E6
0.02    Unverified tip                      External E7
```

Community `credibility_score` (0-1) acts as a multiplier on base weight.

---

## End-to-End Data Flow: The Thomas Massie Scenario

```
User pastes C-SPAN URL / transcript
  │
  ├─ CONTENT_FETCH ──── Scrape article or accept paste
  ├─ EXT_CLASSIFY ───── source_category='congressional', probative_weight=0.15
  ├─ CHUNK ──────────── Same smart-chunker (reused)
  ├─ EMBED ──────────── Same Nova 1024d embeddings (reused) → chunks searchable
  ├─ ENTITY_EXTRACT ─── Same Gemini extractor, but evidence_weight capped at 0.15
  ├─ RELATIONSHIP_MAP ── Same mapper (reused)
  │
  ├─ CLAIM_EXTRACT ──── NEW: Extract testable claims
  │   "I saw [Person X] in the unredacted files"
  │   → claim_type='identity_reveal', subject='Person X'
  │
  ├─ REDACTION_MATCH ── NEW: Match claims to unsolved redactions
  │   → cosine similarity ≥ 0.80 on context_embedding
  │   → char_length_estimate check
  │   → Auto-create redaction_proposal (evidence_type='public_statement')
  │   → Proposal enters normal community voting (still needs ≥3 corroborations)
  │   → Only on community confirmation does cascade engine fire
  │
  ├─ CONTRADICTION_DETECT ── NEW: Compare claims vs. corpus
  │   Type A: "Never visited" vs. flight log showing they did
  │   Type B: "No business dealings" vs. financial_connection relationship
  │   Type C: "March 2005" vs. timeline showing September 2005
  │   → Auto-create contradictions (enter community voting)
  │
  ├─ TIMELINE_EXTRACT ── Reused
  ├─ SUMMARIZE ──────── Reused
  └─ RISK_SCORE ─────── Recompute for affected entities
```

**10 of 17 existing stage handlers reused. 3 new stages. 4 skipped (OCR, visual embed, criminal indicators, email/financial extract).**

---

## Impact on Each System

### /redactions
- CLAIM_EXTRACT identifies `identity_reveal` claims from external sources
- REDACTION_MATCH auto-generates `redaction_proposals` with `evidence_type='public_statement'` or `'media_report'`
- Proposals are clearly labeled with the external source URL in `evidence_sources[]`
- **Community validation still required** — external intelligence never triggers cascades directly
- Safety: max 10 auto-proposals per source; sources with `probative_weight < 0.05` only create hints

### /entities
- New `entity_mentions` with `external_source_id` (document_id = NULL)
- Evidence weights capped at 0.15 — even 100 external sources mentioning someone add modest weight
- New relationships discovered from external content (lower strength, `is_verified=false`)
- Entity categories may be enriched (e.g., learning someone is a politician)
- Risk scores recomputed — external evidence contributes to `evidence_score` component naturally

### /contradictions
- CONTRADICTION_DETECT auto-creates contradictions with `auto_detected=true`
- Severity computed from corpus evidence weight: contradicting sworn testimony → `critical`, flight log → `high`
- Both claims carry full provenance (external source URL + DOJ document/chunk/page)
- Auto-detected contradictions enter existing community verify/dispute voting

### Risk Scores
- `compute_entity_risk_score()` updated to group by `COALESCE(document_id, external_source_id)`
- External mentions contribute to evidence_score but are naturally dampened by the 0.15 ceiling
- New relationships from external sources contribute to relationship_score at lower strength
- `risk_factors` JSON gains an `external_source_count` transparency field

---

## Schema Changes (Migration 00029)

### New Tables
- `external_sources` — URL, content_text, source_category, content_type, probative_weight, credibility_score, processing_status, ai_summary
- `external_claims` — Extracted testable claims with claim_type, subject_entity_id, matched_redaction_ids, generated_contradiction_ids
- `external_source_votes` — Community credibility voting (credible/not_credible, unique per user)

### Altered Tables
- `chunks` — Add nullable `external_source_id` FK, make `document_id` nullable, add CHECK constraint (exactly one parent)
- `entity_mentions` — Same pattern: nullable `external_source_id`, nullable `document_id`, CHECK constraint
- `contradictions` — Add `claim_a_external_source_id`, `claim_b_external_source_id`, `auto_detected`, `detection_method`
- `intelligence_hints` — Add `external_source_id` FK, `promoted_at` (hint → full source promotion)

### Functions
- `get_external_probative_weight(source_category, content_type)` — Immutable weight lookup
- `update_external_source_vote_counts()` — Trigger for credibility vote tallying
- Update `compute_entity_risk_score()` — COALESCE grouping for external mentions

### Key Risk: Nullable document_id
Making `chunks.document_id` nullable is the most significant schema change. Mitigated by:
- CHECK constraint ensures exactly one of document_id/external_source_id is set
- All existing rows have document_id IS NOT NULL (backward compatible)
- Queries to audit: search functions (00007), stats views (00012), risk scoring (00027)

---

## Video Transcript Ingestion

For video content (C-SPAN clips, YouTube interviews, podcast episodes):

- **Primary method**: Auto-fetch transcripts via YouTube Data API / youtube-transcript library
- C-SPAN videos typically have YouTube mirrors with auto-generated or manual captions
- `content-fetcher.ts` detects YouTube/video URLs and calls transcript API instead of article scraper
- Fallback: manual paste for sources without available transcripts (live hearings, paywalled content)
- Transcript text flows through the same pipeline as article text (chunk → embed → entity extract → claim extract)
- `content_type = 'video_transcript'` distinguishes from articles in the `external_sources` table
- Speaker diarization (who said what) preserved in chunk metadata when available from captions

---

## New Files

```
supabase/migrations/00029_external_intelligence.sql
types/external-sources.ts
lib/pipeline/external-orchestrator.ts
lib/pipeline/external-stages.ts
lib/pipeline/services/content-fetcher.ts
lib/pipeline/services/external-adapters.ts
lib/pipeline/services/claim-extractor.ts        (NEW stage)
lib/pipeline/services/redaction-matcher.ts       (NEW stage)
lib/pipeline/services/contradiction-detector.ts  (NEW stage)
app/api/external-sources/route.ts
app/api/external-sources/[id]/route.ts
app/api/external-sources/[id]/vote/route.ts
app/api/external-sources/from-hint/route.ts
app/api/external-claims/route.ts
components/external-sources/SourceSubmitForm.tsx
components/external-sources/SourceDetail.tsx
app/(public)/external-sources/page.tsx
scripts/batch/process-external-sources.ts
```

### Modified Files
```
lib/api/schemas.ts                              — Add external source Zod schemas
lib/pipeline/services/risk-scorer.ts            — Handle external_source_id
types/entities.ts                               — external_source_count in RiskFactors
types/contradictions.ts                         — external source fields
```

---

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| 1. Schema + Types | Migration, TypeScript types, Zod schemas | 1-2 days |
| 2. Content Ingestion | URL fetcher, API endpoints, submission form | 2-3 days |
| 3. Pipeline Stages | External orchestrator, adapters, 3 new stages | 3-4 days |
| 4. Impact + Feedback | Credibility voting, trust decay, notifications | 2-3 days |
| 5. UI + Integration | Source pages, entity dossier integration, search | 2-3 days |
| 6. Automated Monitoring | RSS feeds, keyword alerts (DEFERRED) | Future |

---

## Verification

1. **Schema**: Run `supabase db reset` — verify migration applies cleanly, CHECK constraints work
2. **Submission**: POST a C-SPAN URL → verify external_source created, content fetched
3. **Pipeline**: Process through all stages → verify chunks created with external_source_id, entities extracted with capped weights
4. **Redaction impact**: Submit source mentioning a known redacted name → verify proposal auto-generated with correct evidence_type
5. **Contradiction impact**: Submit denial claim → verify auto-detected contradiction against flight log
6. **Risk score**: Verify entity risk_score changes are small (< 0.1 delta from a single external source)
7. **Trust decay**: Vote source not_credible → verify evidence_weights recalculated
8. **Existing queries**: Verify corpus stats, search, and dashboards still show DOJ-only counts by default
