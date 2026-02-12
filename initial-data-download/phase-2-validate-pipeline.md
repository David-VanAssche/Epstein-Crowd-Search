# Phase 2: Validate DOJ ZIP Streaming Pipeline

**Time:** ~1 hour
**Run on:** Local machine
**Cost:** $0
**Prerequisites:** Phase 0 complete (Phase 1 can run in parallel)
**Result:** Confirmed that DOJ ZIP → Supabase streaming works end-to-end

## Tasks

- [ ] 2.1: Implement ZIP streaming module (`zip_streamer.py`)
- [ ] 2.2: Test with Dataset 6 (~51MB, smallest)
- [ ] 2.3: Test with Dataset 5 (~61MB)
- [ ] 2.4: Verify uploaded PDFs open correctly
- [ ] 2.5: Verify `documents` table records created

---

### 2.1: Implement ZIP Streaming

Build `scripts/doj_uploader/zip_streamer.py` using:

```python
# Core pattern
import httpx
from stream_unzip import stream_unzip

DOJ_COOKIE = "justiceGovAgeVerified=true"

def stream_zip_from_doj(dataset_num: int):
    url = f"https://www.justice.gov/epstein/files/DataSet%20{dataset_num}.zip"
    with httpx.stream("GET", url, headers={"Cookie": DOJ_COOKIE}, timeout=300.0) as response:
        response.raise_for_status()
        yield from response.iter_bytes(chunk_size=65536)

def process_zip_dataset(dataset_num: int, supabase_client):
    for file_name, file_size, unzipped_chunks in stream_unzip(stream_zip_from_doj(dataset_num)):
        name = file_name.decode("utf-8", errors="replace")
        if name.endswith("/") or not name.lower().endswith(".pdf"):
            for _ in unzipped_chunks:
                pass
            continue
        pdf_bytes = b"".join(unzipped_chunks)
        storage_path = f"doj/dataset-{dataset_num}/{name}"
        supabase_client.storage.from_("documents").upload(
            path=storage_path, file=pdf_bytes,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
        # Insert documents table record...
```

Key details:
- ZIP never touches disk — streamed in 64KB chunks
- Each PDF accumulated in memory (typically 10KB-50MB)
- For PDFs >50MB: use `boto3` S3-compatible multipart upload
- DOJ requires cookie: `justiceGovAgeVerified=true`
- Retry with exponential backoff on failures

### 2.2-2.3: Test with Datasets 5+6

```bash
python scripts/upload-to-supabase.py doj-zips --dataset 6
python scripts/upload-to-supabase.py doj-zips --dataset 5
```

### 2.4-2.5: Verification

1. Check Supabase Storage → `documents/doj/dataset-5/` and `dataset-6/` contain PDFs
2. Download 2-3 random PDFs, verify they open in a PDF reader
3. Check `documents` table has rows with correct `storage_path`, `file_size_bytes`
4. Check `upload-progress.json` shows datasets 5+6 as complete

## Acceptance Criteria

- [ ] Datasets 5+6 PDFs in Supabase Storage (~112MB total)
- [ ] Documents table records created for each PDF
- [ ] Progress tracking working
- [ ] No local files left on disk after streaming
