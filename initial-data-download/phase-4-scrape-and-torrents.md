# Phase 4: Scraped PDFs + Torrent Datasets

**Time:** ~3-7 days
**Run on:** Cloud VM with 150GB SSD
**Cost:** ~$9 (VM + SSD time)
**Prerequisites:** Phase 3 complete
**Result:** Datasets 9-11 (~200GB) + House Oversight PDFs uploaded

## Tasks

### Scraping (zero local disk)
- [ ] 4.1: Implement PDF scraper (`pdf_scraper.py`)
- [ ] 4.2: Scrape Dataset 9 PDF URLs from DOJ listing pages
- [ ] 4.3: Download + upload Dataset 9 PDFs to Supabase
- [ ] 4.4: Scrape + upload Dataset 11 PDFs

### Torrents (temp disk required)
- [ ] 4.5: Implement torrent handler (`torrent_handler.py`)
- [ ] 4.6: Download Dataset 9 via torrent → upload → delete local
- [ ] 4.7: Download Dataset 10 via torrent → upload → delete local
- [ ] 4.8: Download Dataset 11 via torrent → upload → delete local

### House Oversight
- [ ] 4.9: Download House Oversight PDFs from Google Drive/Dropbox → upload

### Cleanup
- [ ] 4.10: Verify all uploads
- [ ] 4.11: Delete cloud VM

---

### 4.1: PDF Scraper Implementation

Scrapes DOJ listing pages to enumerate individual PDF URLs:
- Base URL: `https://www.justice.gov/epstein/doj-disclosures/data-set-{N}-files`
- Regex: `href="(/epstein/files/DataSet%20{N}/[^"]+\.pdf)"`
- Pagination: sequential pages until 3 consecutive empty pages
- Rate limiting: 0.5s between requests, 5 concurrent downloads max
- Cookie: `justiceGovAgeVerified=true`

Phase 1: Enumerate URLs → save manifest JSON (only local file)
Phase 2: Async download each PDF to memory → upload to Supabase

### 4.5: Torrent Handler Implementation

For datasets only available via torrent (or faster via torrent):
```
aria2c magnet_link --dir=/mnt/temp/dataset-N --seed-time=0 --max-connection-per-server=16
```

Polling loop watches for completed PDFs:
1. Detect new `.pdf` files in temp directory
2. Upload each to Supabase Storage
3. Delete local copy immediately after upload
4. Minimizes peak disk usage

Magnet links from `yung-megafone/Epstein-Files` repo (verified with checksums).

### Note on Datasets 9-11 Overlap

Datasets 9 and 11 are available via BOTH scraping and torrent. Strategy:
- Try scraping first (zero disk needed)
- Fall back to torrent if scraping is too slow or DOJ blocks
- Dataset 10 is torrent-only (~82GB)

## Acceptance Criteria

- [ ] All 12 DOJ datasets in Supabase Storage
- [ ] House Oversight PDFs in Supabase Storage
- [ ] Documents table fully populated
- [ ] Cloud VM deleted (no ongoing cost)
- [ ] Total storage: ~206GB DOJ + House Oversight PDFs
