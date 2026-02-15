#!/usr/bin/env python3
# Force unbuffered output so progress appears in real-time even when piped
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

"""
backfill_media.py — Scan Supabase Storage (via S3 API) for media files in DOJ
datasets and insert rows into the `images` and `videos` database tables.

Usage:
  # First time: install deps
  pip install boto3

  # Run from repo root:
  python scripts/backfill_media.py

  # Dry run (no inserts):
  python scripts/backfill_media.py --dry-run

  # Only scan specific datasets:
  python scripts/backfill_media.py --datasets 10,11

  # Scan all 12 datasets:
  python scripts/backfill_media.py --all-datasets

  # Skip S3 scan and use a pre-generated listing file:
  python scripts/backfill_media.py --listing-file /tmp/ds10_listing.txt --datasets 10
"""

import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# macOS Python often has SSL cert issues. Create a permissive context for urllib.
# boto3 handles its own SSL via botocore/certifi, so this only affects urllib calls.
_SSL_CTX = ssl.create_default_context()
try:
    import certifi
    _SSL_CTX.load_verify_locations(certifi.where())
except (ImportError, Exception):
    # If certifi isn't available, disable verification for Supabase REST calls
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE

# ---------------------------------------------------------------------------
# Load .env from repo root
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

# File extension categories
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".tiff", ".tif", ".bmp"}
VIDEO_EXTENSIONS = {
    ".mp4", ".avi", ".mov", ".wmv", ".mkv", ".mpg", ".mpeg", ".m4v",
    ".vob", ".webm", ".3gp",
    # NOTE: .ts excluded — in DOJ data, .ts files are MPEG transport streams,
    # but also TypeScript files elsewhere. We only include .ts if found inside
    # known media directories.
}
AUDIO_EXTENSIONS = {".m4a", ".wav", ".mp3", ".aac", ".flac", ".ogg", ".opus", ".amr"}

# Datasets known to have media files
MEDIA_DATASETS = {
    2: "Includes .avi video files",
    8: "Prison CCTV .mp4 files",
    9: "Email attachments + native media (1,832 files)",
    10: "180K images, 874 native video/audio files",
    11: "4 .m4v native files",
}


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
    """Make a Supabase REST API request using urllib (no requests dependency)."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        query = "&".join(f"{k}={v}" for k, v in params.items())
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
            status = resp.status
            content_range = resp.headers.get("Content-Range", "")
            return {
                "status": status,
                "data": json.loads(resp_body) if resp_body else None,
                "content_range": content_range,
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        return {"status": e.code, "error": error_body, "data": None}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"status": 0, "error": str(e), "data": None}


def get_dataset_uuid(dataset_number: int) -> str | None:
    """Fetch the UUID for a dataset by number."""
    result = supabase_rest(
        "GET",
        "datasets",
        params={"dataset_number": f"eq.{dataset_number}", "select": "id"},
        prefer="return=representation",
    )
    if result.get("data") and len(result["data"]) > 0:
        return result["data"][0]["id"]
    return None


def get_existing_count(table: str, dataset_id: str) -> int:
    """Check how many rows already exist for this dataset in the given table."""
    result = supabase_rest(
        "GET",
        table,
        params={
            "dataset_id": f"eq.{dataset_id}",
            "select": "id",
            "limit": "0",
        },
        prefer="count=exact",
    )
    cr = result.get("content_range", "")
    if "/" in cr:
        try:
            return int(cr.split("/")[-1])
        except ValueError:
            pass
    return 0


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

        # Retry with backoff
        success = False
        for attempt in range(3):
            result = supabase_rest("POST", table, data=batch)
            status = result.get("status", 0)
            if 200 <= status < 300:
                inserted += len(batch)
                success = True
                break
            elif status == 429:
                # Rate limited — back off
                wait = (2**attempt) * 2
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                break  # Non-retryable error

        if not success:
            error = result.get("error", "Unknown error")
            print(
                f"    Batch {i // BATCH_SIZE + 1} failed (HTTP {result.get('status', '?')}): {error[:300]}"
            )
            # Fall back to individual inserts
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
# S3 Listing via boto3
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
    """
    List all objects under a prefix using boto3 paginator.
    Returns list of {path, size} dicts.
    """
    client = get_s3_client()
    paginator = client.get_paginator("list_objects_v2")

    files = []
    page_count = 0

    print(f"  Listing s3://{BUCKET}/{prefix} ...")
    print(f"  (this may take several minutes for large datasets)")

    try:
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            page_count += 1
            for obj in page.get("Contents", []):
                files.append(
                    {
                        "path": obj["Key"],
                        "size": obj["Size"],
                    }
                )
            if page_count % 10 == 0:
                print(f"    ... {len(files):,} objects so far ({page_count} pages)")
    except Exception as e:
        print(f"  ERROR listing S3: {e}")
        return []

    print(f"  Listed {len(files):,} objects in {page_count} pages")
    return files


def load_listing_file(filepath: str) -> list[dict]:
    """
    Load a pre-generated listing file.
    Supports two formats:
      1. aws s3 ls format: "2026-02-14 12:34:56    12345 path/to/file.ext"
      2. Simple format: one path per line (size defaults to 0)
    """
    files = []
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # Try aws s3 ls format
            match = re.match(
                r"(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(.+)", line
            )
            if match:
                files.append(
                    {
                        "path": match.group(4),
                        "size": int(match.group(3)),
                    }
                )
            else:
                # Simple path format
                files.append({"path": line, "size": 0})
    return files


# ---------------------------------------------------------------------------
# File Classification
# ---------------------------------------------------------------------------


def classify_file(path: str) -> str | None:
    """Classify a file as 'image', 'video', 'audio', or None."""
    ext = os.path.splitext(path)[1].lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    if ext in AUDIO_EXTENSIONS:
        return "audio"
    # Special case: .ts files in NATIVES directories are MPEG transport streams
    if ext == ".ts" and "/NATIVES/" in path.upper():
        return "video"
    return None


def determine_media_type(ext: str, dataset_number: int = 0) -> str:
    """Determine the media_type field value for the videos table."""
    ext = ext.lower()
    if ext in AUDIO_EXTENSIONS:
        return "audio"
    # DS8 is known to be prison CCTV
    if dataset_number == 8:
        return "cctv"
    return "video"


# ---------------------------------------------------------------------------
# Core Processing
# ---------------------------------------------------------------------------


def process_dataset(
    dataset_number: int,
    files: list[dict],
    dry_run: bool = False,
) -> dict:
    """
    Process a list of files from a dataset, inserting image and video rows.
    Returns stats dict.
    """
    stats = {
        "dataset_number": dataset_number,
        "total_files": len(files),
        "images_found": 0,
        "videos_found": 0,
        "audio_found": 0,
        "images_inserted": 0,
        "videos_inserted": 0,
        "images_failed": 0,
        "videos_failed": 0,
        "skipped_existing": False,
    }

    # Get dataset UUID
    dataset_id = get_dataset_uuid(dataset_number)
    if not dataset_id:
        print(f"  ERROR: DS{dataset_number} not found in datasets table")
        return stats

    print(f"  Dataset UUID: {dataset_id}")

    # Check existing counts
    existing_images = get_existing_count("images", dataset_id)
    existing_videos = get_existing_count("videos", dataset_id)
    if existing_images > 0 or existing_videos > 0:
        print(
            f"  Already has {existing_images:,} images and {existing_videos:,} videos in DB"
        )
        print(f"  Skipping to avoid duplicates. Delete existing rows first to re-run.")
        stats["skipped_existing"] = True
        return stats

    # Classify files and build insert rows
    image_rows = []
    video_rows = []  # includes audio — stored in videos table with media_type

    for f in files:
        path = f["path"]
        size = f["size"]
        file_type = classify_file(path)

        if file_type is None:
            continue

        filename = os.path.basename(path)
        ext = os.path.splitext(filename)[1].lower()
        # path from S3 is already the full bucket-relative storage path
        storage_path = path

        if file_type == "image":
            stats["images_found"] += 1
            image_rows.append(
                {
                    "dataset_id": dataset_id,
                    "filename": filename,
                    "storage_path": storage_path,
                    "file_type": ext.lstrip("."),
                    "file_size_bytes": size,
                    "metadata": json.dumps(
                        {
                            "source": "backfill_media.py",
                        }
                    ),
                }
            )
        elif file_type == "video":
            stats["videos_found"] += 1
            video_rows.append(
                {
                    "dataset_id": dataset_id,
                    "filename": filename,
                    "storage_path": storage_path,
                    "media_type": determine_media_type(ext, dataset_number),
                    "processing_status": "pending",
                    "metadata": json.dumps(
                        {
                            "source": "backfill_media.py",
                            "file_size_bytes": size,
                            "file_type": ext.lstrip("."),
                        }
                    ),
                }
            )
        elif file_type == "audio":
            stats["audio_found"] += 1
            video_rows.append(
                {
                    "dataset_id": dataset_id,
                    "filename": filename,
                    "storage_path": storage_path,
                    "media_type": "audio",
                    "processing_status": "pending",
                    "metadata": json.dumps(
                        {
                            "source": "backfill_media.py",
                            "file_size_bytes": size,
                            "file_type": ext.lstrip("."),
                        }
                    ),
                }
            )

    print(
        f"  Found: {stats['images_found']:,} images, "
        f"{stats['videos_found']:,} videos, {stats['audio_found']:,} audio"
    )

    # Insert images
    if image_rows:
        print(f"  Inserting {len(image_rows):,} image rows...")
        ins, fail = batch_insert("images", image_rows, dry_run=dry_run)
        stats["images_inserted"] = ins
        stats["images_failed"] = fail

    # Insert videos (includes audio)
    if video_rows:
        print(f"  Inserting {len(video_rows):,} video/audio rows...")
        ins, fail = batch_insert("videos", video_rows, dry_run=dry_run)
        stats["videos_inserted"] = ins
        stats["videos_failed"] = fail

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Backfill images and videos tables from Supabase S3 Storage"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't actually insert, just scan and report",
    )
    parser.add_argument(
        "--datasets",
        type=str,
        default=None,
        help="Comma-separated dataset numbers (default: known media datasets 2,8,9,10,11)",
    )
    parser.add_argument(
        "--listing-file",
        type=str,
        default=None,
        help="Pre-generated S3 listing file (one per dataset, use with --datasets N)",
    )
    parser.add_argument(
        "--all-datasets",
        action="store_true",
        help="Scan ALL 12 datasets, not just known media datasets",
    )
    args = parser.parse_args()

    # Validate config
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print(
            "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
        )
        print(f"  Loaded .env from: {ENV_FILE}")
        sys.exit(1)

    if not S3_ACCESS_KEY or not S3_SECRET_KEY:
        print(
            "ERROR: SUPABASE_S3_ACCESS_KEY_ID and SUPABASE_S3_SECRET_ACCESS_KEY must be set"
        )
        sys.exit(1)

    print("=" * 60)
    print("Media Backfill: Scan S3 Storage -> Insert DB Rows")
    print("=" * 60)
    print(f"  Supabase URL: {SUPABASE_URL}")
    print(f"  S3 Endpoint:  {S3_ENDPOINT}")
    print(f"  Dry run:      {args.dry_run}")
    print()

    # Determine which datasets to process
    if args.datasets:
        dataset_numbers = [int(x.strip()) for x in args.datasets.split(",")]
    elif args.all_datasets:
        dataset_numbers = list(range(1, 13))
    else:
        dataset_numbers = sorted(MEDIA_DATASETS.keys())

    print(f"Datasets to scan: {dataset_numbers}")
    print()

    all_stats = []
    grand_totals = {
        "images_found": 0,
        "videos_found": 0,
        "audio_found": 0,
        "images_inserted": 0,
        "videos_inserted": 0,
        "images_failed": 0,
        "videos_failed": 0,
    }

    for ds_num in dataset_numbers:
        print(f"\n{'=' * 40}")
        print(f"DS{ds_num}: {MEDIA_DATASETS.get(ds_num, 'Scanning for media...')}")
        print(f"{'=' * 40}")

        # Get file listing
        if args.listing_file and len(dataset_numbers) == 1:
            print(f"  Loading listing from: {args.listing_file}")
            files = load_listing_file(args.listing_file)
        else:
            prefix = f"doj/dataset-{ds_num}/"
            files = s3_list_recursive(prefix)

        if not files:
            print(f"  No files found or listing failed. Skipping.")
            continue

        print(f"  Total files listed: {len(files):,}")

        # Show extension breakdown
        ext_counts: dict[str, int] = {}
        for f in files:
            ext = os.path.splitext(f["path"])[1].lower() or "(none)"
            ext_counts[ext] = ext_counts.get(ext, 0) + 1
        print(f"  Extension breakdown:")
        for ext, count in sorted(ext_counts.items(), key=lambda x: -x[1])[:15]:
            print(f"    {ext:10s}: {count:>10,}")

        # Filter to only media files
        media_files = [f for f in files if classify_file(f["path"]) is not None]
        print(f"  Media files: {len(media_files):,}")

        if not media_files:
            print(f"  No media files found in this dataset. Skipping.")
            continue

        # Show sample
        print(f"  Sample files:")
        for f in media_files[:5]:
            print(f"    {f['size']:>12,} bytes  {f['path']}")
        if len(media_files) > 5:
            print(f"    ... and {len(media_files) - 5:,} more")

        # Process
        stats = process_dataset(ds_num, media_files, dry_run=args.dry_run)
        all_stats.append(stats)

        for key in grand_totals:
            grand_totals[key] += stats.get(key, 0)

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")

    for s in all_stats:
        status = ""
        if s.get("skipped_existing"):
            status = " [SKIPPED - rows already exist]"
        elif args.dry_run:
            status = " [DRY RUN]"
        print(
            f"  DS{s['dataset_number']}: "
            f"{s['images_found']:,} images ({s['images_inserted']:,} inserted), "
            f"{s['videos_found']:,} videos + {s['audio_found']:,} audio "
            f"({s['videos_inserted']:,} inserted)"
            f"{status}"
        )

    print(f"\n  GRAND TOTAL:")
    print(
        f"    Images: {grand_totals['images_found']:,} found, "
        f"{grand_totals['images_inserted']:,} inserted, "
        f"{grand_totals['images_failed']:,} failed"
    )
    print(
        f"    Videos+Audio: {grand_totals['videos_found'] + grand_totals['audio_found']:,} found, "
        f"{grand_totals['videos_inserted']:,} inserted, "
        f"{grand_totals['videos_failed']:,} failed"
    )

    if args.dry_run:
        print("\n  [DRY RUN] No rows were actually inserted. Remove --dry-run to insert.")

    if not args.dry_run and (
        grand_totals["images_inserted"] > 0 or grand_totals["videos_inserted"] > 0
    ):
        print(
            f"\n  NOTE: The corpus_totals() RPC uses pg_class reltuples for counts."
        )
        print(f"  Postgres auto-ANALYZE will update counts within a few minutes.")
        print(f"  To force immediate update, run in SQL editor:")
        print(f"    ANALYZE images;")
        print(f"    ANALYZE videos;")


if __name__ == "__main__":
    main()
