#!/usr/bin/env python3
# Force unbuffered output so progress appears in real-time even when piped
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

"""
backfill_unlinked.py — Scan storage_objects for unlinked files and insert
rows into documents/images/videos/audio_files tables, then link them.

Handles ~30K content files (kaggle images, zenodo images/PDFs, websites JSON,
court-records) while skipping ~73K junk files (padding, repo code, metadata).

Usage:
  # Dry run (classify and report, no inserts):
  python scripts/backfill_unlinked.py --dry-run

  # Full run (insert + link):
  python scripts/backfill_unlinked.py

  # Link-only (skip inserts, just run UPDATE linking):
  python scripts/backfill_unlinked.py --link-only

  # Skip linking pass (inserts only):
  python scripts/backfill_unlinked.py --skip-link

  # Only process a specific prefix:
  python scripts/backfill_unlinked.py --prefix kaggle/
"""

import argparse
import json
import os
import random
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
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

BATCH_SIZE = 500
REST_PAGE_SIZE = 1000

# ---------------------------------------------------------------------------
# Extension sets (case-insensitive, stored lowercase)
# ---------------------------------------------------------------------------

SKIP_CODE_CONFIG_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".py", ".css", ".scss", ".md",
    ".yml", ".yaml", ".lock", ".gitignore", ".dockerignore", ".sh",
    ".mjs", ".sql", ".example", ".prettierrc", ".eslintignore",
    ".vercelignore", ".gitattributes", ".cursorignore", ".gitkeep",
    ".mako", ".njk", ".ini", ".conf", ".production",
    ".snapshot-shm", ".snapshot-wal", ".db",
    ".meta", ".jsonl", ".parquet",
}

SKIP_DOJ_METADATA_EXTENSIONS = {".dat", ".opt", ".lfp", ".lst", ".dii"}

DOCUMENT_EXTENSIONS = {
    ".pdf", ".txt", ".rtf", ".csv", ".xls", ".xlsx",
    ".htm", ".html", ".zip", ".torrent",
}

IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".bmp", ".webp",
}

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".m4v", ".3gp"}

AUDIO_EXTENSIONS = {".m4a", ".wav", ".mp3", ".opus", ".amr"}

# MIME type mapping for documents
MIME_MAP = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".rtf": "application/rtf",
    ".csv": "text/csv",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".htm": "text/html",
    ".html": "text/html",
    ".json": "application/json",
    ".zip": "application/zip",
    ".torrent": "application/x-bittorrent",
}


# ---------------------------------------------------------------------------
# Supabase REST API (same pattern as backfill_media.py)
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
    """Upsert rows in batches (on storage_path). Returns (upserted, failed)."""
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
            result = supabase_rest(
                "POST", table, data=batch,
                params={"on_conflict": "storage_path"},
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
            for row in batch:
                r = supabase_rest(
                    "POST", table, data=row,
                    params={"on_conflict": "storage_path"},
                    prefer="resolution=merge-duplicates,return=minimal",
                )
                if 200 <= r.get("status", 0) < 300:
                    inserted += 1
                else:
                    failed += 1

        done = i + len(batch)
        if done % 5000 < BATCH_SIZE or done >= total:
            print(f"    {table}: {inserted:,}/{total:,} upserted, {failed:,} failed")

    return inserted, failed


# ---------------------------------------------------------------------------
# Fetch unlinked storage_objects via REST
# ---------------------------------------------------------------------------


def fetch_unlinked(prefix: str | None = None) -> list[dict]:
    """Paginated GET of all unlinked storage_objects."""
    all_rows: list[dict] = []
    offset = 0

    print("Fetching unlinked storage_objects...")

    while True:
        params: dict = {
            "select": "path,extension,size_bytes",
            "linked_document_id": "is.null",
            "linked_image_id": "is.null",
            "linked_video_id": "is.null",
            "linked_audio_id": "is.null",
            "order": "path",
            "limit": str(REST_PAGE_SIZE),
            "offset": str(offset),
        }
        if prefix:
            params["path"] = f"like.{prefix}*"

        result = supabase_rest(
            "GET", "storage_objects", params=params,
            prefer="return=representation",
        )

        if result.get("status", 0) != 200:
            print(f"  ERROR fetching page at offset {offset}: {result.get('error', result.get('status'))}")
            break

        data = result.get("data") or []
        if not data:
            break

        all_rows.extend(data)
        offset += len(data)

        if offset % 10000 < REST_PAGE_SIZE:
            print(f"  ... {offset:,} rows fetched")

        if len(data) < REST_PAGE_SIZE:
            break

    print(f"  Total unlinked: {len(all_rows):,}")
    return all_rows


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------


def _get_extension(path: str) -> str:
    """Get lowercase extension including the dot."""
    _, ext = os.path.splitext(path)
    return ext.lower()


def _source_label(path: str) -> str:
    """Derive a source label from path prefix."""
    parts = path.split("/")
    if len(parts) >= 2:
        return f"{parts[0]}-{parts[1]}"
    return parts[0] if parts else "unknown"


def _is_json_content(path: str) -> bool:
    """Check if a .json file is content (websites/ or kaggle/linogova/)."""
    lower = path.lower()
    return lower.startswith("websites/") or lower.startswith("kaggle/linogova/")


def classify(row: dict) -> tuple[str, str]:
    """
    Classify a storage_object row.
    Returns (category, reason) where:
      category: "skip", "document", "image", "video", "audio", "eml", "unknown"
      reason: skip reason or classification detail
    """
    path = row["path"]
    ext = _get_extension(path)

    # --- Skip rules ---

    # Padding files
    if "__padding_file" in path:
        return "skip", "padding"

    # Repo code (github/* except github/erikveland/data/)
    if path.startswith("github/"):
        if not path.startswith("github/erikveland/data/"):
            # erikveland .eml files are under github/erikveland/ (not data/)
            # but those are handled as "eml" below, not skipped here
            if ext != ".eml":
                return "skip", "repo-code"

    # Metadata prefixes
    for pfx in ("_manifests/", "test/", "enrichment/"):
        if path.startswith(pfx):
            return "skip", "metadata"

    # DOJ metadata extensions
    if ext in SKIP_DOJ_METADATA_EXTENSIONS:
        return "skip", "doj-metadata"

    # Code/config extensions (except .json content files)
    if ext in SKIP_CODE_CONFIG_EXTENSIONS:
        return "skip", "code-config"

    # .json: content only if under websites/ or kaggle/linogova/
    if ext == ".json":
        if _is_json_content(path):
            return "document", "json-content"
        return "skip", "code-config"

    # --- Content classification ---

    if ext == ".eml":
        return "eml", "eml"

    if ext in DOCUMENT_EXTENSIONS:
        return "document", ext

    if ext in IMAGE_EXTENSIONS:
        return "image", ext

    if ext in VIDEO_EXTENSIONS:
        return "video", ext

    if ext in AUDIO_EXTENSIONS:
        return "audio", ext

    return "unknown", ext or "(no-ext)"


# ---------------------------------------------------------------------------
# Row builders
# ---------------------------------------------------------------------------


def build_document_row(row: dict) -> dict:
    path = row["path"]
    ext = _get_extension(path)
    filename = os.path.basename(path)
    file_type = ext.lstrip(".") if ext else "unknown"
    size = row.get("size_bytes") or 0

    return {
        "filename": filename,
        "storage_path": path,
        "file_type": file_type,
        "metadata": json.dumps({
            "source": _source_label(path),
            "file_size_bytes": size,
        }),
    }


def build_image_row(row: dict) -> dict:
    path = row["path"]
    ext = _get_extension(path)
    filename = os.path.basename(path)
    size = row.get("size_bytes") or 0

    return {
        "filename": filename,
        "storage_path": path,
        "file_type": ext.lstrip("."),
        "file_size_bytes": size,
        "metadata": json.dumps({"source": _source_label(path)}),
    }


def build_video_row(row: dict) -> dict:
    path = row["path"]
    ext = _get_extension(path)
    filename = os.path.basename(path)
    size = row.get("size_bytes") or 0

    return {
        "filename": filename,
        "storage_path": path,
        "media_type": "video",
        "processing_status": "pending",
        "metadata": json.dumps({
            "source": _source_label(path),
            "file_size_bytes": size,
            "file_type": ext.lstrip("."),
        }),
    }


def build_audio_row(row: dict) -> dict:
    path = row["path"]
    ext = _get_extension(path)
    filename = os.path.basename(path)
    size = row.get("size_bytes") or 0

    return {
        "filename": filename,
        "storage_path": path,
        "file_type": ext.lstrip("."),
        "file_size_bytes": size,
        "processing_status": "pending",
        "metadata": json.dumps({"source": _source_label(path)}),
    }


# ---------------------------------------------------------------------------
# Linking pass
# ---------------------------------------------------------------------------


def run_linking():
    """Call the link_storage_objects() RPC to link newly-inserted rows."""
    print("\nRunning link_storage_objects() RPC...")
    result = supabase_rest(
        "POST", "rpc/link_storage_objects",
        prefer="return=representation",
    )
    if result.get("status", 0) == 200 and result.get("data"):
        data = result["data"]
        if isinstance(data, list) and data:
            row = data[0]
            print(f"  Linked: {row.get('documents_linked', 0):,} documents, "
                  f"{row.get('images_linked', 0):,} images, "
                  f"{row.get('videos_linked', 0):,} videos, "
                  f"{row.get('audio_linked', 0):,} audio")
        else:
            print(f"  Result: {data}")
    else:
        error = result.get("error", f"HTTP {result.get('status')}")
        print(f"  ERROR: {error[:300]}")
        print("  Tip: If timeout, run linking manually via psql:")
        print("    SELECT * FROM link_storage_objects();")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Backfill unlinked storage_objects into documents/images/videos/audio_files"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Classify and report, no inserts or linking",
    )
    parser.add_argument(
        "--link-only", action="store_true",
        help="Skip inserts, only run linking pass",
    )
    parser.add_argument(
        "--skip-link", action="store_true",
        help="Skip linking pass (inserts only)",
    )
    parser.add_argument(
        "--prefix", type=str, default=None,
        help="Only process storage_objects with this path prefix (e.g., kaggle/)",
    )
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    print("=" * 60)
    print("Backfill Unlinked Storage Objects")
    print("=" * 60)
    print(f"  Supabase URL: {SUPABASE_URL}")
    print(f"  Dry run:      {args.dry_run}")
    print(f"  Link only:    {args.link_only}")
    print(f"  Skip link:    {args.skip_link}")
    if args.prefix:
        print(f"  Prefix:       {args.prefix}")
    print()

    # Link-only mode
    if args.link_only:
        run_linking()
        return

    # Fetch all unlinked objects
    rows = fetch_unlinked(prefix=args.prefix)
    if not rows:
        print("No unlinked storage_objects found. Exiting.")
        return

    # Classify
    print("\nClassifying...")
    skip_counts: dict[str, int] = defaultdict(int)
    category_counts: dict[str, int] = defaultdict(int)
    unknown_extensions: dict[str, int] = defaultdict(int)
    skipped_rows: list[dict] = []

    doc_rows: list[dict] = []
    img_rows: list[dict] = []
    vid_rows: list[dict] = []
    aud_rows: list[dict] = []
    eml_count = 0

    for row in rows:
        category, reason = classify(row)
        category_counts[category] += 1

        if category == "skip":
            skip_counts[reason] += 1
            skipped_rows.append(row)
        elif category == "document":
            doc_rows.append(build_document_row(row))
        elif category == "image":
            img_rows.append(build_image_row(row))
        elif category == "video":
            vid_rows.append(build_video_row(row))
        elif category == "audio":
            aud_rows.append(build_audio_row(row))
        elif category == "eml":
            eml_count += 1
        elif category == "unknown":
            unknown_extensions[reason] += 1

    # Report
    print(f"\n  Classification summary:")
    print(f"    Documents:  {len(doc_rows):,}")
    print(f"    Images:     {len(img_rows):,}")
    print(f"    Videos:     {len(vid_rows):,}")
    print(f"    Audio:      {len(aud_rows):,}")
    print(f"    EML (skip): {eml_count:,} (handled by import-emails.ts)")
    print(f"    Skipped:    {category_counts['skip']:,}")
    print(f"    Unknown:    {category_counts['unknown']:,}")

    print(f"\n  Skip reasons:")
    for reason, count in sorted(skip_counts.items(), key=lambda x: -x[1]):
        print(f"    {reason:20s}: {count:>10,}")

    if unknown_extensions:
        print(f"\n  Unknown extensions:")
        for ext, count in sorted(unknown_extensions.items(), key=lambda x: -x[1])[:20]:
            print(f"    {ext:20s}: {count:>10,}")

    # Sample skipped files for manual audit
    if skipped_rows:
        sample = random.sample(skipped_rows, min(10, len(skipped_rows)))
        print(f"\n  Sample skipped files (for manual audit):")
        for r in sample:
            print(f"    {r['path']}")

    # Insert
    if args.dry_run:
        print(f"\n  [DRY RUN] Would insert:")
        print(f"    {len(doc_rows):,} documents")
        print(f"    {len(img_rows):,} images")
        print(f"    {len(vid_rows):,} videos")
        print(f"    {len(aud_rows):,} audio")
        print(f"\n  [DRY RUN] No rows were actually inserted.")
        return

    total_inserted = 0
    total_failed = 0

    if doc_rows:
        print(f"\nInserting {len(doc_rows):,} document rows...")
        ins, fail = batch_insert("documents", doc_rows)
        total_inserted += ins
        total_failed += fail

    if img_rows:
        print(f"\nInserting {len(img_rows):,} image rows...")
        ins, fail = batch_insert("images", img_rows)
        total_inserted += ins
        total_failed += fail

    if vid_rows:
        print(f"\nInserting {len(vid_rows):,} video rows...")
        ins, fail = batch_insert("videos", vid_rows)
        total_inserted += ins
        total_failed += fail

    if aud_rows:
        print(f"\nInserting {len(aud_rows):,} audio_files rows...")
        ins, fail = batch_insert("audio_files", aud_rows)
        total_inserted += ins
        total_failed += fail

    print(f"\n{'=' * 60}")
    print("INSERT SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Total upserted: {total_inserted:,}")
    print(f"  Total failed:   {total_failed:,}")

    # Linking pass
    if not args.skip_link:
        run_linking()

    print(f"\nDone.")


if __name__ == "__main__":
    main()
