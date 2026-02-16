#!/usr/bin/env python3
# Force unbuffered output so progress appears in real-time even when piped
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

"""
backfill_community_ocr.py — Map community-contributed OCR .txt files to EFTA documents.

Three community sources in raw-archive:
  - github/s0fskr1p/   (s0fskr1p's OCR text extractions)
  - github/markramm/    (markramm's OCR text extractions)
  - github/maxandrews/  (maxandrews' OCR text extractions)

Each .txt file is named like EFTA00001234.txt (or similar) and contains OCR text
for the corresponding EFTA document. This script:
  1. Lists .txt files from each source via S3
  2. Extracts the EFTA number from the filename
  3. Inserts into community_ocr_mappings table
  4. Resolves document_id by matching efta_number + '.pdf' against documents.filename
  5. Optionally applies OCR text to documents.ocr_text

Usage:
  pip install boto3

  # Scan and map all sources:
  python scripts/backfill_community_ocr.py

  # Dry run:
  python scripts/backfill_community_ocr.py --dry-run

  # Single source:
  python scripts/backfill_community_ocr.py --source s0fskr1p

  # Apply OCR text to matched documents:
  python scripts/backfill_community_ocr.py --apply-ocr
"""

import argparse
import json
import os
import re
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

# Community OCR source prefixes
COMMUNITY_SOURCES = {
    "s0fskr1p": "github/s0fskr1p/",
    "markramm": "github/markramm/",
    "maxandrews": "github/maxandrews/",
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


def batch_insert(
    table: str, rows: list[dict], dry_run: bool = False
) -> tuple[int, int]:
    """Insert rows in batches with upsert on storage_path. Returns (inserted, failed)."""
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
                "POST",
                table,
                data=batch,
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
            print(f"    Batch {i // BATCH_SIZE + 1} failed (HTTP {result.get('status', '?')}): {error[:300]}")
            for row in batch:
                r = supabase_rest(
                    "POST",
                    table,
                    data=row,
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


def s3_download_text(path: str) -> str | None:
    """Download a text file from S3 and return its contents."""
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=BUCKET, Key=path)
        return response["Body"].read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"    ERROR downloading {path}: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# EFTA number extraction
# ---------------------------------------------------------------------------


def extract_efta_number(filename: str) -> str | None:
    """Extract EFTA number from a filename like EFTA00001234.txt."""
    match = re.search(r"(?i)(EFTA\d{8})", filename)
    if match:
        return match.group(1).upper()
    return None


# ---------------------------------------------------------------------------
# Document resolution
# ---------------------------------------------------------------------------


def resolve_document_ids(efta_numbers: list[str]) -> dict[str, str]:
    """Look up document UUIDs by EFTA filename. Returns {efta_number: document_id}."""
    resolved = {}

    # Query in batches
    for i in range(0, len(efta_numbers), 100):
        batch = efta_numbers[i : i + 100]
        filenames = [f"{efta}.pdf" for efta in batch]
        # Use PostgREST 'in' filter
        filter_val = "(" + ",".join(filenames) + ")"
        result = supabase_rest(
            "GET",
            "documents",
            params={
                "select": "id,filename",
                "filename": f"in.{filter_val}",
            },
            prefer="return=representation",
        )
        rows = result.get("data") or []
        for row in rows:
            fn = row["filename"]
            efta = fn.replace(".pdf", "").replace(".PDF", "")
            resolved[efta.upper()] = row["id"]

    return resolved


# ---------------------------------------------------------------------------
# Apply OCR text
# ---------------------------------------------------------------------------


def apply_ocr_text(source: str, dry_run: bool = False) -> tuple[int, int]:
    """Download OCR text for matched+unapplied mappings and write to documents.ocr_text."""
    # Fetch unapplied mappings with a document_id
    offset = 0
    applied = 0
    failed = 0

    while True:
        result = supabase_rest(
            "GET",
            "community_ocr_mappings",
            params={
                "select": "id,storage_path,document_id,source",
                "source": f"eq.{source}",
                "document_id": "not.is.null",
                "ocr_applied": "eq.false",
                "limit": "100",
                "offset": str(offset),
            },
            prefer="return=representation",
        )
        rows = result.get("data") or []
        if not rows:
            break

        for row in rows:
            if dry_run:
                applied += 1
                continue

            # Download text
            text = s3_download_text(row["storage_path"])
            if not text or len(text.strip()) < 10:
                failed += 1
                continue

            # Write to documents.ocr_text (only if currently NULL to avoid
            # overwriting human-corrected or pipeline-generated OCR text)
            patch_result = supabase_rest(
                "PATCH",
                "documents",
                data={
                    "ocr_text": text.strip(),
                    "ocr_source": f"community-{source}",
                },
                params={
                    "id": f"eq.{row['document_id']}",
                    "ocr_text": "is.null",
                },
            )
            if 200 <= patch_result.get("status", 0) < 300:
                # Mark as applied
                supabase_rest(
                    "PATCH",
                    "community_ocr_mappings",
                    data={"ocr_applied": True},
                    params={"id": f"eq.{row['id']}"},
                )
                # Mark 'ocr' stage as completed on the document
                supabase_rpc("append_completed_stage", {
                    "p_document_id": row["document_id"],
                    "p_stage": "ocr",
                })
                applied += 1
            else:
                failed += 1

        offset += len(rows)
        if len(rows) < 100:
            break

        if applied % 100 == 0:
            print(f"    Applied: {applied:,}, Failed: {failed:,}")

    return applied, failed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Map community OCR .txt files to EFTA documents"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't actually insert, just scan and report",
    )
    parser.add_argument(
        "--source",
        type=str,
        default=None,
        choices=list(COMMUNITY_SOURCES.keys()),
        help="Only process a single source",
    )
    parser.add_argument(
        "--apply-ocr",
        action="store_true",
        help="Download OCR text and write to documents.ocr_text for matched rows",
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help="Skip confirmation prompts (for automation)",
    )
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    if not S3_ACCESS_KEY or not S3_SECRET_KEY:
        print("ERROR: SUPABASE_S3_ACCESS_KEY_ID and SUPABASE_S3_SECRET_ACCESS_KEY must be set")
        sys.exit(1)

    print("=" * 60)
    print("Community OCR Mapping: .txt files -> EFTA documents")
    print("=" * 60)
    print(f"  Dry run:    {args.dry_run}")
    print(f"  Apply OCR:  {args.apply_ocr}")
    print()

    sources = {args.source: COMMUNITY_SOURCES[args.source]} if args.source else COMMUNITY_SOURCES

    total_mapped = 0
    total_orphaned = 0

    for source_name, prefix in sources.items():
        print(f"\n{'=' * 40}")
        print(f"Source: {source_name} ({prefix})")
        print(f"{'=' * 40}")

        # List .txt files
        all_files = s3_list_recursive(prefix)
        txt_files = [f for f in all_files if f["path"].lower().endswith(".txt")]
        print(f"  .txt files: {len(txt_files):,} (of {len(all_files):,} total)")

        if not txt_files:
            print(f"  No .txt files found. Skipping.")
            continue

        # Build mapping rows
        rows = []
        efta_numbers = []
        no_efta = 0

        for f in txt_files:
            filename = os.path.basename(f["path"])
            efta = extract_efta_number(filename)

            row = {
                "source": source_name,
                "storage_path": f["path"],
                "efta_number": efta,
            }
            rows.append(row)

            if efta:
                efta_numbers.append(efta)
            else:
                no_efta += 1

        print(f"  EFTA numbers extracted: {len(efta_numbers):,}")
        if no_efta > 0:
            print(f"  Files without EFTA number: {no_efta:,}")

        # Insert into community_ocr_mappings
        print(f"\n  Inserting {len(rows):,} mapping rows...")
        inserted, failed = batch_insert("community_ocr_mappings", rows, dry_run=args.dry_run)
        print(f"  Inserted: {inserted:,}, Failed: {failed:,}")

        # Resolve document_ids
        if efta_numbers and not args.dry_run:
            print(f"\n  Resolving document IDs for {len(efta_numbers):,} EFTA numbers...")
            resolved = resolve_document_ids(list(set(efta_numbers)))
            print(f"  Resolved: {len(resolved):,} / {len(set(efta_numbers)):,} unique EFTA numbers")

            # Update community_ocr_mappings with document_id
            linked = 0
            for efta, doc_id in resolved.items():
                result = supabase_rest(
                    "PATCH",
                    "community_ocr_mappings",
                    data={"document_id": doc_id},
                    params={
                        "efta_number": f"eq.{efta}",
                        "source": f"eq.{source_name}",
                        "document_id": "is.null",
                    },
                )
                if 200 <= result.get("status", 0) < 300:
                    linked += 1

            print(f"  Linked {linked:,} mappings to documents")
            total_mapped += linked
            total_orphaned += len(set(efta_numbers)) - len(resolved)
        elif args.dry_run:
            print(f"  [DRY RUN] Skipping document resolution")
            total_mapped += len(efta_numbers)

        # Apply OCR text if requested
        if args.apply_ocr and not args.dry_run:
            print(f"\n  Applying OCR text to matched documents...")
            if not args.yes:
                print(f"  WARNING: This will overwrite existing ocr_text for matched documents.")
                confirm = input(f"  Continue? (y/N): ").strip().lower()
                if confirm != "y":
                    print(f"  Skipped OCR application.")
                    continue
            applied, ocr_failed = apply_ocr_text(source_name, dry_run=args.dry_run)
            print(f"  Applied: {applied:,}, Failed: {ocr_failed:,}")

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Mapped to documents:  {total_mapped:,}")
    print(f"  Orphaned (no match):  {total_orphaned:,}")

    if args.dry_run:
        print("\n  [DRY RUN] No rows were actually inserted.")


if __name__ == "__main__":
    main()
