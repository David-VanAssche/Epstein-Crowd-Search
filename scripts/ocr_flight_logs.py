#!/usr/bin/env python3
# Force unbuffered output so progress appears in real-time even when piped
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

"""
ocr_flight_logs.py — OCR flight log PDFs page-by-page using Kimi K2.5 (Fireworks)
then fuzzy-match extracted records to existing flights rows.

Requires:
  pip install pymupdf

Usage:
  python scripts/ocr_flight_logs.py                  # OCR all 6 parts
  python scripts/ocr_flight_logs.py --part 1         # OCR only Part 1
  python scripts/ocr_flight_logs.py --dry-run        # preview without DB writes
  python scripts/ocr_flight_logs.py --skip-ocr       # skip OCR, only do matching
"""

import argparse
import base64
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# .env loader
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = REPO_ROOT / ".env"


def load_dotenv(env_file: Path) -> None:
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
# SSL context
# ---------------------------------------------------------------------------

_SSL_CTX = ssl.create_default_context()
try:
    import certifi
    _SSL_CTX.load_verify_locations(certifi.where())
except (ImportError, Exception):
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

BUCKET = "raw-archive"

FLIGHT_LOG_PDFS = [
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part1_0_0_0_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part2_0_0_0_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part3_0_0_0_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part4_0_0_0_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part5_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part6_0.pdf",
]

# Temp directory for downloaded PDFs and page images
TEMP_DIR = Path("/tmp/flight_log_ocr")


# ---------------------------------------------------------------------------
# Supabase REST API
# ---------------------------------------------------------------------------


def supabase_rest(
    method: str,
    table: str,
    data=None,
    params: dict | None = None,
    prefer: str = "return=minimal",
    timeout: int = 60,
) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        query = "&".join(
            f"{k}={urllib.parse.quote(str(v), safe='.,=()!*')}" for k, v in params.items()
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
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX) as resp:
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


def download_storage_file(storage_path: str, dest: Path) -> bool:
    """Download a file from Supabase Storage to a local path."""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  Using cached: {dest.name} ({dest.stat().st_size:,} bytes)")
        return True

    encoded_path = urllib.parse.quote(storage_path, safe="/")
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{encoded_path}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=300, context=_SSL_CTX) as resp:
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as f:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
        print(f"  Downloaded: {dest.name} ({dest.stat().st_size:,} bytes)")
        return True
    except Exception as e:
        print(f"  ERROR downloading {storage_path}: {e}")
        return False


# ---------------------------------------------------------------------------
# PDF page splitting with PyMuPDF
# ---------------------------------------------------------------------------


def split_pdf_to_images(pdf_path: Path, output_dir: Path, dpi: int = 100) -> list[Path]:
    """Split a PDF into per-page JPEG images. Returns list of image paths."""
    try:
        import fitz  # pymupdf
    except ImportError:
        print("ERROR: pymupdf is required. Install with: pip install pymupdf")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)
    image_paths = []

    doc = fitz.open(str(pdf_path))
    total_pages = len(doc)
    print(f"  PDF has {total_pages} pages")

    for page_num in range(total_pages):
        img_path = output_dir / f"page_{page_num + 1:04d}.jpg"

        if img_path.exists() and img_path.stat().st_size > 0:
            image_paths.append(img_path)
            continue

        page = doc[page_num]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        # Save as JPEG to keep file sizes manageable (~200-400KB vs 2MB PNG)
        pix.save(str(img_path))
        image_paths.append(img_path)

        if (page_num + 1) % 50 == 0:
            print(f"    Rendered {page_num + 1}/{total_pages} pages")

    doc.close()
    print(f"  Rendered {total_pages} page images")
    return image_paths


# ---------------------------------------------------------------------------
# Kimi K2.5 Vision OCR via Fireworks
# ---------------------------------------------------------------------------

OCR_PROMPT = """Extract all flight records from this handwritten flight log page.

Each flight record typically contains: date, tail number (N-number), departure airport, arrival airport, pilot name, and passenger names.

Return a JSON object with exactly this structure:
{
  "flights": [
    {
      "date": "YYYY-MM-DD",
      "tail_number": "N...",
      "departure": "airport name or code",
      "arrival": "airport name or code",
      "pilot": "pilot name",
      "passengers": ["name1", "name2"]
    }
  ],
  "raw_text": "full transcription of all text on the page"
}

Rules:
- If a date spans multiple flights (same date, multiple legs), repeat the date for each flight
- If you cannot read a field, use null
- If no flight records are found on this page (blank page, cover page, etc.), return {"flights": [], "raw_text": "..."}
- For dates, use the format YYYY-MM-DD. The logs span approximately 1995-2013.
- Return ONLY the JSON object, no other text"""


def ocr_page(image_path: Path, max_retries: int = 3) -> dict | None:
    """Send a page image to GPT-4.1-mini for OCR extraction via curl."""
    import subprocess
    import tempfile

    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "model": "gpt-4.1-mini",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}",
                            "detail": "high",
                        },
                    },
                    {
                        "type": "text",
                        "text": OCR_PROMPT,
                    },
                ],
            }
        ],
        "temperature": 0.1,
        "max_tokens": 8192,
    }

    # Write payload to temp file to avoid shell argument limits
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
        json.dump(payload, tmp)
        tmp_path = tmp.name

    for attempt in range(max_retries):
        try:
            result = subprocess.run(
                [
                    "curl", "-s", "--max-time", "180",
                    "https://api.openai.com/v1/chat/completions",
                    "-H", f"Authorization: Bearer {OPENAI_API_KEY}",
                    "-H", "Content-Type: application/json",
                    "-d", f"@{tmp_path}",
                ],
                capture_output=True,
                text=True,
                timeout=200,
            )

            if result.returncode != 0:
                print(f"    curl error (attempt {attempt + 1}, rc={result.returncode}): {result.stderr[:200]}")
                if result.stdout:
                    print(f"    curl stdout: {result.stdout[:200]}")
                if attempt < max_retries - 1:
                    time.sleep(5 * (attempt + 1))
                continue

            resp_data = json.loads(result.stdout)

            if "error" in resp_data:
                err = resp_data["error"]
                if "rate" in str(err.get("message", "")).lower():
                    wait = (2 ** attempt) * 5
                    print(f"    Rate limited, waiting {wait}s...")
                    time.sleep(wait)
                    continue
                print(f"    API error: {err.get('message', '')[:200]}")
                if attempt < max_retries - 1:
                    time.sleep(3)
                continue

            content = resp_data["choices"][0]["message"]["content"]
            os.unlink(tmp_path)
            return _parse_ocr_response(content)

        except subprocess.TimeoutExpired:
            print(f"    Timeout (attempt {attempt + 1})")
            if attempt < max_retries - 1:
                time.sleep(5)
        except Exception as e:
            print(f"    Error (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(5 * (attempt + 1))

    try:
        os.unlink(tmp_path)
    except OSError:
        pass
    return None


def _parse_ocr_response(content: str) -> dict | None:
    """Parse the JSON response from the OCR model."""
    content = content.strip()

    # Remove markdown code fences
    if content.startswith("```"):
        lines = content.split("\n")
        json_lines = []
        in_block = False
        for line in lines:
            if line.strip().startswith("```") and not in_block:
                in_block = True
                continue
            elif line.strip() == "```":
                break
            elif in_block:
                json_lines.append(line)
        content = "\n".join(json_lines)

    # Remove <think>...</think> blocks if present
    if "<think>" in content:
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try to find JSON object in the response
        match = re.search(r"\{[\s\S]*\}", content)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        print(f"    Failed to parse OCR JSON: {content[:200]}")
        return None


# ---------------------------------------------------------------------------
# Flight matching
# ---------------------------------------------------------------------------


def normalize_for_match(s: str | None) -> str:
    """Normalize a string for fuzzy matching."""
    if not s:
        return ""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def date_close(d1: str | None, d2: str | None, tolerance_days: int = 1) -> bool:
    """Check if two date strings are within tolerance_days of each other."""
    if not d1 or not d2:
        return False
    try:
        dt1 = datetime.strptime(d1, "%Y-%m-%d")
        dt2 = datetime.strptime(d2, "%Y-%m-%d")
        return abs((dt1 - dt2).days) <= tolerance_days
    except ValueError:
        return d1 == d2


def match_ocr_to_flights(
    ocr_records: list[dict],
    db_flights: list[dict],
) -> list[tuple[dict, dict]]:
    """
    Match OCR-extracted flight records to existing DB flights.
    Returns list of (ocr_record, db_flight) tuples.
    """
    # Build index of DB flights by date for fast lookup
    flights_by_date: dict[str, list[dict]] = {}
    for f in db_flights:
        date = f.get("flight_date") or ""
        flights_by_date.setdefault(date, []).append(f)

    matches = []
    used_db_ids = set()

    for ocr in ocr_records:
        ocr_date = ocr.get("date") or ""
        ocr_dep = normalize_for_match(ocr.get("departure"))
        ocr_arr = normalize_for_match(ocr.get("arrival"))
        ocr_tail = normalize_for_match(ocr.get("tail_number"))

        best_match = None
        best_score = 0

        # Check exact date and +/- 1 day
        candidate_dates = [ocr_date]
        try:
            dt = datetime.strptime(ocr_date, "%Y-%m-%d")
            candidate_dates.append((dt + timedelta(days=1)).strftime("%Y-%m-%d"))
            candidate_dates.append((dt - timedelta(days=1)).strftime("%Y-%m-%d"))
        except ValueError:
            pass

        for cdate in candidate_dates:
            for f in flights_by_date.get(cdate, []):
                if f["id"] in used_db_ids:
                    continue

                score = 0
                # Date match (exact = 3, off by 1 = 1)
                if cdate == ocr_date:
                    score += 3
                else:
                    score += 1

                # Departure match (check both full name and IATA code)
                db_dep = normalize_for_match(f.get("departure"))
                db_dep_iata = (f.get("departure_iata") or "").lower()
                if ocr_dep and (
                    (db_dep and (ocr_dep in db_dep or db_dep in ocr_dep))
                    or (db_dep_iata and ocr_dep == db_dep_iata)
                ):
                    score += 2

                # Arrival match (check both full name and IATA code)
                db_arr = normalize_for_match(f.get("arrival"))
                db_arr_iata = (f.get("arrival_iata") or "").lower()
                if ocr_arr and (
                    (db_arr and (ocr_arr in db_arr or db_arr in ocr_arr))
                    or (db_arr_iata and ocr_arr == db_arr_iata)
                ):
                    score += 2

                # Tail number match (fuzzy: allow 1 char difference for OCR errors)
                db_tail = normalize_for_match(f.get("tail_number"))
                if ocr_tail and db_tail:
                    if ocr_tail == db_tail:
                        score += 3
                    elif len(ocr_tail) == len(db_tail) and sum(
                        a != b for a, b in zip(ocr_tail, db_tail)
                    ) <= 1:
                        score += 2  # 1-char difference (e.g., N908JC vs N908JE)

                if score > best_score and score >= 5:
                    best_score = score
                    best_match = f

        if best_match:
            matches.append((ocr, best_match))
            used_db_ids.add(best_match["id"])

    return matches


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------


def process_pdf(
    storage_path: str,
    document_id: str | None,
    db_flights: list[dict],
    dry_run: bool,
) -> dict:
    """Process a single flight log PDF: download, split, OCR, match."""
    filename = os.path.basename(storage_path)
    part_name = filename.replace("B. Flight Log_Released in U.S. v. Maxwell_", "").replace(".pdf", "")
    print(f"\n{'=' * 50}")
    print(f"Processing: {part_name}")
    print(f"{'=' * 50}")

    stats = {
        "part": part_name,
        "pages": 0,
        "flights_extracted": 0,
        "flights_matched": 0,
        "pages_with_flights": 0,
    }

    # Download PDF
    pdf_dest = TEMP_DIR / filename
    if not download_storage_file(storage_path, pdf_dest):
        print(f"  Skipping {part_name}: download failed")
        return stats

    # Split to page images
    pages_dir = TEMP_DIR / part_name.replace(" ", "_")
    page_images = split_pdf_to_images(pdf_dest, pages_dir)
    stats["pages"] = len(page_images)

    # OCR each page
    all_ocr_records = []  # (page_number, record)
    ocr_texts = []  # (page_number, raw_text)

    # Check for cached OCR results
    cache_path = TEMP_DIR / f"{part_name.replace(' ', '_')}_ocr.json"
    cached_results = {}
    if cache_path.exists():
        try:
            cached_results = json.loads(cache_path.read_text())
            print(f"  Loaded {len(cached_results)} cached OCR results")
        except Exception:
            pass

    for i, img_path in enumerate(page_images):
        page_num = i + 1
        page_key = str(page_num)

        # Use cached result if available
        if page_key in cached_results:
            result = cached_results[page_key]
        else:
            result = ocr_page(img_path)
            if result:
                cached_results[page_key] = result
                # Save cache after each page
                cache_path.write_text(json.dumps(cached_results, indent=2))

            # Rate limit: ~1 request per second
            time.sleep(1.0)

        if not result:
            if page_num % 20 == 0:
                print(f"    Page {page_num}/{len(page_images)}: OCR failed")
            continue

        flights_on_page = result.get("flights") or []
        raw_text = result.get("raw_text") or ""

        if raw_text:
            ocr_texts.append((page_num, raw_text))

        if flights_on_page:
            stats["pages_with_flights"] += 1
            for rec in flights_on_page:
                rec["_page_number"] = page_num
                all_ocr_records.append(rec)

        if page_num % 20 == 0 or page_num == len(page_images):
            print(
                f"    Page {page_num}/{len(page_images)}: "
                f"{len(flights_on_page)} flights, "
                f"{len(all_ocr_records)} total extracted"
            )

    stats["flights_extracted"] = len(all_ocr_records)
    print(f"\n  OCR complete: {len(all_ocr_records)} flights from {stats['pages_with_flights']} pages")

    # Update document record with OCR text and page count
    if document_id and not dry_run:
        # Concatenate OCR texts with page markers
        full_ocr = "\n".join(
            f"--- Page {pn} ---\n{text}" for pn, text in sorted(ocr_texts)
        )
        patch = {
            "page_count": len(page_images),
            "processing_status": "completed",
            "ocr_source": "gpt-4.1-mini",
        }
        if full_ocr:
            patch["ocr_text"] = full_ocr

        result = supabase_rest(
            "PATCH",
            "documents",
            data=patch,
            params={"id": f"eq.{document_id}"},
        )
        if 200 <= result.get("status", 0) < 300:
            print(f"  Updated document {document_id}: page_count={len(page_images)}, ocr_source=gpt-4.1-mini")
        else:
            print(f"  ERROR updating document: {result.get('error', '')[:200]}")

    # Match OCR records to DB flights
    if all_ocr_records and db_flights:
        print(f"\n  Matching {len(all_ocr_records)} OCR records to {len(db_flights)} DB flights...")
        matches = match_ocr_to_flights(all_ocr_records, db_flights)
        stats["flights_matched"] = len(matches)
        print(f"  Matched: {len(matches)} flights")

        if matches and not dry_run and document_id:
            linked = 0
            for ocr_rec, db_flight in matches:
                page_num = ocr_rec.get("_page_number")
                patch = {"document_id": document_id}
                if page_num:
                    patch["page_number"] = page_num

                result = supabase_rest(
                    "PATCH",
                    "flights",
                    data=patch,
                    params={"id": f"eq.{db_flight['id']}"},
                )
                if 200 <= result.get("status", 0) < 300:
                    linked += 1

            print(f"  Linked {linked} flights to document + page numbers")

        # Log unmatched OCR records
        unmatched = len(all_ocr_records) - len(matches)
        if unmatched > 0:
            print(f"  Unmatched OCR records: {unmatched}")
            # Save unmatched for review
            unmatched_path = TEMP_DIR / f"{part_name.replace(' ', '_')}_unmatched.json"
            matched_pages = {(m[0].get("date"), m[0].get("_page_number")) for m in matches}
            unmatched_recs = [
                r for r in all_ocr_records
                if (r.get("date"), r.get("_page_number")) not in matched_pages
            ]
            unmatched_path.write_text(json.dumps(unmatched_recs, indent=2))
            print(f"  Saved unmatched records to: {unmatched_path}")

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="OCR flight log PDFs and link to flights table"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without DB writes",
    )
    parser.add_argument(
        "--part",
        type=int,
        default=None,
        help="Only process a specific part number (1-6)",
    )
    parser.add_argument(
        "--skip-ocr",
        action="store_true",
        help="Skip OCR phase, only do matching from cached results",
    )
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY must be set")
        sys.exit(1)

    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Flight Log OCR + Matching")
    print("=" * 60)
    print(f"  Supabase URL: {SUPABASE_URL}")
    print(f"  Dry run: {args.dry_run}")
    print(f"  Temp dir: {TEMP_DIR}")
    print()

    # Determine which PDFs to process
    if args.part:
        if args.part < 1 or args.part > 6:
            print("ERROR: --part must be 1-6")
            sys.exit(1)
        pdfs = [FLIGHT_LOG_PDFS[args.part - 1]]
    else:
        pdfs = FLIGHT_LOG_PDFS

    # Look up document IDs for the PDFs
    doc_ids: dict[str, str] = {}
    for pdf_path in pdfs:
        result = supabase_rest(
            "GET",
            "documents",
            params={
                "storage_path": f"eq.{pdf_path}",
                "select": "id,storage_path",
            },
            prefer="return=representation",
        )
        if result.get("data") and len(result["data"]) > 0:
            doc_ids[pdf_path] = result["data"][0]["id"]

    print(f"  PDFs to process: {len(pdfs)}")
    print(f"  With document records: {len(doc_ids)}")
    if len(doc_ids) < len(pdfs):
        missing = [p for p in pdfs if p not in doc_ids]
        print(f"  WARNING: No document records for: {[os.path.basename(p) for p in missing]}")
        print(f"  Run backfill_flights.py --phase E first to create document records.")

    # Fetch all flights for matching
    print("\n  Fetching all flight rows for matching...")
    all_flights = []
    offset = 0
    page_size = 1000
    while True:
        result = supabase_rest(
            "GET",
            "flights",
            params={
                "select": "id,flight_date,departure,arrival,departure_iata,arrival_iata,aircraft,tail_number,document_id",
                "order": "flight_date.asc",
                "offset": str(offset),
                "limit": str(page_size),
            },
            prefer="return=representation",
        )
        rows = result.get("data") or []
        all_flights.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    print(f"  Fetched {len(all_flights)} flight rows")

    # Process each PDF
    all_stats = []
    for pdf_path in pdfs:
        doc_id = doc_ids.get(pdf_path)
        stats = process_pdf(pdf_path, doc_id, all_flights, args.dry_run)
        all_stats.append(stats)

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")

    total_pages = 0
    total_extracted = 0
    total_matched = 0

    for s in all_stats:
        print(
            f"  {s['part']}: {s['pages']} pages, "
            f"{s['flights_extracted']} extracted, "
            f"{s['flights_matched']} matched"
        )
        total_pages += s["pages"]
        total_extracted += s["flights_extracted"]
        total_matched += s["flights_matched"]

    print(f"\n  TOTAL: {total_pages} pages, {total_extracted} flights extracted, {total_matched} matched")

    if args.dry_run:
        print("\n  [DRY RUN] No database changes were made.")


if __name__ == "__main__":
    main()
