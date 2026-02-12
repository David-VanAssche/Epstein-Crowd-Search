# Phase 1: Community Processed Data

**Time:** ~2-4 hours
**Run on:** Local machine
**Cost:** $0 (all open-source/free data)
**Prerequisites:** Phase 0 complete
**Result:** Search works on ~300K+ chunks, 86K+ entities, structured flight/email data

This is the highest-value phase. It ingests everything the community has already processed for free.

## Tasks

### OCR Text
- [ ] 1.1: Ingest s0fskr1p/epsteinfiles (OCR text, Datasets 1-12)
- [ ] 1.2: Ingest tensonaut/EPSTEIN_FILES_20K (House Oversight OCR, HuggingFace)
- [ ] 1.3: Ingest markramm/EpsteinFiles (House Oversight .txt files)

### Embeddings
- [ ] 1.4: Ingest svetfm/epstein-fbi-files (236K chunks + 768d embeddings)
- [ ] 1.5: Ingest svetfm/epstein-files-nov11-25 (69K chunks + 768d embeddings)

### Entities
- [ ] 1.6: Ingest LMSBAND/epstein-files-db (SQLite: NER entities + relationships)
- [ ] 1.7: Ingest epstein-docs/epstein-docs.github.io (8,175 docs: entities + summaries)
- [ ] 1.8: Ingest ErikVeland/epstein-archive (86K entities, 51K documents)
- [ ] 1.9: Ingest maxandrews/Epstein-doc-explorer (Claude-extracted email entities)

### Chunks
- [ ] 1.10: Ingest benbaessler/epfiles (pre-processed chunks, ~190MB)

### Structured Data
- [ ] 1.11: Ingest epsteinsblackbook.com CSV (1,971 contacts + flight manifests)
- [ ] 1.12: Ingest notesbymuneeb/epstein-emails (5,082 email threads, HuggingFace)
- [ ] 1.13: Ingest EF20K/Datasets + Kaggle datasets (House Oversight CSVs)
- [ ] 1.14: Ingest Archive.org flight log text
- [ ] 1.15: Investigate Tsardoz/epstein-files-public (Sifter Labs, if data available)

### Progress Tracking
- [ ] 1.16: Update `data_sources` table status for each completed source
- [ ] 1.17: Run `status` command, verify counts match expectations

---

### 1.1: s0fskr1p/epsteinfiles

**Source:** https://github.com/s0fskr1p/epsteinfiles
**What:** ~1,000 text files covering DOJ Datasets 1-12, ~5GB of UTF-8 plain text
**Key feature:** Reveals text hidden under overlay redactions in PDFs
**Format:** Flattened folder structure, paths encoded in filenames

**Steps:**
1. Clone: `git clone https://github.com/s0fskr1p/epsteinfiles /tmp/s0fskr1p`
2. For each `.txt` file:
   a. Parse filename to extract dataset number and original document name
   b. Upload text to `ocr-text/doj/dataset-{N}/{filename}.txt` in Supabase Storage
   c. Upsert `documents` row: `ocr_source='s0fskr1p'`, `ocr_text_path=...`, `processing_status='ocr_complete'`
3. Update `data_sources` table: status='ingested', ingested_count=X

### 1.2: tensonaut/EPSTEIN_FILES_20K

**Source:** https://huggingface.co/datasets/tensonaut/EPSTEIN_FILES_20K
**What:** 25,000+ text entries from House Oversight (Nov 2025), Tesseract OCR, ~106MB CSV
**Format:** CSV with columns: `filename`, `text`

**Steps:**
1. Download: `huggingface-cli download tensonaut/EPSTEIN_FILES_20K --repo-type dataset --local-dir /tmp/tensonaut`
2. Read CSV with pandas
3. For each row:
   a. Upload text to `ocr-text/house-oversight/{filename}.txt`
   b. Upsert `documents` row: `dataset_id='house-oversight'`, `ocr_source='tensonaut'`
4. Update `data_sources` table

### 1.3: markramm/EpsteinFiles

**Source:** https://github.com/markramm/EpsteinFiles
**What:** 2,895 .txt files from House Oversight
**Format:** Plain text in `documents/house_oversight/` directory

**Steps:**
1. Clone: `git clone https://github.com/markramm/EpsteinFiles /tmp/markramm`
2. For each `.txt` in `documents/house_oversight/`:
   a. Upload to `ocr-text/house-oversight/{filename}.txt` (skip if already exists from 1.2)
   b. Upsert `documents` row: `ocr_source='markramm'`
3. Update `data_sources` table

### 1.4: svetfm/epstein-fbi-files

**Source:** https://huggingface.co/datasets/svetfm/epstein-fbi-files
**What:** 236K chunks with 768d embeddings (nomic-embed-text via Ollama)
**Format:** Parquet with columns: source_file, chunk_index, text, embedding (768 floats)
**Chunking:** 1500 chars with 300 char overlap

**Steps:**
1. Download Parquet file(s) via huggingface-hub
2. Read with pandas/pyarrow
3. Batch insert into `chunks` table:
   - `document_id` (match via source_file → documents table)
   - `chunk_index`
   - `content` (text)
   - `embedding` (768d vector)
   - `embedding_model` = 'nomic-embed-text'
   - `source` = 'svetfm'
4. Update `data_sources` table

**Note:** Our project spec uses Google Vertex AI text-embedding-004 (768d) for embeddings. The svetfm embeddings use nomic-embed-text (also 768d). These are different models — embeddings are NOT interchangeable for cosine similarity search. Options:
- Store svetfm embeddings in a separate column (`embedding_community`)
- Re-embed with our target model later when funding is available
- Use svetfm embeddings as a starting point for basic search (quality will be lower but functional)

**Decision needed:** How to handle mismatched embedding models. Recommend storing them with `embedding_model` metadata so the pipeline knows which to re-process.

### 1.5: svetfm/epstein-files-nov11-25-house-post-ocr-embeddings

**Source:** https://huggingface.co/datasets/svetfm/epstein-files-nov11-25-house-post-ocr-embeddings
**What:** 69,290 chunks + 768d embeddings (House Oversight)
**Format:** Parquet

**Steps:** Same as 1.4. Insert into `chunks` table with `source='svetfm'`.

### 1.6: LMSBAND/epstein-files-db

**Source:** https://github.com/LMSBAND/epstein-files-db
**What:** SQLite database (835MB uncompressed), Datasets 8-12, 1,901+ docs
**Contains:** Full-text search index, NER entities, relationship data

**Steps:**
1. Download release: split gzip parts (~155MB compressed)
2. Reassemble and decompress: `cat parts/* | gunzip > epstein.db`
3. Open SQLite, iterate tables:
   a. Documents → upsert into `documents` table
   b. Entities → insert into `entities` table with `source='lmsband'`
   c. Relationships → insert into `entity_relationships` table
4. Update `data_sources` table

### 1.7: epstein-docs/epstein-docs.github.io

**Source:** https://github.com/epstein-docs/epstein-docs.github.io
**What:** 8,175 docs as JSON: OCR text, 12,243 people, 5,709 orgs, 3,211 locations, AI summaries
**Format:** JSON files at `results/{folder}/{imagename}.json`

**Steps:**
1. Clone repo (or sparse checkout `results/` directory)
2. For each JSON file, extract:
   a. OCR text → upload to `ocr-text/` bucket, update `documents.ocr_source='epstein-docs'`
   b. Entities (people, orgs, locations, dates) → insert into `entities` + `entity_mentions` tables
   c. Summary → store in `documents.ai_summary` or separate field
3. Update `data_sources` table

### 1.8: ErikVeland/epstein-archive

**Source:** https://github.com/ErikVeland/epstein-archive
**What:** 86K entities, 51K documents, React/Express/Postgres pipeline
**Format:** Postgres or SQLite dump (check repo for export format)

**Steps:**
1. Clone repo, find database export/seed files
2. Parse entity data → bulk insert into `entities` table
3. Parse document metadata → upsert into `documents` table
4. This is the largest entity source — may need deduplication against 1.6 and 1.7

### 1.9: maxandrews/Epstein-doc-explorer

**Source:** https://github.com/maxandrews/Epstein-doc-explorer
**What:** SQLite DB (`document_analysis.db`) with Claude-extracted entities from emails
**Format:** SQLite

**Steps:**
1. Download `document_analysis.db` from repo
2. Parse entity tables → insert into `entities` with `source='maxandrews'`
3. Parse email network graph data → insert into `entity_relationships`

### 1.10: benbaessler/epfiles

**Source:** https://github.com/benbaessler/epfiles
**What:** Pre-processed chunks (~60MB compressed, ~190MB extracted)
**Format:** ChromaDB database dump

**Steps:**
1. Download ChromaDB files from provided URL
2. Load with chromadb Python client
3. Extract chunks (text + metadata) → insert into `chunks` table
4. If embeddings included, store with `embedding_model` metadata

### 1.11: epsteinsblackbook.com CSV

**Source:** https://epsteinsblackbook.com/structured-data
**What:** 1,971 names with contact info + flight manifests
**Format:** CSV

**Steps:**
1. Download CSV files
2. Contacts → insert into `entities` table (type='person', with phone/address metadata)
3. Flight manifests → insert into structured `flights` table or as timeline events
4. Cross-reference names against existing entities for deduplication

### 1.12: notesbymuneeb/epstein-emails

**Source:** https://huggingface.co/datasets/notesbymuneeb/epstein-emails
**What:** 5,082 parsed email threads
**Format:** Parquet/CSV

**Steps:**
1. Download via huggingface-hub
2. Parse email fields (from, to, date, subject, body)
3. Insert into `documents` table (type='email')
4. Extract sender/recipient entities → insert into `entities` + `entity_relationships`

### 1.13: EF20K/Datasets + Kaggle

**Sources:**
- https://github.com/EF20K/Datasets
- https://www.kaggle.com/datasets/jazivxt/the-epstein-files
- https://www.kaggle.com/datasets/linogova/epstein-ranker-dataset-u-s-house-oversight

**Steps:**
1. Download CSV files
2. Parse and deduplicate against data already ingested from 1.2 and 1.3
3. Insert any new records into `documents` table

### 1.14: Archive.org Flight Logs

**Source:** https://archive.org/stream/EpsteinFlightLogsLolitaExpress/JE-Logs-1-20_djvu.txt
**What:** Full OCR text of Lolita Express flight logs

**Steps:**
1. Download text file
2. Parse flight entries (dates, passengers, routes)
3. Insert structured records into timeline_events or flights table
4. Upload raw text to `ocr-text/` bucket

### 1.15: Tsardoz/epstein-files-public

**Source:** https://github.com/Tsardoz/epstein-files-public
**Status:** Needs verification — main repo (Tsardoz/epstein) returned 404
**Note:** Sifter Labs platform shutting down Feb 15, 2026

**Steps:**
1. Check repo contents — is there a database dump? Embeddings? Just code?
2. If data exists, assess format and ingest
3. If code-only, evaluate for reusable processing logic

### 1.16-1.17: Progress Tracking

After each source is ingested:
1. Update `data_sources` row: `status='ingested'`, `ingested_count=N`, `ingested_at=NOW()`
2. Run `python scripts/upload-to-supabase.py status` to verify cumulative counts

## Acceptance Criteria

- [ ] ~5GB OCR text uploaded to `ocr-text/` bucket
- [ ] ~300K+ chunks with embeddings in `chunks` table
- [ ] ~86K+ entities in `entities` table
- [ ] Structured flight, email, and contact data in DB
- [ ] All ingested sources marked as 'ingested' in `data_sources` table
- [ ] `status` command shows expected counts per source
