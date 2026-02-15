#!/usr/bin/env python3
"""
Scrape all unique data from epsteininvestigation.org that we don't already have.

What we're grabbing:
  1. Entity relationships CSV (1,007 connections)
  2. Enriched entities CSV (96 key figures)
  3. Flight logs CSV (55 enriched records)
  4. Email metadata CSV (21 records)
  5. Full email corpus via API (4,050 emails with body text)
  6. Amazon orders (886 purchase records)
  7. Document index (207K+ document metadata — slug, type, source, file_url)
  8. Photo index (16,407 photo metadata)

Rate limit: 100 req/min → we sleep 0.7s between requests to stay safe.
"""

import httpx
import json
import csv
import time
import os
import sys
from pathlib import Path
from datetime import datetime

BASE_URL = "https://www.epsteininvestigation.org"
API_URL = f"{BASE_URL}/api/v1"
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "/mnt/temp/epsteininvestigation"))
RATE_LIMIT_DELAY = 0.7  # seconds between API calls

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def download_csv(name, url, output_path):
    """Download a CSV file directly."""
    log(f"Downloading CSV: {name}")
    try:
        with httpx.Client(timeout=60, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
            output_path.write_bytes(r.content)
            lines = len(r.text.strip().split('\n')) - 1
            log(f"  OK: {output_path.name} ({lines} records, {len(r.content):,} bytes)")
            return lines
    except Exception as e:
        log(f"  FAILED: {e}")
        return 0


def paginate_api(endpoint, params=None, max_pages=None):
    """Paginate through an API endpoint, yielding all records."""
    if params is None:
        params = {}
    params.setdefault("limit", 100)
    page = 1
    total_fetched = 0

    with httpx.Client(timeout=60, follow_redirects=True) as client:
        while True:
            params["page"] = page
            try:
                r = client.get(f"{API_URL}/{endpoint}", params=params)
                r.raise_for_status()
                data = r.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (404, 403):
                    log(f"  /{endpoint} returned {e.response.status_code} — skipping")
                    return
                log(f"  Error on page {page}: {e}")
                time.sleep(2)
                continue
            except Exception as e:
                log(f"  Error on page {page}: {e}")
                time.sleep(2)
                continue

            records = data.get("data", [])
            total = data.get("total", 0)

            if not records:
                break

            yield from records
            total_fetched += len(records)

            if total_fetched >= total:
                break
            if max_pages and page >= max_pages:
                break

            page += 1
            time.sleep(RATE_LIMIT_DELAY)

    log(f"  Fetched {total_fetched}/{total} records from /{endpoint}")


def scrape_documents():
    """Pull full document index via API."""
    log("=== Scraping Document Index ===")
    output_path = OUTPUT_DIR / "documents.jsonl"
    count = 0

    with open(output_path, "w") as f:
        for doc in paginate_api("documents", {"limit": 100}):
            f.write(json.dumps(doc) + "\n")
            count += 1
            if count % 1000 == 0:
                log(f"  {count} documents...")

    log(f"  DONE: {count} documents → {output_path.name}")
    return count


def scrape_emails():
    """Pull full email corpus via API — these have body text."""
    log("=== Scraping Email Corpus ===")
    output_path = OUTPUT_DIR / "emails_full.jsonl"
    count = 0

    # First try the emails endpoint
    with open(output_path, "w") as f:
        for email in paginate_api("emails", {"limit": 100}):
            f.write(json.dumps(email) + "\n")
            count += 1
            if count % 100 == 0:
                log(f"  {count} emails...")

    log(f"  DONE: {count} emails → {output_path.name}")
    return count


def scrape_flights():
    """Pull full flight data via API."""
    log("=== Scraping Flight Data ===")
    output_path = OUTPUT_DIR / "flights_full.jsonl"
    count = 0

    with open(output_path, "w") as f:
        for flight in paginate_api("flights", {"limit": 100}):
            f.write(json.dumps(flight) + "\n")
            count += 1

    log(f"  DONE: {count} flights → {output_path.name}")
    return count


def scrape_entities():
    """Pull full entity data via API."""
    log("=== Scraping Entity Data ===")
    output_path = OUTPUT_DIR / "entities_full.jsonl"
    count = 0

    with open(output_path, "w") as f:
        for entity in paginate_api("entities", {"limit": 100}):
            f.write(json.dumps(entity) + "\n")
            count += 1

    log(f"  DONE: {count} entities → {output_path.name}")
    return count


def scrape_amazon_orders():
    """Scrape Amazon orders — these are on the website, try API first."""
    log("=== Scraping Amazon Orders ===")
    output_path = OUTPUT_DIR / "amazon_orders.jsonl"
    count = 0

    # Try common API patterns
    endpoints_to_try = ["orders", "amazon-orders", "purchases"]
    for ep in endpoints_to_try:
        try:
            with httpx.Client(timeout=30, follow_redirects=True) as client:
                r = client.get(f"{API_URL}/{ep}", params={"limit": 1})
                if r.status_code == 200:
                    data = r.json()
                    if data.get("data"):
                        log(f"  Found orders at /{ep}")
                        with open(output_path, "w") as f:
                            for order in paginate_api(ep, {"limit": 100}):
                                f.write(json.dumps(order) + "\n")
                                count += 1
                                if count % 100 == 0:
                                    log(f"  {count} orders...")
                        log(f"  DONE: {count} orders → {output_path.name}")
                        return count
        except Exception:
            continue

    # If no API endpoint, try scraping the HTML pages
    log("  No API endpoint found for orders, trying HTML scrape...")
    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            # Try fetching the orders page to see if there's embedded JSON
            r = client.get(f"{BASE_URL}/orders")
            if r.status_code == 200:
                # Look for __NEXT_DATA__ or similar embedded JSON
                import re
                match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text)
                if match:
                    next_data = json.loads(match.group(1))
                    # Navigate the Next.js data structure
                    props = next_data.get("props", {}).get("pageProps", {})
                    orders = props.get("orders", props.get("data", []))
                    if orders:
                        with open(output_path, "w") as f:
                            for order in orders:
                                f.write(json.dumps(order) + "\n")
                                count += 1
                        log(f"  DONE (from HTML): {count} orders → {output_path.name}")
                        return count

                # Also try looking for a fetch URL in the page source
                api_matches = re.findall(r'fetch\(["\']([^"\']*order[^"\']*)["\']', r.text)
                for api_url in api_matches:
                    log(f"  Found potential API: {api_url}")

    except Exception as e:
        log(f"  HTML scrape failed: {e}")

    log(f"  Could not find Amazon orders data programmatically")
    return 0


def scrape_search_names():
    """Pull the full names directory — 23,540 names."""
    log("=== Scraping Names Directory ===")
    output_path = OUTPUT_DIR / "all_names.jsonl"
    count = 0

    # Try the names/people endpoint
    endpoints_to_try = ["names", "people", "all-names"]
    for ep in endpoints_to_try:
        try:
            with httpx.Client(timeout=30, follow_redirects=True) as client:
                r = client.get(f"{API_URL}/{ep}", params={"limit": 1})
                if r.status_code == 200:
                    data = r.json()
                    if data.get("data") or data.get("total", 0) > 0:
                        log(f"  Found names at /{ep} (total: {data.get('total', '?')})")
                        with open(output_path, "w") as f:
                            for name in paginate_api(ep, {"limit": 100}):
                                f.write(json.dumps(name) + "\n")
                                count += 1
                                if count % 1000 == 0:
                                    log(f"  {count} names...")
                        log(f"  DONE: {count} names → {output_path.name}")
                        return count
        except Exception:
            continue

    log(f"  No names API endpoint found")
    return 0


def scrape_photos_index():
    """Pull photo metadata index."""
    log("=== Scraping Photo Index ===")
    output_path = OUTPUT_DIR / "photos_index.jsonl"
    count = 0

    endpoints_to_try = ["photos", "images"]
    for ep in endpoints_to_try:
        try:
            with httpx.Client(timeout=30, follow_redirects=True) as client:
                r = client.get(f"{API_URL}/{ep}", params={"limit": 1})
                if r.status_code == 200:
                    data = r.json()
                    if data.get("data") or data.get("total", 0) > 0:
                        log(f"  Found photos at /{ep} (total: {data.get('total', '?')})")
                        with open(output_path, "w") as f:
                            for photo in paginate_api(ep, {"limit": 100}):
                                f.write(json.dumps(photo) + "\n")
                                count += 1
                                if count % 1000 == 0:
                                    log(f"  {count} photos...")
                        log(f"  DONE: {count} photos → {output_path.name}")
                        return count
        except Exception:
            continue

    log(f"  No photos API endpoint found")
    return 0


def probe_endpoints():
    """Discover which API endpoints actually exist."""
    log("=== Probing API Endpoints ===")
    candidates = [
        "documents", "entities", "flights", "search",
        "emails", "orders", "amazon-orders", "purchases",
        "names", "people", "all-names", "persons",
        "photos", "images", "media",
        "relationships", "connections", "network",
    ]
    available = {}
    with httpx.Client(timeout=15, follow_redirects=True) as client:
        for ep in candidates:
            try:
                r = client.get(f"{API_URL}/{ep}", params={"limit": 1})
                if r.status_code == 200:
                    data = r.json()
                    total = data.get("total", len(data.get("data", [])))
                    available[ep] = total
                    log(f"  /{ep}: {r.status_code} OK ({total} records)")
                else:
                    log(f"  /{ep}: {r.status_code}")
            except Exception as e:
                log(f"  /{ep}: error ({e})")
            time.sleep(0.3)
    return available


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log(f"Output directory: {OUTPUT_DIR}")
    log(f"Rate limit delay: {RATE_LIMIT_DELAY}s between requests")
    log("")

    # 0. Probe endpoints
    available = probe_endpoints()
    log(f"\nAvailable endpoints: {list(available.keys())}")
    log("")

    results = {}

    # 1. Download the 4 CSV exports
    log("=" * 60)
    log("PHASE 1: CSV Downloads")
    log("=" * 60)
    csv_dir = OUTPUT_DIR / "csv"
    csv_dir.mkdir(exist_ok=True)

    csvs = {
        "entities": f"{BASE_URL}/api/download/entities",
        "flights": f"{BASE_URL}/api/download/flights",
        "relationships": f"{BASE_URL}/api/download/relationships",
        "emails": f"{BASE_URL}/api/download/emails",
    }
    for name, url in csvs.items():
        results[f"csv_{name}"] = download_csv(name, url, csv_dir / f"{name}.csv")

    # 2. Full API scrapes — only hit endpoints that exist
    log("")
    log("=" * 60)
    log("PHASE 2: API Scrapes")
    log("=" * 60)

    if "entities" in available:
        results["entities_api"] = scrape_entities()
    if "flights" in available:
        results["flights_api"] = scrape_flights()

    # Emails — try available endpoint or skip
    email_ep = next((ep for ep in ["emails", "email"] if ep in available), None)
    if email_ep:
        results["emails_api"] = scrape_emails()
    else:
        log("=== Emails: no API endpoint found, CSV download only ===")

    results["amazon_orders"] = scrape_amazon_orders()

    # Names
    names_ep = next((ep for ep in ["names", "people", "all-names", "persons"] if ep in available), None)
    if names_ep:
        results["names"] = scrape_search_names()
    else:
        log("=== Names: no API endpoint found ===")

    # Photos
    photos_ep = next((ep for ep in ["photos", "images", "media"] if ep in available), None)
    if photos_ep:
        results["photos_index"] = scrape_photos_index()
    else:
        log("=== Photos: no API endpoint found ===")

    # 3. Document index (the big one)
    log("")
    log("=" * 60)
    log("PHASE 3: Full Document Index")
    log("=" * 60)
    if "documents" in available:
        log(f"  Total documents to fetch: {available.get('documents', '?')}")
        results["documents"] = scrape_documents()
    else:
        log("=== Documents: no API endpoint found ===")

    # Summary
    log("")
    log("=" * 60)
    log("SCRAPE COMPLETE")
    log("=" * 60)
    for key, count in results.items():
        log(f"  {key}: {count} records")

    total_files = sum(1 for f in OUTPUT_DIR.rglob("*") if f.is_file())
    total_size = sum(f.stat().st_size for f in OUTPUT_DIR.rglob("*") if f.is_file())
    log(f"\nTotal: {total_files} files, {total_size / 1024 / 1024:.1f} MB")

    # Save manifest
    manifest = {
        "source": "epsteininvestigation.org",
        "scraped_at": datetime.utcnow().isoformat(),
        "results": results,
        "total_files": total_files,
        "total_bytes": total_size,
    }
    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    log(f"Manifest saved: {manifest_path}")


if __name__ == "__main__":
    main()
