#!/usr/bin/env python3
"""
parse_dat_opt.py - Parse Concordance OPT/DAT files from all 12 DOJ datasets.

Downloads OPT + DAT from Supabase Storage (S3 protocol), parses document
boundaries and metadata, cross-validates against the documents table, and
optionally bulk-updates documents via Supabase REST API.

OPT format (Opticon):
  BatesNumber,VolumeLabel,ImageFilePath,DocumentBreak,FolderBreak,BoxBreak,PageCount
  - DocumentBreak=Y marks first page of a new logical document
  - Pages between Y markers belong to the same document

DAT format (Concordance):
  - Field separator: thorn (U+00FE)
  - Text qualifier: 0x14 in these files
  - First line is header
  - DOJ datasets only have: Begin Bates, End Bates

Usage:
  python3 scripts/parse_dat_opt.py                       # Parse all, report only
  python3 scripts/parse_dat_opt.py --dataset 1           # Parse dataset 1 only
  python3 scripts/parse_dat_opt.py --verify              # Verify DB against OPT
  python3 scripts/parse_dat_opt.py --update              # Update DB with parsed data
  python3 scripts/parse_dat_opt.py --update --dataset 9  # Update single dataset
"""

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    import boto3
    import requests
except ImportError:
    print("Missing dependencies. Install with: pip3 install boto3 requests")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
CACHE_DIR = Path("/tmp/epstein-parse")

DATASET_PATHS = {
    1:  ("doj/dataset-1/VOL00001/DATA/VOL00001",  "doj/dataset-1/VOL00001"),
    2:  ("doj/dataset-2/VOL00002/DATA/VOL00002",  "doj/dataset-2/VOL00002"),
    3:  ("doj/dataset-3/VOL00003/DATA/VOL00003",  "doj/dataset-3/VOL00003"),
    4:  ("doj/dataset-4/VOL00004/DATA/VOL00004",  "doj/dataset-4/VOL00004"),
    5:  ("doj/dataset-5/VOL00005/DATA/VOL00005",  "doj/dataset-5/VOL00005"),
    6:  ("doj/dataset-6/DataSet6/VOL00006/DATA/VOL00006", "doj/dataset-6/DataSet6/VOL00006"),
    7:  ("doj/dataset-7/VOL00007/DATA/VOL00007",  "doj/dataset-7/VOL00007"),
    8:  ("doj/dataset-8/VOL00008/DATA/VOL00008",  "doj/dataset-8/VOL00008"),
    9:  ("doj/dataset-9/DataSet_9/DATA/VOL00009",  "doj/dataset-9/DataSet_9/VOL00009"),
    10: ("doj/dataset-10/VOL00010/DATA/VOL00010", "doj/dataset-10/VOL00010"),
    11: ("doj/dataset-11/VOL00011/DATA/VOL00011", "doj/dataset-11/VOL00011"),
    12: ("doj/dataset-12/VOL00012/DATA/VOL00012", "doj/dataset-12/VOL00012"),
}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class OPTPage:
    bates_number: str
    volume_label: str
    image_path: str
    document_break: bool
    page_count_field: int


@dataclass
class Document:
    efta_start: str
    efta_end: str
    page_count: int
    filename: str
    storage_path: str
    file_type: str
    volume_label: str
    pages: list


@dataclass
class DATRecord:
    fields: dict


@dataclass
class DatasetResult:
    dataset_number: int
    opt_pages: int
    opt_documents: int
    dat_records: int
    dat_columns: list
    documents: list
    dat_records_list: list
    dat_opt_match: bool
    multi_page_docs: int
    max_page_count: int
    efta_start: str
    efta_end: str


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

def load_env():
    env = {}
    if not ENV_FILE.exists():
        print(f"ERROR: .env file not found at {ENV_FILE}")
        sys.exit(1)
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def get_s3_client(env):
    return boto3.client(
        "s3",
        endpoint_url="https://evcxibwuuhvvkrplazyk.storage.supabase.co/storage/v1/s3",
        aws_access_key_id=env["SUPABASE_S3_ACCESS_KEY_ID"],
        aws_secret_access_key=env["SUPABASE_S3_SECRET_ACCESS_KEY"],
        region_name="us-east-1",
    )


def get_supabase_headers(env):
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# File download
# ---------------------------------------------------------------------------

def download_file(s3, key, dest):
    if dest.exists() and dest.stat().st_size > 0:
        return True
    try:
        s3.download_file("raw-archive", key, str(dest))
        return True
    except Exception as e:
        print(f"  ERROR downloading {key}: {e}")
        return False


# ---------------------------------------------------------------------------
# OPT Parser
# ---------------------------------------------------------------------------

def parse_opt_line(line):
    trimmed = line.strip()
    if not trimmed:
        return None
    parts = []
    current = ""
    in_quotes = False
    for ch in trimmed:
        if ch == '"':
            in_quotes = not in_quotes
        elif ch == "," and not in_quotes:
            parts.append(current)
            current = ""
        else:
            current += ch
    parts.append(current)
    if len(parts) < 4:
        return None
    pc_str = parts[6] if len(parts) > 6 and parts[6] else "1"
    return OPTPage(
        bates_number=parts[0],
        volume_label=parts[1],
        image_path=parts[2].replace("\\", "/"),
        document_break=(parts[3] == "Y"),
        page_count_field=int(pc_str) if pc_str.isdigit() else 1,
    )


def parse_opt_file(path):
    pages = []
    errors = 0
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            p = parse_opt_line(line)
            if p:
                pages.append(p)
            elif line.strip():
                errors += 1
    if errors > 0:
        print(f"  WARNING: {errors} unparseable OPT lines")
    return pages


def build_documents_from_opt(pages, volume_base):
    documents = []
    current_pages = []
    for page in pages:
        if page.document_break and current_pages:
            doc = _create_document(current_pages, volume_base)
            if doc:
                documents.append(doc)
            current_pages = []
        current_pages.append(page)
    if current_pages:
        doc = _create_document(current_pages, volume_base)
        if doc:
            documents.append(doc)
    return documents


def _create_document(pages, volume_base):
    if not pages:
        return None
    first = pages[0]
    last = pages[-1]
    filename = first.image_path.split("/")[-1]
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    return Document(
        efta_start=first.bates_number,
        efta_end=last.bates_number,
        page_count=len(pages),
        filename=filename,
        storage_path=f"{volume_base}/{first.image_path}",
        file_type=ext,
        volume_label=first.volume_label,
        pages=[p.bates_number for p in pages],
    )


# ---------------------------------------------------------------------------
# DAT Parser
# ---------------------------------------------------------------------------

def parse_dat_file(path):
    THORN = "\u00fe"
    TEXT_QUAL = "\x14"
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    if not lines:
        return [], []
    header = lines[0].strip().strip(THORN)
    columns = header.split(THORN + TEXT_QUAL + THORN)
    records = []
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        row = line.strip(THORN)
        values = row.split(THORN + TEXT_QUAL + THORN)
        record = {}
        for i, col in enumerate(columns):
            record[col] = values[i] if i < len(values) else ""
        records.append(DATRecord(fields=record))
    return columns, records


# ---------------------------------------------------------------------------
# Cross-validation
# ---------------------------------------------------------------------------

def cross_validate(documents, dat_records):
    if len(documents) != len(dat_records):
        return False
    for doc, rec in zip(documents, dat_records):
        begin = rec.fields.get("Begin Bates", "")
        end = rec.fields.get("End Bates", "")
        if doc.efta_start != begin or doc.efta_end != end:
            return False
    return True


# ---------------------------------------------------------------------------
# Dataset processing
# ---------------------------------------------------------------------------

def process_dataset(ds_num, s3):
    if ds_num not in DATASET_PATHS:
        print(f"DS{ds_num}: No path configuration")
        return None

    base_path, volume_base = DATASET_PATHS[ds_num]
    vol_name = base_path.split("/")[-1]

    print("\n" + "=" * 60)
    print(f"Dataset {ds_num} ({vol_name})")
    print("=" * 60)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    opt_dest = CACHE_DIR / f"{vol_name}.OPT"
    dat_dest = CACHE_DIR / f"{vol_name}.DAT"

    if not download_file(s3, f"{base_path}.OPT", opt_dest):
        return None
    if not download_file(s3, f"{base_path}.DAT", dat_dest):
        return None

    print(f"  Parsing OPT ({opt_dest.stat().st_size:,} bytes)...")
    opt_pages = parse_opt_file(opt_dest)
    documents = build_documents_from_opt(opt_pages, volume_base)

    print(f"  Parsing DAT ({dat_dest.stat().st_size:,} bytes)...")
    columns, dat_records = parse_dat_file(dat_dest)

    dat_opt_match = cross_validate(documents, dat_records)
    multi_page = sum(1 for d in documents if d.page_count > 1)
    max_pages = max((d.page_count for d in documents), default=0)
    efta_start = documents[0].efta_start if documents else "?"
    efta_end = documents[-1].efta_end if documents else "?"

    result = DatasetResult(
        dataset_number=ds_num,
        opt_pages=len(opt_pages),
        opt_documents=len(documents),
        dat_records=len(dat_records),
        dat_columns=columns,
        documents=documents,
        dat_records_list=dat_records,
        dat_opt_match=dat_opt_match,
        multi_page_docs=multi_page,
        max_page_count=max_pages,
        efta_start=efta_start,
        efta_end=efta_end,
    )

    print(f"  Pages:       {result.opt_pages:>10,}")
    print(f"  Documents:   {result.opt_documents:>10,}")
    print(f"  Multi-page:  {result.multi_page_docs:>10,}")
    print(f"  Max pages:   {result.max_page_count:>10,}")
    print(f"  EFTA range:  {result.efta_start} - {result.efta_end}")
    print(f"  DAT columns: {result.dat_columns}")
    print(f"  DAT records: {result.dat_records:>10,}")
    match_str = "YES" if result.dat_opt_match else "NO - MISMATCH"
    print(f"  DAT/OPT match: {match_str}")

    return result


# ---------------------------------------------------------------------------
# Database verification
# ---------------------------------------------------------------------------

def verify_database(results, env):
    sep = "=" * 60
    print(f"\n{sep}")
    print("DATABASE VERIFICATION")
    print(sep)

    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    headers = get_supabase_headers(env)

    resp = requests.get(
        f"{url}/rest/v1/datasets?select=id,dataset_number&order=dataset_number",
        headers=headers,
    )
    ds_map = {d["dataset_number"]: d["id"] for d in resp.json()}

    total_db = 0
    total_opt = 0
    mismatches = []

    for r in results:
        ds_id = ds_map.get(r.dataset_number)
        if not ds_id:
            print(f"  DS{r.dataset_number}: Not in datasets table!")
            continue
        resp = requests.get(
            f"{url}/rest/v1/documents?dataset_id=eq.{ds_id}&select=id&limit=1",
            headers={**headers, "Prefer": "count=exact"},
        )
        cr = resp.headers.get("Content-Range", "*/0")
        db_count = int(cr.split("/")[-1])
        total_db += db_count
        total_opt += r.opt_documents
        status = "OK" if db_count == r.opt_documents else "MISMATCH"
        if db_count != r.opt_documents:
            mismatches.append((r.dataset_number, db_count, r.opt_documents))
        print(f"  DS{r.dataset_number:>2}: DB={db_count:>8,}  OPT={r.opt_documents:>8,}  [{status}]")

    print(f"\n  TOTAL: DB={total_db:>10,}  OPT={total_opt:>10,}")
    if mismatches:
        print("\n  MISMATCHES:")
        for ds, db, opt in mismatches:
            print(f"    DS{ds}: DB={db:,}, OPT={opt:,} (diff: {db - opt:+,})")
    else:
        print(f"\n  All {len(results)} datasets match perfectly.")


def verify_page_counts(results, env):
    sep = "=" * 60
    print(f"\n{sep}")
    print("PAGE COUNT SPOT CHECKS")
    print(sep)

    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    headers = get_supabase_headers(env)

    resp = requests.get(
        f"{url}/rest/v1/datasets?select=id,dataset_number&order=dataset_number",
        headers=headers,
    )
    ds_map = {d["dataset_number"]: d["id"] for d in resp.json()}

    issues = 0
    checked = 0

    for r in results:
        ds_id = ds_map.get(r.dataset_number)
        if not ds_id:
            continue
        expected = {doc.filename: doc.page_count for doc in r.documents}
        for order_param in ["page_count.desc", "filename"]:
            resp = requests.get(
                f"{url}/rest/v1/documents?dataset_id=eq.{ds_id}"
                f"&select=filename,page_count&order={order_param}&limit=5",
                headers=headers,
            )
            for row in resp.json():
                fname = row["filename"]
                db_pc = row["page_count"]
                opt_pc = expected.get(fname)
                checked += 1
                if opt_pc is not None and db_pc != opt_pc:
                    print(f"  DS{r.dataset_number} {fname}: DB={db_pc}, OPT={opt_pc} MISMATCH")
                    issues += 1

    if issues == 0:
        print(f"  All {checked} spot checks passed.")
    else:
        print(f"  {issues}/{checked} page count mismatches found!")


# ---------------------------------------------------------------------------
# Database update
# ---------------------------------------------------------------------------

def update_database(results, env):
    """
    Bulk-update documents with dat_validated flag in metadata.

    Uses the mark_dat_validated RPC function (created by migration 00038)
    with batched calls to avoid statement timeouts on large datasets.

    Since DAT files only have Begin/End Bates (no rich metadata),
    we mark metadata.dat_validated = true and copy efta_start/efta_end
    as dat_begin_bates/dat_end_bates for cross-reference confirmation.
    """
    sep = "=" * 60
    print(f"\n{sep}")
    print("DATABASE UPDATE (batched RPC)")
    print(sep)

    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    headers = get_supabase_headers(env)

    resp = requests.get(
        f"{url}/rest/v1/datasets?select=id,dataset_number&order=dataset_number",
        headers=headers,
    )
    ds_map = {d["dataset_number"]: d["id"] for d in resp.json()}

    total_updated = 0
    BATCH_SIZE = 1000  # Safe size for Supabase statement timeout

    for r in results:
        ds_id = ds_map.get(r.dataset_number)
        if not ds_id:
            print(f"  DS{r.dataset_number}: No dataset UUID, skipping")
            continue

        print(f"  DS{r.dataset_number}: Updating {r.opt_documents:,} documents...")
        ds_total = 0
        batch_num = 0
        consecutive_failures = 0
        t0 = time.time()

        while consecutive_failures < 5:
            batch_num += 1
            success = False

            for attempt in range(3):
                try:
                    rpc_resp = requests.post(
                        f"{url}/rest/v1/rpc/mark_dat_validated",
                        headers=headers,
                        json={"p_dataset_id": ds_id, "p_batch_size": BATCH_SIZE},
                        timeout=30,
                    )
                    if rpc_resp.status_code == 200:
                        success = True
                        break
                    elif rpc_resp.status_code == 404:
                        print(f"  RPC not found. Run migrations 00037 + 00038 first.")
                        return
                    elif rpc_resp.status_code in (500, 503):
                        time.sleep(3 + attempt * 2)
                except requests.exceptions.Timeout:
                    time.sleep(5)

            if not success:
                consecutive_failures += 1
                time.sleep(5)
                continue

            count = rpc_resp.json()
            if count == 0:
                break

            consecutive_failures = 0
            ds_total += count

            if batch_num % 10 == 0 or ds_total >= r.opt_documents:
                elapsed = time.time() - t0
                rate = ds_total / elapsed if elapsed > 0 else 0
                remaining = r.opt_documents - ds_total
                eta = remaining / rate if rate > 0 else 0
                print(f"    {ds_total:>8,} / {r.opt_documents:>8,} ({rate:.0f}/s, ETA {eta:.0f}s)")

            time.sleep(0.3)

        elapsed = time.time() - t0
        total_updated += ds_total
        print(f"  DS{r.dataset_number}: {ds_total:,} updated in {elapsed:.1f}s")

    print(f"\n  TOTAL: {total_updated:,} documents updated")


def print_report(results):
    sep80 = "=" * 80
    sep90 = "-" * 90
    print(f"\n{sep80}")
    print("CONCORDANCE OPT/DAT PARSE REPORT")
    print(sep80)

    total_pages = 0
    total_docs = 0
    total_multi = 0

    print(f"\n{'DS':>4} {'Pages':>10} {'Docs':>10} {'Multi-pg':>10} {'Max':>8} {'Avg':>8} {'Match':>6} EFTA Range")
    print(sep90)

    for r in sorted(results, key=lambda x: x.dataset_number):
        avg = r.opt_pages / r.opt_documents if r.opt_documents else 0
        total_pages += r.opt_pages
        total_docs += r.opt_documents
        total_multi += r.multi_page_docs
        match_str = "YES" if r.dat_opt_match else "NO"
        print(
            f"{r.dataset_number:>4} "
            f"{r.opt_pages:>10,} "
            f"{r.opt_documents:>10,} "
            f"{r.multi_page_docs:>10,} "
            f"{r.max_page_count:>8,} "
            f"{avg:>8.1f} "
            f"{match_str:>6} "
            f"{r.efta_start} - {r.efta_end}"
        )

    print(sep90)
    avg_total = total_pages / total_docs if total_docs else 0
    print(
        f"{'TOT':>4} "
        f"{total_pages:>10,} "
        f"{total_docs:>10,} "
        f"{total_multi:>10,} "
        f"{'':>8} "
        f"{avg_total:>8.1f}"
    )

    # DAT column summary
    all_columns = set()
    for r in results:
        all_columns.update(r.dat_columns)
    print(f"\nDAT columns across all datasets: {sorted(all_columns)}")
    if all_columns == {"Begin Bates", "End Bates"}:
        print("  NOTE: All DAT files contain only Begin/End Bates.")
        print("  No rich metadata (dates, custodians, subjects) in Concordance files.")

    # Page count distribution
    print("\nPage count distribution:")
    all_docs = []
    for r in results:
        all_docs.extend(r.documents)

    buckets = [
        ("1 page", 1, 1),
        ("2-5 pages", 2, 5),
        ("6-10 pages", 6, 10),
        ("11-50 pages", 11, 50),
        ("51-100 pages", 51, 100),
        ("101-500 pages", 101, 500),
        ("501-1000 pages", 501, 1000),
        ("1001+ pages", 1001, 999999),
    ]
    for label, lo, hi in buckets:
        count = sum(1 for d in all_docs if lo <= d.page_count <= hi)
        pct = count / len(all_docs) * 100 if all_docs else 0
        bar = "#" * int(pct / 2)
        print(f"  {label:>16}: {count:>8,} ({pct:>5.1f}%) {bar}")

    # Top 10 largest documents
    print("\nTop 10 largest documents:")
    top = sorted(all_docs, key=lambda d: d.page_count, reverse=True)[:10]
    for i, doc in enumerate(top, 1):
        print(f"  {i:>2}. {doc.filename} ({doc.page_count:,} pages) {doc.efta_start}-{doc.efta_end}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Parse Concordance OPT/DAT files from DOJ datasets"
    )
    parser.add_argument("--dataset", type=int, help="Process single dataset (1-12)")
    parser.add_argument("--verify", action="store_true", help="Verify DB against OPT")
    parser.add_argument("--update", action="store_true", help="Update DB with parsed data")
    parser.add_argument("--no-download", action="store_true", help="Use cached files only")
    args = parser.parse_args()

    env = load_env()
    s3 = None if args.no_download else get_s3_client(env)
    datasets = [args.dataset] if args.dataset else list(range(1, 13))

    results = []
    t0 = time.time()
    for ds_num in datasets:
        result = process_dataset(ds_num, s3)
        if result:
            results.append(result)
    elapsed = time.time() - t0
    print(f"\nParsing complete in {elapsed:.1f}s")

    print_report(results)

    if args.verify or args.update:
        verify_database(results, env)
        verify_page_counts(results, env)

    if args.update:
        update_database(results, env)

    print("\nDone.")


if __name__ == "__main__":
    main()
