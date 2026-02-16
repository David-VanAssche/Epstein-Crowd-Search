# Phase 5: Post-Import Processing

After all data is imported (Phases 2-4), run remaining pipeline stages, refresh materialized views, and update denormalized counts.

## 5A. Remaining Pipeline Stages

These stages depend on chunks + entities existing. Run in order.

> **Note (Audit H2)**: `run-all.ts` currently has skip checks for OCR, CHUNK, and ENTITY_EXTRACT only. Community-imported docs that already have classifications or embeddings will be redundantly re-processed. Before running these stages at scale, add skip checks to `run-all.ts` for:
> - **EMBED**: Skip if `embedding_model` already matches target model
> - **CLASSIFY**: Skip if `classification` already exists

### Classification
```bash
npx tsx scripts/batch/run-all.ts --stage classify
```
Classifies each document into one of the document types (deposition, flight_log, fbi_302, financial, email, court_filing, police_report, correspondence, photo). Sets `documents.classification`.

### Contextual Headers
```bash
npx tsx scripts/batch/run-all.ts --stage contextual_headers
```
Generates 50-100 token context header per chunk using LLM. Improves search quality by adding document context to each chunk. Sets `chunks.contextual_header`.

**Cost**: ~$0.0005/page — uses LLM API call per chunk.

### Redaction Detection
```bash
npx tsx scripts/batch/run-all.ts --stage redaction_detect
```
Detects and catalogs redacted regions with surrounding context. Populates `redactions` table. Critical for the Cascade Engine (cross-document redaction matching).

### Timeline Extraction
```bash
npx tsx scripts/batch/run-all.ts --stage timeline_extract
```
Extracts dated events from chunks. Populates `timeline_events` table. Powers the `/timeline` page.

### Document Summarization
```bash
npx tsx scripts/batch/run-all.ts --stage summarize
```
Generates executive summary for each document. Sets `documents.ai_summary`.

### Criminal Indicators
```bash
npx tsx scripts/batch/run-all.ts --stage criminal_indicators
```
Flags evidence of trafficking, obstruction, conspiracy, financial crimes. Uses entity + relationship data.

### Email Extraction
```bash
npx tsx scripts/batch/run-all.ts --stage email_extract
```
For documents classified as correspondence/email — extracts structured fields into `emails` table.

### Financial Extraction
```bash
npx tsx scripts/batch/run-all.ts --stage financial_extract
```
For financial documents — extracts transactions into `financial_transactions` table.

## 5B. Co-Flight Links + Network Metrics

These are aggregate stages that run across all data, not per-document:

```bash
npx tsx scripts/batch/generate-co-flight-links.ts
npx tsx scripts/batch/compute-network-metrics.ts
```

- Co-flight links: Creates `traveled_with` relationships from shared flights
- Network metrics: Computes PageRank, betweenness centrality across entity network

## 5C. Refresh Materialized Views

After all data is populated, refresh the materialized views created by migration 00022:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY flight_passenger_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY email_communication_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY entity_network_metrics;
```

Run via:
```bash
npx supabase db execute --sql "REFRESH MATERIALIZED VIEW CONCURRENTLY flight_passenger_stats;"
npx supabase db execute --sql "REFRESH MATERIALIZED VIEW CONCURRENTLY email_communication_stats;"
npx supabase db execute --sql "REFRESH MATERIALIZED VIEW CONCURRENTLY entity_network_metrics;"
```

## 5D. Update Denormalized Counts

```sql
-- Update document chunk counts
UPDATE documents d SET chunk_count = (
  SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id
) WHERE chunk_count = 0 OR chunk_count IS NULL;

-- Update document entity counts
UPDATE documents d SET entity_count = (
  SELECT COUNT(DISTINCT em.entity_id) FROM entity_mentions em WHERE em.document_id = d.id
) WHERE entity_count = 0 OR entity_count IS NULL;

-- Update dataset document counts
UPDATE datasets ds SET document_count = (
  SELECT COUNT(*) FROM documents d WHERE d.dataset_id = ds.id
);

-- Update dataset page counts
UPDATE datasets ds SET page_count = (
  SELECT COALESCE(SUM(d.page_count), 0) FROM documents d WHERE d.dataset_id = ds.id
);
```

## 5E. Update Processing Status

Mark all successfully processed documents as complete:
```sql
UPDATE documents
SET processing_status = 'complete'
WHERE processing_status = 'community'
  AND ocr_text IS NOT NULL
  AND chunk_count > 0
  AND id IN (SELECT DISTINCT document_id FROM chunks WHERE content_embedding IS NOT NULL);
```

## Total Pipeline Cost Estimate

| Stage | Est. documents | Cost/doc | Total |
|-------|---------------|----------|-------|
| Embedding (Phase 3) | ~305K chunks | ~$0.00003 | ~$9 |
| Entity extraction (Phase 4) | ~70K docs | $0.0004-0.01 | $30-700 |
| Classification | ~70K docs | $0.0002 | ~$14 |
| Contextual headers | ~305K chunks | $0.0005 | ~$150 |
| Redaction detection | ~70K docs | $0.0005 | ~$35 |
| Timeline extraction | ~70K docs | $0.0005 | ~$35 |
| Summarization | ~70K docs | $0.0003 | ~$21 |
| Criminal indicators | ~70K docs | $0.0008 | ~$56 |
| **Total (low, Fireworks entities)** | | | **~$350** |
| **Total (high, Gemini entities)** | | | **~$1,020** |

Note: These are estimates. Actual costs depend on document sizes and API pricing.

## Execution Order

```
1. classify              (depends on: documents with ocr_text)
2. contextual_headers    (depends on: chunks)
3. embedding             (depends on: contextual_headers)  ← Phase 3
4. entity_extract        (depends on: chunks)              ← Phase 4
5. relationship_map      (depends on: entity_extract)
6. redaction_detect      (depends on: chunks)
7. timeline_extract      (depends on: entity_extract)
8. summarize             (depends on: entity_extract)
9. criminal_indicators   (depends on: entity_extract + relationship_map)
10. email_extract        (depends on: entity_extract)
11. financial_extract    (depends on: entity_extract)
12. co_flight_links      (depends on: email_extract + entity_extract)
13. network_metrics      (depends on: co_flight_links)
14. Refresh materialized views
15. Update denormalized counts
```

## Verification

### Final health check
```sql
-- Overall stats
SELECT
  (SELECT COUNT(*) FROM documents) as total_documents,
  (SELECT COUNT(*) FROM documents WHERE processing_status = 'complete') as completed,
  (SELECT COUNT(*) FROM documents WHERE processing_status = 'failed') as failed,
  (SELECT COUNT(*) FROM chunks) as total_chunks,
  (SELECT COUNT(*) FROM chunks WHERE content_embedding IS NOT NULL) as embedded_chunks,
  (SELECT COUNT(*) FROM entities) as total_entities,
  (SELECT COUNT(*) FROM entity_mentions) as total_mentions,
  (SELECT COUNT(*) FROM entity_relationships) as total_relationships,
  (SELECT COUNT(*) FROM flights) as total_flights,
  (SELECT COUNT(*) FROM timeline_events) as total_timeline_events,
  (SELECT COUNT(*) FROM redactions) as total_redactions;
```

### Page tests
- [ ] `/search` — returns results for "Jeffrey Epstein"
- [ ] `/entities` — shows entity list with mention counts
- [ ] `/timeline` — shows timeline events
- [ ] `/flights` — shows flight data
- [ ] `/emails` — shows email threads
- [ ] `/redactions` — shows redacted content
- [ ] `/analysis` — network graph renders

## Checklist

- [ ] All pipeline stages run without errors
- [ ] Materialized views refreshed
- [ ] Denormalized counts updated
- [ ] No documents stuck in 'failed' status (or failures investigated)
- [ ] Search returns relevant results
- [ ] All application pages render with real data
- [ ] Database size checked (should be < 8GB)
