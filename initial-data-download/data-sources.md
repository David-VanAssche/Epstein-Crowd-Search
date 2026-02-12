# Data Source Inventory

Complete inventory of all sources to ingest. Each source has a priority tier, format, and the processing step it saves.

## Tier 1: Highest Value (processed data ready to ingest)

| # | Source | What | Size | Processing Saved | Ingest In |
|---|--------|------|------|-----------------|-----------|
| 1 | **s0fskr1p/epsteinfiles** | OCR'd text for ALL 12 DOJ datasets | ~5GB text | OCR ($2-5K) | Phase 1 |
| 2 | **svetfm/epstein-fbi-files** (HuggingFace) | 236K chunks + 768d embeddings (nomic-embed-text) | Large Parquet | Chunking + embedding | Phase 1 |
| 3 | **svetfm/epstein-files-nov11-25-house-post-ocr-embeddings** (HuggingFace) | 69,290 chunks + 768d embeddings (House Oversight) | Parquet | Chunking + embedding | Phase 1 |
| 4 | **LMSBAND/epstein-files-db** (GitHub) | SQLite DB: 1,901 docs (Datasets 8-12), NER entities, relationship graph | 835MB | Entity extraction + relationship mapping | Phase 1 |
| 5 | **epstein-docs/epstein-docs.github.io** (GitHub) | 8,175 docs: AI OCR, 12,243 people, 5,709 orgs, 3,211 locations, summaries | JSON per doc | OCR + entity extraction + summarization | Phase 1 |
| 6 | **ErikVeland/epstein-archive** (GitHub) | 86K entities, 51K documents, full processing pipeline | Postgres/SQLite | Entity extraction at scale | Phase 1 |
| 7 | **benbaessler/epfiles** (GitHub) | Pre-processed chunks (~190MB) with ChromaDB | ChromaDB dump | Chunking | Phase 1 |

## Tier 2: Structured Data (parsed, specific document types)

| # | Source | What | Format | Ingest In |
|---|--------|------|--------|-----------|
| 8 | **epsteinsblackbook.com** | 1,971 names with contacts + flight manifests | CSV download | Phase 1 |
| 9 | **Epstein Exposed (epsteinexposed.com)** | 1,400 persons, 1,700 flights, 2,700 emails, 55 GPS locations | Searchable DB | Phase 1 |
| 10 | **tensonaut/EPSTEIN_FILES_20K** (HuggingFace) | 20K House Oversight pages, Tesseract OCR | CSV (~106MB) | Phase 1 |
| 11 | **notesbymuneeb/epstein-emails** (HuggingFace) | 5,082 parsed email threads | Parquet/CSV | Phase 1 |
| 12 | **markramm/EpsteinFiles** (GitHub) | 2,895 House Oversight docs as .txt | Plain text | Phase 1 |
| 13 | **EF20K/Datasets** (GitHub) | House Oversight processed data | CSV | Phase 1 |
| 14 | **Kaggle (jazivxt + linogova)** | House Oversight datasets | CSV | Phase 1 |
| 15 | **Archive.org flight logs** | Full OCR text of Lolita Express logs | Text | Phase 1 |
| 16 | **maxandrews/Epstein-doc-explorer** (GitHub) | SQLite DB: Claude-extracted entities from emails | SQLite | Phase 1 |

## Tier 3: Raw PDFs (authoritative originals)

| # | Source | What | Size | Ingest In |
|---|--------|------|------|-----------|
| 17 | **DOJ Official** (justice.gov/epstein) | 12 datasets, 3.5M pages | ~206GB | Phases 2-4 |
| 18 | **yung-megafone/Epstein-Files** (GitHub) | Index + torrent magnets + checksums for all 12 datasets | Magnet links | Phase 4 |
| 19 | **Archive.org mirrors** | Backup copies of DOJ datasets | Torrents | Phase 4 |
| 20 | **House Oversight Committee** | 20K estate pages (Google Drive/Dropbox) | PDFs | Phase 4 |

## Tier 4: Reference / Cross-Validation

| # | Source | What | Ingest In |
|---|--------|------|-----------|
| 21 | **theelderemo/FULL_EPSTEIN_INDEX** (HuggingFace) | Unified metadata index across all releases | Phase 5 |
| 22 | **Tsardoz/epstein-files-public** (GitHub) | Sifter Labs public version (main repo 404'd, needs verification) | Phase 1 (if data exists) |
| 23 | **Zenodo (record 18512562)** | Digital archive with torrent files | Phase 4 |
| 24 | **DocumentCloud** | Flight logs, birthday book, depositions (searchable) | Phase 1 |

## Known Processing Gaps (crowdsource opportunities)

| Gap | Scale | Status |
|-----|-------|--------|
| **2,000 DOJ videos** | Unknown total duration | Nobody has transcribed (Whisper opportunity) |
| **180,000 images** | ~180K files | No classification/tagging/face detection |
| **Overlay redactions** | Unknown count | s0fskr1p found text under some, systematic effort incomplete |
| **Cross-dataset entity linking** | 3.5M pages | Individual projects extracted entities, nobody unified |
| **Full DOJ OCR** | ~3.5M pages (s0fskr1p covers ~1K) | Vast majority still needs OCR |
