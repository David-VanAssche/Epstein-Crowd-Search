#!/usr/bin/env python3
# Force unbuffered output so progress appears in real-time even when piped
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

"""
backfill_storage_objects.py — Scan the entire raw-archive bucket via S3 and
populate the `storage_objects` table, then link rows to documents/images/videos/audio.

Usage:
  pip install boto3

  # Full bucket scan + link:
  python scripts/backfill_storage_objects.py

  # Dry run:
  python scripts/backfill_storage_objects.py --dry-run

  # Scan only a prefix:
  python scripts/backfill_storage_objects.py --prefix doj/dataset-1/

  # Skip scan, just run the linking pass:
  python scripts/backfill_storage_objects.py --link-only
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

# macOS Python often has SSL cert issues
_SSL_CTX = ssl.create_default_context()
try:
    import certifi
    _SSL_CTX.load_verify_locations(certifi.where())
except (ImportError, Exception):
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


# ---------------------------------------------------------------------------
# Supabase REST API (reused from backfill_media.py)
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
        # URL-encode param values to handle special chars in paths (#, &, etc.)
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


def supabase_rpc(fn_name: str, body: dict | None = None) -> dict:
    """Call a Supabase RPC function."""
    url = f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body or {}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120, context=_SSL_CTX) as resp:
            resp_body = resp.read().decode("utf-8")
            return {"status": resp.status, "data": json.loads(resp_body) if resp_body else None}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        return {"status": e.code, "error": error_body, "data": None}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"status": 0, "error": str(e), "data": None}


# ---------------------------------------------------------------------------
# Batch insert with retry
# ---------------------------------------------------------------------------


def batch_upsert(rows: list[dict], dry_run: bool = False) -> tuple[int, int]:
    """Upsert rows into storage_objects in batches. Returns (inserted, failed)."""
    inserted = 0
    failed = 0
    total = len(rows)

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]

        if dry_run:
            inserted += len(batch)
            done = i + len(batch)
            if done % 10000 < BATCH_SIZE or done >= total:
                print(f"    storage_objects: {inserted:,}/{total:,} [DRY RUN]")
            continue

        # Retry with backoff
        success = False
        for attempt in range(3):
            result = supabase_rest(
                "POST",
                "storage_objects",
                data=batch,
                params={"on_conflict": "path"},
                prefer="resolution=merge-duplicates,return=minimal",
            )
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
            print(
                f"    Batch {i // BATCH_SIZE + 1} failed (HTTP {result.get('status', '?')}): {error[:300]}"
            )
            # Fall back to individual inserts
            for row in batch:
                r = supabase_rest(
                    "POST",
                    "storage_objects",
                    data=row,
                    params={"on_conflict": "path"},
                    prefer="resolution=merge-duplicates,return=minimal",
                )
                if 200 <= r.get("status", 0) < 300:
                    inserted += 1
                else:
                    failed += 1

        done = i + len(batch)
        if done % 10000 < BATCH_SIZE or done >= total:
            print(f"    storage_objects: {inserted:,}/{total:,} upserted, {failed:,} failed")

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
    """List all objects under a prefix. Returns list of {path, size} dicts."""
    client = get_s3_client()
    paginator = client.get_paginator("list_objects_v2")

    files = []
    page_count = 0

    print(f"  Listing s3://{BUCKET}/{prefix} ...")
    print(f"  (this may take a long time for the full bucket)")

    try:
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            page_count += 1
            for obj in page.get("Contents", []):
                files.append({"path": obj["Key"], "size": obj["Size"]})
            if page_count % 50 == 0:
                print(f"    ... {len(files):,} objects so far ({page_count} pages)")
    except Exception as e:
        print(f"  ERROR listing S3: {e}")
        return []

    print(f"  Listed {len(files):,} objects in {page_count} pages")
    return files


# ---------------------------------------------------------------------------
# Parse path into components
# ---------------------------------------------------------------------------


def parse_path(path: str) -> dict | None:
    """Parse a bucket-relative path into storage_objects row fields.
    Returns None for folder entries (trailing slash / empty filename)."""
    # Normalize: strip leading slash, collapse double slashes
    path = path.lstrip("/").replace("//", "/")

    parts = path.split("/")
    folder = parts[0] if parts else ""
    subfolder = parts[1] if len(parts) >= 3 else None
    filename = parts[-1] if parts else path

    # Skip folder entries (trailing slash produces empty filename)
    if not filename:
        return None

    # Extract extension (last dot, but not for dotfiles like .gitignore)
    dot_idx = filename.rfind(".")
    extension = filename[dot_idx:].lower() if dot_idx > 0 else None

    return {
        "path": path,
        "folder": folder,
        "subfolder": subfolder,
        "filename": filename,
        "extension": extension,
    }


# ---------------------------------------------------------------------------
# Linking pass — SQL-based UPDATE joins
# ---------------------------------------------------------------------------


def run_linking_pass(dry_run: bool = False):
    """Link storage_objects rows to documents, images, videos, audio_files.

    Uses the link_storage_objects() SQL function (migration 00047) which performs
    all four UPDATE...FROM joins in a single transaction — far faster than
    per-row REST API calls.
    """
    print("\nLinking pass: matching storage_objects to existing table rows...")

    if dry_run:
        print("  [DRY RUN] Skipping linking pass.")
        return

    print("  Calling link_storage_objects() RPC (single SQL transaction)...")
    result = supabase_rpc("link_storage_objects")

    if result.get("status") and 200 <= result["status"] < 300:
        data = result.get("data")
        if data and isinstance(data, list) and len(data) > 0:
            row = data[0]
            print(f"    documents: {row.get('documents_linked', 0):,} linked")
            print(f"    images:    {row.get('images_linked', 0):,} linked")
            print(f"    videos:    {row.get('videos_linked', 0):,} linked")
            print(f"    audio:     {row.get('audio_linked', 0):,} linked")
        else:
            print(f"    RPC returned: {data}")
    else:
        error = result.get("error", "Unknown error")
        print(f"    ERROR: RPC failed (HTTP {result.get('status', '?')}): {error[:500]}")
        print(f"    Ensure migration 00047 has been applied.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Scan raw-archive bucket and populate storage_objects table"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't actually insert, just scan and report",
    )
    parser.add_argument(
        "--prefix",
        type=str,
        default="",
        help="Only scan this S3 prefix (e.g., doj/dataset-1/)",
    )
    parser.add_argument(
        "--link-only",
        action="store_true",
        help="Skip S3 scan, just run the linking pass",
    )
    args = parser.parse_args()

    # Validate config
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    print("=" * 60)
    print("Storage Objects Backfill: S3 Scan -> storage_objects table")
    print("=" * 60)
    print(f"  Supabase URL: {SUPABASE_URL}")
    print(f"  S3 Endpoint:  {S3_ENDPOINT}")
    print(f"  Dry run:      {args.dry_run}")
    print(f"  Prefix:       {args.prefix or '(full bucket)'}")
    print(f"  Link only:    {args.link_only}")
    print()

    if not args.link_only:
        if not S3_ACCESS_KEY or not S3_SECRET_KEY:
            print("ERROR: SUPABASE_S3_ACCESS_KEY_ID and SUPABASE_S3_SECRET_ACCESS_KEY must be set")
            sys.exit(1)

        # Scan S3
        files = s3_list_recursive(args.prefix)
        if not files:
            print("No files found. Exiting.")
            sys.exit(0)

        # Show folder breakdown
        folder_counts: dict[str, int] = {}
        folder_sizes: dict[str, int] = {}
        for f in files:
            folder = f["path"].split("/")[0] if "/" in f["path"] else "(root)"
            folder_counts[folder] = folder_counts.get(folder, 0) + 1
            folder_sizes[folder] = folder_sizes.get(folder, 0) + f["size"]

        print(f"\nFolder breakdown:")
        for folder, count in sorted(folder_counts.items(), key=lambda x: -x[1]):
            size_gb = folder_sizes[folder] / (1024**3)
            print(f"  {folder:30s}: {count:>10,} files  ({size_gb:>8.2f} GB)")

        # Build rows
        print(f"\nBuilding storage_objects rows...")
        rows = []
        skipped_folders = 0
        for f in files:
            parsed = parse_path(f["path"])
            if parsed is None:
                skipped_folders += 1
                continue
            parsed["size_bytes"] = f["size"]
            rows.append(parsed)
        if skipped_folders:
            print(f"  Skipped {skipped_folders:,} folder entries (trailing slash)")

        print(f"  {len(rows):,} rows to upsert")

        # Upsert
        inserted, failed = batch_upsert(rows, dry_run=args.dry_run)
        print(f"\n  Upserted: {inserted:,}, Failed: {failed:,}")

    # Linking pass
    run_linking_pass(dry_run=args.dry_run)

    print(f"\nDone!")


if __name__ == "__main__":
    main()
