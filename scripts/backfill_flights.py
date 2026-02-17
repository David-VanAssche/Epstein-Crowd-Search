#!/usr/bin/env python3
# Force unbuffered output so progress appears in real-time even when piped
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

"""
backfill_flights.py — Enrich the flights table with 5 phases:

  Phase A: Deduplicate rows (3,416 → ~1,770)
  Phase B: Backfill passenger_names, pilot, passenger_count from source JSON
  Phase C: Parse tail_number + aircraft_type from aircraft field
  Phase D: Normalize airports to IATA codes via LLM
  Phase E: Ingest flight log PDFs into documents table

Usage:
  pip install requests  # only external dep (optional, uses urllib if missing)

  python scripts/backfill_flights.py                 # run all phases
  python scripts/backfill_flights.py --phase A       # run single phase
  python scripts/backfill_flights.py --phase A,B,C   # run specific phases
  python scripts/backfill_flights.py --dry-run        # preview without changes
"""

import argparse
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# .env loader
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
# SSL context (macOS Python often has cert issues)
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
FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "")

BUCKET = "raw-archive"
FLIGHTS_JSON_PATH = "websites/epstein-exposed/flights.json"

# Flight log PDF paths in storage (Parts 1-6 only, skip compiled version)
FLIGHT_LOG_PDFS = [
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part1_0_0_0_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part2_0_0_0_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part3_0_0_0_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part4_0_0_0_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part5_0.pdf",
    "kaggle/jazivxt/B. Flight Log_Released in U.S. v. Maxwell_Part6_0.pdf",
]


# ---------------------------------------------------------------------------
# Supabase REST API (matches pattern from backfill_media.py)
# ---------------------------------------------------------------------------


def supabase_rest(
    method: str,
    table: str,
    data=None,
    params: dict | None = None,
    prefer: str = "return=minimal",
    timeout: int = 60,
) -> dict:
    """Make a Supabase REST API request using urllib."""
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


def fetch_all_flights() -> list[dict]:
    """Fetch all flight rows from the DB, paginating with range headers."""
    all_rows = []
    offset = 0
    page_size = 1000

    while True:
        result = supabase_rest(
            "GET",
            "flights",
            params={
                "select": "*",
                "order": "flight_date.asc,id.asc",
                "offset": str(offset),
                "limit": str(page_size),
            },
            prefer="return=representation",
        )
        rows = result.get("data") or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    return all_rows


def download_storage_file(storage_path: str) -> bytes | None:
    """Download a file from Supabase Storage."""
    encoded_path = urllib.parse.quote(storage_path, safe="/")
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{encoded_path}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=120, context=_SSL_CTX) as resp:
            return resp.read()
    except Exception as e:
        print(f"  ERROR downloading {storage_path}: {e}")
        return None


def get_storage_metadata(storage_path: str) -> dict | None:
    """Get metadata for a storage object (size, etc.)."""
    encoded_path = urllib.parse.quote(storage_path, safe="/")
    url = f"{SUPABASE_URL}/storage/v1/object/info/{BUCKET}/{encoded_path}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  WARNING: Could not get metadata for {storage_path}: {e}")
        return None


# ---------------------------------------------------------------------------
# Phase A: Deduplicate
# ---------------------------------------------------------------------------


def phase_a_deduplicate(flights: list[dict], dry_run: bool) -> list[dict]:
    """
    Group flights by (flight_date, aircraft, departure, arrival).
    Keep the row with the most populated fields, DELETE the rest.
    Returns the surviving rows.
    """
    print("\n" + "=" * 60)
    print("PHASE A: Deduplicate flights")
    print("=" * 60)

    # Group by composite key
    groups: dict[tuple, list[dict]] = {}
    for f in flights:
        key = (
            f.get("flight_date") or "",
            (f.get("aircraft") or "").strip().lower(),
            (f.get("departure") or "").strip().lower(),
            (f.get("arrival") or "").strip().lower(),
        )
        groups.setdefault(key, []).append(f)

    # Find duplicates
    to_delete = []
    survivors = []
    dup_groups = 0

    for key, group in groups.items():
        if len(group) == 1:
            survivors.append(group[0])
            continue

        dup_groups += 1
        # Score each row by how many fields are populated
        def score(row):
            s = 0
            if row.get("passenger_names"):
                s += len(row["passenger_names"])
            if row.get("pilot"):
                s += 1
            if row.get("tail_number"):
                s += 1
            if row.get("raw_text"):
                s += 1
            if row.get("document_id"):
                s += 1
            return s

        group.sort(key=score, reverse=True)
        survivors.append(group[0])
        to_delete.extend(group[1:])

    print(f"  Total rows: {len(flights)}")
    print(f"  Unique keys: {len(groups)}")
    print(f"  Duplicate groups: {dup_groups}")
    print(f"  Rows to delete: {len(to_delete)}")
    print(f"  Rows surviving: {len(survivors)}")

    if not to_delete:
        print("  No duplicates found. Skipping.")
        return flights

    if dry_run:
        print("  [DRY RUN] Would delete {len(to_delete)} rows.")
        return survivors

    # Delete in batches
    deleted = 0
    batch_size = 50
    ids_to_delete = [r["id"] for r in to_delete]

    for i in range(0, len(ids_to_delete), batch_size):
        batch_ids = ids_to_delete[i : i + batch_size]
        id_list = ",".join(f'"{uid}"' for uid in batch_ids)
        result = supabase_rest(
            "DELETE",
            "flights",
            params={"id": f"in.({id_list})"},
        )
        status = result.get("status", 0)
        if 200 <= status < 300:
            deleted += len(batch_ids)
        else:
            print(f"  ERROR deleting batch: {result.get('error', 'unknown')[:200]}")
            # Fall back to individual deletes
            for uid in batch_ids:
                r = supabase_rest("DELETE", "flights", params={"id": f"eq.{uid}"})
                if 200 <= r.get("status", 0) < 300:
                    deleted += 1
                else:
                    print(f"    Failed to delete {uid}")

        if (i + batch_size) % 500 < batch_size or i + batch_size >= len(ids_to_delete):
            print(f"  Deleted {deleted}/{len(ids_to_delete)}")

    print(f"  Deduplication complete: {deleted} rows deleted")
    return survivors


# ---------------------------------------------------------------------------
# Phase B: Backfill from source data
# ---------------------------------------------------------------------------


def phase_b_backfill_from_source(flights: list[dict], dry_run: bool) -> list[dict]:
    """
    Download flights.json from storage and backfill missing fields.
    Match DB rows to source by (flight_date, aircraft).
    """
    print("\n" + "=" * 60)
    print("PHASE B: Backfill from source data (flights.json)")
    print("=" * 60)

    # Download source data
    print(f"  Downloading {FLIGHTS_JSON_PATH}...")
    raw = download_storage_file(FLIGHTS_JSON_PATH)
    if not raw:
        print("  ERROR: Could not download flights.json. Skipping phase B.")
        return flights

    source_data = json.loads(raw.decode("utf-8"))
    print(f"  Source records: {len(source_data)}")

    # Build lookup by (date, aircraft_lower)
    # Source JSON uses: date, origin, destination, aircraft, pilot, passengerNames, passengerCount
    source_lookup: dict[tuple, dict] = {}
    for rec in source_data:
        date = rec.get("date") or rec.get("flightDate") or rec.get("flight_date") or ""
        aircraft = (rec.get("aircraft") or "").strip().lower()
        if date and aircraft:
            key = (date, aircraft)
            if key not in source_lookup:
                source_lookup[key] = rec

    print(f"  Unique source keys: {len(source_lookup)}")

    # Match and patch
    patched = 0
    matched = 0
    patches_by_id: dict[str, dict] = {}

    for f in flights:
        date = f.get("flight_date") or ""
        aircraft = (f.get("aircraft") or "").strip().lower()
        key = (date, aircraft)

        src = source_lookup.get(key)
        if not src:
            continue
        matched += 1

        patch = {}

        # Backfill passenger_names if empty
        src_passengers = src.get("passengerNames") or src.get("passenger_names") or []
        if isinstance(src_passengers, list) and src_passengers:
            current = f.get("passenger_names") or []
            if not current:
                patch["passenger_names"] = src_passengers

        # Backfill pilot if empty
        src_pilot = src.get("pilot") or ""
        if src_pilot and not f.get("pilot"):
            patch["pilot"] = src_pilot

        # Compute passenger_count
        pnames = patch.get("passenger_names") or f.get("passenger_names") or []
        src_count = src.get("passengerCount") or src.get("passenger_count")
        if src_count and isinstance(src_count, int):
            patch["passenger_count"] = src_count
        elif pnames:
            patch["passenger_count"] = len(pnames)

        if patch:
            patches_by_id[f["id"]] = patch
            patched += 1

    print(f"  Matched: {matched} / {len(flights)} DB rows")
    print(f"  Rows to patch: {patched}")

    if not patches_by_id:
        print("  Nothing to patch. Skipping.")
        return flights

    if dry_run:
        # Show sample patches
        for uid, patch in list(patches_by_id.items())[:3]:
            print(f"    Sample: {uid} -> {patch}")
        print(f"  [DRY RUN] Would patch {patched} rows.")
        return flights

    # Apply patches
    applied = 0
    for uid, patch in patches_by_id.items():
        result = supabase_rest(
            "PATCH",
            "flights",
            data=patch,
            params={"id": f"eq.{uid}"},
        )
        if 200 <= result.get("status", 0) < 300:
            applied += 1
            # Update in-memory copy too
            for f in flights:
                if f["id"] == uid:
                    f.update(patch)
                    break
        else:
            err = result.get("error", "")[:200]
            if applied == 0:
                print(f"  ERROR on first patch: {err}")

        if applied % 200 == 0 and applied > 0:
            print(f"  Patched {applied}/{patched}...")

    print(f"  Phase B complete: {applied} rows patched")
    return flights


# ---------------------------------------------------------------------------
# Phase C: Parse tail_number + aircraft_type
# ---------------------------------------------------------------------------


def phase_c_parse_aircraft(flights: list[dict], dry_run: bool) -> list[dict]:
    """
    Parse aircraft field like "N212JE (Gulfstream G550)" into:
      tail_number = "N212JE"
      aircraft_type = "Gulfstream G550"
    """
    print("\n" + "=" * 60)
    print("PHASE C: Parse tail_number + aircraft_type from aircraft field")
    print("=" * 60)

    # Pattern: "N212JE (Gulfstream G550)" or "N212JE - Gulfstream G550"
    # Also handles bare tail numbers like "N212JE"
    tail_pattern = re.compile(
        r"^(N\d{1,5}[A-Z]{0,2})"           # FAA N-number
        r"(?:\s*[\(\-–]\s*(.+?)[\)\s]*)?$",  # optional type in parens or after dash
        re.IGNORECASE,
    )

    patches_by_id: dict[str, dict] = {}

    for f in flights:
        aircraft = (f.get("aircraft") or "").strip()
        if not aircraft:
            continue

        patch = {}
        m = tail_pattern.match(aircraft)

        if m:
            tail = m.group(1).upper()
            atype = (m.group(2) or "").strip() if m.group(2) else None

            if not f.get("tail_number"):
                patch["tail_number"] = tail
            if atype and not f.get("aircraft_type"):
                patch["aircraft_type"] = atype
        else:
            # No N-number — the whole field might be the aircraft type
            # e.g., "Gulfstream II/SP", "Boeing 727"
            if not f.get("aircraft_type") and not aircraft.startswith("N"):
                patch["aircraft_type"] = aircraft

        if patch:
            patches_by_id[f["id"]] = patch

    print(f"  Rows to patch: {len(patches_by_id)}")

    if not patches_by_id:
        print("  Nothing to patch. Skipping.")
        return flights

    # Count what we're setting
    tail_count = sum(1 for p in patches_by_id.values() if "tail_number" in p)
    type_count = sum(1 for p in patches_by_id.values() if "aircraft_type" in p)
    print(f"  Setting tail_number on {tail_count} rows")
    print(f"  Setting aircraft_type on {type_count} rows")

    if dry_run:
        for uid, patch in list(patches_by_id.items())[:5]:
            f_aircraft = next((f["aircraft"] for f in flights if f["id"] == uid), "?")
            print(f"    {f_aircraft} -> {patch}")
        print(f"  [DRY RUN] Would patch {len(patches_by_id)} rows.")
        return flights

    applied = 0
    for uid, patch in patches_by_id.items():
        result = supabase_rest(
            "PATCH",
            "flights",
            data=patch,
            params={"id": f"eq.{uid}"},
        )
        if 200 <= result.get("status", 0) < 300:
            applied += 1
            for f in flights:
                if f["id"] == uid:
                    f.update(patch)
                    break

        if applied % 500 == 0 and applied > 0:
            print(f"  Patched {applied}/{len(patches_by_id)}...")

    print(f"  Phase C complete: {applied} rows patched")
    return flights


# ---------------------------------------------------------------------------
# Phase D: Normalize airports to IATA codes
# ---------------------------------------------------------------------------


def phase_d_normalize_airports(flights: list[dict], dry_run: bool) -> list[dict]:
    """
    Collect all distinct departure/arrival values, use LLM to map to IATA codes,
    then PATCH departure_iata/arrival_iata on all rows.
    """
    print("\n" + "=" * 60)
    print("PHASE D: Normalize airports to IATA codes")
    print("=" * 60)

    # Collect unique airport names
    airport_names: set[str] = set()
    for f in flights:
        dep = (f.get("departure") or "").strip()
        arr = (f.get("arrival") or "").strip()
        if dep:
            airport_names.add(dep)
        if arr:
            airport_names.add(arr)

    # Remove empty and already-IATA-like values
    airport_names.discard("")
    print(f"  Distinct airport names: {len(airport_names)}")

    if not airport_names:
        print("  No airports to normalize. Skipping.")
        return flights

    # Static IATA mapping — pre-computed from the known airport names in the dataset.
    # ICAO codes resolved: LFBG=CNG, EINN=SNN, TIST=STT, LZIB=BTS, EDDM=MUC, etc.
    IATA_MAP = {
        "ABQ": "ABQ", "ACC": "ACC", "ACY Airport": "ACY", "APC Airport": "APC",
        "ASE Airport": "ASE", "Abuja, Nigeria": "ABV", "Accra, Ghana": "ACC",
        "Albuquerque International Sunport, NM": "ABQ", "Azores, Portugal": "PDL",
        "BAF Airport": "BAF", "BCT Airport": "BCT", "BFI Airport": "BFI",
        "BQK Airport": "BQK", "BUR Airport": "BUR",
        "Bangor International Airport, ME": "BGR", "Bangor International, ME": "BGR",
        "Boston Logan International, MA": "BOS", "CDG": "CDG", "CMH": "CMH",
        "CNM Airport": "CNM", "CNO Airport": "CNO", "CNW Airport": "CNW",
        "CPS Airport": "CPS", "CPT": "CPT", "CRW Airport": "CRW",
        "CYJT Airport": "YJT", "CYQX Airport": "YQX", "CYVR Airport": "YVR",
        "CYXU Airport": "YXU", "CYYR Airport": "YYR",
        "Columbus Airport, OH": "CMH", "Cyril E. King Airport, USVI": "STT",
        "DAR": "DAR", "DIAP Airport": "ABJ",
        "Daytona Beach International, FL": "DAB", "Dulles International, VA": "IAD",
        "EDDM Airport": "MUC", "EGGP Airport": "LPL", "EGHL Airport": "QLA",
        "EGPH Airport": "EDI", "EINN Airport": "SNN", "ESSA Airport": "ARN",
        "EWR Airport": "EWR",
        "Fort Lauderdale-Hollywood International, FL": "FLL",
        "GEG Airport": "GEG", "GMME Airport": "RBA", "GMMX Airport": "RAK",
        "GOOY Airport": "DSS", "GUC Airport": "GUC", "GVAC Airport": "SID",
        "GYH Airport": "GYH", "Hanscom Field, MA": "BED",
        "ILG Airport": "ILG", "IND Airport": "IND", "ISM Airport": "ISM",
        "ISP Airport": "ISP", "JFK": "JFK", "JFK International, NY": "JFK",
        "Johannesburg, South Africa": "JNB",
        "John F. Kennedy International, NY": "JFK",
        "John Glenn Columbus International, OH": "CMH",
        "LAS Airport": "LAS", "LAX International, CA": "LAX",
        "LCQ Airport": "LCQ", "LEIB Airport": "IBZ", "LETL Airport": "LET",
        "LFBE Airport": "EGC", "LFBG Airport": "CNG", "LFMN Airport": "NCE",
        "LFTH Airport": "TLN", "LGB Airport": "LGB", "LGIR Airport": "HER",
        "LHR": "LHR", "LLBG Airport": "TLV", "LOS": "LOS",
        "LOWW Airport": "VIE", "LPAZ Airport": "SMA", "LSGG Airport": "GVA",
        "LSJ Airport": "LSJ", "LSZH Airport": "ZRH", "LZIB Airport": "BTS",
        "Lagos, Nigeria": "LOS",
        "Laurence G. Hanscom Field, Bedford, MA": "BED",
        "Le Bourget, Paris, France": "LBG",
        "London Luton Airport, UK": "LTN", "London Luton, UK": "LTN",
        "London Stansted Airport, UK": "STN", "London Stansted, UK": "STN",
        "MBPV Airport": "PLS", "MCN Airport": "MCN", "MDPC Airport": "PUJ",
        "MDPP Airport": "POP", "MDW Airport": "MDW", "MHT Airport": "MHT",
        "MIV Airport": "MIV", "MMSD Airport": "SJD", "MYNN Airport": "NAS",
        "Maputo, Mozambique": "MPM", "Martha's Vineyard Airport, MA": "MVY",
        "Miami International, FL": "MIA",
        "Montreal-Trudeau International, Canada": "YUL",
        "NUQ Airport": "NUQ", "OAK Airport": "OAK", "ONT Airport": "ONT",
        "PBI": "PBI", "PDK Airport": "PDK", "PHL Airport": "PHL",
        "PTK Airport": "PTK", "PWM Airport": "PWM",
        "Palm Beach International, FL": "PBI",
        "Paris Le Bourget, France": "LBG",
        "Phoenix Sky Harbor International, AZ": "PHX",
        "RIC Airport": "RIC", "RSW Airport": "RSW", "RUH Airport": "RUH",
        "RWI Airport": "RWI", "RYY Airport": "RYY",
        "Rabat-Salé Airport, Morocco": "RBA",
        "SAF Airport": "SAF", "SAN Airport": "SAN", "SBGK Airport": "GIG",
        "SBGR Airport": "GRU", "SDL Airport": "SDL", "SEF Airport": "SEF",
        "SFO Airport": "SFO", "SJC Airport": "SJC", "SKBO Airport": "BOG",
        "SLC Airport": "SLC", "SSI Airport": "SSI", "STT": "STT",
        "SWF Airport": "SWF", "Santa Fe Municipal Airport, NM": "SAF",
        "Savannah/Hilton Head International, GA": "SAV",
        "TEB": "TEB", "TIST Airport": "STT", "TJSJ Airport": "SJU",
        "TLPC Airport": "SLU", "TQPF Airport": "AXA",
        "TUL Airport": "TUL", "TUS Airport": "TUS",
        "Teterboro Airport, NJ": "TEB",
        "VNY Airport": "VNY", "VQQ Airport": "VQQ",
        "Washington Dulles International, VA": "IAD",
        "Westchester County Airport, NY": "HPN",
    }

    clean_mapping = {name: code for name, code in IATA_MAP.items() if name in airport_names}
    unmapped = airport_names - set(clean_mapping.keys())
    print(f"  Mapped {len(clean_mapping)} / {len(airport_names)} airports from static table")
    if unmapped:
        print(f"  Unmapped: {sorted(unmapped)}")

    if dry_run:
        for name, code in list(clean_mapping.items())[:10]:
            print(f"    {name} -> {code}")
        print(f"  [DRY RUN] Would patch flights with IATA codes.")
        return flights

    # Build patches
    patched = 0
    for f in flights:
        dep = (f.get("departure") or "").strip()
        arr = (f.get("arrival") or "").strip()
        patch = {}

        dep_iata = clean_mapping.get(dep)
        arr_iata = clean_mapping.get(arr)

        if dep_iata and not f.get("departure_iata"):
            patch["departure_iata"] = dep_iata
        if arr_iata and not f.get("arrival_iata"):
            patch["arrival_iata"] = arr_iata

        if patch:
            result = supabase_rest(
                "PATCH",
                "flights",
                data=patch,
                params={"id": f"eq.{f['id']}"},
            )
            if 200 <= result.get("status", 0) < 300:
                patched += 1
                f.update(patch)

            if patched % 500 == 0 and patched > 0:
                print(f"  Patched {patched}...")

    print(f"  Phase D complete: {patched} rows patched with IATA codes")
    return flights


def _call_fireworks_json(prompt: str) -> dict | None:
    """Call Fireworks kimi-k2.5 and parse JSON from the response."""
    url = "https://api.fireworks.ai/inference/v1/chat/completions"
    payload = {
        "model": "accounts/fireworks/models/kimi-k2p5",
        "messages": [
            {"role": "system", "content": "You are a data processing assistant. Return ONLY valid JSON. No explanations, no markdown, no code fences."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 4096,
    }

    headers = {
        "Authorization": f"Bearer {FIREWORKS_API_KEY}",
        "Content-Type": "application/json",
    }

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=120, context=_SSL_CTX) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            content = resp_data["choices"][0]["message"]["content"]

            # Extract JSON from response (may be wrapped in ```json...```)
            content = content.strip()
            if content.startswith("```"):
                # Remove markdown code fences
                lines = content.split("\n")
                # Drop first line (```json) and last line (```)
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

            # qwen3-235b sometimes wraps in <think>...</think> tags
            if "<think>" in content:
                # Remove thinking block
                content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Try to extract JSON object from content
                match = re.search(r"\{[\s\S]*\}", content)
                if match:
                    return json.loads(match.group())
                print(f"  Failed to parse JSON from response: {content[:300]}")
                return None
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        print(f"  Fireworks API HTTP {e.code}: {error_body[:500]}")
        return None
    except Exception as e:
        print(f"  Fireworks API error: {e}")
        return None


# ---------------------------------------------------------------------------
# Phase E: Ingest flight log PDFs into documents table
# ---------------------------------------------------------------------------


def phase_e_ingest_pdfs(dry_run: bool) -> list[dict]:
    """
    Insert document records for the 6 flight log PDFs (Parts 1-6).
    Returns the created document records.
    """
    print("\n" + "=" * 60)
    print("PHASE E: Ingest flight log PDFs into documents table")
    print("=" * 60)

    # Check which PDFs already exist in documents table
    existing_docs = []
    for pdf_path in FLIGHT_LOG_PDFS:
        result = supabase_rest(
            "GET",
            "documents",
            params={
                "storage_path": f"eq.{pdf_path}",
                "select": "id,storage_path",
            },
            prefer="return=representation",
        )
        if result.get("data"):
            existing_docs.extend(result["data"])

    existing_paths = {d["storage_path"] for d in existing_docs}
    new_pdfs = [p for p in FLIGHT_LOG_PDFS if p not in existing_paths]

    print(f"  Total flight log PDFs: {len(FLIGHT_LOG_PDFS)}")
    print(f"  Already in documents: {len(existing_paths)}")
    print(f"  New to ingest: {len(new_pdfs)}")

    if not new_pdfs:
        print("  All PDFs already ingested. Skipping.")
        return existing_docs

    if dry_run:
        for p in new_pdfs:
            print(f"    Would ingest: {p}")
        print(f"  [DRY RUN] Would insert {len(new_pdfs)} document records.")
        return existing_docs

    created_docs = list(existing_docs)

    for pdf_path in new_pdfs:
        filename = os.path.basename(pdf_path)

        # Try to get file size from storage metadata
        file_size = None
        meta = get_storage_metadata(pdf_path)
        if meta and isinstance(meta, dict):
            file_size = meta.get("size") or meta.get("contentLength")

        doc_row = {
            "filename": filename,
            "storage_path": pdf_path,
            "file_type": "pdf",
            "mime_type": "application/pdf",
            "classification": "flight_log",
            "processing_status": "pending",
            "ocr_source": None,
            "metadata": json.dumps({
                "source": "us_v_maxwell",
                "kaggle_dataset": "jazivxt",
                "ingested_by": "backfill_flights.py",
            }),
        }
        if file_size:
            doc_row["file_size_bytes"] = file_size

        result = supabase_rest(
            "POST",
            "documents",
            data=doc_row,
            prefer="return=representation",
        )

        if 200 <= result.get("status", 0) < 300 and result.get("data"):
            doc = result["data"][0] if isinstance(result["data"], list) else result["data"]
            created_docs.append(doc)
            print(f"  Inserted: {filename} -> {doc['id']}")
        else:
            err = result.get("error", "unknown")[:200]
            print(f"  ERROR inserting {filename}: {err}")

    print(f"  Phase E complete: {len(created_docs)} documents total")
    return created_docs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Backfill and enrich the flights table"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying the database",
    )
    parser.add_argument(
        "--phase",
        type=str,
        default="A,B,C,D,E",
        help="Comma-separated phases to run (default: A,B,C,D,E)",
    )
    args = parser.parse_args()

    phases = {p.strip().upper() for p in args.phase.split(",")}

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    print("=" * 60)
    print("Flight Data Backfill")
    print("=" * 60)
    print(f"  Supabase URL: {SUPABASE_URL}")
    print(f"  Dry run: {args.dry_run}")
    print(f"  Phases: {', '.join(sorted(phases))}")
    print()

    # Fetch all flights once (phases A-D all need them)
    flights = []
    if phases & {"A", "B", "C", "D"}:
        print("Fetching all flight rows...")
        flights = fetch_all_flights()
        print(f"  Fetched {len(flights)} rows")

    if "A" in phases:
        flights = phase_a_deduplicate(flights, args.dry_run)

    if "B" in phases:
        flights = phase_b_backfill_from_source(flights, args.dry_run)

    if "C" in phases:
        flights = phase_c_parse_aircraft(flights, args.dry_run)

    if "D" in phases:
        flights = phase_d_normalize_airports(flights, args.dry_run)

    if "E" in phases:
        phase_e_ingest_pdfs(args.dry_run)

    print("\n" + "=" * 60)
    print("ALL PHASES COMPLETE")
    print("=" * 60)

    # Final summary
    if flights:
        has_passengers = sum(1 for f in flights if f.get("passenger_names"))
        has_tail = sum(1 for f in flights if f.get("tail_number"))
        has_dep_iata = sum(1 for f in flights if f.get("departure_iata"))
        print(f"  Total flights: {len(flights)}")
        print(f"  With passenger_names: {has_passengers}")
        print(f"  With tail_number: {has_tail}")
        print(f"  With departure_iata: {has_dep_iata}")


if __name__ == "__main__":
    main()
