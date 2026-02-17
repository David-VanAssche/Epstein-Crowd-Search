# Supabase Storage Bucket Inventory: `raw-archive`

Last updated: 2026-02-16 (live S3 API scan)

## Summary

| Metric | Value |
|--------|-------|
| **Total top-level folders** | 15 |
| **Total files (non-DOJ)** | 204,235 |
| **Total files (DOJ datasets 1-12)** | 1,382,304 |
| **Grand total files** | ~1,586,539 |
| **Estimated total size** | ~260+ GB |
| **SHA-256 manifests** | 36 |

### Database linkage

| Table | Rows | Has `storage_path`? | Coverage |
|-------|------|---------------------|----------|
| `documents` | 1,380,964 | Yes (all rows) | 100% — every document maps to a Storage object |
| `videos` | 1,299 | Yes | Backfilled from DS8/DS10 media scans |
| `images` | 0 | Yes (column exists) | **NOT BACKFILLED** — 180K+ images in DS10/house-oversight not yet indexed |
| `audio_files` | 0 | Yes (column exists) | **NOT BACKFILLED** — audio in DS10 not yet indexed |
| `data_sources` | 13 | N/A (tracks sources, not files) | 13 authoritative sources, all status=ingested |

---

## Folder-by-Folder Inventory

### `doj/` — DOJ FOIA Datasets 1-12

**1,382,304 files / ~210 GB** — The core archive. 12 datasets + 1 test batch.

| Dataset | Files | Size (MB) | File Types | Notes |
|---------|-------|-----------|------------|-------|
| dataset-1 | 3,163 | 1,268 | .pdf, .dat, .opt, .dii, .lfp, .lst | FBI interviews, Palm Beach PD |
| dataset-2 | 577 | 632 | .pdf, .dat, .opt, **.avi** | Contains video files |
| dataset-3 | 68 | 559 | .pdf, .dat, .opt | |
| dataset-4 | 154 | 359 | .pdf, .dat, .opt | |
| dataset-5 | 122 | 62 | .pdf, .dat, .opt | |
| dataset-6 | 15 | 53 | .pdf, .dat, .opt | |
| dataset-7 | 19 | 98 | .pdf, .dat, .opt | |
| dataset-8 | 11,035 | 10,911 | .pdf, .dat, .opt, **.mp4, .mp3, .m4a, .csv, .xls, .xlsx** | Rich media + spreadsheets |
| dataset-9 | 531,257 | 96,860 | .pdf, .dat, .opt | **Missing OPT/DAT load files** |
| dataset-10 | 504,029 | 77,030 | .pdf, .dat, .opt, **.mp4, .mov, .m4v, .m4a, .mp3, .wav, .amr, .opus, .3gp** | 180K images, 874 native media |
| dataset-11 | 331,661 | 27,446 | .pdf, .dat, .opt, **.m4v** | 4 native video files |
| dataset-12 | 154 | 120 | .pdf, .dat, .opt | |
| test-batch | 50 | 3 | .pdf | Pipeline test subset |

**Media files in DOJ datasets:**
- Video: .avi (DS2), .mp4 (DS8/10), .mov (DS10), .m4v (DS10/11), .3gp (DS10)
- Audio: .mp3 (DS8/10), .m4a (DS8/10), .wav (DS10), .amr (DS10), .opus (DS10)
- Spreadsheets: .csv, .xls, .xlsx (DS8)
- Load files: .dat, .opt (all datasets — maps EFTA page numbers to PDF files)

---

### `house-oversight/` — House Oversight Committee Releases

**42,822 files / 148.3 GB** — Two releases from House Oversight Committee.

| Subfolder | Files | Size (MB) | File Types | Description |
|-----------|-------|-----------|------------|-------------|
| release1-doj | 99 | 76,438 | .wav (56), .mp4 (27), .zip (12), .dat, .opt, .sqlite, .xml | DOJ materials provided to Congress — mostly audio/video |
| release3-additional-estate | 42,716 | 73,753 | (no ext) (16,680), .jpeg (15,247), .jpg (7,850), .txt (2,895), .tif (28), .xls (8), .xlsx (2), .mov (1) | Estate documents — **huge photo collection + extensionless files** |

**Key observations:**
- `release1-doj`: 56 WAV files and 27 MP4 videos — likely surveillance/interview recordings
- `release3-additional-estate`: 16,680 files with no extension (need investigation), 23,097 images (.jpeg/.jpg), 2,895 text files
- The extensionless files in release3 may be images or documents without proper naming

---

### `github/` — Community GitHub Repositories

**129,360 files / 7.5 GB** — 10 community-contributed repositories.

| Subfolder | Files | Size (MB) | Primary File Types | Description |
|-----------|-------|-----------|-------------------|-------------|
| **erikveland** | 42,120 | 2,800 | .eml (34,431), .txt (4,675), .html (478), .jpg (446) | **Epstein email archive** — 34K raw .eml files + metadata |
| **maxandrews** | 29,821 | 309 | .txt (29,728), .csv (26) | OCR text extractions |
| **epstein-docs** | 29,525 | 137 | .json (29,503) | Document metadata as JSON |
| **benbaessler** | 23,224 | 146 | .jsonl (23,115) | Structured data extractions |
| **s0fskr1p** | 1,643 | 4,039 | .txt (1,640) | **OCR text from overlay-redacted documents** (high value) |
| **markramm** | 2,915 | 54 | .txt (2,898) | OCR text extractions |
| **yung-megafone** | 37 | 91 | .torrent (14), .txt (9), .json (6), .zip (3) | Torrent files + metadata |
| **phelix-epstein-network** | 41 | 9 | .py (14), .json (8), .csv (3) | FOIA analysis scripts + data |
| **lmsband** | 21 | 29 | .py (7), .js (3), .png (3) | Analysis tools |
| **rhowardstone** | 13 | 26 | .gz (4), .json (4), .csv (3) | Compressed corpus analysis data |

---

### `kaggle/` — Kaggle Datasets

**26,091 files / 36.8 GB**

| Subfolder | Files | Size (MB) | Primary File Types | Description |
|-----------|-------|-----------|-------------------|-------------|
| **jazivxt** | 26,063 | 37,562 | .jpg (22,901), .txt (2,896), .tif (221), .pdf (32), .xls (8) | Epstein files dataset — primarily scanned images + OCR text |
| **linogova** | 28 | 120 | .jsonl (26) | Structured data extractions |

---

### `huggingface/` — HuggingFace Datasets

**161 files / 600 MB**

| Subfolder | Files | Size (MB) | Primary File Types | Description |
|-----------|-------|-----------|-------------------|-------------|
| **svetfm-fbi** | 131 | 121 | .pdf (56), .metadata (58) | FBI vault documents |
| **svetfm-nov11** | 7 | 341 | .parquet (1), .metadata (3) | November 2011 document release |
| **teyler-20k** | 7 | 101 | .txt (1), .metadata (3) | 20K document text dump |
| **KillerShoaib-emails** | 2 | 29 | .jsonl (1), .parquet (1) | Email dataset |
| **muneeb-emails** | 7 | 4 | .parquet (1), .metadata (3) | Email metadata |
| **elderemo-index** | 7 | 3 | .csv (1), .metadata (3) | Document index |

---

### `zenodo/` — Zenodo Archive

**3,957 files / 4.1 GB**

| Subfolder | Files | Size (MB) | File Types | Description |
|-----------|-------|-----------|------------|-------------|
| images | 3,727 | 3,823 | .jpg (3,681), .tif (46) | Scanned document images |
| pdfs | 205 | 347 | .pdf (205) | Document PDFs |
| text | 15 | 0.02 | .txt (15) | OCR text |
| resources | 2 | 0.6 | .txt (2) | Metadata |
| web_sources | 2 | 0.6 | .htm (1), .json (1) | Source references |

---

### `court-records/` — Court Filings

**304 files / 88 MB**

| Subfolder | Files | Size (MB) | File Types | Description |
|-----------|-------|-----------|------------|-------------|
| usvi-v-jpmorgan | 199 | 10 | .pdf (199) | USVI v. JPMorgan Chase exhibits |
| florida-v-epstein | 99 | 5 | .pdf (99) | Florida state case filings |
| giuffre-v-maxwell | 3 | 62 | .zip (1), .pdf (1), .txt (1) | Unsealed documents (Jan 2024) |
| maxwell-criminal | 3 | 11 | .pdf (3) | Maxwell trial documents |

---

### `documentcloud/` — DocumentCloud Collections

**12 files / 1,010 MB** — All PDFs. Epstein drops, MCC docs, NPA, DOJ 2025 release.

---

### `enrichment/` — External Enrichment Data

**9 files / 12 MB**

| Subfolder | Files | File Types | Description |
|-----------|-------|------------|-------------|
| epsteininvestigation-org | 9 | .csv (4), .jsonl (4), .json (1) | Scraped entity/flight/relationship/email/document data |

---

### `websites/` — Scraped Websites

**1,433 files / 54 MB**

| Subfolder | Files | File Types | Description |
|-----------|-------|------------|-------------|
| epstein-exposed | 1,426 | .json (1,426) | Scraped platform data |
| blackbook | 6 | .json (3), .html (2), .csv (1) | Address book data |
| archive-org-flights | 1 | .txt (1) | Flight log text |

---

### `scraped/` — API Scrapes

**4 files / 0.7 MB** — All `.jsonl`. Scraped from epsteininvestigation.org API.

---

### `reports/` — Investigation Reports

**3 files / 6 MB** — DOJ OIG, DOJ OPR, DOJ Disclosure memos (all PDFs).

---

### `police-records/`

**1 file / 1.7 MB** — Palm Beach PD records (PDF).

---

### `_manifests/` — SHA-256 Verification Manifests

**36 files / 64 MB** — JSON manifests generated at upload time by the hoarder system. Each contains file paths, sizes, and SHA-256 hashes for one source.

---

### `test/`

**2 files / <0.1 MB** — Pipeline test files.

---

## Existing Index/Tracking Systems

### 1. Upload Manifests (`_manifests/*.json`)
- **Created by**: `scripts/hoarder/uploader.py` at upload time
- **Contains**: SHA-256 hashes, file sizes, paths for each uploaded source
- **Coverage**: 36 manifests covering community sources (GitHub, HF, Kaggle, Zenodo, websites)
- **Does NOT cover**: DOJ datasets (uploaded via S3 sync, not hoarder), house-oversight, court-records, reports
- **Use case**: Verifying upload integrity, detecting missing/failed uploads

### 2. Database `documents.storage_path`
- **Coverage**: 1,380,964 documents, all with `storage_path` set
- **Maps**: Database document records to `raw-archive/doj/dataset-*/...` paths
- **Does NOT cover**: Community sources (github/*, kaggle/*, etc.), house-oversight, enrichment data
- **Use case**: Linking pipeline-processed documents back to raw source files

### 3. `data_sources` table
- **Coverage**: 13 authoritative source definitions (DOJ, courts, police, reports)
- **Does NOT track**: Individual files, community sources, enrichment data
- **Use case**: High-level source status tracking for the Sources page

### 4. `CORPUS_AUDIT.md`
- **Coverage**: Manual inventory updated 2026-02-14
- **Contains**: File counts, sizes, EFTA ranges, known gaps, source descriptions
- **Use case**: Human-readable reference document

---

## Critical Gaps in Tracking

### Files in Storage but NOT in any database table

| Storage Path | Files | Issue |
|-------------|-------|-------|
| `house-oversight/release3-additional-estate/` | 42,716 | **Not imported to documents table** — 23K images, 16K extensionless files, 2.9K text files |
| `house-oversight/release1-doj/` | 99 | **Not imported** — 56 WAV + 27 MP4 recordings |
| `github/erikveland/*.eml` | 34,431 | **Email files not in emails table** — raw .eml format |
| `github/benbaessler/*.jsonl` | 23,115 | Community-extracted structured data — not cross-referenced |
| `github/epstein-docs/*.json` | 29,503 | Community document metadata — not cross-referenced |
| `github/maxandrews/*.txt` | 29,728 | Community OCR text — not cross-referenced |
| `github/s0fskr1p/*.txt` | 1,640 | **High-value** overlay-redaction OCR — not linked to source EFTA docs |
| `kaggle/jazivxt/*.jpg` | 22,901 | Scanned images — not in images table |
| `zenodo/images/*.jpg` | 3,727 | Scanned images — not in images table |
| `images` table | 0 rows | **Completely empty** — DS10 has 180K+ images, house-oversight has 23K+ |
| `audio_files` table | 0 rows | **Completely empty** — DS10 has audio files, house-oversight has 56 WAVs |

### Missing linkage between enrichment data and source documents

The `enrichment/epsteininvestigation-org/` folder contains entity, flight, relationship, and document data scraped from EpsteinSuite, but there is **no foreign key or path mapping** linking these enrichment records back to our documents. The `documents.jsonl` file contains their slug-based document IDs, not our EFTA numbers.

### Community OCR text not linked to source PDFs

`github/s0fskr1p/`, `github/markramm/`, and `github/maxandrews/` contain OCR text extractions from Epstein documents, but these are stored as standalone `.txt` files. There is no mapping table linking `s0fskr1p/EFTA00001234.txt` back to `doj/dataset-1/.../EFTA00001234.pdf` in the documents table.

---

## Recommendations

1. **Build a `storage_objects` index table** — A database table that catalogs every file in `raw-archive` with columns: `path`, `size`, `extension`, `source_folder`, `linked_document_id`, `indexed_at`. Populate via S3 list + periodic refresh. This becomes the authoritative index for import scripts.

2. **Backfill `images` table** — DS10 alone has 180K+ images. Run `backfill_media.py` for images across DOJ + house-oversight + kaggle + zenodo.

3. **Backfill `audio_files` table** — DS10 audio files (.wav, .mp3, .m4a, .amr, .opus) + house-oversight WAVs.

4. **Map community OCR to source documents** — Create a `community_ocr_mappings` table linking s0fskr1p/markramm/maxandrews text files to their source EFTA documents by filename pattern matching.

5. **Import house-oversight data** — 42,822 files not in any database table. Needs classification of the 16,680 extensionless files first.

6. **Investigate extensionless files** — `house-oversight/release3-additional-estate/` has 16,680 files with no extension. Run `file` command on a sample to determine actual types.
