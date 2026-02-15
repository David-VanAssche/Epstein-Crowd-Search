#!/usr/bin/env python3
"""
Scrape server-rendered data from epsteininvestigation.org HTML pages.

Targets data NOT available via their /api/v1/ endpoints:
  1. Amazon orders (79 visible of 886 claimed, paginated at 25/page)
  2. Photos metadata (16,407 records, paginated at 24/page)
  3. Names directory (73+ entries, single page)
  4. Emails (4,050 claimed, page 1 only accessible)

Strategy: Parse RSC (React Server Components) flight payloads from
self.__next_f.push() inline scripts. This is more reliable than
parsing rendered HTML since the data is structured JSON.

Rate limit: 100 req/min → 0.7s between requests.
"""

import httpx
import json
import time
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone
from bs4 import BeautifulSoup

BASE_URL = "https://www.epsteininvestigation.org"
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "scraped_html"))
RATE_LIMIT_DELAY = 0.7
HEADERS = {
    "User-Agent": "EpsteinCrowdResearch/1.0 (open-source archive project)",
    "Accept": "text/html,application/xhtml+xml",
}


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def fetch_page(url, retries=3):
    """Fetch a page with retries."""
    for attempt in range(retries):
        try:
            with httpx.Client(timeout=30, follow_redirects=True, headers=HEADERS) as client:
                r = client.get(url)
                r.raise_for_status()
                return r.text
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (404, 403):
                log(f"  {e.response.status_code} for {url}")
                return None
            log(f"  HTTP {e.response.status_code} on attempt {attempt+1}")
        except Exception as e:
            log(f"  Error on attempt {attempt+1}: {e}")
        time.sleep(2 * (attempt + 1))
    return None


def extract_rsc_chunks(html):
    """Extract and decode RSC flight payloads from self.__next_f.push() scripts."""
    raw_chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.DOTALL)
    decoded = []
    for chunk in raw_chunks:
        try:
            decoded.append(chunk.encode().decode('unicode_escape'))
        except Exception:
            decoded.append(chunk)
    return decoded


def extract_rsc_pagination(chunks):
    """Extract pagination info (current_page, total_pages) from RSC data."""
    for chunk in chunks:
        match = re.search(r'"Page ",(\d+)," of ","(\d+)"', chunk)
        if match:
            return int(match.group(1)), int(match.group(2))
    return None, None


def extract_json_ld(html):
    """Extract JSON-LD from RSC data (it's embedded in RSC, not directly in HTML)."""
    results = []
    # JSON-LD is in RSC as dangerouslySetInnerHTML
    for match in re.finditer(r'"__html":"(\{[^}]*@context[^}]*\}(?:[^"]*\})*)"', html):
        try:
            raw = match.group(1).replace('\\"', '"').replace('\\\\', '\\')
            results.append(json.loads(raw))
        except (json.JSONDecodeError, Exception):
            pass
    # Also try BeautifulSoup for any actual script tags
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            results.append(json.loads(script.string))
        except (json.JSONDecodeError, TypeError):
            pass
    return results


# ─── ORDERS ───────────────────────────────────────────────────────────────────

def parse_rsc_orders(chunks):
    """Parse order records from RSC flight data.

    Order rows are spread across individual RSC chunks. Each chunk with
    an AMZ- order number contains one table row with:
    [date, item+order#, category_badge, qty, price, view_link]
    """
    orders = []

    for chunk in chunks:
        if "AMZ-" not in chunk:
            continue

        # Each chunk with AMZ- contains one order row
        uuid_match = re.search(
            r'"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"',
            chunk
        )
        if not uuid_match:
            continue

        order = {"id": uuid_match.group(1)}

        # Date
        m = re.search(
            r'font-mono text-sm","children":"'
            r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4})"',
            chunk
        )
        if m:
            order["date"] = m.group(1)

        # Item name
        m = re.search(r'font-medium line-clamp-2","children":"([^"]+)"', chunk)
        if m:
            order["item"] = m.group(1)

        # Order number
        m = re.search(r'(AMZ-\d{4}-\d{4}-\d{3})', chunk)
        if m:
            order["order_number"] = m.group(1)

        # Category
        m = re.search(r'secondary/90 text-xs","children":"([^"]+)"', chunk)
        if m:
            order["category"] = m.group(1)

        # Quantity (bare number)
        m = re.search(r'text-center","children":(\d+)', chunk)
        if m:
            order["quantity"] = int(m.group(1))

        # Price (double $$ in RSC encoding)
        m = re.search(r'text-right font-mono text-sm","children":"\$\$([^"]+)"', chunk)
        if m:
            order["price"] = f"${m.group(1)}"

        # Detail URL
        m = re.search(r'"href":"(/orders/[^"]+)"', chunk)
        if m:
            order["detail_url"] = m.group(1)

        if order.get("item"):
            orders.append(order)

    return orders


def scrape_orders():
    """Scrape Amazon purchase orders from /orders pages."""
    log("=== Scraping Amazon Orders ===")
    all_orders = []
    page = 1
    total_pages = None

    while True:
        url = f"{BASE_URL}/orders?page={page}"
        log(f"  Fetching page {page}{'/' + str(total_pages) if total_pages else ''}...")
        html = fetch_page(url)
        if not html:
            break

        chunks = extract_rsc_chunks(html)

        # Get pagination on first page
        if total_pages is None:
            _, total_pages = extract_rsc_pagination(chunks)
            if total_pages:
                log(f"  Total pages: {total_pages}")

        # Extract "Showing X-Y of Z" info
        for chunk in chunks:
            showing = re.search(r'"Showing ",(\d+),"-",(\d+)," of"," ","(\d+)"', chunk)
            if showing and page == 1:
                log(f"  Showing {showing.group(1)}-{showing.group(2)} of {showing.group(3)} orders")

        orders = parse_rsc_orders(chunks)
        if not orders:
            log(f"  No orders found on page {page} — stopping")
            break

        all_orders.extend(orders)
        log(f"  Found {len(orders)} orders (total: {len(all_orders)})")

        if total_pages and page >= total_pages:
            break
        if not total_pages and len(orders) < 20:
            break

        page += 1
        time.sleep(RATE_LIMIT_DELAY)

    # Save
    output_path = OUTPUT_DIR / "amazon_orders.jsonl"
    with open(output_path, "w") as f:
        for order in all_orders:
            f.write(json.dumps(order) + "\n")
    log(f"  DONE: {len(all_orders)} orders → {output_path}")
    return len(all_orders)


# ─── PHOTOS ───────────────────────────────────────────────────────────────────

def parse_rsc_photos(chunks):
    """Parse photo metadata from RSC flight data."""
    photos = []

    for chunk in chunks:
        if "supabase.co/storage" not in chunk and "/photos/" not in chunk:
            continue

        # Photos have image URLs and metadata in card components
        # Find image URLs
        img_pattern = re.compile(
            r'"src":"(https://[^"]*supabase\.co/storage/v1/object/public/photos/[^"]+)"'
        )
        # Find photo detail links
        link_pattern = re.compile(r'"href":"(/photos/[^"]+)"')
        # Find alt text / titles
        alt_pattern = re.compile(r'"alt":"([^"]+)"')

        # Try to find structured photo cards
        # Each photo card typically has an image, title, location, source
        card_splits = re.split(r'(?=\$L\w+","[0-9a-f]{8}-)', chunk)

        for card in card_splits:
            img_match = img_pattern.search(card)
            if not img_match:
                continue

            photo = {"image_url": img_match.group(1)}

            alt_match = alt_pattern.search(card)
            if alt_match:
                photo["title"] = alt_match.group(1)

            link_match = link_pattern.search(card)
            if link_match:
                photo["detail_url"] = link_match.group(1)

            # Location
            loc_match = re.search(r'"children":"([^"]*(?:Residence|Property|Office|Room|Island|Mansion|Apartment|Ranch|Palm Beach|New York|Manhattan|Virgin|Little St)[^"]*)"', card, re.IGNORECASE)
            if loc_match:
                photo["location"] = loc_match.group(1)

            # Source
            src_match = re.search(r'outline","children":"([^"]+)"', card)
            if src_match:
                photo["source"] = src_match.group(1)

            photos.append(photo)

    return photos


def scrape_photos():
    """Scrape photo metadata from /photos pages."""
    log("=== Scraping Photo Metadata ===")
    all_photos = []
    page = 1
    total_pages = None

    while True:
        url = f"{BASE_URL}/photos?page={page}"
        if page == 1 or page % 10 == 0:
            log(f"  Fetching page {page}{'/' + str(total_pages) if total_pages else ''}...")
        html = fetch_page(url)
        if not html:
            break

        chunks = extract_rsc_chunks(html)

        if total_pages is None:
            _, total_pages = extract_rsc_pagination(chunks)
            if total_pages:
                log(f"  Total pages: {total_pages}")

        photos = parse_rsc_photos(chunks)

        if not photos:
            # Fallback: try BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            for img in soup.find_all("img", src=re.compile(r"supabase\.co/storage")):
                photo = {"image_url": img.get("src", ""), "alt": img.get("alt", "")}
                link = img.find_parent("a", href=True)
                if link:
                    photo["detail_url"] = link["href"]
                photos.append(photo)

        if not photos:
            log(f"  No photos found on page {page} — stopping")
            break

        all_photos.extend(photos)

        if page % 10 == 0:
            log(f"  {len(all_photos)} photos so far...")

        if total_pages and page >= total_pages:
            break
        if not total_pages and len(photos) < 10:
            break

        page += 1
        time.sleep(RATE_LIMIT_DELAY)

    output_path = OUTPUT_DIR / "photos_metadata.jsonl"
    with open(output_path, "w") as f:
        for photo in all_photos:
            f.write(json.dumps(photo) + "\n")
    log(f"  DONE: {len(all_photos)} photos → {output_path}")
    return len(all_photos)


# ─── NAMES ────────────────────────────────────────────────────────────────────

def parse_rsc_names(chunks):
    """Parse name entries from RSC flight data."""
    names = []

    for chunk in chunks:
        if "/names/" not in chunk:
            continue

        # Names have profile links and metadata
        # Pattern: href to /names/slug, with name text, role, counts
        name_pattern = re.compile(
            r'"href":"(/names/[^"]+)".*?'
            r'"children":"([^"]+)"',
            re.DOTALL
        )

        # Find all name cards by splitting on card boundaries
        card_splits = re.split(r'(?=\["\\?\$","\\?\$L)', chunk)

        for card in card_splits:
            href_match = re.search(r'"href":"(/names/[^"]+)"', card)
            if not href_match:
                continue

            entry = {"profile_url": href_match.group(1)}

            # Find name (usually in a bold/semibold element right after the link)
            name_matches = re.findall(r'(?:semibold|font-medium)[^"]*","children":"([^"]+)"', card)
            if name_matches:
                entry["name"] = name_matches[0]

            # Find role/description
            role_match = re.search(r'text-muted-foreground[^"]*","children":"([^"]{10,})"', card)
            if role_match:
                entry["role"] = role_match.group(1)

            # Find counts (numbers near icons)
            count_matches = re.findall(r'"children":(\d+)', card)
            if len(count_matches) >= 1:
                entry["document_count"] = int(count_matches[0])
            if len(count_matches) >= 2:
                entry["flight_count"] = int(count_matches[1])
            if len(count_matches) >= 3:
                entry["email_count"] = int(count_matches[2])

            if entry.get("name"):
                names.append(entry)

    return names


def scrape_names():
    """Scrape the names directory from /names."""
    log("=== Scraping Names Directory ===")
    url = f"{BASE_URL}/names"
    html = fetch_page(url)
    if not html:
        log("  Failed to fetch /names")
        return 0

    # Try RSC parsing first
    chunks = extract_rsc_chunks(html)
    names = parse_rsc_names(chunks)

    # Fallback: BeautifulSoup
    if not names:
        log("  RSC parsing found 0 names, falling back to HTML parsing")
        soup = BeautifulSoup(html, "html.parser")
        for link in soup.find_all("a", href=re.compile(r"/names/")):
            name_text = link.get_text(strip=True)
            if not name_text or len(name_text) < 2:
                continue
            entry = {"name": name_text, "profile_url": link.get("href", "")}
            parent = link.find_parent("div", class_=True) or link.find_parent("li")
            if parent:
                entry["raw_text"] = parent.get_text(separator="|", strip=True)
            names.append(entry)

    # Also extract from JSON-LD
    json_ld = extract_json_ld(html)
    for item in json_ld:
        if isinstance(item, dict) and "itemListElement" in item:
            for elem in item["itemListElement"]:
                if isinstance(elem, dict) and "name" in elem:
                    # Check if not already present
                    existing = {n.get("name", "").lower() for n in names}
                    if elem["name"].lower() not in existing:
                        names.append(elem)

    # Deduplicate
    seen = set()
    unique = []
    for n in names:
        key = n.get("name", n.get("profile_url", str(n)))
        if key not in seen:
            seen.add(key)
            unique.append(n)

    output_path = OUTPUT_DIR / "names_directory.jsonl"
    with open(output_path, "w") as f:
        for name in unique:
            f.write(json.dumps(name) + "\n")
    log(f"  DONE: {len(unique)} names → {output_path}")
    return len(unique)


# ─── EMAILS ───────────────────────────────────────────────────────────────────

def parse_rsc_emails(chunks):
    """Parse email records from RSC flight data."""
    emails = []

    for chunk in chunks:
        if "/emails/" not in chunk and "email" not in chunk.lower():
            continue

        # Email cards: sender, recipient, subject, date, preview
        card_splits = re.split(r'(?=\$L\w+","[0-9a-f]{8}-)', chunk)

        for card in card_splits:
            if len(card) < 100:
                continue

            email = {}

            # Detail link
            href_match = re.search(r'"href":"(/emails/[^"]+)"', card)
            if href_match:
                email["detail_url"] = href_match.group(1)

            # Date
            date_match = re.search(
                r'"children":"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4})"',
                card
            )
            if date_match:
                email["date"] = date_match.group(1)

            # From/To — look for name patterns
            from_match = re.search(r'(?:From|Sender)[^"]*"children":"([^"]+)"', card)
            if from_match:
                email["from"] = from_match.group(1)

            to_match = re.search(r'(?:To|Recipient)[^"]*"children":"([^"]+)"', card)
            if to_match:
                email["to"] = to_match.group(1)

            # Subject
            subject_match = re.search(r'"font-medium[^"]*","children":"([^"]{5,})"', card)
            if subject_match:
                email["subject"] = subject_match.group(1)

            # Preview/body text
            text_matches = re.findall(r'"children":"([^"]{30,})"', card)
            if text_matches:
                email["preview"] = max(text_matches, key=len)

            if email.get("detail_url") or email.get("subject"):
                emails.append(email)

    return emails


def scrape_emails():
    """Scrape email records from /emails pages."""
    log("=== Scraping Emails ===")
    all_emails = []
    page = 1
    total_pages = None
    consecutive_failures = 0

    while True:
        url = f"{BASE_URL}/emails?page={page}"
        log(f"  Fetching page {page}{'/' + str(total_pages) if total_pages else ''}...")
        html = fetch_page(url)
        if not html:
            break

        chunks = extract_rsc_chunks(html)

        if total_pages is None:
            _, total_pages = extract_rsc_pagination(chunks)
            if total_pages:
                log(f"  Total pages: {total_pages}")

        # Check for error messages
        has_error = any("unable to load" in c.lower() or "unavailable" in c.lower() for c in chunks)
        if has_error:
            log(f"  Database error on page {page}")
            consecutive_failures += 1
            if consecutive_failures >= 3:
                log("  3 consecutive failures — stopping")
                break
            page += 1
            time.sleep(2)
            continue

        consecutive_failures = 0
        emails = parse_rsc_emails(chunks)

        # Fallback: BeautifulSoup
        if not emails:
            soup = BeautifulSoup(html, "html.parser")
            for link in soup.find_all("a", href=re.compile(r"/emails/")):
                parent = link.find_parent("div", class_=True)
                if parent:
                    text = parent.get_text(separator="|", strip=True)
                    if len(text) > 20:
                        email = {"detail_url": link.get("href", ""), "raw_text": text}
                        # Extract date
                        dm = re.search(
                            r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}',
                            text
                        )
                        if dm:
                            email["date"] = dm.group()
                        emails.append(email)

        if not emails:
            log(f"  No emails found on page {page} — stopping")
            break

        all_emails.extend(emails)
        log(f"  Found {len(emails)} emails (total: {len(all_emails)})")

        if total_pages and page >= total_pages:
            break
        if not total_pages and len(emails) < 10:
            break

        page += 1
        time.sleep(RATE_LIMIT_DELAY)

    output_path = OUTPUT_DIR / "emails.jsonl"
    with open(output_path, "w") as f:
        for email in all_emails:
            f.write(json.dumps(email) + "\n")
    log(f"  DONE: {len(all_emails)} emails → {output_path}")
    return len(all_emails)


# ─── DETAIL PAGE ENRICHMENT ────────────────────────────────────────────────────

def enrich_from_details(jsonl_path, label, url_field, parse_fn):
    """Fetch detail pages for each record and merge extra fields."""
    log(f"=== Enriching {label} from detail pages ===")

    records = []
    with open(jsonl_path) as f:
        for line in f:
            records.append(json.loads(line))

    urls = [r.get(url_field) for r in records if r.get(url_field)]
    log(f"  {len(urls)} detail pages to fetch")

    enriched_count = 0
    for i, record in enumerate(records):
        detail_url = record.get(url_field)
        if not detail_url:
            continue

        full_url = f"{BASE_URL}{detail_url}" if detail_url.startswith("/") else detail_url
        html = fetch_page(full_url)
        if not html:
            continue

        extra = parse_fn(html)
        if extra:
            record.update(extra)
            enriched_count += 1

        if (i + 1) % 10 == 0:
            log(f"  {i + 1}/{len(records)} processed...")

        time.sleep(RATE_LIMIT_DELAY)

    # Save enriched version
    enriched_path = jsonl_path.with_name(jsonl_path.stem + "_enriched.jsonl")
    with open(enriched_path, "w") as f:
        for record in records:
            f.write(json.dumps(record) + "\n")
    log(f"  DONE: {enriched_count}/{len(records)} enriched → {enriched_path}")
    return enriched_count


def parse_order_detail(html):
    """Extract extra fields from an order detail page."""
    extra = {}
    chunks = extract_rsc_chunks(html)
    all_text = " ".join(chunks)

    # Shipping address
    addr_match = re.search(
        r'"children":"(\d+\s+[^"]*(?:Street|Ave|Blvd|Road|Dr|Way|Lane|Place|Court)[^"]*)"',
        all_text, re.IGNORECASE
    )
    if addr_match:
        extra["shipping_address"] = addr_match.group(1)

    # Ship To
    ship_match = re.search(r'"Ship To[^"]*","([^"]+)"', all_text)
    if not ship_match:
        ship_match = re.search(r'Ship[^"]*To[^"]*"children":"([^"]+)"', all_text)
    if ship_match:
        extra["ship_to"] = ship_match.group(1)

    # Product description (longer than list view)
    desc_match = re.search(r'"description":"([^"]{50,})"', all_text)
    if desc_match:
        extra["description"] = desc_match.group(1)

    # Any additional fields
    for field in ["asin", "tracking", "seller"]:
        m = re.search(rf'"{field}[^"]*":"([^"]+)"', all_text, re.IGNORECASE)
        if m:
            extra[field] = m.group(1)

    return extra if extra else None


def parse_email_detail(html):
    """Extract full body text and metadata from an email detail page."""
    extra = {}
    chunks = extract_rsc_chunks(html)
    all_text = " ".join(chunks)

    # Sender with email
    from_match = re.search(
        r'"children":"([^"]+@[^"]+)"',
        all_text
    )
    if from_match:
        extra["sender_email"] = from_match.group(1)

    # Sender name
    from_name = re.search(r'(?:From|Sender)[^"]*"children":"([^"@]+)"', all_text)
    if from_name:
        extra["sender_name"] = from_name.group(1).strip()

    # Recipient with email
    to_match = re.search(
        r'(?:To|Recipient)[^"]*"children":"([^"]+@[^"]+)"',
        all_text
    )
    if to_match:
        extra["recipient_email"] = to_match.group(1)

    # Subject
    subject_match = re.search(r'(?:Subject|Re:)[^"]*"children":"([^"]+)"', all_text)
    if subject_match:
        extra["subject"] = subject_match.group(1)

    # Full body text — usually the longest text segment
    text_segments = re.findall(r'"children":"([^"]{40,})"', all_text)
    if text_segments:
        # Filter out CSS classes and HTML-like strings
        body_candidates = [
            t for t in text_segments
            if not any(skip in t for skip in ["className", "flex ", "grid ", "rounded", "border"])
        ]
        if body_candidates:
            extra["body"] = max(body_candidates, key=len)

    # Date
    date_match = re.search(
        r'"children":"((?:January|February|March|April|May|June|July|August|'
        r'September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|'
        r'Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4})"',
        all_text
    )
    if date_match:
        extra["date"] = date_match.group(1)

    return extra if extra else None


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def save_raw_html(html, name):
    """Save raw HTML for debugging."""
    debug_dir = OUTPUT_DIR / "debug"
    debug_dir.mkdir(exist_ok=True)
    (debug_dir / f"{name}.html").write_text(html)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log(f"Output directory: {OUTPUT_DIR}")
    log(f"Rate limit delay: {RATE_LIMIT_DELAY}s between requests")

    targets = sys.argv[1:] if len(sys.argv) > 1 else ["orders", "names", "emails", "photos"]
    log(f"Targets: {targets}")

    # Save first page HTML for debugging
    log("\n=== Saving debug HTML samples ===")
    url_map = {
        "orders": f"{BASE_URL}/orders",
        "names": f"{BASE_URL}/names",
        "emails": f"{BASE_URL}/emails",
        "photos": f"{BASE_URL}/photos",
    }
    for target in targets:
        if target in url_map:
            html = fetch_page(url_map[target])
            if html:
                save_raw_html(html, target)
                log(f"  Saved debug HTML for {target} ({len(html):,} bytes)")

    results = {}

    if "orders" in targets:
        log("")
        results["orders"] = scrape_orders()

    if "names" in targets:
        log("")
        results["names"] = scrape_names()

    if "emails" in targets:
        log("")
        results["emails"] = scrape_emails()

    if "photos" in targets:
        log("")
        results["photos"] = scrape_photos()

    # Summary
    log("")
    log("=" * 60)
    log("SCRAPE COMPLETE")
    log("=" * 60)
    for key, count in results.items():
        log(f"  {key}: {count} records")

    total_files = sum(1 for f in OUTPUT_DIR.rglob("*") if f.is_file())
    total_size = sum(f.stat().st_size for f in OUTPUT_DIR.rglob("*") if f.is_file())
    log(f"\nTotal: {total_files} files, {total_size / 1024:.1f} KB")

    # Phase 2: Enrich from detail pages
    if "details" in targets or not sys.argv[1:]:
        log("")
        log("=" * 60)
        log("PHASE 2: Detail Page Enrichment")
        log("=" * 60)

        # Enrich orders with shipping addresses
        orders_path = OUTPUT_DIR / "amazon_orders.jsonl"
        if orders_path.exists():
            enriched = enrich_from_details(
                orders_path, "orders", "detail_url",
                parse_order_detail
            )
            results["orders_enriched"] = enriched

        # Enrich emails with full body text + sender/recipient
        emails_path = OUTPUT_DIR / "emails.jsonl"
        if emails_path.exists():
            enriched = enrich_from_details(
                emails_path, "emails", "detail_url",
                parse_email_detail
            )
            results["emails_enriched"] = enriched

    # Summary
    log("")
    log("=" * 60)
    log("ALL PHASES COMPLETE")
    log("=" * 60)
    for key, count in results.items():
        log(f"  {key}: {count} records")

    total_files = sum(1 for f in OUTPUT_DIR.rglob("*") if f.is_file())
    total_size = sum(f.stat().st_size for f in OUTPUT_DIR.rglob("*") if f.is_file())
    log(f"\nTotal: {total_files} files, {total_size / 1024:.1f} KB")

    # Save manifest
    manifest = {
        "source": "epsteininvestigation.org (HTML/RSC scrape)",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
