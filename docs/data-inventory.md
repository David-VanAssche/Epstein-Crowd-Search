# Data Inventory & Storage Object Reconciliation

Last updated: 2026-02-17

## Overview

The archive stores files in Supabase Storage bucket `raw-archive`, tracked via the `storage_objects` table. Each storage object is linked to a content row in `documents`, `images`, `videos`, or `audio_files` via `linked_document_id`, `linked_image_id`, `linked_video_id`, or `linked_audio_id`.

## Current Counts

| Table | Count |
|---|---|
| `storage_objects` | 1,586,499 |
| `documents` | 1,430,228 |
| `images` | 50,667 |
| `videos` | 1,328 |
| `audio_files` | 56 |
| **Total linked** | **1,482,226** (93.4%) |
| **Unlinked** | **104,273** (6.6%) |

## Linked Content by Source

Storage objects are organized under `raw-archive/` with this prefix structure:

| Prefix | Content | Linked? |
|---|---|---|
| `doj/dataset-{1..12}/` | DOJ document releases (PDFs, images, text) | Yes |
| `house-oversight/release{1..3}*/` | House Oversight Committee releases | Yes |
| `kaggle/jazivxt/` | Kaggle dataset mirror (text, images) | Yes |
| `kaggle/linogova/` | Kaggle dataset (JSON content files) | Yes |
| `github/erikveland/data/` | OCR text, clean text, emails | Yes |
| `github/s0fskr1p/` | Merged court record text files (1,640 docs) | Yes |
| `github/yung-megafone/notes/` | Research notes, data files, torrents (28 docs) | Yes |
| `huggingface/*/` | HuggingFace dataset mirrors | Yes |
| `websites/` | Scraped website JSON content | Yes |
| `scraped/` | Scraped web content | Yes |

## Unlinked Storage Objects (104,273)

These are intentionally unlinked. They fall into these categories:

### Legitimate Non-Content (skip)

| Category | Count | Description |
|---|---|---|
| Tar padding files | ~16,680 | `__padding_file` entries from tar archives |
| Repo source code | ~87,800 | GitHub contributor app/tool code (`.ts`, `.tsx`, `.py`, `.js`, etc.) under `github/maxandrews/`, `github/epstein-docs/`, `github/benbaessler/`, `github/markramm/`, `github/erikveland/` (non-data), `github/lmsband/`, `github/phelix-epstein-network/` |
| DOJ metadata | ~33 | `.dat`, `.opt`, `.lfp`, `.lst`, `.dii` load files |
| Manifests | ~36 | `_manifests/*.json` SHA-256 verification files |
| Enrichment data | ~9 | `enrichment/` prefix (separate workflow) |
| Test files | ~2 | `test/` prefix |

### Duplicate OCR Copies (skip - content exists via other paths)

| Source | Count | Description |
|---|---|---|
| `github/maxandrews/data/` | ~29,750 | OCR `.txt` of House Oversight docs (duplicates `erikveland/data/` and `kaggle/` copies). Includes ~795 `_partN` split files for large docs. |
| `github/markramm/documents/` | ~2,895 | Another contributor's OCR `.txt` copy of the same House Oversight docs |

### Enrichment/Analysis Data (skip for now, potential future use)

| Source | Count | Description |
|---|---|---|
| `github/epstein-docs/results/` | ~29,500 | Per-image OCR analysis JSON from an 11ty site build (`results/IMAGES001/...`) |
| `github/benbaessler/packages/backend/data/chunks/` | ~23,115 | Pre-chunked `.jsonl` document text (e.g., `HOUSE_OVERSIGHT_010477.jsonl`) for embedding pipelines |

### Broken/Irrelevant Files (skip)

| Category | Count | Description |
|---|---|---|
| Truncated Amazon order emails | ~260 | `.eml` files under `jeeproject_yahoo/` with parentheses in filenames that caused path truncation in storage. These are personal Amazon/Hulu/spam emails, not research content. |
| `.eml.meta` files | included above | Metadata sidecar files for emails |
| `.sqlite` databases | 2 | Contributor tool databases |
| Misc unknown extensions | ~30 | `.pluginpayloadattachment`, `.incomplete`, `.xml`, etc. |

## Key Scripts

| Script | Purpose |
|---|---|
| `scripts/backfill_unlinked.py` | Scans unlinked `storage_objects`, classifies by extension/path, batch-inserts into content tables, runs `link_storage_objects()` |
| `scripts/import/import-emails.ts` | Imports `.eml` files from `github/erikveland/` into `documents` + `emails` tables |
| `scripts/backfill_storage_objects.py` | Initial storage object catalog builder |
| `scripts/backfill_media.py` | Backfills images/videos/audio into their tables |

## Key Migrations

| Migration | Purpose |
|---|---|
| `00050_link_storage_objects_slow.sql` | Creates `link_storage_objects()` RPC that matches `storage_path` across tables |
| `00051_storage_path_indexes.sql` | Adds indexes on `storage_path` for linking performance |
| `00052_documents_storage_path_unique.sql` | Partial unique index on `documents.storage_path` to prevent duplicates |

## Linking Mechanism

The `link_storage_objects()` Postgres function scans `storage_objects` where all `linked_*_id` columns are NULL, matches against `documents.storage_path`, `images.storage_path`, etc., and sets the appropriate foreign key. It has a statement timeout configured in migration 00050.

**Note:** The full-table scan can timeout on the Supabase REST API. For targeted linking after small inserts, do per-row UPDATE matching instead (see backfill script's fallback logic).

## Reconciliation History

- **2026-02-17:** Backfilled 2,081 missing items:
  - 1,640 s0fskr1p merged court record text files
  - 413 jeeproject_yahoo `.eml` files (special-char filenames)
  - 28 yung-megafone research notes/data files
  - Linked via targeted per-row UPDATE (full `link_storage_objects()` timed out)
