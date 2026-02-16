#!/usr/bin/env python3
"""Apply epsteininvestigation.org enrichment data to documents table.

Cross-references by EFTA page number (slug → filename).
Updates: classification, ai_summary (from excerpt), page_count, metadata.
Uses asyncio + aiohttp for concurrent requests (~50x faster).
"""

import asyncio
import json
import os
import ssl
import sys

JSONL_PATH = "/tmp/enrichment_docs.jsonl"
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CONCURRENCY = 30  # concurrent PATCH requests

# Stats
updated = 0
no_match = 0
skipped = 0
failed = 0

def doc_type_to_classification(doc_type: str) -> str | None:
    mapping = {
        "foia_release": "foia_release",
        "photo": "photograph",
        "other": "other",
    }
    return mapping.get(doc_type)

async def patch_document(session, filename: str, updates: dict, sem: asyncio.Semaphore):
    global updated, no_match, failed
    url = f"{SUPABASE_URL}/rest/v1/documents?filename=eq.{filename}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=headers-only",
    }
    async with sem:
        try:
            async with session.patch(url, json=updates, headers=headers) as resp:
                cr = resp.headers.get("content-range", "")
                if "*/0" in cr:
                    no_match += 1
                else:
                    updated += 1
        except Exception as e:
            failed += 1
            if failed <= 5:
                print(f"  Error: {filename}: {e}", file=sys.stderr)

async def main():
    global skipped
    try:
        import aiohttp
    except ImportError:
        print("Installing aiohttp...", flush=True)
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "pip", "install", "aiohttp",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        await proc.wait()
        import aiohttp

    records = []
    with open(JSONL_PATH) as f:
        for line in f:
            records.append(json.loads(line))

    print(f"Loaded {len(records)} enrichment records", flush=True)

    # Skip already-processed (from previous partial run)
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    sem = asyncio.Semaphore(CONCURRENCY)
    conn = aiohttp.TCPConnector(limit=CONCURRENCY, ssl=ssl_ctx)
    async with aiohttp.ClientSession(connector=conn) as session:
        tasks = []
        for i, rec in enumerate(records):
            slug = rec.get("slug", "")
            if not slug:
                skipped += 1
                continue

            filename = slug.upper() + ".pdf"
            updates = {}

            classification = doc_type_to_classification(rec.get("document_type", ""))
            if classification:
                updates["classification"] = classification

            excerpt = rec.get("excerpt")
            if excerpt and len(excerpt.strip()) > 10:
                updates["ai_summary"] = excerpt.strip()[:2000]

            page_count = rec.get("page_count")
            if page_count and isinstance(page_count, int) and page_count > 0:
                updates["page_count"] = page_count

            meta = {}
            if rec.get("source_url"):
                meta["doj_source_url"] = rec["source_url"]
            if rec.get("file_url"):
                meta["epsteininvestigation_url"] = rec["file_url"]
            if rec.get("document_type"):
                meta["epsteininvestigation_type"] = rec["document_type"]
            if meta:
                updates["metadata"] = meta

            if not updates:
                skipped += 1
                continue

            tasks.append(patch_document(session, filename, updates, sem))

            # Progress every 500 queued
            if len(tasks) % 500 == 0:
                # Flush pending tasks
                await asyncio.gather(*tasks)
                tasks = []
                print(f"  Progress: {i+1}/{len(records)} (updated={updated}, no_match={no_match}, skipped={skipped}, failed={failed})", flush=True)

        # Final batch
        if tasks:
            await asyncio.gather(*tasks)

    print(f"\nDone! Updated={updated}, No match={no_match}, Skipped={skipped}, Failed={failed}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
