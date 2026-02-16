# rhowardstone/Epstein-research Integration

## Vision

Import 6+ GB of structured research data from [rhowardstone/Epstein-research](https://github.com/rhowardstone/Epstein-research) — the most methodologically rigorous independent analysis of the Epstein corpus — and adopt their 6 key techniques that we currently lack. This upgrades our pipeline from "LLM-first" to "forensic-first" methodology, saving significant compute costs and producing more reliable results.

## Source Repository Analysis

rhowardstone's repo contains:

| Asset | Size | Contents |
|-------|------|----------|
| `full_text_corpus.db` | 6.08 GB | All page OCR text across 2.73M pages |
| `redaction_analysis_v2.db` | 2.58M records | Spatial + OCR-layer redaction detection results |
| `knowledge_graph.db` | ~50 MB | 524 entities, 2,096 relationships |
| `persons_registry.json` | ~2 MB | 1,614 persons with role categorization |
| `image_analysis.db` | ~500 MB | 38,955 image analysis records |
| `transcripts.db` | ~100 MB | 375 speech/audio transcriptions |
| Investigation reports | 100+ files | Markdown reports with congressional scoring |

Their methodology differs fundamentally from ours:

```
rhowardstone: PDF forensics → spatial analysis → OCR noise filtering → verified text
Our current:   Raw OCR → LLM classification → LLM extraction → everything

Key insight: ~98% of "recovered redaction text" from OCR layers is noise.
Without their filtering methodology, our redaction detection will be full of false positives.
```

## Key Architecture Decisions (from Council Review)

### 1. Import OCR Text to `chunks` Table, Not a New `pages` Table
The DeepReason council proposed a `pages` table for raw OCR text. **Rejected** — we already have `chunks` with `document_id` + `chunk_index` + `content`. Import rhowardstone OCR text as chunks with `ocr_source = 'rhowardstone'` and skip our Document AI OCR stage for these documents. This saves ~$3,250 per full-corpus OCR run.

### 2. Filter Before Import: Discard ~98% of "Recovered" Redaction Text
rhowardstone discovered that most "hidden text under redactions" is OCR noise from the scanning process (Tr=3 invisible text rendering mode). Their filtering methodology must be replicated before we import redaction analysis data. Importing unfiltered data would poison our redaction confidence scores.

### 3. Spatial Redaction Detection Runs at Ingest, Not at LLM Stage
Current pipeline detects redactions at stage 9 (LLM-based). rhowardstone uses PyMuPDF to detect black rectangles at the PDF level — this is deterministic, fast, and free. **Decision:** Add spatial detection as a sub-step of stage 1 (OCR), before any LLM processing. The LLM redaction stage becomes a supplementary check for non-spatial redaction types (whiteouts, over-stamps).

### 4. Entity Import Uses Existing Dedup Infrastructure
Our migration 00027 already has `normalize_entity_name()` and unique constraints on `(name_normalized, entity_type)`. Import rhowardstone's 524 entities and 1,614 persons through this pipeline with ON CONFLICT merging. Their person role categorizations become `metadata.rhowardstone_role` for cross-reference.

### 5. Investigation Reports Are a New Content Type, Not Documents
100+ markdown investigation reports don't belong in the `documents` table (those are primary source documents). **Decision:** New `investigation_reports` table with author attribution, congressional relevance scores, and linked entity/document references. Displayed on a dedicated `/reports` page.

### 6. Security First: PII and Sealed Content
The security council identified CRITICAL risks with importing entity metadata (phone numbers, addresses) and court-sealed redaction content. **Decision:** Phase 0 hardens RLS policies before any data import begins.

## Phases

| Phase | Name | Focus | Status |
|-------|------|-------|--------|
| 0 | [Security Prerequisites](phase-00-security-prerequisites.md) | RLS hardening, PII protection, provenance tracking | Not started |
| 1 | [Data Import](phase-01-data-import.md) | Import 6 SQLite DBs + JSON + reports into Supabase | Not started |
| 2 | [Methodology Upgrades](phase-02-methodology-upgrades.md) | Spatial redaction, OCR layer extraction, noise filtering | Not started |
| 3 | [Investigation UI](phase-03-investigation-ui.md) | /reports page, /start-here guide, quality badges | Not started |
| 4 | [Media & Corrections](phase-04-media-and-corrections.md) | Media browser, DOJ links, self-correction audit trail | Not started |
| 5 | [Validation](phase-05-validation.md) | Cross-reference verification, regression testing | Not started |

## What We Gain

| Capability | Before | After |
|-----------|--------|-------|
| OCR text coverage | 0% (pending Document AI) | ~100% (rhowardstone corpus) |
| Redaction detection | LLM-only, high false positive | Spatial + OCR-layer + LLM (3-method) |
| Entity count | ~0 imported | 1,614 persons + 524 entities |
| Relationships | 0 | 2,096 verified relationships |
| Image analysis | 0 | 38,955 analyzed images |
| Audio transcripts | 0 | 375 transcriptions |
| Investigation reports | 0 | 100+ reports with congressional scoring |
| OCR cost savings | $3,250/run | $0 (pre-existing OCR text) |

## What They Don't Have (Our Advantages)

- Community participation (crowdsourced redaction solving, voting)
- Semantic search (pgvector + 1024d Nova embeddings)
- Real-time collaboration (proposal/vote system)
- Structured entity dossier pages
- 17-stage enrichment pipeline with LLM extraction
- Donation-funded processing model
- Social intelligence feed (planned)
- Network analysis visualization

## Council Reviews

Detailed analysis from each council member:

- [DeepReason — Data Import Architecture](council-reviews/review-deepreason-import.md)
- [CodeReviewer — Pipeline Methodology Upgrades](council-reviews/review-codereview-methodology.md)
- [FrontendExpert — UI/UX Design](council-reviews/review-gemini-ux.md)
- [Security Reviewer — Risk Assessment](council-reviews/review-opus-security.md)

## Dependencies

- **Blocked by:** Phase 0 data import (seed-datasets, parse-opt-files) must complete first so we have `documents` rows to attach imported data to
- **Depends on:** Migration 00027 (entity dedup) already applied
- **External:** rhowardstone repo must be cloned locally or downloaded as release artifacts
