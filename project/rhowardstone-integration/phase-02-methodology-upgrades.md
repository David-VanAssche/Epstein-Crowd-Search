# Phase 2: Methodology Upgrades

> **Status:** Not started
> **Estimated effort:** 42-60 hours (across 3 waves)
> **Depends on:** Phase 1 (data import — to have test data available)

## Goal

Upgrade our 17-stage document enrichment pipeline with 6 forensic techniques from rhowardstone's methodology. These techniques replace expensive LLM calls with deterministic PDF analysis where possible, saving compute costs and producing more reliable results.

## Wave 1: OCR Layer Extraction + Noise Filtering (14-20 hrs)

### 2.1 OCR Text Layer Extraction

**Modify:** `lib/pipeline/services/document-ai-ocr.ts`

**What:** Before sending a PDF page to Google Document AI ($0.0015/page), check if the PDF already has an embedded text layer. ~70% of DOJ PDFs do (from the scanning software's built-in OCR).

**Implementation:**

```typescript
// New pre-check in the OCR service
async function extractExistingTextLayer(pdfBuffer: Buffer, pageNumber: number): Promise<string | null> {
  // Use pdf-parse or pdfjs-dist to extract text
  // Check for Tr=3 (invisible text rendering mode) — this is the OCR layer
  const text = await extractText(pdfBuffer, pageNumber);

  if (!text || text.trim().length < 50) return null;

  // Quality check: is this real text or garbage?
  if (isLikelyNoise(text)) return null;

  return text;
}

// Modified OCR stage flow:
async function processOcr(document: Document): Promise<void> {
  const pdfBuffer = await downloadPdf(document.storage_path);

  for (const page of pages) {
    // Step 1: Try extracting existing text layer (FREE)
    const existingText = await extractExistingTextLayer(pdfBuffer, page.number);

    if (existingText) {
      await saveOcrText(page, existingText, 'pdf_text_layer');
      continue; // Skip Document AI for this page
    }

    // Step 2: Fall back to Document AI (paid)
    const ocrText = await callDocumentAI(pdfBuffer, page.number);
    await saveOcrText(page, ocrText, 'document_ai');
  }
}
```

**Cost savings:** ~$3,250 per full-corpus OCR run (70% of 2.73M pages at $0.0015/page = $2,866 saved, plus API call overhead).

**Library options:**
- `pdfjs-dist` (Mozilla's PDF.js for Node) — already used by many Next.js projects, good TypeScript support
- `pdf-parse` — simpler API but less control over rendering modes
- **Recommended:** `pdfjs-dist` for its ability to detect text rendering modes

### 2.2 OCR Noise Filtering

**New file:** `lib/pipeline/services/noise-filter.ts`

**What:** Filter out OCR scanning artifacts that appear as invisible text in PDFs. Without this, ~98% of "recovered text under redactions" is garbage.

**Heuristics (from rhowardstone's methodology):**

```typescript
export function isLikelyOcrNoise(text: string): boolean {
  if (!text || text.length < 3) return true;

  // 1. Alphabetic character ratio
  const alpha = text.replace(/[^a-zA-Z]/g, '').length;
  if (alpha / text.length < 0.3) return true;

  // 2. Average word length (real English: 4-6 chars)
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
  if (avgLen < 2 || avgLen > 15) return true;

  // 3. Repeated character runs (noise often has "aaaa", "////")
  if (/(.)\1{4,}/.test(text)) return true;

  // 4. Dictionary word ratio (check against common English words)
  // Use a 10K most-common-words list, case-insensitive
  const knownCount = words.filter(w => COMMON_WORDS.has(w.toLowerCase())).length;
  if (knownCount / words.length < 0.15) return true;

  // 5. Excessive non-ASCII (noise from encoding issues)
  const nonAscii = text.replace(/[\x20-\x7E]/g, '').length;
  if (nonAscii / text.length > 0.2) return true;

  return false;
}
```

**Integration:** Used by:
- OCR stage (2.1) for text layer quality check
- Redaction detection stage (Wave 2) for recovered text validation
- Data import scripts (Phase 1) for rhowardstone redaction filtering

## Wave 2: Spatial Redaction Detection + Congressional Scoring (16-22 hrs)

### 2.3 Spatial Redaction Detection

**New file:** `lib/pipeline/services/spatial-redaction-detector.ts`

**What:** Detect black rectangles in PDFs using geometry analysis. This is deterministic, free, and catches redactions that text-based LLM analysis misses entirely (e.g., fully blacked-out pages).

**Implementation approach:**

Since our pipeline is TypeScript, we have two options:
1. **TypeScript with `pdfjs-dist`** — can detect filled rectangles via the operator list
2. **Python batch preprocessing** — use PyMuPDF (fitz) which has native drawing detection

**Recommended:** Python batch preprocessing for initial corpus scan, TypeScript integration for ongoing pipeline.

**Python batch script:** `scripts/batch/detect-spatial-redactions.py`
```python
import fitz  # PyMuPDF
import json

def detect_redactions(pdf_path):
    doc = fitz.open(pdf_path)
    redactions = []

    for page_num, page in enumerate(doc):
        drawings = page.get_drawings()
        for d in drawings:
            # Black filled rectangle, minimum size threshold
            if (d.get('fill') == (0, 0, 0) and
                d['rect'].width > 20 and
                d['rect'].height > 8):
                redactions.append({
                    'page': page_num,
                    'x0': d['rect'].x0,
                    'y0': d['rect'].y0,
                    'x1': d['rect'].x1,
                    'y1': d['rect'].y1,
                    'width': d['rect'].width,
                    'height': d['rect'].height,
                    'area': d['rect'].width * d['rect'].height,
                    'method': 'spatial',
                    'confidence': 0.95,
                })

    return redactions
```

**TypeScript integration:** `lib/pipeline/services/spatial-redaction-detector.ts`
```typescript
// For ongoing pipeline processing, detect spatial redactions during OCR stage
// Uses pdfjs-dist operator list to find filled black rectangles
export async function detectSpatialRedactions(
  pdfBuffer: Buffer,
  pageNumber: number
): Promise<SpatialRedaction[]>
```

**Pipeline integration:** Runs as sub-step of Stage 1 (OCR), storing results in `documents.metadata.spatial_redactions`. The existing LLM-based Stage 9 (Redaction Detect) becomes a supplementary check that:
1. Validates spatial redactions with text context
2. Catches non-spatial redaction types (whiteouts, over-stamps, strike-throughs)
3. Merges spatial + LLM results with confidence weighting

### 2.4 Congressional Significance Scoring

**Modify:** `lib/pipeline/services/risk-scorer.ts`

**What:** Add a congressional relevance score (0-100) alongside the existing criminal risk score. This helps researchers and congressional staffers prioritize which documents to review.

**Scoring factors:**
```typescript
function computeCongressionalScore(document: Document, entities: Entity[]): number {
  let score = 0;

  // Named government officials mentioned (+20 per official, max 40)
  const officials = entities.filter(e => e.metadata?.role === 'government_official');
  score += Math.min(officials.length * 20, 40);

  // Financial evidence present (+15)
  if (document.classification_tags?.some(t => FINANCIAL_TYPES.includes(t))) score += 15;

  // Victim testimony (+20)
  if (['deposition', 'witness_statement'].includes(document.classification)) score += 20;

  // Travel records with specific locations (+10)
  if (document.classification === 'flight_log') score += 10;

  // Cross-referenced in investigation reports (+15)
  if (document.metadata?.referenced_in_reports?.length > 0) score += 15;

  // Multiple entity mentions (+5 per entity, max 15)
  score += Math.min(entities.length * 5, 15);

  return Math.min(score, 100);
}
```

**Migration:** Add `congressional_score INT` column to `documents` table.

## Wave 3: PLIST + Corrupted PDF Recovery (12-18 hrs)

### 2.5 PLIST Metadata Extraction

**New file:** `lib/pipeline/services/plist-extractor.ts`

**What:** Extract Apple PLIST metadata embedded in PDF metadata streams. Reveals device info, creation timestamps, GPS coordinates, and software versions.

**Coverage:** ~5-10% of documents (Apple-origin PDFs)

**Implementation:**
```typescript
// Extract PLIST from PDF metadata stream
// Apple devices embed creation metadata that can reveal:
// - Device type (iPhone, iPad, Mac)
// - Creation timestamp (more precise than PDF creation date)
// - GPS coordinates (if location services were on)
// - Software version (which iOS/macOS version)
export async function extractPlistMetadata(pdfBuffer: Buffer): Promise<PlistMetadata | null>
```

**Pipeline integration:** Runs during Stage 1 (OCR) as optional sub-step. Results stored in `documents.metadata.plist`.

### 2.6 Corrupted PDF Recovery

**New file:** `lib/pipeline/services/pdf-recovery.ts`

**What:** Byte-level text recovery from corrupted or truncated PDFs that fail normal parsing.

**Coverage:** ~2-3% of documents (~70-80K pages)

**Implementation:**
```typescript
// When normal PDF parsing fails, attempt byte-level recovery
// Scans raw PDF stream for text operators (Tj, TJ, ', ")
// Extracts whatever text is recoverable
export async function recoverCorruptedPdf(
  pdfBuffer: Buffer
): Promise<{ text: string; recoveryRate: number; errors: string[] }>
```

**Pipeline integration:** Activated as fallback when OCR stage encounters a PDF parse error. Results marked with `metadata.partial_recovery = true` and `metadata.recovery_rate = 0.X`.

## Language Strategy

| Component | Language | Rationale |
|-----------|----------|-----------|
| OCR text extraction | TypeScript (pdfjs-dist) | Consistent with pipeline |
| Noise filtering | TypeScript | Pure logic, no PDF dependency |
| Spatial redaction (batch) | Python (PyMuPDF) | Best library for drawing detection |
| Spatial redaction (live) | TypeScript (pdfjs-dist) | Pipeline consistency |
| Congressional scoring | TypeScript | Pure scoring logic |
| PLIST extraction | TypeScript (plist npm package) | Small dependency |
| PDF recovery | TypeScript | Byte-level operations |

**Python dependency:** Only the batch spatial redaction script requires Python. Install `pymupdf` in the GCP VM venv. The TypeScript pipeline uses `pdfjs-dist` for live processing.

## Checklist

### Wave 1
- [ ] 2.1 OCR text layer extraction implemented in document-ai-ocr.ts
- [ ] 2.1 pdfjs-dist added as dependency
- [ ] 2.2 Noise filter module created and tested
- [ ] 2.2 Unit tests with known noise samples vs. real text
- [ ] Wave 1 integration test: process 10 documents end-to-end

### Wave 2
- [ ] 2.3 Python spatial redaction batch script created
- [ ] 2.3 TypeScript spatial redaction detector for live pipeline
- [ ] 2.3 Redaction detection stage updated to merge spatial + LLM results
- [ ] 2.4 Congressional scoring function implemented
- [ ] 2.4 Migration: `congressional_score` column on documents
- [ ] Wave 2 integration test: verify spatial redactions match known redacted pages

### Wave 3
- [ ] 2.5 PLIST extractor created and tested
- [ ] 2.6 PDF recovery module created and tested
- [ ] 2.6 Fallback wiring in OCR stage
- [ ] Wave 3 integration test: recover text from 5 known-corrupted PDFs
