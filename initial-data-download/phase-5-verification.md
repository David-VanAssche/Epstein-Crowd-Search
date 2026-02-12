# Phase 5: Verification & Coverage Report

**Time:** ~1 hour
**Run on:** Local machine
**Cost:** $0
**Prerequisites:** All previous phases complete
**Result:** Complete coverage report, all data cross-validated

## Tasks

- [ ] 5.1: Cross-reference against theelderemo/FULL_EPSTEIN_INDEX
- [ ] 5.2: Verify PDF integrity (spot-check random samples)
- [ ] 5.3: Verify OCR text coverage
- [ ] 5.4: Verify embedding coverage
- [ ] 5.5: Verify entity counts
- [ ] 5.6: Generate final coverage report
- [ ] 5.7: Update data_sources table with final counts

---

### 5.1: Cross-Reference

Download `theelderemo/FULL_EPSTEIN_INDEX` from HuggingFace.
Compare document list against our `documents` table.
Report any missing documents.

### 5.2: PDF Integrity

For each dataset, download 5 random PDFs from Supabase Storage.
Verify they open correctly in a PDF reader.
Check file sizes are > 0 and match expected ranges.

### 5.3: OCR Text Coverage

```sql
SELECT
  dataset_id,
  COUNT(*) as total_docs,
  COUNT(ocr_source) as ocr_complete,
  ROUND(COUNT(ocr_source)::numeric / COUNT(*)::numeric * 100, 1) as ocr_pct
FROM documents
GROUP BY dataset_id
ORDER BY dataset_id;
```

### 5.4: Embedding Coverage

```sql
SELECT
  embedding_model,
  COUNT(*) as chunk_count
FROM chunks
WHERE embedding IS NOT NULL
GROUP BY embedding_model;
```

Expected: ~305K chunks (236K FBI + 69K House Oversight)

### 5.5: Entity Counts

```sql
SELECT source, entity_type, COUNT(*) as count
FROM entities
GROUP BY source, entity_type
ORDER BY count DESC;
```

Expected: 86K+ entities from ErikVeland + LMSBAND + epstein-docs + maxandrews

### 5.6: Final Coverage Report

Generate a JSON/markdown report:
```json
{
  "total_pdfs": 0,
  "total_ocr_text": 0,
  "total_chunks_with_embeddings": 0,
  "total_entities": 0,
  "total_relationships": 0,
  "datasets": {
    "1": { "pdfs": 0, "ocr_pct": 0, "entities": 0 },
    ...
  },
  "gaps": {
    "videos_untranscribed": 2000,
    "images_unclassified": 180000,
    "pages_without_ocr": 0
  }
}
```

This report feeds directly into the Stats page UI.

## Acceptance Criteria

- [ ] Coverage report generated
- [ ] No missing documents vs. FULL_EPSTEIN_INDEX
- [ ] All spot-checked PDFs valid
- [ ] data_sources table reflects final ingestion state
- [ ] Gaps documented for crowdsource dashboard
