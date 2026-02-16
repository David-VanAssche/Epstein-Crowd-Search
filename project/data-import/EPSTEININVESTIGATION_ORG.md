# epsteininvestigation.org — Site Analysis

Scraped: 2026-02-14

## Overview

A volunteer-built archive of 207K+ Epstein investigation documents with enrichment.
Free public API (no auth required). Built on Next.js 15 + Supabase + pgvector.

## Their Dataset Stats

| Category | Count | Notes |
|----------|-------|-------|
| Documents | 207,251 | Indexed with OCR text, classified by type |
| Names/Entities | 23,540 | But only 96 "key" entities have enrichment |
| Flights | 3,004 | But API only returns 55 enriched records |
| Emails | 4,050 | Full body text, sender/recipient, subject |
| Photos | 16,407 | From DOJ evidence, categorized by location |
| Amazon Orders | 886 | Purchase records from federal subpoenas |

## Their Data Sources (8 total)

| Source | Documents | % |
|--------|-----------|---|
| DOJ Epstein Library - Court Records | 12,521 | 6.0% |
| DOJ - EFTA Photos | 7,607 | 3.7% |
| DOJ - Manual Photos | 7,683 | 3.7% |
| DOJ - Unclassified Materials | 2,632 | 1.3% |
| DOJ - Data Sets 1-5 | 5,703 | 2.8% |
| House Oversight Committee | 1,124 | 0.5% |
| FBI Vault | 850 | 0.4% |
| FOIA Releases | 600 | 0.3% |

**NOTE:** They only have ~38K documents explicitly sourced above (18% of 207K).
The remaining 169K are presumably from DOJ Datasets 6-12 but not broken out.

## Their Processing Pipeline

1. **Document Acquisition** — SHA-256 hashing for chain of custody
2. **OCR** — Multi-engine: Tesseract + cloud OCR, multiple passes with confidence scoring
3. **Classification** — ML-based document type classification (court records, FBI files, depositions, emails)
4. **NER** — Named Entity Recognition with alias resolution + cross-document linking
5. **AI Summarization** — Anthropic Claude for per-document summaries
6. **Search Indexing** — PostgreSQL tsvector (full-text) + pgvector embeddings (semantic), merged via Reciprocal Rank Fusion
7. **QA** — Automated + manual validation

## Their API Endpoints

Base: `https://www.epsteininvestigation.org/api/v1`

| Endpoint | Records | Rate Limit |
|----------|---------|------------|
| GET /documents | 207K+ (but API shows 21,880?) | 100 req/min |
| GET /entities | 96 enriched | 100 req/min |
| GET /flights | 55 enriched | 100 req/min |
| GET /search?q= | full-text search | 100 req/min |

### Document API Fields
- id, slug, title, document_type, source, document_date, excerpt, page_count, file_url, source_url

### Entity API Fields
- id, slug, name, entity_type, document_count, flight_count, email_count, role_description

### Flight API Fields
- id, slug, flight_date, aircraft_tail_number, pilot_name, departure_airport_code, departure_airport, arrival_airport_code, arrival_airport, passenger_names[]

## CSV Downloads

| Dataset | Records | URL |
|---------|---------|-----|
| Entities & People | 96 | /api/download/entities |
| Flight Logs | 55 | /api/download/flights |
| Entity Relationships | 1,007 | /api/download/relationships |
| Email Metadata | 21 | /api/download/emails |

## What They Have That We Don't

1. **Entity enrichment** — 96 key figures with document counts, role descriptions, cross-references
2. **Relationship graph** — 1,007 entity-to-entity connections with type + strength score
3. **Email corpus** — 4,050 emails with full body text, sender/recipient parsing
4. **Photo classification** — 16,407 evidence photos categorized by location
5. **Amazon orders** — 886 purchase records with items, quantities, prices, dates
6. **AI summaries** — Claude-generated summaries for each document
7. **OCR text** — Multi-engine OCR output for all 207K documents
8. **Document classification** — Type labels (court records, FBI files, depositions, correspondence, financial)
9. **Search infrastructure** — Full-text + semantic search with vector embeddings
10. **House Oversight docs** — 1,124 documents from Congress we haven't grabbed

## What We Have That They Don't

1. **Complete DOJ Datasets 6-12** — They seem to only have DS1-5 broken out; we have all 12 with 2.73M pages
2. **Raw production data** — OPT/DAT load files with document-level Bates metadata
3. **Community datasets** — 24+ GitHub/HuggingFace/Kaggle sources with alternative OCR, analysis
4. **s0fskr1p overlay redaction text** — OCR text hidden under black-box redactions
5. **USVI v. JPMorgan exhibits** — 199 financial exhibits
6. **Florida v. Epstein filings** — 99 state court documents
7. **DocumentCloud collections** — Including 405MB MCC document

## Gaps We Can Fill From Them

1. **Relationship CSV** (1,007 connections) — import directly as seed data for our network graph
2. **Email metadata CSV** (21 records) — cross-reference with our email corpus
3. **Entity list** (96 with enrichment) — use as seed entities, then expand with NER on our 2.73M pages
4. **Amazon orders** — scrape the /orders page (886 records, 4 pages)
5. **House Oversight docs** — 1,124 documents we don't have yet
6. **Flight enrichment** (55 records) — their passenger parsing + airport resolution

## Scrape Results (2026-02-14)

### API Downloads (Complete)
- **Documents**: 21,880 records via /api/v1/documents (paginated, 100/page)
- **Entities**: 96 records via /api/v1/entities
- **Flights**: 55 records via /api/v1/flights
- **Relationships**: 1,007 via /api/download/relationships CSV
- **Email Metadata**: 21 via /api/download/emails CSV

### HTML/RSC Scrape (Server-Rendered Data)

| Dataset | Retrieved | Site Claims | Notes |
|---------|-----------|-------------|-------|
| Amazon Orders | 75 | 886 | 79 visible on paginated list, 75 parsed. Server filters to subset. |
| Emails | 21 | 4,050 | Page 2+ returns DB error. Full body text + sender/recipient extracted. |
| Names | 51 | 23,540 | Only "Key Figures" section rendered. |
| Photos | 3,055 | 16,407 | All 128 pages scraped. AI descriptions + EFTA references. |

**Method**: Next.js RSC flight payload parsing (`self.__next_f.push([1,"..."])`) + JSON-LD.
**Scraper**: `scripts/hoarder/scrape_html.py`

### Email Detail Fields
Each of the 21 emails enriched with:
- `subject`, `date`, `sender_name`, `sender_email`, `body`
- Senders include: Ghislaine Maxwell, Jeffrey Epstein, Jes Staley, Alexander Acosta,
  Sarah Kellen, Lesley Groff, Jean-Luc Brunel, DB Compliance

### Order Detail Fields
Each of the 75 orders enriched with `shipping_address`:
- 9 East 71st Street, New York, NY (Epstein townhouse)
- 358 El Brillo Way, Palm Beach, FL (Epstein mansion)

### Data Availability Analysis
The 886 orders / 4,050 emails / 16,407 photos totals are server-side database counts.
The site only renders a subset via server-rendered HTML — this is a server-side filtering
decision, not a scraping limitation. Headless browsers (Playwright etc.) would not help.
Getting the full dataset requires either:
1. Their Supabase anon key (confirmed server-side only, not in any JS bundle)
2. Direct collaboration / data sharing agreement
3. Waiting for them to publish more data

## Action Items

- [x] Download all 4 CSVs from their /api/download/ endpoints
- [x] Scrape Amazon orders (75 of 886 — server-side limit)
- [x] Scrape emails with full body text (21 of 4,050 — server-side limit)
- [x] Scrape photo metadata with AI descriptions (3,055 of 16,407)
- [x] Scrape key figures names directory (51 of 23,540)
- [ ] Upload scraped data to Supabase Storage (`raw-archive/scraped/epsteininvestigation.org/`)
- [ ] Check if House Oversight docs overlap with our existing data
- [ ] Evaluate their entity/relationship data quality for import
- [ ] Compare their OCR quality against s0fskr1p and our raw PDFs
- [ ] Consider pulling their document summaries via API (21K+ docs × rate limit = ~3.5 hours)
- [ ] Reach out about data sharing for the remaining 800+ orders, 4K emails, 13K photos
