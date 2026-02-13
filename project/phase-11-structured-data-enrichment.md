# Phase 11: Structured Data & Schema Enrichment

> **Sessions:** 2-3 | **Dependencies:** Phase 2 (database), Phase 6 (pipeline) | **Parallel with:** Nothing

## Summary

Add structured data extraction capabilities and schema enrichment for the five major data types missing from the platform: emails, financial transactions, property ownership, contradictions, and investigation thread convergences. Also enriches person entities with sub-categories (associate, politician, victim, etc.) and Wikidata metadata (photos, birth/death dates, nationality, occupation). Adds ghost flight detection fields to flights. Two new pipeline stages (13: Email Extract, 14: Financial Extract) and four batch scripts for enrichment.

## IMPORTANT: Dependencies on Prior Phases

- Phase 2: All core tables (entities, documents, chunks, entity_relationships) must exist
- Phase 6: Pipeline orchestrator + batch infrastructure must be working
- Entity extraction (Stage 5) must be complete for entity resolution in email/financial extraction

---

## Step-by-Step Execution

### Step 1: Create migration `00021_structured_data_enrichment.sql`

File: `supabase/migrations/00021_structured_data_enrichment.sql`

9 sections:
1. **Entity enrichment columns** — `category` TEXT CHECK (15 values), `wikidata_id`, `photo_url`, `birth_date`, `death_date`, `nationality[]`, `occupation[]`
2. **Flight enrichment columns** — `manifest_status` CHECK ('full','partial','missing'), `data_source_type` CHECK (6 values), `leg_number`, `trip_group_id`
3. **Emails table** — 27 columns: from/to/cc with entity resolution, thread_id, body_tsv, attachments, confidence
4. **Financial transactions table** — 15 columns: from/to entities, amount, type, suspicious flags, shell_company_involved
5. **Property ownership table** — from/to dates, acquisition type/amount, shell_company flag, document_ids[]
6. **Contradictions table** — claim A/B with chunk+doc refs, severity CHECK, tags[], auto-verify trigger at 3 verify votes
7. **Thread convergences table** — auto-sort BEFORE INSERT trigger swaps pairs so thread_a_id < thread_b_id, UNIQUE constraint
8. **Extraction type update** — add 'email' and 'financial_transaction' to structured_data_extractions CHECK
9. **Helper functions** — full-text search on email body via tsvector trigger, RLS policies (public read, auth write)

### Step 2: Update type definitions

Files:
- `types/structured-data.ts` — NEW: PersonCategory (15 values), ManifestStatus, FlightDataSourceType, TransactionType, AcquisitionType, ContradictionSeverity, OverlapType, Email, FinancialTransaction, PropertyOwnership, Contradiction, ThreadConvergence interfaces
- `types/entities.ts` — MODIFY: add `category`, `wikidata_id`, `photo_url`, `birth_date`, `death_date`, `nationality`, `occupation` to Entity interface
- `types/collaboration.ts` — MODIFY: add `'email' | 'financial_transaction'` to ExtractionType union

### Step 3: Add pipeline stages 13+14

File: `lib/pipeline/stages.ts` — MODIFY

Add enum values:
- `EMAIL_EXTRACT = 'email_extract'` (depends on ENTITY_EXTRACT)
- `FINANCIAL_EXTRACT = 'financial_extract'` (depends on ENTITY_EXTRACT)
- `CO_FLIGHT_LINKS = 'co_flight_links'` (Phase 12, depends on ENTITY_EXTRACT)
- `NETWORK_METRICS = 'network_metrics'` (Phase 12, depends on CO_FLIGHT_LINKS)

### Step 4: Build email extractor service

File: `lib/pipeline/services/email-extractor.ts` — NEW

- `handleEmailExtract(documentId, supabase)` stage handler
- `EmailExtractorService` class
- Checks document classification (correspondence/email/memo/letter)
- Idempotency: skips if emails already exist for this document
- Gemini Flash JSON extraction with structured prompt
- Entity resolution via fuzzy name matching (ILIKE on last name)
- Inserts into `emails` table + `structured_data_extractions`

### Step 5: Build financial extractor service

File: `lib/pipeline/services/financial-extractor.ts` — NEW

- `handleFinancialExtract(documentId, supabase)` stage handler
- `FinancialExtractorService` class
- Checks classification (financial_record/tax_filing/bank_statement/invoice/receipt/legal_financial)
- Suspicious pattern flagging: cash >$10K, round amounts >$100K, offshore keywords, shell company indicators
- Entity resolution for from/to parties
- Inserts into `financial_transactions` + `structured_data_extractions`

### Step 6: Build person categorizer service

File: `lib/pipeline/services/person-categorizer.ts` — NEW

- `PersonCategorizerService.categorizeAll()` method
- Batches 20 person entities per Gemini API call
- Validates against 15 PersonCategory values
- Updates `entities.category` and `metadata.category_confidence`
- `--limit` and `--dry-run` support via batch script

### Step 7: Build Wikidata enrichment script

File: `scripts/batch/enrich-wikidata.ts` — NEW

- SPARQL queries to Wikidata API
- Rate-limited at 1 request per 1.2 seconds
- Searches by entity name with alias fallback
- Writes: `wikidata_id`, `photo_url`, `birth_date`, `death_date`, `nationality[]`, `occupation[]`
- Marks `NOT_FOUND` in metadata to avoid re-querying

### Step 8: Create batch scripts

Files:
- `scripts/batch/extract-emails.ts` — NEW
- `scripts/batch/extract-financial.ts` — NEW
- `scripts/batch/categorize-persons.ts` — NEW

All support `--dataset-id`, `--limit`, `--dry-run` flags.

### Step 9: Register stages in run-all.ts

File: `scripts/batch/run-all.ts` — MODIFY: import and register EMAIL_EXTRACT, FINANCIAL_EXTRACT handlers

### Step 10: Add package.json scripts

File: `package.json` — MODIFY: add `batch:emails`, `batch:financial`, `batch:categorize`, `batch:wikidata`

---

## Gotchas

1. Thread convergence auto-sort trigger must fire BEFORE INSERT to swap pairs before the UNIQUE constraint evaluates
2. Email `thread_id` is TEXT (not UUID) — preserves RFC 2822 Message-ID headers for cross-dataset matching
3. Contradiction auto-verify trigger fires on contradiction_votes INSERT, not on contradictions UPDATE
4. Wikidata SPARQL rate limit is ~1 req/s — standalone script, not a pipeline stage
5. Email body_tsv trigger uses `to_tsvector('english', ...)` — must match search query config
6. Financial extractor `suspicious_reasons` is TEXT[] — accumulated from multiple detection rules
7. Entity resolution uses ILIKE on last name + first initial — trade-off between speed and accuracy
8. `handleEmailExtract` returns `{ success, error? }` but StageHandler expects `Promise<void>` — wrapper needed in run-all.ts
9. Person categorizer batches 20 at a time to stay within Gemini token limits
10. Wikidata script marks NOT_FOUND to avoid re-querying on subsequent runs

## Files Created/Modified

```
supabase/migrations/00021_structured_data_enrichment.sql     NEW
types/structured-data.ts                                      NEW
types/entities.ts                                             MODIFY
types/collaboration.ts                                        MODIFY
lib/pipeline/stages.ts                                        MODIFY
lib/pipeline/services/email-extractor.ts                      NEW
lib/pipeline/services/financial-extractor.ts                  NEW
lib/pipeline/services/person-categorizer.ts                   NEW
scripts/batch/enrich-wikidata.ts                              NEW
scripts/batch/extract-emails.ts                               NEW
scripts/batch/extract-financial.ts                            NEW
scripts/batch/categorize-persons.ts                           NEW
scripts/batch/run-all.ts                                      MODIFY
package.json                                                  MODIFY
```

## Acceptance Criteria

- [x] Migration applies cleanly; all CHECK constraints reject invalid values
- [x] Thread convergences auto-sort trigger swaps `(B, A)` → `(A, B)` and deduplicates
- [x] Email/financial extractors skip non-matching document classifications
- [x] Both extractors are idempotent (re-run doesn't duplicate)
- [x] Wikidata script enriches entities with photos, dates, nationality
- [x] `pnpm tsc --noEmit` passes (non-test files)
