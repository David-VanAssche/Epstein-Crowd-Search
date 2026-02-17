#!/usr/bin/env python3
# Force unbuffered output so progress appears in real-time even when piped
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

"""
backfill_house_oversight.py — Investigate and import house-oversight documents.

The house-oversight/ folder contains ~42K files across multiple releases.
Many files lack extensions and need magic-byte detection to determine type.

Usage:
  pip install boto3

  # Investigate extensionless files (sample 50, detect type via magic bytes):
  python scripts/backfill_house_oversight.py --investigate-only

  # Dry run (scan and classify, no inserts):
  python scripts/backfill_house_oversight.py --dry-run

  # Full import:
  python scripts/backfill_house_oversight.py

  # Scan a specific release:
  python scripts/backfill_house_oversight.py --release release3-additional-estate
"""

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# macOS SSL
_SSL_CTX = ssl.create_default_context()
try:
    import certifi
    _SSL_CTX.load_verify_locations(certifi.where())
except (ImportError, Exception):
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE

# ---------------------------------------------------------------------------
# Load .env
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = REPO_ROOT / ".env"


def load_dotenv(env_file: Path) -> None:
    """Minimal .env loader (avoids python-dotenv dependency)."""
    if not env_file.exists():
        return
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if key not in os.environ:
                os.environ[key] = value


load_dotenv(ENV_FILE)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
S3_ENDPOINT = os.environ.get(
    "SUPABASE_S3_ENDPOINT",
    "https://evcxibwuuhvvkrplazyk.storage.supabase.co/storage/v1/s3",
)
S3_ACCESS_KEY = os.environ.get("SUPABASE_S3_ACCESS_KEY_ID", "")
S3_SECRET_KEY = os.environ.get("SUPABASE_S3_SECRET_ACCESS_KEY", "")

BUCKET = "raw-archive"
BATCH_SIZE = 500

# Known releases in house-oversight/
HOUSE_OVERSIGHT_PREFIX = "house-oversight/"

# Magic byte signatures for file type detection
MAGIC_SIGNATURES = {
    b"\x89PNG": "png",
    b"\xff\xd8\xff": "jpeg",
    b"%PDF": "pdf",
    b"II\x2a\x00": "tiff",
    b"MM\x00\x2a": "tiff",
    b"GIF8": "gif",
    b"PK\x03\x04": "zip",
    b"\x00\x00\x01\x00": "ico",
    b"BM": "bmp",
}
# RIFF is checked separately since we need bytes 8-11 to distinguish AVI vs WAV

# Map detected types to media categories
TYPE_TO_CATEGORY = {
    "pdf": "document",
    "png": "image",
    "jpeg": "image",
    "tiff": "image",
    "gif": "image",
    "bmp": "image",
    "ico": "image",
    "avi": "video",
    "wav": "audio",
}

# File extensions that are definitely documents
DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".rtf", ".xls", ".xlsx", ".csv", ".htm", ".html"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".tiff", ".tif", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".wmv", ".mkv", ".mpg", ".mpeg", ".m4v", ".webm"}
AUDIO_EXTENSIONS = {".m4a", ".wav", ".mp3", ".aac", ".flac", ".ogg", ".opus", ".amr"}


# ---------------------------------------------------------------------------
# Supabase REST API
# ---------------------------------------------------------------------------


def supabase_rest(
    method: str,
    table: str,
    data=None,
    params: dict | None = None,
    prefer: str = "return=minimal",
) -> dict:
    """Make a Supabase REST API request using urllib."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        query = "&".join(
            f"{k}={urllib.parse.quote(str(v), safe='.,=()!')}" for k, v in params.items()
        )
        url += f"?{query}"

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
            resp_body = resp.read().decode("utf-8")
            return {
                "status": resp.status,
                "data": json.loads(resp_body) if resp_body else None,
                "content_range": resp.headers.get("Content-Range", ""),
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        return {"status": e.code, "error": error_body, "data": None}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"status": 0, "error": str(e), "data": None}


def batch_insert(
    table: str, rows: list[dict], dry_run: bool = False
) -> tuple[int, int]:
    """Insert rows in batches. Returns (inserted, failed)."""
    inserted = 0
    failed = 0
    total = len(rows)

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]

        if dry_run:
            inserted += len(batch)
            done = i + len(batch)
            if done % 5000 < BATCH_SIZE or done >= total:
                print(f"    {table}: {inserted:,}/{total:,} [DRY RUN]")
            continue

        success = False
        for attempt in range(3):
            result = supabase_rest("POST", table, data=batch)
            status = result.get("status", 0)
            if 200 <= status < 300:
                inserted += len(batch)
                success = True
                break
            elif status == 429:
                wait = (2**attempt) * 2
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                break

        if not success:
            error = result.get("error", "Unknown error")
            print(f"    Batch {i // BATCH_SIZE + 1} failed (HTTP {result.get('status', '?')}): {error[:300]}")
            for row in batch:
                r = supabase_rest("POST", table, data=row)
                if 200 <= r.get("status", 0) < 300:
                    inserted += 1
                else:
                    failed += 1

        done = i + len(batch)
        if done % 5000 < BATCH_SIZE or done >= total:
            print(f"    {table}: {inserted:,}/{total:,} inserted, {failed:,} failed")

    return inserted, failed


# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------


def get_s3_client():
    """Create an S3 client pointing at Supabase Storage's S3-compatible API."""
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        print("ERROR: boto3 is required. Install with: pip install boto3")
        sys.exit(1)

    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1",
        config=Config(
            retries={"max_attempts": 3, "mode": "adaptive"},
            max_pool_connections=10,
        ),
    )


def s3_list_recursive(prefix: str) -> list[dict]:
    """List all objects under a prefix. Returns list of {path, size} dicts."""
    client = get_s3_client()
    paginator = client.get_paginator("list_objects_v2")

    files = []
    page_count = 0
    print(f"  Listing s3://{BUCKET}/{prefix} ...")

    try:
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            page_count += 1
            for obj in page.get("Contents", []):
                files.append({"path": obj["Key"], "size": obj["Size"]})
            if page_count % 10 == 0:
                print(f"    ... {len(files):,} objects so far ({page_count} pages)")
    except Exception as e:
        print(f"  ERROR listing S3: {e}")
        return []

    print(f"  Listed {len(files):,} objects in {page_count} pages")
    return files


def s3_read_head(path: str, num_bytes: int = 16) -> bytes | None:
    """Read the first N bytes of a file from S3 for magic byte detection."""
    client = get_s3_client()
    try:
        response = client.get_object(
            Bucket=BUCKET, Key=path, Range=f"bytes=0-{num_bytes - 1}"
        )
        return response["Body"].read()
    except Exception as e:
        print(f"    ERROR reading head of {path}: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# File type detection
# ---------------------------------------------------------------------------


def detect_type_by_magic(header: bytes) -> str | None:
    """Detect file type from magic bytes."""
    # Check RIFF container first (need bytes 8-11 to distinguish AVI vs WAV)
    if len(header) >= 12 and header[:4] == b"RIFF":
        if header[8:12] == b"AVI ":
            return "avi"
        if header[8:12] == b"WAVE":
            return "wav"
        return "riff"

    for sig, file_type in MAGIC_SIGNATURES.items():
        if header[: len(sig)] == sig:
            return file_type
    return None


def classify_by_extension(path: str) -> str | None:
    """Classify a file by its extension. Returns 'document', 'image', 'video', 'audio', or None."""
    ext = os.path.splitext(path)[1].lower()
    if ext in DOCUMENT_EXTENSIONS:
        return "document"
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    if ext in AUDIO_EXTENSIONS:
        return "audio"
    return None


def get_release_from_path(path: str) -> str:
    """Extract the release name from a house-oversight path."""
    # house-oversight/release3-additional-estate/foo.pdf → release3-additional-estate
    parts = path.split("/")
    if len(parts) >= 2:
        return parts[1]
    return "unknown"


# ---------------------------------------------------------------------------
# Investigation mode
# ---------------------------------------------------------------------------


def investigate_extensionless(files: list[dict], sample_size: int = 50):
    """Download first 16 bytes of extensionless files and detect type."""
    extensionless = [f for f in files if not os.path.splitext(f["path"])[1]]
    print(f"\n  Extensionless files: {len(extensionless):,}")

    if not extensionless:
        print("  No extensionless files found.")
        return

    # Sample
    import random
    random.seed(42)
    sample = random.sample(extensionless, min(sample_size, len(extensionless)))
    print(f"  Sampling {len(sample)} files for magic byte detection...")

    type_counts: dict[str, int] = {}
    unknown_samples: list[str] = []

    for f in sample:
        header = s3_read_head(f["path"])
        if header is None:
            type_counts["(read error)"] = type_counts.get("(read error)", 0) + 1
            continue

        detected = detect_type_by_magic(header)
        if detected:
            type_counts[detected] = type_counts.get(detected, 0) + 1
        else:
            type_counts["(unknown)"] = type_counts.get("(unknown)", 0) + 1
            if len(unknown_samples) < 5:
                unknown_samples.append(
                    f"    {f['path']} — first bytes: {header[:16].hex()}"
                )

    print(f"\n  Detection results ({len(sample)} files sampled):")
    for ftype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        pct = count / len(sample) * 100
        print(f"    {ftype:15s}: {count:>5,} ({pct:.1f}%)")

    if unknown_samples:
        print(f"\n  Unknown file samples:")
        for s in unknown_samples:
            print(s)

    # Extrapolate
    print(f"\n  Extrapolated for all {len(extensionless):,} extensionless files:")
    for ftype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        est = int(len(extensionless) * count / len(sample))
        print(f"    {ftype:15s}: ~{est:>8,}")


# ---------------------------------------------------------------------------
# Full import
# ---------------------------------------------------------------------------


def import_documents(files: list[dict], dry_run: bool = False) -> dict:
    """Import house-oversight files into the documents table (PDFs/text) and
    report media files for separate backfill_media.py run."""
    stats = {
        "documents": 0,
        "images": 0,
        "videos": 0,
        "audio": 0,
        "extensionless": 0,
        "unknown": 0,
        "docs_inserted": 0,
        "docs_failed": 0,
    }

    doc_rows = []

    for f in files:
        path = f["path"]
        size = f["size"]
        ext = os.path.splitext(path)[1].lower()
        filename = os.path.basename(path)
        release = get_release_from_path(path)

        if not ext:
            stats["extensionless"] += 1
            # For extensionless files, we'll need magic byte detection
            # at scale. For now, skip and report.
            continue

        category = classify_by_extension(path)

        if category == "document":
            stats["documents"] += 1
            file_type = ext.lstrip(".") if ext else "unknown"
            doc_rows.append({
                "filename": filename,
                "storage_path": path,
                "file_type": file_type,
                "mime_type": _ext_to_mime(ext),
                "metadata": json.dumps({
                    "source": "house-oversight",
                    "release": release,
                    "file_size_bytes": size,
                }),
            })
        elif category == "image":
            stats["images"] += 1
        elif category == "video":
            stats["videos"] += 1
        elif category == "audio":
            stats["audio"] += 1
        else:
            stats["unknown"] += 1

    print(f"\n  Classification:")
    print(f"    Documents:     {stats['documents']:,}")
    print(f"    Images:        {stats['images']:,}")
    print(f"    Videos:        {stats['videos']:,}")
    print(f"    Audio:         {stats['audio']:,}")
    print(f"    Extensionless: {stats['extensionless']:,}")
    print(f"    Unknown ext:   {stats['unknown']:,}")

    if doc_rows:
        print(f"\n  Inserting {len(doc_rows):,} document rows...")
        ins, fail = batch_insert("documents", doc_rows, dry_run=dry_run)
        stats["docs_inserted"] = ins
        stats["docs_failed"] = fail

    if stats["images"] > 0 or stats["videos"] > 0 or stats["audio"] > 0:
        print(f"\n  NOTE: {stats['images'] + stats['videos'] + stats['audio']:,} media files found.")
        print(f"  Use backfill_media.py --prefix house-oversight/ --no-dataset-id to import them.")

    if stats["extensionless"] > 0:
        print(f"\n  NOTE: {stats['extensionless']:,} extensionless files skipped.")
        print(f"  Run with --investigate-only to detect their types via magic bytes.")

    return stats


def _ext_to_mime(ext: str) -> str | None:
    """Map common extensions to MIME types."""
    mime_map = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
        ".rtf": "application/rtf",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".csv": "text/csv",
        ".htm": "text/html",
        ".html": "text/html",
    }
    return mime_map.get(ext.lower())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Investigate and import house-oversight documents"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't actually insert, just scan and report",
    )
    parser.add_argument(
        "--investigate-only",
        action="store_true",
        help="Only investigate extensionless files (sample magic bytes)",
    )
    parser.add_argument(
        "--release",
        type=str,
        default=None,
        help="Only scan a specific release subfolder (e.g., release3-additional-estate)",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=50,
        help="Number of extensionless files to sample for investigation (default: 50)",
    )
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    if not S3_ACCESS_KEY or not S3_SECRET_KEY:
        print("ERROR: SUPABASE_S3_ACCESS_KEY_ID and SUPABASE_S3_SECRET_ACCESS_KEY must be set")
        sys.exit(1)

    print("=" * 60)
    print("House Oversight: Investigate & Import")
    print("=" * 60)
    print(f"  Mode:    {'investigate' if args.investigate_only else 'import'}")
    print(f"  Dry run: {args.dry_run}")
    if args.release:
        print(f"  Release: {args.release}")
    print()

    # Determine prefix
    if args.release:
        prefix = f"{HOUSE_OVERSIGHT_PREFIX}{args.release}/"
    else:
        prefix = HOUSE_OVERSIGHT_PREFIX

    # List files
    files = s3_list_recursive(prefix)
    if not files:
        print("No files found. Exiting.")
        sys.exit(0)

    # Show extension breakdown
    ext_counts: dict[str, int] = {}
    for f in files:
        ext = os.path.splitext(f["path"])[1].lower() or "(none)"
        ext_counts[ext] = ext_counts.get(ext, 0) + 1
    print(f"\n  Extension breakdown:")
    for ext, count in sorted(ext_counts.items(), key=lambda x: -x[1])[:20]:
        print(f"    {ext:10s}: {count:>10,}")

    # Show release breakdown
    release_counts: dict[str, int] = {}
    for f in files:
        release = get_release_from_path(f["path"])
        release_counts[release] = release_counts.get(release, 0) + 1
    print(f"\n  Release breakdown:")
    for release, count in sorted(release_counts.items(), key=lambda x: -x[1]):
        print(f"    {release:40s}: {count:>10,}")

    if args.investigate_only:
        investigate_extensionless(files, sample_size=args.sample_size)
        return

    # Full import
    stats = import_documents(files, dry_run=args.dry_run)

    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Documents inserted:  {stats['docs_inserted']:,}")
    print(f"  Documents failed:    {stats['docs_failed']:,}")

    if args.dry_run:
        print("\n  [DRY RUN] No rows were actually inserted.")


if __name__ == "__main__":
    main()
