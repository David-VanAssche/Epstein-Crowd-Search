# Architecture: Upload CLI Tool

## File Structure

```
scripts/
  doj_uploader/
    __init__.py
    config.py              # All source URLs, dataset metadata, magnet links
    supabase_client.py     # Supabase client setup (storage + DB)
    storage.py             # Upload logic (standard + S3 multipart for >50MB)

    # Community data ingestors
    ocr_ingest.py          # s0fskr1p + tensonaut + markramm text files
    embedding_ingest.py    # svetfm HuggingFace Parquet → chunks table
    entity_ingest.py       # LMSBAND SQLite + epstein-docs JSON + ErikVeland + maxandrews
    chunk_ingest.py        # benbaessler ChromaDB → chunks table
    structured_ingest.py   # CSVs: black book, flights, emails, Kaggle

    # DOJ direct download
    zip_streamer.py        # Stream ZIP → extract in memory → upload
    pdf_scraper.py         # Scrape DOJ listing pages → download PDFs → upload
    torrent_handler.py     # aria2c → watch dir → upload → delete

    # Utilities
    progress.py            # JSON progress tracking for resumability
    db.py                  # All database operations
    cli.py                 # Click CLI with all subcommands
  requirements-uploader.txt
  upload-to-supabase.py    # Entry point
```

## Dependencies (requirements-uploader.txt)

```
supabase>=2.0.0
stream-unzip>=0.0.80
httpx>=0.27.0
aiohttp>=3.9.0
click>=8.0.0
rich>=13.0.0
boto3>=1.34.0
python-dotenv>=1.0.0
huggingface-hub>=0.20.0
pandas>=2.0.0
pyarrow>=14.0.0
chromadb>=0.4.0
```

## CLI Commands

```bash
# Community data (Phase 1)
python scripts/upload-to-supabase.py community-ocr
python scripts/upload-to-supabase.py community-embeddings
python scripts/upload-to-supabase.py community-entities
python scripts/upload-to-supabase.py community-chunks
python scripts/upload-to-supabase.py structured-data

# DOJ PDFs (Phases 2-4)
python scripts/upload-to-supabase.py doj-zips [--all|--dataset N]
python scripts/upload-to-supabase.py doj-scrape --dataset N
python scripts/upload-to-supabase.py doj-torrents [--all] [--temp-dir /mnt/temp]
python scripts/upload-to-supabase.py house-oversight

# Utilities
python scripts/upload-to-supabase.py verify
python scripts/upload-to-supabase.py status
python scripts/upload-to-supabase.py resume
```

## Resumability

`upload-progress.json` structure:
```json
{
  "sources": {
    "s0fskr1p": { "status": "complete", "total": 1000, "uploaded": 1000, "failed": [] },
    "doj-zip-8": { "status": "in_progress", "total": 50000, "uploaded": 32000, "failed": ["file.pdf"], "last_file": "..." }
  },
  "last_updated": "2026-02-12T10:00:00Z"
}
```

Before each upload: check `documents` table for existing record. Upsert mode prevents duplicates.

## Key Design Decisions

1. **Python over TypeScript** for the upload tool because:
   - `stream-unzip` (streaming ZIP extraction) is Python-only
   - `supabase-py` handles file uploads natively
   - HuggingFace datasets library is Python
   - Reference downloader (Surebob) is Python

2. **Single CLI tool** rather than separate scripts per source because:
   - Shared Supabase client, progress tracking, error handling
   - Consistent logging and status reporting
   - One `requirements.txt` to manage

3. **Embedding model:** All embeddings use Amazon Nova Multimodal Embeddings v1 (1024d unified space for text/image/video/audio). Community embeddings (nomic-embed-text 768d) are imported with `embedding_model` metadata and re-embedded with Nova during the Phase 6 pipeline pass (~$19 for 365K chunks).
