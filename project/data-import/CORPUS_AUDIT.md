# Epstein Archive — Corpus Audit & Inventory

Last updated: 2026-02-14

## Supabase Storage Bucket: `raw-archive`

**Grand Total: 1,530,877 files / 259 GiB**

---

## DOJ Datasets 1–12 (EFTA Production)

**1,382,302 files / 210 GiB / 2,731,789 EFTA-numbered pages**

Each page has a unique sequential Bates stamp (EFTA00000001 → EFTA02731789).
Multi-page documents are bundled into single PDF files, so file count < page count.
The `.OPT` load files in each dataset's `DATA/` directory map pages → PDF files → documents.

| Dataset | EFTA Range | Pages | PDF Files | Notes |
|---------|-----------|-------|-----------|-------|
| DS1 | EFTA00000001 – EFTA00003158 | 3,158 | 3,163 | FBI interviews, Palm Beach PD |
| DS2 | EFTA00003159 – EFTA00003857 | 699 | 577 | Includes .avi video files |
| DS3 | EFTA00003858 – EFTA00005704 | 1,847 | 68 | |
| DS4 | EFTA00005705 – EFTA00008408 | 2,704 | 154 | |
| DS5 | EFTA00008409 – EFTA00008528 | 120 | 122 | |
| DS6 | EFTA00008529 – EFTA00009015 | 487 | 15 | |
| DS7 | EFTA00009016 – EFTA00009675 | 660 | 19 | |
| DS8 | EFTA00009676 – EFTA00039024 | 29,349 | 11,035 | Includes .mp4 video files |
| DS9 | EFTA00039025 – EFTA01262781 | 1,223,757 | 531,256 | **Missing OPT/DAT** (archive.org torrent had IMAGES only) |
| DS10 | EFTA01262782 – EFTA02212882 | 950,101 | 504,030 | 180K images, 874 native video/audio files |
| DS11 | EFTA02212883 – EFTA02730264 | 517,382 | 331,662 | 4 .m4v native files |
| DS12 | EFTA02730265 – EFTA02731789 | 1,525 | 154 | |

### Key facts
- EFTA numbering is **perfectly sequential** across datasets (no gaps between datasets)
- DS9 is missing its `DATA/` directory (no `.OPT` or `.DAT` load file) — page count derived from EFTA range
- DS10/DS11 OPT files confirm 1:1 EFTA-to-page mapping within each dataset
- ~3,234 non-PDF native files across all datasets (video, audio, spreadsheets)

---

## The "3.5 Million" Discrepancy

DOJ claims: **"nearly 3.5 million responsive pages"**
Our verified EFTA count: **2,731,789 pages**
Gap: **~768,000 pages**

### Most likely explanation (per independent research)
The DOJ's 3.5M figure includes:
1. **Non-EFTA court records** on justice.gov/epstein/court-records (Giuffre v. Maxwell + 50+ cases, no Bates stamps)
2. **Pre-EFTA releases** (AG Bondi Feb 2025 declassification — flight logs, contact books)
3. **House Oversight Committee releases** (33,295 DOJ pages + 20,000 estate pages on Google Drive)
4. **Pre-deduplication counting** (DOJ acknowledged intra-department file sharing caused duplicates)
5. **Removed files** (~several thousand docs taken down for victim privacy post-release)

### Independent verification
- rhowardstone/Epstein-research (GitHub): "All 2,731,783 EFTA page-numbers accounted for — 100% complete"
- chad-loder/efta-analysis: Identified 12 PDFs that disappeared between v1/v2 postings of Volume 8
- No researcher has published a reconciliation bridging 2.73M to 3.5M

---

## Non-DOJ Sources in Supabase

### Court Records (NEW — 2026-02-14)
| Source | Bucket Path | Files | Size |
|--------|------------|-------|------|
| Giuffre v. Maxwell unsealed (Jan 2024) | `court-records/giuffre-v-maxwell/` | 3 | 62 MB |
| USVI v. JPMorgan Chase exhibits | `court-records/usvi-v-jpmorgan/` | 199 | ~20 MB |
| Florida v. Epstein filings | `court-records/florida-v-epstein/` | 99 | ~6 MB |
| Maxwell criminal trial docs | `court-records/maxwell-criminal/` | 3 | ~11 MB |

### Investigation Reports (NEW — 2026-02-14)
| Source | Bucket Path | Files | Size |
|--------|------------|-------|------|
| DOJ OIG Report (Epstein death, June 2023) | `reports/doj-oig/` | 1 | 5.7 MB |
| DOJ OPR Report (Acosta/NPA investigation) | `reports/doj-opr/` | 1 | 0.3 MB |
| DOJ Disclosure memos | `reports/doj-disclosures/` | 1 | 0.1 MB |

### Police Records (NEW — 2026-02-14)
| Source | Bucket Path | Files | Size |
|--------|------------|-------|------|
| Palm Beach PD (2005-2006) | `police-records/palm-beach/` | 1 | 1.7 MB |

### DocumentCloud Collections (NEW — 2026-02-14)
| Source | Bucket Path | Files | Size |
|--------|------------|-------|------|
| 5 Epstein Drops + MCC docs + NPA + DOJ 2025 release | `documentcloud/` | 12 | ~1 GB |

### Community Sources (GitHub, HuggingFace, Kaggle, etc.)
| Source | Bucket Path | Files | Size |
|--------|------------|-------|------|
| s0fskr1p (OCR text from overlay redactions) | `github/s0fskr1p/` | 1,644 | ~4 GB |
| benbaessler | `github/benbaessler/` | 23,225 | ~146 MB |
| erikveland | `github/erikveland/` | ~29K | ~2.3 GB |
| epstein-docs | `github/epstein-docs/` | ~29K | ~137 MB |
| markramm | `github/markramm/` | 2,915 | ~54 MB |
| phelix-epstein-network (FOIA extraction) | `github/phelix-epstein-network/` | ~100 | ~12 MB |
| lmsband | `github/lmsband/` | 21 | ~29 MB |
| maxandrews | `github/maxandrews/` | ~30K | ~309 MB |
| rhowardstone | `github/rhowardstone/` | ~3K | ~55 MB |
| yung-megafone | `github/yung-megafone/` | 37 | ~91 MB |
| jazivxt/epstein-files (Kaggle) | `kaggle/jazivxt/` | 26,066 | ~37.5 GB |
| linogova (Kaggle) | `kaggle/linogova/` | 28 | ~120 MB |
| elderemo-index (HuggingFace) | `huggingface/elderemo-index/` | 7 | ~3 MB |
| muneeb-emails (HuggingFace) | `huggingface/muneeb-emails/` | ~100 | ~? |
| svetfm-fbi (HuggingFace) | `huggingface/svetfm-fbi/` | 133 | ~2.4 GB |
| svetfm-nov11 (HuggingFace) | `huggingface/svetfm-nov11/` | 7 | ~341 MB |
| teyler-20k (HuggingFace) | `huggingface/teyler-20k/` | ~12 | ~? |
| Zenodo record 18512562 | `zenodo/` | 3,957 | ~4.2 GB |
| blackbook website | `websites/blackbook/` | ~? | ~? |
| epstein-exposed website | `websites/epstein-exposed/` | 1,426 | ~54 MB |
| archive.org flight logs | `websites/archive-org-flights/` | 1 | 0.2 MB |

### Manifests
| Source | Bucket Path | Files |
|--------|------------|-------|
| SHA-256 verification manifests | `_manifests/` | 33 |

---

## Hoarder Verification Status

From `python hoarder.py verify --all` (2026-02-14):

| Source | Status | Expected | Uploaded | Failed |
|--------|--------|----------|----------|--------|
| s0fskr1p | has_failures | 1,644 | 1,643 | 1 |
| svetfm/fbi | has_failures | 133 | 131 | 2 |
| svetfm/nov11 | verified | 7 | 7 | 0 |
| LMSBAND | verified | 21 | 21 | 0 |
| epstein-docs | has_failures | 29,525 | 29,522 | 3 |
| erikveland | has_failures | 33,447 | 29,341 | 4,106 |
| benbaessler | has_failures | 23,225 | 23,224 | 1 |
| epsteins-black-book | verified | 6 | 6 | 0 |
| epstein-exposed | verified | 1,426 | 1,426 | 0 |
| notesbymurk | verified | 7 | 7 | 0 |
| markramm | verified | 2,915 | 2,915 | 0 |
| jazivxt (Kaggle) | has_failures | 26,066 | 26,063 | 3 |
| linogova (Kaggle) | verified | 28 | 28 | 0 |
| archive-flights | verified | 1 | 1 | 0 |
| maxandrews | has_failures | 29,823 | 29,821 | 2 |
| yung-megafone | verified | 37 | 37 | 0 |
| elderemo-index | verified | 7 | 7 | 0 |
| zenodo | has_failures | 3,955 | 3,954 | 1 |

erikveland has 4,106 failures (largest gap). All others are 0-3 failures.

---

## Enrichment Data (from epsteininvestigation.org)

Scraped 2026-02-14. Stored at `enrichment/epsteininvestigation-org/` in Supabase.

| File | Records | Size | Description |
|------|---------|------|-------------|
| csv/entities.csv | 96 | 7 KB | Key figures with document/flight/email counts |
| csv/flights.csv | 55 | 9 KB | Enriched flight logs with passenger names, airports |
| csv/relationships.csv | 1,000 | 46 KB | Entity-to-entity connections with type + strength |
| csv/emails.csv | 21 | 3 KB | Email metadata (date, from, to, subject) |
| entities_full.jsonl | 96 | 22 KB | Full entity JSON (same as CSV but richer) |
| flights_full.jsonl | 55 | 24 KB | Full flight JSON |
| documents.jsonl | 21,880 | 12.7 MB | Document index: slug, type, source, file_url, excerpt |

### What their API did NOT expose (server-rendered only):
- 4,050 emails with full body text (only 21 metadata records via CSV)
- 886 Amazon purchase orders
- 16,407 photo metadata/classifications
- 23,540 names directory (only 96 "key" entities via API)
- Network graph data (only 1,000 relationships via CSV)

### Their document count vs ours:
- Their API returned 21,880 documents (not the 207K claimed on their site)
- This subset appears to be DS1-8 + court records (the smaller datasets)
- They may gate DS9-12 (the bulk of 2.73M pages) behind their viewer only

---

## Known Gaps / Missing Data

1. **DS9 OPT/DAT file** — Archive.org torrent only included IMAGES directory. Need complete torrent with DATA/ for document-level metadata.
2. **House Oversight Committee releases** — 33,295 DOJ pages + 20,000 estate pages hosted on Google Drive/Dropbox. Not yet downloaded.
3. **AG Bondi Phase One release** (Feb 27, 2025) — flight logs, contact books, evidence lists. May overlap with DS1-8.
4. **DOJ reading room materials** — unredacted copies available to Congress in supervised sessions, not downloadable.
5. **Treasury SARs (FinCEN)** — PETRA Act pending, not yet released.
6. **Bloomberg 18K emails** — journalism-only, not redistributable.
7. **erikveland** — 4,106 upload failures need retry.
8. **tensonaut (HuggingFace)** — needs auth token, no manifest.

---

## Sources & References

- [DOJ Press Release: 3.5M Pages](https://www.justice.gov/opa/pr/department-justice-publishes-35-million-responsive-pages-compliance-epstein-files)
- [DOJ Epstein Library](https://www.justice.gov/epstein)
- [DOJ Disclosures (12 Datasets)](https://www.justice.gov/epstein/doj-disclosures)
- [rhowardstone/Epstein-research CORPUS_INVENTORY](https://github.com/rhowardstone/Epstein-research/blob/main/methodology/CORPUS_INVENTORY.md)
- [chad-loder/efta-analysis](https://github.com/chad-loder/efta-analysis)
- [House Oversight: Epstein Records](https://oversight.house.gov/release/oversight-committee-releases-epstein-records-provided-by-the-department-of-justice/)
- [Al Jazeera: Visual Guide](https://www.aljazeera.com/news/2026/2/10/struggling-to-navigate-the-epstein-files-here-is-a-visual-guide)
