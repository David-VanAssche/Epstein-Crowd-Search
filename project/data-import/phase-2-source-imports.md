# Phase 2: Per-Source Import Scripts

Build and run one import script per data source, in priority order. Each script is independent and idempotent.

---

## Priority 1: s0fskr1p OCR Text

**File**: `scripts/import/import-s0fskr1p.ts`
**Source**: `raw-archive/github/s0fskr1p/` (~1,644 files, 4.0GB)
**Value**: OCR text that reveals content hidden under overlay redactions. Highest-quality OCR available.

### Import logic

1. List all `.txt` files from Storage
2. For each file:
   - Download text content
   - Parse filename to extract document identifier (e.g., `Government Exhibit 123.txt`)
   - Match to DOJ dataset by filename pattern where possible
   - Create `document` row:
     - `ocr_text` = file content
     - `ocr_source` = 's0fskr1p'
     - `file_type` = 'pdf' (original was PDF, OCR text extracted)
     - `processing_status` = 'community'
     - `storage_path` = path to original PDF in doj/ folder if matchable
3. Update `data_sources` status

### After import

Documents are ready for: **chunking → embedding → entity extraction**

### Verify
```sql
SELECT COUNT(*) FROM documents WHERE ocr_source = 's0fskr1p';  -- ~1,644
SELECT COUNT(*) FROM documents WHERE ocr_source = 's0fskr1p' AND ocr_text IS NOT NULL;  -- same
```

---

## Priority 2: benbaessler Pre-Chunked Text

**File**: `scripts/import/import-benbaessler.ts`
**Source**: `raw-archive/github/benbaessler/` (~23,225 files, 146MB)
**Value**: Pre-chunked text — saves chunking step.

### Import logic

1. List all files from Storage
2. Group files by document (likely naming convention: `doc_001_chunk_001.txt`)
3. For each document group:
   - Concatenate chunks to reconstruct full `ocr_text`
   - Create `document` row with `ocr_source = 'benbaessler'`, `processing_status = 'community'`
4. For each chunk file:
   - Create `chunks` row with:
     - `source` = 'benbaessler'
     - `content` = chunk text
     - `chunk_index` = parsed from filename
     - `embedding_model` = NULL (needs Nova embedding)
5. Update `documents.chunk_count`

### After import

Documents are ready for: **embedding → entity extraction** (chunking already done)

### Verify
```sql
SELECT COUNT(*) FROM documents WHERE ocr_source = 'benbaessler';
SELECT COUNT(*) FROM chunks WHERE source = 'benbaessler';
SELECT COUNT(*) FROM chunks WHERE source = 'benbaessler' AND content_embedding IS NULL;  -- all need embedding
```

---

## Priority 3: epstein-docs JSON Documents

**File**: `scripts/import/import-epstein-docs.ts`
**Source**: `raw-archive/github/epstein-docs/` (~29,525 files, 137MB)
**Value**: Structured JSON with metadata fields (dates, classification, etc.)

### Import logic

1. List all `.json` files from Storage
2. For each file:
   - Download and parse JSON
   - Extract: `text`, `title`, `date`, `classification`, `source_url`, `page_count`
   - Create `document` row with extracted fields, `ocr_source = 'epstein-docs'`
   - Chunk using `chunkDocument()` from `lib/pipeline/services/smart-chunker.ts`
   - Insert `chunks` rows with `source = 'epstein-docs'`

### Reuses
- `lib/pipeline/services/smart-chunker.ts` → `chunkDocument()` function

### After import

Documents are ready for: **embedding → entity extraction**

### Verify
```sql
SELECT COUNT(*) FROM documents WHERE ocr_source = 'epstein-docs';  -- ~29,525
SELECT COUNT(*) FROM chunks WHERE source = 'epstein-docs';
```

---

## Priority 4: svetfm Pre-Chunked + Pre-Embedded (HuggingFace)

**File**: `scripts/import/import-svetfm.ts`
**Source**: `raw-archive/huggingface/svetfm-fbi/` (133 files, 2.4GB) + `svetfm-nov11/` (7 files, 341MB)
**Value**: Complete chunks with 768d nomic-embed-text embeddings. Text is ready; embeddings need upgrading to 1024d Nova.

### Import logic

1. Download parquet/JSON files from Storage
2. Parse HuggingFace dataset format:
   - Each record contains: `text`, `embedding` (768d array), `metadata` (document info)
3. For each unique document in the dataset:
   - Create `document` row with `embedding_source = 'svetfm'`, `processing_status = 'community'`
4. For each chunk:
   - Create `chunks` row with:
     - `source` = 'svetfm'
     - `embedding_model` = 'nomic-embed-text'
     - `content_embedding` = NULL (768d embeddings discarded — too different from 1024d Nova)
     - OR: store 768d as metadata for reference, leave `content_embedding` NULL

### Important decision

The existing 768d nomic-embed-text vectors cannot be mixed with 1024d Nova vectors in the same column. Options:
- **A) Discard 768d, embed from scratch** (recommended — simpler, consistent)
- B) Store 768d in a metadata JSONB field for reference

### After import

Documents are ready for: **embedding** (chunks exist, embeddings need Nova)

### Dependency

May need `@huggingface/hub` or `parquet-wasm` package for parquet parsing. Check file formats first.

---

## Priority 5: maxandrews + lmsband Entity Databases

**File**: `scripts/import/import-entity-dbs.ts`
**Source**: `raw-archive/github/maxandrews/` (29,823 files, 309MB) + `lmsband/` (21 files, 29MB)
**Value**: Pre-extracted entities and relationships.

### Import logic

1. Download `.sqlite` / `.db` files from Storage to temp directory
2. Open with `better-sqlite3` (needs `pnpm add -D better-sqlite3 @types/better-sqlite3`)
3. Read entity tables (inspect schema first — unknown format)
4. For each entity:
   - Compute `name_normalized` via `normalizeEntityName()`
   - Upsert into `entities` table (ON CONFLICT on `(name_normalized, entity_type)`)
   - Merge aliases, increment `mention_count`
   - Set `source` = 'lmsband' or 'maxandrews'
5. For relationships (if present in SQLite):
   - Map to `entity_relationships` table
   - ON CONFLICT on `(entity_a_id, entity_b_id, relationship_type)` — merge evidence

### Explore first

The exact SQLite schema is unknown. First step is to download a sample file and inspect:
```bash
# In the import script, add a discovery mode:
npx tsx scripts/import/import-entity-dbs.ts --discover
# Prints: table names, column names, row counts
```

### After import

Entities available for linking. Entity extraction in Phase 4 can match against these.

### Verify
```sql
SELECT source, COUNT(*) FROM entities GROUP BY source;
SELECT COUNT(*) FROM entity_relationships;
```

---

## Priority 6: markramm OCR Text

**File**: `scripts/import/import-markramm.ts`
**Source**: `raw-archive/github/markramm/` (2,915 files, 54MB)

Same pattern as s0fskr1p. Create `document` rows with `ocr_text`, `ocr_source = 'markramm'`.

### Deduplication with s0fskr1p

Some documents may overlap. Use filename matching:
- If a document with the same filename already exists with `ocr_source = 's0fskr1p'`, skip (s0fskr1p is higher quality)
- If no match, create new document

---

## Priority 7: muneeb-emails

**File**: `scripts/import/import-emails.ts`
**Source**: `raw-archive/github/muneeb-emails/` (7 files, 4.4MB)

### Import logic

1. Download and parse email data files (JSON/CSV — inspect format first)
2. For each email thread:
   - Create `document` row with `classification = 'email'`, full thread as `ocr_text`
   - If migration 00021 applied: create `emails` table row with from/to/cc/subject/body
   - Chunk the email body text
3. Link referenced entity names to `entities` table

---

## Priority 8: blackbook + archive-flights (Structured Data)

**File**: `scripts/import/import-structured.ts`
**Source**: `raw-archive/github/blackbook/` (6 files) + `archive-flights/` (1 file)

### Blackbook import

1. Parse CSV files (phone numbers, addresses, names)
2. For each contact:
   - Create `entities` row with `entity_type = 'person'`
   - Store phone/address in `metadata` JSONB
   - Set `source = 'blackbook'`

### Flight logs import

1. Parse flight log text (line-by-line format: date, departure, arrival, passengers)
2. For each flight:
   - Create `flights` table row
   - Match passenger names to `entities` table
   - Populate `passenger_entity_ids` array

### Verify
```sql
SELECT COUNT(*) FROM entities WHERE source = 'blackbook';
SELECT COUNT(*) FROM flights WHERE source = 'archive_org';
```

---

## Priority 9: Raw PDFs (Register Only)

**File**: `scripts/import/import-raw-pdfs.ts`
**Source**: `raw-archive/doj/dataset-*` + `raw-archive/kaggle/jazivxt/` (~37K files, 47GB)

### Import logic — metadata only

1. List all files from Storage (do NOT download content)
2. For each PDF:
   - Create `document` row with:
     - `filename`, `storage_path`, `file_size_bytes`
     - `file_type` = 'pdf'
     - `processing_status` = 'pending' (needs full pipeline)
     - `dataset_id` matched from folder name (e.g., `doj/dataset-8/` → Dataset 8)
     - NO `ocr_text` (will need Document AI OCR — $$$)
3. Cross-reference with s0fskr1p/markramm/benbaessler:
   - If OCR text already imported for this filename → update existing doc's `storage_path`
   - If not → create new doc waiting for OCR processing

### Cost note

Full OCR processing of ~37K PDFs via Google Document AI ≈ $55-100 (at $0.0015/page, ~37K docs × avg 10 pages). This is deferred to the crowdfunding phase.

---

## Priority 10: Zenodo Mixed Data

**File**: `scripts/import/import-raw-pdfs.ts` (same script, additional source)
**Source**: `raw-archive/zenodo/` (3,955 files, 4.1GB)

Mixed PDFs and images. Register as raw documents (same as Priority 9) unless inspection reveals pre-processed data.

**Note**: Added per Audit Finding M1. The zenodo data was present in Storage but had no import script planned.

---

## Execution Order

Run scripts in this order. Each can run independently but earlier ones provide dedup benefits:

```bash
# Phase 0 first (see phase-0-prerequisites.md)

# Then import in priority order:
npx tsx scripts/import/import-s0fskr1p.ts
npx tsx scripts/import/import-benbaessler.ts
npx tsx scripts/import/import-epstein-docs.ts
npx tsx scripts/import/import-svetfm.ts
npx tsx scripts/import/import-entity-dbs.ts
npx tsx scripts/import/import-markramm.ts       # dedup against s0fskr1p
npx tsx scripts/import/import-emails.ts
npx tsx scripts/import/import-structured.ts
npx tsx scripts/import/import-raw-pdfs.ts       # register only, no download
```

## Checklist

- [ ] All 9 import scripts created
- [ ] Each script tested with `--limit 10 --dry-run`
- [ ] Each script run in full
- [ ] `data_sources` table shows 'ingested' for completed sources
- [ ] Document counts match expected (from manifest file counts)
- [ ] Chunk counts reasonable (documents × ~5-20 chunks each)
