#!/usr/bin/env python3
"""
Scrape epsteinexposed.com via their public REST API.
No auth required. Rate limit: 60 req/min.
"""
import os, sys, json, time, math

sys.path.insert(0, os.path.dirname(__file__))
import httpx
from supabase import create_client
from uploader import upload_directory

DEST = '/mnt/temp/epstein-exposed'
BASE = 'https://epsteinexposed.com/api/v1'
DELAY = 1.1  # stay under 60 req/min

os.makedirs(DEST, exist_ok=True)


def fetch_paginated(endpoint, params=None, per_page=100):
    """Fetch all pages from a paginated API endpoint."""
    params = params or {}
    params['per_page'] = per_page
    all_data = []
    page = 1

    while True:
        params['page'] = page
        for attempt in range(3):
            try:
                resp = httpx.get(f'{BASE}/{endpoint}', params=params, timeout=30)
                resp.raise_for_status()
                body = resp.json()
                break
            except Exception as e:
                print(f'  Error on page {page} (attempt {attempt+1}): {e}')
                if attempt < 2:
                    time.sleep(5 * (attempt + 1))
                else:
                    return all_data

        data = body.get('data', [])
        meta = body.get('meta', {})
        total = meta.get('total', 0)
        all_data.extend(data)

        total_pages = math.ceil(total / per_page) if total else 1
        if page == 1 or page % 10 == 0 or page == total_pages:
            print(f'  Page {page}/{total_pages} ({len(all_data)}/{total} records)')

        if page >= total_pages or not data:
            break

        page += 1
        time.sleep(DELAY)

    return all_data


# === PERSONS (list) ===
print('\n=== Fetching persons list ===')
persons = fetch_paginated('persons')
os.makedirs(f'{DEST}/persons', exist_ok=True)
with open(f'{DEST}/persons/_all.json', 'w') as f:
    json.dump(persons, f, indent=2)
print(f'Got {len(persons)} persons')

# === PERSON DETAILS (individual profiles with connections) ===
print('\n=== Fetching person details ===')
os.makedirs(f'{DEST}/persons/detail', exist_ok=True)
for i, person in enumerate(persons):
    slug = person.get('slug', '')
    if not slug:
        continue
    detail_path = f'{DEST}/persons/detail/{slug}.json'
    if os.path.exists(detail_path):
        continue
    for attempt in range(3):
        try:
            resp = httpx.get(f'{BASE}/persons/{slug}', timeout=30)
            resp.raise_for_status()
            with open(detail_path, 'w') as f:
                json.dump(resp.json(), f, indent=2)
            break
        except Exception as e:
            if attempt < 2:
                time.sleep(5)
            else:
                print(f'  Failed: {slug}: {e}')
    if (i + 1) % 50 == 0:
        print(f'  {i + 1}/{len(persons)} person details fetched')
    time.sleep(DELAY)
print(f'Done: {len(persons)} person details')

# === FLIGHTS ===
print('\n=== Fetching flights ===')
flights = fetch_paginated('flights')
with open(f'{DEST}/flights.json', 'w') as f:
    json.dump(flights, f, indent=2)
print(f'Got {len(flights)} flights')

# === DOCUMENTS (1.5M records - fetch in batches) ===
print('\n=== Fetching document index ===')
os.makedirs(f'{DEST}/documents', exist_ok=True)

try:
    resp = httpx.get(f'{BASE}/documents', params={'per_page': 1}, timeout=30)
    resp.raise_for_status()
    total_docs = resp.json().get('meta', {}).get('total', 0)
    print(f'Total documents: {total_docs:,}')
except Exception as e:
    print(f'Error checking documents: {e}')
    total_docs = 0

if total_docs > 0:
    per_page = 100
    total_pages = math.ceil(total_docs / per_page)
    batch_size = 100  # pages per file (10K records per file)
    all_count = 0

    for batch_start in range(1, total_pages + 1, batch_size):
        batch_end = min(batch_start + batch_size - 1, total_pages)
        batch_num = (batch_start - 1) // batch_size
        batch_file = f'{DEST}/documents/batch_{batch_num:04d}.json'

        if os.path.exists(batch_file):
            with open(batch_file) as f:
                existing = json.load(f)
            all_count += len(existing)
            print(f'  Batch {batch_num}: already exists ({len(existing)} records), total: {all_count:,}')
            continue

        batch_data = []
        for page in range(batch_start, batch_end + 1):
            for attempt in range(3):
                try:
                    resp = httpx.get(f'{BASE}/documents',
                                     params={'per_page': per_page, 'page': page},
                                     timeout=30)
                    resp.raise_for_status()
                    data = resp.json().get('data', [])
                    batch_data.extend(data)
                    break
                except Exception as e:
                    if attempt < 2:
                        time.sleep(5 * (attempt + 1))
                    else:
                        print(f'  Failed page {page}: {e}')
            time.sleep(DELAY)

        with open(batch_file, 'w') as f:
            json.dump(batch_data, f)
        all_count += len(batch_data)
        print(f'  Batch {batch_num}: {len(batch_data)} records (total: {all_count:,})')

    print(f'Done: {all_count:,} document records')

# === SEARCH for emails ===
print('\n=== Searching for emails ===')
os.makedirs(f'{DEST}/search', exist_ok=True)
try:
    resp = httpx.get(f'{BASE}/search', params={'q': 'email', 'type': 'email', 'limit': 100}, timeout=30)
    resp.raise_for_status()
    with open(f'{DEST}/search/emails.json', 'w') as f:
        json.dump(resp.json(), f, indent=2)
    print(f'Got {len(resp.json().get("data", []))} email results')
except Exception as e:
    print(f'Email search error: {e}')

# === Upload everything to Supabase ===
print('\n=== Uploading to Supabase ===')
client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
stats = upload_directory(client, DEST, 'websites/epstein-exposed', source_key='epstein-exposed')
print(f'DONE: {stats}')
