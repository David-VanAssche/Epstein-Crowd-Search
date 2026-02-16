# Council Review: Pipeline Methodology Upgrades
**Reviewer:** CodeReviewer (GPT-5.2-Codex + GPT-4.1 via OpenAI)
**Focus:** Which rhowardstone techniques to adopt, priority order, and implementation effort

## The 6 Methodology Upgrades

### Upgrade 1: OCR Text Layer Extraction (Wave 1 — High Priority)
**What:** Extract invisible text (Tr=3 rendering mode) from PDFs before running Document AI OCR.
**Why:** Many DOJ PDFs already have an OCR text layer embedded by the scanning software. Extracting this is free and instant vs. $3,250/run for Document AI.
**How:** Use PyMuPDF (`fitz`) or `pdf.js` text extraction. Check `page.get_text()` output — if non-empty and passes quality heuristics (not all garbage), use it directly.
**Effort:** 8-12 dev hours
**Savings:** ~$3,250 per full-corpus OCR run (covers ~70% of pages that already have text layers)

```python
# rhowardstone's approach (simplified)
import fitz
doc = fitz.open(pdf_path)
for page in doc:
    text = page.get_text()
    if text.strip() and not is_ocr_noise(text):
        # Use this text directly — no Document AI needed
        save_text(page_num, text, source='pdf_text_layer')
    else:
        # Queue for Document AI OCR
        queue_for_ocr(page_num)
```

### Upgrade 2: OCR Noise Filtering (Wave 1 — Critical)
**What:** Filter out ~98% of false "recovered text under redactions" that is actually OCR scanning noise.
**Why:** Without this filter, our redaction detection pipeline will flag thousands of false positives, destroying user trust.
**How:** rhowardstone's filtering heuristics:
1. Character distribution analysis (noise has unusual char frequency)
2. Word length distribution (noise produces very short or very long "words")
3. Dictionary matching (real text has recognizable English words)
4. Positional correlation (noise doesn't align with redaction geometry)
**Effort:** 6-8 dev hours
**Impact:** Prevents import of ~2.5M false redaction records

### Upgrade 3: Spatial Redaction Detection (Wave 2 — High Priority)
**What:** Detect black rectangles in PDFs using PyMuPDF geometry analysis.
**Why:** Deterministic, free, and catches redactions that LLM text analysis misses (e.g., fully blacked-out pages with no text at all).
**How:**
1. Extract all drawing operations from PDF page
2. Identify filled black rectangles above a size threshold
3. Record bounding box coordinates + page number
4. Cross-reference with text layer to identify what's under the redaction
**Effort:** 12-16 dev hours (includes coordinate mapping to our chunk system)
**Integration:** Runs as sub-step of OCR stage, before LLM processing

```python
# rhowardstone's core detection logic
for page in doc:
    drawings = page.get_drawings()
    for d in drawings:
        if (d['type'] == 'rect' and
            d['fill'] == (0, 0, 0) and  # black fill
            d['rect'].width > 20 and d['rect'].height > 8):
            record_redaction(page.number, d['rect'])
```

### Upgrade 4: Congressional Significance Scoring (Wave 2 — Medium Priority)
**What:** Score documents and entities by congressional investigation relevance.
**Why:** rhowardstone's 100+ investigation reports include a scoring system for which documents would be most useful to Congress. This helps researchers prioritize.
**How:**
1. Import scoring criteria from rhowardstone's reports
2. Add `congressional_score` (0-100) to documents table
3. Weight by: named officials (2x), financial evidence (1.5x), victim testimony (2x), travel records (1.5x)
4. Display on document cards and entity dossiers
**Effort:** 4-6 dev hours

### Upgrade 5: PLIST Metadata Extraction (Wave 3 — Low Priority)
**What:** Extract Apple PLIST metadata embedded in some DOJ documents.
**Why:** Some documents contain device metadata (creation dates, software versions, GPS coordinates) in PLIST format that reveals provenance information.
**How:** Parse PLIST binary/XML from PDF metadata streams. Extract creation date, modification date, creator software, GPS coords.
**Effort:** 4-6 dev hours
**Coverage:** Affects ~5-10% of documents (Apple-origin PDFs)

### Upgrade 6: Corrupted PDF Recovery (Wave 3 — Low Priority)
**What:** Byte-level recovery of text from corrupted/truncated PDFs.
**Why:** ~2-3% of DOJ PDFs have corruption (truncated downloads, encoding errors). rhowardstone has tools to recover partial text from these.
**How:**
1. Detect PDF parse failures during OCR
2. Fall back to raw byte stream scanning for text operators
3. Extract whatever text is recoverable
4. Flag as `metadata.partial_recovery = true`
**Effort:** 8-12 dev hours (fiddly byte-level work)
**Coverage:** ~70-80K pages potentially recoverable

## Prioritization

### Wave 1 (Do First) — Total: 14-20 dev hours
- OCR text layer extraction (8-12h) — **saves $3,250/run**
- OCR noise filtering (6-8h) — **prevents 2.5M false positives**

### Wave 2 (Do Second) — Total: 16-22 dev hours
- Spatial redaction detection (12-16h) — **deterministic, free**
- Congressional scoring (4-6h) — **high user value**

### Wave 3 (Do Later) — Total: 12-18 dev hours
- PLIST metadata extraction (4-6h) — **low coverage, nice-to-have**
- Corrupted PDF recovery (8-12h) — **fiddly, marginal benefit**

**Grand total: 42-60 dev hours across all 3 waves**

## Integration Points

| Upgrade | Pipeline Stage | Runs When |
|---------|---------------|-----------|
| OCR layer extraction | Stage 1 (OCR) | Before Document AI, always |
| Noise filtering | Stage 9 (Redaction Detect) | After spatial detection |
| Spatial redaction | Stage 1 (OCR) sub-step | During PDF processing |
| Congressional scoring | Stage 17 (Risk Score) | After all extraction complete |
| PLIST extraction | Stage 1 (OCR) sub-step | During PDF processing |
| Corrupted PDF recovery | Stage 1 (OCR) fallback | On PDF parse failure |

## Language Consideration

rhowardstone's tools are Python (PyMuPDF). Our pipeline is TypeScript. Options:
1. **Port to TypeScript** using `pdf-lib` or `pdfjs-dist` — more consistent but may miss PyMuPDF features
2. **Python microservice** — run PyMuPDF analysis as a sidecar, call from TypeScript orchestrator
3. **Batch preprocessing** — run Python scripts in batch mode, write results to Supabase, TypeScript reads them

**Recommended:** Option 3 for initial import (fast, practical), then Option 1 for ongoing pipeline integration (avoids Python dependency in production).
