#!/usr/bin/env python3
"""
Fix flight departure/arrival/passenger data in the flights table.

Problem: 3,416 flight rows imported from epstein_exposed have only flight_date
and aircraft populated. departure, arrival, and passenger_names are all NULL.
This happened because the import script (import-structured.ts) tried field names
like record.departure/record.from that don't match the actual API response schema
from epsteinexposed.com.

Fix Strategy:
  1. Download the original flights.json from Supabase Storage to discover actual field names
  2. Download enrichment data from epsteininvestigation.org (CSV + JSONL)
  3. Re-parse with correct field mappings
  4. Batch-UPDATE existing rows via Supabase REST API (match on id)
  5. Optionally merge enrichment flights that don't exist yet

Usage:
  # First, check what's in the source data (dry run):
  python3 scripts/fix_flights.py --dry-run

  # Apply fixes:
  python3 scripts/fix_flights.py

  # Also import enrichment flights from epsteininvestigation.org:
  python3 scripts/fix_flights.py --include-enrichment

Requirements:
  pip install httpx python-dotenv
"""

import os
import sys
import json
import csv
import io
import re
import argparse
from datetime import datetime
from pathlib import Path

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Run: pip install httpx")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: python-dotenv not installed. Run: pip install python-dotenv")
    sys.exit(1)

# Load .env from project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


# ============================================================
# Step 1: Download source data from Supabase Storage
# ============================================================

def download_storage_file(path: str) -> bytes | None:
    """Download a file from Supabase Storage bucket raw-archive."""
    url = f"{SUPABASE_URL}/storage/v1/object/raw-archive/{path}"
    try:
        resp = httpx.get(url, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }, timeout=60, follow_redirects=True)
        if resp.status_code == 200:
            return resp.content
        else:
            log(f"  Download failed ({resp.status_code}): {path}")
            return None
    except Exception as e:
        log(f"  Download error: {path}: {e}")
        return None


def list_storage_files(prefix: str) -> list[str]:
    """List files in a Supabase Storage directory."""
    url = f"{SUPABASE_URL}/storage/v1/object/list/raw-archive"
    try:
        resp = httpx.post(url, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        }, json={"prefix": prefix, "limit": 1000}, timeout=30)
        if resp.status_code == 200:
            items = resp.json()
            return [f"{prefix}/{item['name']}" for item in items if item.get('name')]
        return []
    except Exception as e:
        log(f"  List error: {prefix}: {e}")
        return []


# ============================================================
# Step 2: Discover actual field names in epstein-exposed data
# ============================================================

# Known possible field name mappings from epsteinexposed.com API.
# We'll auto-detect from the actual data, but here's our best guesses:
DEPARTURE_FIELDS = [
    "departure_airport", "departure_airport_code", "departure", "from",
    "from_airport", "origin", "origin_airport", "dep_airport",
    "departure_location", "from_location",
]
ARRIVAL_FIELDS = [
    "arrival_airport", "arrival_airport_code", "arrival", "to",
    "to_airport", "destination", "destination_airport", "arr_airport",
    "arrival_location", "to_location",
]
PASSENGER_FIELDS = [
    "passengers", "passenger_names", "manifest", "passenger_list",
    "pax", "names", "people",
]
DATE_FIELDS = [
    "flight_date", "date", "departure_date", "log_date",
]
AIRCRAFT_FIELDS = [
    "aircraft", "aircraft_type", "plane", "aircraft_model",
]
TAIL_FIELDS = [
    "tail_number", "aircraft_tail_number", "aircraft_tail", "registration",
    "tail_no", "reg",
]
PILOT_FIELDS = [
    "pilot", "pilot_name", "captain",
]


def find_field(record: dict, candidates: list[str]) -> any:
    """Find the first matching field value from a list of candidate field names."""
    for field in candidates:
        val = record.get(field)
        if val is not None and val != "" and val != []:
            return val
    return None


def discover_fields(records: list[dict]) -> dict:
    """Analyze records to discover which field names contain which data."""
    all_keys = set()
    for r in records[:50]:
        all_keys.update(r.keys())

    log(f"  All fields found: {sorted(all_keys)}")

    # Try to auto-map
    dep_field = None
    arr_field = None
    pax_field = None

    for r in records[:50]:
        for f in DEPARTURE_FIELDS:
            if f in r and r[f]:
                dep_field = f
                break
        for f in ARRIVAL_FIELDS:
            if f in r and r[f]:
                arr_field = f
                break
        for f in PASSENGER_FIELDS:
            if f in r and r[f]:
                pax_field = f
                break
        if dep_field and arr_field and pax_field:
            break

    # Also check for nested structures
    nested_keys = {}
    for r in records[:10]:
        for k, v in r.items():
            if isinstance(v, dict):
                nested_keys[k] = list(v.keys())

    if nested_keys:
        log(f"  Nested objects: {nested_keys}")

    return {
        "all_keys": sorted(all_keys),
        "departure_field": dep_field,
        "arrival_field": arr_field,
        "passenger_field": pax_field,
        "nested": nested_keys,
    }


# ============================================================
# Step 3: Parse epstein-exposed source data
# ============================================================

def parse_exposed_flights(raw: bytes) -> list[dict]:
    """Parse epstein-exposed flights.json into normalized flight records."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        log(f"  JSON parse error: {e}")
        return []

    records = data if isinstance(data, list) else [data]
    log(f"  Parsed {len(records)} raw records from flights.json")

    if not records:
        return []

    # Show sample record for debugging
    log(f"  Sample record keys: {list(records[0].keys())}")
    log(f"  Sample record (first 500 chars): {json.dumps(records[0])[:500]}")

    discovery = discover_fields(records)

    flights = []
    missing_dep = 0
    missing_arr = 0
    missing_pax = 0

    for record in records:
        # Handle nested data structures
        # Some APIs wrap data in a "data" or "attributes" key
        if "data" in record and isinstance(record["data"], dict):
            record = {**record, **record["data"]}
        if "attributes" in record and isinstance(record["attributes"], dict):
            record = {**record, **record["attributes"]}

        departure = find_field(record, DEPARTURE_FIELDS)
        arrival = find_field(record, ARRIVAL_FIELDS)
        passengers = find_field(record, PASSENGER_FIELDS)
        date = find_field(record, DATE_FIELDS)
        aircraft = find_field(record, AIRCRAFT_FIELDS)
        tail = find_field(record, TAIL_FIELDS)
        pilot = find_field(record, PILOT_FIELDS)

        # Handle passenger data that might be a string (comma-separated) vs list
        if isinstance(passengers, str):
            passengers = [p.strip() for p in passengers.split(",") if p.strip()]
        elif not isinstance(passengers, list):
            passengers = []

        # Normalize departure/arrival - might be dict with code/name
        if isinstance(departure, dict):
            departure = departure.get("code") or departure.get("name") or departure.get("airport_code")
        if isinstance(arrival, dict):
            arrival = arrival.get("code") or arrival.get("name") or arrival.get("airport_code")

        if not departure:
            missing_dep += 1
        if not arrival:
            missing_arr += 1
        if not passengers:
            missing_pax += 1

        flights.append({
            "flight_date": date,
            "departure": str(departure) if departure else None,
            "arrival": str(arrival) if arrival else None,
            "aircraft": str(aircraft) if aircraft else None,
            "tail_number": str(tail) if tail else None,
            "pilot": str(pilot) if pilot else None,
            "passenger_names": passengers if passengers else [],
        })

    log(f"  Parsed: {len(flights)} flights")
    log(f"  Missing departure: {missing_dep}, arrival: {missing_arr}, passengers: {missing_pax}")

    return flights


# ============================================================
# Step 4: Parse enrichment data from epsteininvestigation.org
# ============================================================

def parse_enrichment_csv(raw: bytes) -> list[dict]:
    """Parse the flights CSV from epsteininvestigation.org."""
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    flights = []

    for row in reader:
        # Map column names (from EPSTEININVESTIGATION_ORG.md):
        # flight_date, aircraft_tail_number, pilot_name,
        # departure_airport_code, departure_airport,
        # arrival_airport_code, arrival_airport, passenger_names[]
        passengers_str = row.get("passenger_names", "") or row.get("passengers", "")

        # Parse passenger list (might be semicolon or comma separated, or JSON array)
        passengers = []
        if passengers_str:
            passengers_str = passengers_str.strip()
            if passengers_str.startswith("["):
                try:
                    passengers = json.loads(passengers_str)
                except json.JSONDecodeError:
                    passengers = [p.strip().strip('"') for p in passengers_str.strip("[]").split(",")]
            elif ";" in passengers_str:
                passengers = [p.strip() for p in passengers_str.split(";") if p.strip()]
            else:
                passengers = [p.strip() for p in passengers_str.split(",") if p.strip()]

        departure = (
            row.get("departure_airport_code")
            or row.get("departure_airport")
            or row.get("departure")
            or row.get("from")
        )
        arrival = (
            row.get("arrival_airport_code")
            or row.get("arrival_airport")
            or row.get("arrival")
            or row.get("to")
        )

        flights.append({
            "flight_date": row.get("flight_date") or row.get("date"),
            "departure": departure,
            "arrival": arrival,
            "tail_number": row.get("aircraft_tail_number") or row.get("tail_number"),
            "aircraft": row.get("aircraft") or row.get("aircraft_type"),
            "pilot": row.get("pilot_name") or row.get("pilot"),
            "passenger_names": passengers,
            "source": "epsteininvestigation",
        })

    log(f"  Parsed {len(flights)} flights from enrichment CSV")
    return flights


def parse_enrichment_jsonl(raw: bytes) -> list[dict]:
    """Parse the flights JSONL from epsteininvestigation.org."""
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    flights = []
    for line in text.strip().split("\n"):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue

        passengers = record.get("passenger_names", [])
        if isinstance(passengers, str):
            if passengers.startswith("["):
                try:
                    passengers = json.loads(passengers)
                except:
                    passengers = [p.strip() for p in passengers.split(",")]
            else:
                passengers = [p.strip() for p in passengers.split(",") if p.strip()]

        departure = (
            record.get("departure_airport_code")
            or record.get("departure_airport")
            or record.get("departure")
            or record.get("from")
        )
        arrival = (
            record.get("arrival_airport_code")
            or record.get("arrival_airport")
            or record.get("arrival")
            or record.get("to")
        )

        flights.append({
            "flight_date": record.get("flight_date") or record.get("date"),
            "departure": departure,
            "arrival": arrival,
            "tail_number": record.get("aircraft_tail_number") or record.get("tail_number"),
            "aircraft": record.get("aircraft") or record.get("aircraft_type"),
            "pilot": record.get("pilot_name") or record.get("pilot"),
            "passenger_names": passengers if isinstance(passengers, list) else [],
            "source": "epsteininvestigation",
        })

    log(f"  Parsed {len(flights)} flights from enrichment JSONL")
    return flights


# ============================================================
# Step 5: Fetch current flights from database
# ============================================================

def fetch_all_flights() -> list[dict]:
    """Fetch all flight rows from the database via Supabase REST API."""
    all_flights = []
    offset = 0
    batch_size = 1000

    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/flights"
            f"?select=id,flight_date,departure,arrival,aircraft,tail_number,pilot,passenger_names,source"
            f"&order=flight_date.asc.nullsfirst"
            f"&offset={offset}&limit={batch_size}"
        )
        resp = httpx.get(url, headers=HEADERS, timeout=120)
        if resp.status_code != 200:
            log(f"  Error fetching flights: {resp.status_code} {resp.text[:200]}")
            break

        batch = resp.json()
        if not batch:
            break

        all_flights.extend(batch)
        offset += len(batch)

        if len(batch) < batch_size:
            break

    return all_flights


# ============================================================
# Step 6: Match and update
# ============================================================

def normalize_date(d: str | None) -> str | None:
    """Normalize date to YYYY-MM-DD format."""
    if not d:
        return None
    d = str(d).strip()

    # Already YYYY-MM-DD?
    if re.match(r"^\d{4}-\d{2}-\d{2}$", d):
        return d

    # Try common formats
    for fmt in ["%m/%d/%Y", "%m-%d-%Y", "%Y/%m/%d", "%d/%m/%Y", "%B %d, %Y", "%b %d, %Y"]:
        try:
            return datetime.strptime(d, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # ISO datetime
    if "T" in d:
        return d[:10]

    return d


def build_match_key(flight_date: str | None, aircraft: str | None) -> str:
    """Build a matching key from date + aircraft for dedup."""
    d = normalize_date(flight_date) or ""
    a = (aircraft or "").strip().lower()
    return f"{d}|{a}"


def update_flight(flight_id: str, updates: dict, dry_run: bool = False) -> bool:
    """Update a single flight row by ID via PATCH."""
    if dry_run:
        return True

    url = f"{SUPABASE_URL}/rest/v1/flights?id=eq.{flight_id}"
    for attempt in range(3):
        try:
            resp = httpx.patch(url, headers=HEADERS, json=updates, timeout=60)
            if resp.status_code in (200, 204):
                return True
            else:
                log(f"  Update failed for {flight_id}: {resp.status_code} {resp.text[:200]}")
                return False
        except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.RemoteProtocolError) as e:
            if attempt < 2:
                import time
                time.sleep(2 * (attempt + 1))
                continue
            log(f"  Update timeout for {flight_id} after 3 attempts: {e}")
            return False


def batch_update_flights(updates: list[tuple[str, dict]], dry_run: bool = False) -> int:
    """Batch update flights. Each item is (flight_id, update_dict)."""
    updated = 0
    for i, (flight_id, update_dict) in enumerate(updates):
        if update_flight(flight_id, update_dict, dry_run):
            updated += 1
        if (i + 1) % 100 == 0:
            log(f"  Updated {i + 1}/{len(updates)}...")

    return updated


def insert_flights(flights: list[dict], dry_run: bool = False) -> int:
    """Insert new flight records in batches."""
    if dry_run or not flights:
        return len(flights)

    inserted = 0
    batch_size = 100

    for i in range(0, len(flights), batch_size):
        batch = flights[i:i + batch_size]
        url = f"{SUPABASE_URL}/rest/v1/flights"
        resp = httpx.post(url, headers={**HEADERS, "Prefer": "return=minimal"}, json=batch, timeout=30)

        if resp.status_code in (200, 201):
            inserted += len(batch)
        else:
            log(f"  Insert batch failed: {resp.status_code} {resp.text[:200]}")

        if (i + batch_size) % 500 == 0:
            log(f"  Inserted {inserted}/{len(flights)}...")

    return inserted


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Fix flight departure/arrival/passenger data")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without modifying DB")
    parser.add_argument("--include-enrichment", action="store_true",
                        help="Also import new flights from epsteininvestigation.org enrichment data")
    parser.add_argument("--show-sample", type=int, default=5,
                        help="Number of sample records to display")
    args = parser.parse_args()

    log("=" * 60)
    log("Flight Data Fix Script")
    log("=" * 60)

    if args.dry_run:
        log("*** DRY RUN MODE - no changes will be made ***")

    # ---- Phase 1: Download source data ----
    log("\n--- Phase 1: Download source data from Supabase Storage ---")

    log("Downloading websites/epstein-exposed/flights.json ...")
    exposed_raw = download_storage_file("websites/epstein-exposed/flights.json")

    log("Downloading enrichment/epsteininvestigation-org/csv/flights.csv ...")
    enrichment_csv_raw = download_storage_file("enrichment/epsteininvestigation-org/csv/flights.csv")

    log("Downloading enrichment/epsteininvestigation-org/flights_full.jsonl ...")
    enrichment_jsonl_raw = download_storage_file("enrichment/epsteininvestigation-org/flights_full.jsonl")

    # ---- Phase 2: Parse source data ----
    log("\n--- Phase 2: Parse source data ---")

    exposed_flights = []
    if exposed_raw:
        log(f"epstein-exposed flights.json: {len(exposed_raw):,} bytes")
        exposed_flights = parse_exposed_flights(exposed_raw)

        # Show sample
        for i, f in enumerate(exposed_flights[:args.show_sample]):
            log(f"  Sample exposed [{i}]: date={f['flight_date']}, "
                f"dep={f['departure']}, arr={f['arrival']}, "
                f"aircraft={f['aircraft']}, pax={f['passenger_names'][:3]}")
    else:
        log("WARNING: Could not download flights.json from epstein-exposed")

    enrichment_flights = []
    if enrichment_csv_raw:
        log(f"\nepsteininvestigation CSV: {len(enrichment_csv_raw):,} bytes")
        enrichment_flights = parse_enrichment_csv(enrichment_csv_raw)
    elif enrichment_jsonl_raw:
        log(f"\nepsteininvestigation JSONL: {len(enrichment_jsonl_raw):,} bytes")
        enrichment_flights = parse_enrichment_jsonl(enrichment_jsonl_raw)

    # Also try JSONL if CSV had no results
    if not enrichment_flights and enrichment_jsonl_raw:
        enrichment_flights = parse_enrichment_jsonl(enrichment_jsonl_raw)

    for i, f in enumerate(enrichment_flights[:args.show_sample]):
        log(f"  Sample enrichment [{i}]: date={f['flight_date']}, "
            f"dep={f['departure']}, arr={f['arrival']}, "
            f"pilot={f['pilot']}, pax={f['passenger_names'][:3]}")

    # ---- Phase 3: Fetch existing flights from DB ----
    log("\n--- Phase 3: Fetch existing flights from database ---")
    db_flights = fetch_all_flights()
    log(f"Found {len(db_flights)} flights in database")

    # Count incomplete rows
    incomplete = [f for f in db_flights
                  if not f.get("departure") or not f.get("arrival") or not f.get("passenger_names")]
    log(f"Incomplete (missing dep/arr/pax): {len(incomplete)}")

    null_dep = sum(1 for f in db_flights if not f.get("departure"))
    null_arr = sum(1 for f in db_flights if not f.get("arrival"))
    null_pax = sum(1 for f in db_flights if not f.get("passenger_names"))
    log(f"  NULL departure: {null_dep}")
    log(f"  NULL arrival: {null_arr}")
    log(f"  NULL/empty passenger_names: {null_pax}")

    # Group by source
    sources = {}
    for f in db_flights:
        s = f.get("source", "unknown")
        sources[s] = sources.get(s, 0) + 1
    log(f"Sources: {sources}")

    # ---- Phase 4: Build index of source data for matching ----
    log("\n--- Phase 4: Match source data to database rows ---")

    # Build index: date -> list of source flights
    exposed_by_date = {}
    for f in exposed_flights:
        d = normalize_date(f["flight_date"])
        if d:
            exposed_by_date.setdefault(d, []).append(f)

    # For matching, we'll try:
    # 1. Exact match on (flight_date, aircraft)
    # 2. Fallback: match on flight_date only (if only one source flight for that date)

    updates_to_apply = []

    for db_flight in db_flights:
        # Only fix rows that are actually missing data
        has_departure = bool(db_flight.get("departure"))
        has_arrival = bool(db_flight.get("arrival"))
        has_passengers = bool(db_flight.get("passenger_names"))

        if has_departure and has_arrival and has_passengers:
            continue  # Already complete

        db_date = normalize_date(db_flight.get("flight_date"))
        db_aircraft = (db_flight.get("aircraft") or "").strip().lower()

        if not db_date:
            continue

        # Find matching source records
        candidates = exposed_by_date.get(db_date, [])

        match = None
        if len(candidates) == 1:
            match = candidates[0]
        elif len(candidates) > 1:
            # Try to narrow by aircraft
            for c in candidates:
                c_aircraft = (c.get("aircraft") or "").strip().lower()
                if c_aircraft and db_aircraft and c_aircraft == db_aircraft:
                    match = c
                    break
            # If no aircraft match, use first candidate with data
            if not match:
                for c in candidates:
                    if c.get("departure") or c.get("arrival") or c.get("passenger_names"):
                        match = c
                        break

        if match:
            update = {}
            if not has_departure and match.get("departure"):
                update["departure"] = match["departure"]
            if not has_arrival and match.get("arrival"):
                update["arrival"] = match["arrival"]
            if not has_passengers and match.get("passenger_names"):
                update["passenger_names"] = match["passenger_names"]
            if not db_flight.get("tail_number") and match.get("tail_number"):
                update["tail_number"] = match["tail_number"]
            if not db_flight.get("pilot") and match.get("pilot"):
                update["pilot"] = match["pilot"]

            if update:
                updates_to_apply.append((db_flight["id"], update))

    log(f"Matched {len(updates_to_apply)} rows to update from epstein-exposed source data")

    # ---- Phase 4b: Try enrichment data for remaining incomplete rows ----
    already_updating = {u[0] for u in updates_to_apply}
    still_incomplete = [
        f for f in db_flights
        if f["id"] not in already_updating
        and (not f.get("departure") or not f.get("arrival") or not f.get("passenger_names"))
    ]

    if enrichment_flights and still_incomplete:
        log(f"\nTrying enrichment data for {len(still_incomplete)} remaining incomplete rows...")

        # Build enrichment index by date
        enrichment_by_date = {}
        for f in enrichment_flights:
            d = normalize_date(f["flight_date"])
            if d:
                enrichment_by_date.setdefault(d, []).append(f)

        enrichment_matches = 0
        for db_flight in still_incomplete:
            db_date = normalize_date(db_flight.get("flight_date"))
            if not db_date:
                continue

            candidates = enrichment_by_date.get(db_date, [])
            match = candidates[0] if len(candidates) == 1 else None

            if not match and len(candidates) > 1:
                db_aircraft = (db_flight.get("aircraft") or "").strip().lower()
                for c in candidates:
                    c_tail = (c.get("tail_number") or "").strip().lower()
                    if c_tail and db_aircraft and c_tail in db_aircraft:
                        match = c
                        break

            if match:
                update = {}
                if not db_flight.get("departure") and match.get("departure"):
                    update["departure"] = match["departure"]
                if not db_flight.get("arrival") and match.get("arrival"):
                    update["arrival"] = match["arrival"]
                if not db_flight.get("passenger_names") and match.get("passenger_names"):
                    update["passenger_names"] = match["passenger_names"]
                if not db_flight.get("tail_number") and match.get("tail_number"):
                    update["tail_number"] = match["tail_number"]
                if not db_flight.get("pilot") and match.get("pilot"):
                    update["pilot"] = match["pilot"]

                if update:
                    updates_to_apply.append((db_flight["id"], update))
                    enrichment_matches += 1

        log(f"Matched {enrichment_matches} additional rows from enrichment data")

    # ---- Phase 5: Show summary and apply ----
    log(f"\n--- Phase 5: Apply updates ---")
    log(f"Total updates to apply: {len(updates_to_apply)}")

    if updates_to_apply:
        # Show samples
        for flight_id, update in updates_to_apply[:args.show_sample]:
            log(f"  {flight_id}: {update}")

        # Count what fields are being updated
        field_counts = {}
        for _, update in updates_to_apply:
            for key in update:
                field_counts[key] = field_counts.get(key, 0) + 1
        log(f"\nField update counts: {field_counts}")

        # Apply
        updated = batch_update_flights(updates_to_apply, dry_run=args.dry_run)
        log(f"{'Would update' if args.dry_run else 'Updated'}: {updated}/{len(updates_to_apply)} rows")
    else:
        log("No updates to apply from source data matching.")
        log("This may mean the flights.json from epsteinexposed.com also lacks departure/arrival data,")
        log("or the field names don't match any known patterns.")
        log("")
        log("Alternative: If the source data truly has no departure/arrival fields,")
        log("the original data from epsteinexposed.com might only contain date + aircraft.")
        log("In that case, we need to populate from enrichment sources.")

    # ---- Phase 6: Import new enrichment flights ----
    if args.include_enrichment and enrichment_flights:
        log(f"\n--- Phase 6: Import new enrichment flights ---")

        # Find enrichment flights that don't already exist in DB
        existing_dates = {normalize_date(f.get("flight_date")) for f in db_flights}
        new_flights = [
            f for f in enrichment_flights
            if normalize_date(f.get("flight_date")) not in existing_dates
            and (f.get("departure") or f.get("arrival"))
        ]

        # Also add enrichment flights where we have the date but different details
        # (more conservative: only add if date + departure are both different)
        existing_keys = {
            f"{normalize_date(f.get('flight_date'))}|{(f.get('departure') or '').lower()}"
            for f in db_flights
        }
        for f in enrichment_flights:
            key = f"{normalize_date(f.get('flight_date'))}|{(f.get('departure') or '').lower()}"
            if key not in existing_keys and f.get("departure"):
                if f not in new_flights:
                    new_flights.append(f)

        log(f"New enrichment flights to import: {len(new_flights)}")

        if new_flights:
            # Prepare for insertion
            insert_records = []
            for f in new_flights:
                insert_records.append({
                    "flight_date": normalize_date(f.get("flight_date")),
                    "departure": f.get("departure"),
                    "arrival": f.get("arrival"),
                    "aircraft": f.get("aircraft"),
                    "tail_number": f.get("tail_number"),
                    "pilot": f.get("pilot"),
                    "passenger_names": f.get("passenger_names", []),
                    "source": "epsteininvestigation",
                })

            inserted = insert_flights(insert_records, dry_run=args.dry_run)
            log(f"{'Would insert' if args.dry_run else 'Inserted'}: {inserted} new enrichment flights")

    # ---- Final summary ----
    log("\n" + "=" * 60)
    log("SUMMARY")
    log("=" * 60)
    log(f"Database flights before: {len(db_flights)}")
    log(f"Incomplete rows found: {len(incomplete)}")
    log(f"Updates applied: {len(updates_to_apply)}")

    if not args.dry_run:
        # Re-fetch to show final state
        log("\nRe-checking database...")
        final_flights = fetch_all_flights()
        final_incomplete = [
            f for f in final_flights
            if not f.get("departure") or not f.get("arrival") or not f.get("passenger_names")
        ]
        log(f"Final flight count: {len(final_flights)}")
        log(f"Still incomplete: {len(final_incomplete)}")

        if final_incomplete:
            log(f"\nStill-incomplete flights by source:")
            src_counts = {}
            for f in final_incomplete:
                s = f.get("source", "unknown")
                src_counts[s] = src_counts.get(s, 0) + 1
            for s, c in sorted(src_counts.items(), key=lambda x: -x[1]):
                log(f"  {s}: {c}")

    log("\nDone.")


if __name__ == "__main__":
    main()
