# Media Data Sources Investigation

**Date:** 2026-02-12
**Status:** No community-processed media data exists. All media must be processed from raw DOJ files.

---

## Executive Summary

After searching GitHub, HuggingFace, Kaggle, Archive.org, DocumentCloud, and the broader web, **no community project has published processed media data** (transcriptions, image classifications, face detection results, or embeddings) for the Epstein DOJ files. The raw media exists in DOJ Datasets 8 and 10, but nobody has run Whisper, image classifiers, or face detection on any of it.

The "180,000 images" figure is misleading — most are scanned document pages embedded in PDFs. The actual evidence photos needing classification are likely **10,000–20,000**. The "2,000 videos" splits into ~400 prison CCTV clips (no audio) and ~1,600 seized personal videos (~14 hours with audio).

---

## Discovered Media Sources

### Raw Media (Unprocessed)

| Source | Type | Count/Size | Format | Dataset | Access | Processing Done |
|--------|------|-----------|--------|---------|--------|----------------|
| DOJ Dataset 8 | Prison CCTV video | ~400 one-hour clips, 10.67 GB | MP4 (WebM on Wikimedia) | DS 8 | justice.gov | **None** |
| DOJ Dataset 10 | Seized images | ~180,000 files within 78.6 GB | Images embedded in 47 PDFs, 96 DPI | DS 10 | Torrent only (removed from DOJ site) | **None** |
| DOJ Dataset 10 | Seized video | ~1,600 clips (~14 hrs unique) | MP4 | DS 10 | Torrent only | **None** |
| DOJ Dataset 9 | Email attachments + native media | ~1,832 native media files (1,530 AVI, 195 MP4, 68 M4A, 12 M4V, 10 WAV, 8 VOB, 7 MOV) | Mixed | DS 9 | justice.gov (partial) | **None** |
| Wikimedia Commons | MCC CCTV concatenation | 10 hrs, WebM | WebM | DS 8 | Public | Concatenated only |
| Zenodo (18512562) | IMAGES.zip archive | Unknown size | ZIP | Mixed | Public | **None** |

### Partial/Reference Sources (No Downloadable Media)

| Source | What Exists | Why Not Usable |
|--------|------------|----------------|
| ErikVeland/epstein-archive (epstein.academy) | 500+ media files with transcript segments, albums, thumbnails | Media binaries are server-side only; `.gitignore` excludes all media dirs |
| The Free Press "Epstein Tapes" | Editorial compilation of all 14 hrs DS 10 video | Paywalled streaming; no downloadable files or transcripts |
| furcalor/epstein | 29.7 GB repo with JPGs extracted from PDFs (8 volumes) | Page-to-JPG conversion only; no classification, tagging, or OCR |
| HarleyCoops/TrumpEpsteinFiles | 1,455 House Oversight images analyzed with Gemini 3.0 Flash | House Oversight only (not DS 8/10); small subset; entity extraction only |
| DocumentCloud | Deposition transcripts (text) | Document-only platform; no audio/video despite depositions being videotaped |
| SEC.gov | Epstein deposition transcript with exhibit photos | PDF only; no audio/video |
| FBI Vault | 22-part FOIA release | Document scans only |

### Confirmed Non-Existent

| What We Looked For | Result |
|-------------------|--------|
| Whisper transcriptions of DOJ videos | **Does not exist anywhere** |
| Image classification/tagging of 180K images | **Does not exist anywhere** |
| Face detection on Epstein evidence photos | **Does not exist anywhere** |
| Maxwell trial audio | **Never recorded** (federal proceeding, not broadcast) |
| Deposition video recordings | **Not released**; only written transcripts public |
| HuggingFace datasets with image/media data | **None** — all 5 known datasets are text-only |
| Kaggle datasets with image/media data | **None** — both known datasets are text/CSV only |
| Kaggle notebooks processing Epstein media | **None exist** |

---

## Technical Details of DOJ Media

### The 180,000 Images (Dataset 10)

**Critical finding:** The DOJ delivered everything as PDFs. The 180,000 images are **embedded as pages within 47 large PDF files** (named `EFTA01262782.pdf` through `EFTA01264397.pdf`), not as standalone image files.

**Image specifications** (per PDF Association forensic analysis):
- Resolution: 96 DPI (769 x 1152 or 1152 x 769 pixels)
- No JPEG (DCTDecode) filters despite visible JPEG artifacts
- Redactions baked into pixel data (not PDF overlay objects)
- Unusually low resolution makes text on objects in photos difficult to read

**Estimated content breakdown:**

| Category | Est. Count | Needs Classification? | Needs Face Detection? | Priority |
|----------|-----------|----------------------|----------------------|----------|
| Scanned document pages | ~160,000+ | No (already have OCR text) | No | Low (re-OCR at higher quality is the win) |
| FBI property photos | ~3,000–5,000 | Yes (room ID, object detection) | Minimal (mostly empty rooms) | Medium |
| Personal/social photos | ~1,000–3,000 | Yes (event type, setting) | **Yes — critical** | **High** |
| Evidence photos from devices | ~5,000–10,000 | Yes (content classification) | Yes (but heavily redacted) | High (limited by redactions) |
| Photo contact sheets | Small | Yes (need splitting first) | Yes after splitting | Medium |

**Key implication:** Only ~10,000–20,000 images actually need image AI processing. The rest are document scans better served by re-OCR.

### The ~2,400 Videos (Datasets 8 + 10)

#### Dataset 8: Prison CCTV (~400 clips)

- **Content:** MCC surveillance cameras — hallways, cell block, elevator bank, desk area
- **Coverage:** July 5 – August 11, 2019 (non-sequential)
- **Breakdown:** 188 clips from "10 South" camera, 26 from elevator bank, 3 from desk area, 1 from "J tier" (2:23)
- **Audio:** None (CCTV)
- **Notable:** CBS News + UC Berkeley's Hany Farid found metadata anomalies; footage from cameras DOJ said were "not recording"
- **Processing need:** Frame extraction, motion detection, anomaly detection — NOT audio transcription

#### Dataset 10: Seized Personal Media (~1,600 clips)

- **Content:** Personal recordings, footage from others, downloads, drone footage of private island, Steve Bannon interview
- **Duration:** ~14 hours unique footage
- **Redactions:** Every female treated as victim; faces/bodies hidden with black boxes. Males unredacted unless linked to female subject.
- **Processing need:** Audio transcription (Whisper), face detection (males only, due to redactions), scene classification

#### Dataset 9: Native Media Files (~1,832 files)

Per yung-megafone inventory of Dataset 9 non-PDF files:

| Extension | Count |
|-----------|-------|
| .avi | 1,530 |
| .mp4 | 195 |
| .m4a | 68 |
| .m4v | 12 |
| .wav | 10 |
| .vob | 8 |
| .mov | 7 |
| .ts | 2 |
| **Total** | **1,832** |

1,983 of ~2,542 expected native files confirmed downloadable from DOJ.

---

## Recommended Next Steps

### Phase A: Image Processing Pipeline

**Step 1: Acquire extracted images (cost: $0, time: ~4 hrs)**
- Download the community-structured torrent (206 GB) from yung-megafone which has already extracted media from PDFs into separate folders
- Alternatively, extract images from the 47 DS 10 PDFs yourself using PyMuPDF (fitz)
- Magnet: `magnet:?xt=urn:btih:f5cbe5026b1f86617c520d0a9cd610d6254cbe85`

**Step 2: Triage images — separate document scans from evidence photos (cost: ~$5–15, time: ~2 hrs)**
- Run a cheap classifier (CLIP or Gemini Flash) on a sample of 1,000 images to determine the document-scan vs. evidence-photo ratio
- Use image dimensions + file size heuristics: document scans are uniform 769x1152 at 96 DPI; photos have varied dimensions
- This determines whether we need to process 180K images or 15K

**Step 3: Classify evidence photos (cost: ~$20–50 for 15K images, time: ~6 hrs)**
- Use Gemini 2.0 Flash ($0.10/1M input tokens) or local LLaVA for image descriptions
- Generate: `description` text, classification tags, `is_redacted` flag
- Store in `images` table: `description`, `ocr_text` (if text visible in photo)

**Step 4: Generate embeddings (cost: ~$2–5 for 15K images, time: ~2 hrs)**
- Visual embeddings: Amazon Nova Multimodal Embeddings v1 (1024d) → `visual_embedding` column
- Nova embeds image pixels directly into the same 1024d space as text — no separate description embedding needed
- A text query like "beach house" matches image pixels via cosine similarity in the unified space

**Step 5: Face detection (cost: ~$10–30, time: ~4 hrs)**
- Run face detection on the ~3,000–5,000 personal/social photos
- Use Google Cloud Vision API or open-source InsightFace
- Store face crops and bounding boxes in `images.metadata` JSONB
- Cross-reference detected faces against known entity photos

**Recommended tool: PyMuPDF (fitz) for PDF image extraction**
- `fitz` extracts embedded images without re-encoding (lossless)
- `pdf2image` (poppler) renders pages as images (lossy, slower, but preserves layout)
- For evidence photos embedded in PDFs: use `fitz` to extract the raw image objects
- For document page scans: use `pdf2image` if you want the full rendered page

### Phase B: Video/Audio Transcription Pipeline

**Step 1: Download videos (cost: $0, time: ~12 hrs for 89 GB)**
- DS 8 (10.67 GB): Available at justice.gov
- DS 10 videos (~70 GB estimated): Torrent only
- DS 9 native media (~1,832 files): Available at justice.gov (partially)

**Step 2: Transcribe Dataset 10 videos with Whisper (cost: $0–50, time: ~4–8 hrs)**
- **Local Whisper (free):** `whisper-large-v3` on GPU — ~14 hrs of audio in ~2–4 hrs on RTX 3090
- **Whisper API ($0.006/min):** 14 hrs × 60 min × $0.006 = **~$5**
- **Deepgram/AssemblyAI:** Similar pricing, better speaker diarization
- Output: transcript text with timestamps → maps to `video_chunks.content`, `timestamp_start`, `timestamp_end`

**Step 3: Speaker diarization (cost: $0–10, time: ~2 hrs)**
- Use `pyannote-audio` (free, local) or AssemblyAI (paid) for speaker identification
- Maps to `video_chunks` — currently no `speaker_label` column but schema mentions it in the prompt
- **Schema gap:** `video_chunks` table has no `speaker_label` column — needs migration

**Step 4: Transcribe Dataset 9 audio files (cost: ~$3, time: ~2 hrs)**
- 68 M4A + 10 WAV + other audio = estimated 5–10 hrs of audio
- Same Whisper pipeline as Step 2

**Step 5: Dataset 8 CCTV frame analysis (cost: ~$20–50, time: ~8 hrs)**
- No audio to transcribe — these are silent CCTV
- Extract keyframes at 1 fps or on motion detection
- Run person detection + tracking (YOLO or similar)
- Flag anomalies: timestamp gaps, camera switches, unexpected movement
- This is specialized work that could be a Phase 5+ task

**Recommended approach: Local Whisper**
- Cost: $0 (requires GPU)
- Quality: whisper-large-v3 is excellent for English
- Speaker diarization: Add pyannote-audio post-processing
- Output format: JSON with word-level timestamps, easily mapped to `video_chunks`

### Phase C: Synthetic Test Data (for immediate UI testing)

Since no real processed media data exists, create synthetic test data to unblock Photo Gallery and Audio Player development:

**Synthetic images (~30 min):**
1. Generate 50 placeholder images with stable-diffusion or use stock photos
2. Create realistic `images` table rows with mock `description`, `visual_embedding`
3. Use random 1024d vectors for embeddings (search won't work but UI will render)

**Synthetic video transcripts (~30 min):**
1. Create 10 mock `videos` rows with realistic metadata
2. Generate 50 `video_chunks` rows with sample transcript text, timestamps
3. Use random 1024d vectors for `content_embedding`

**Synthetic audio (~30 min):**
1. Use TTS to generate 5 short audio clips from real deposition transcript text
2. Store in Supabase Storage
3. Create corresponding `video_chunks` rows (or audio_chunks if that table exists)

This lets the Photo Gallery and Audio Player components be fully tested while real data processing is underway.

---

## Cost/Time Summary

| Task | Cost | Time | Prerequisite |
|------|------|------|-------------|
| Download structured torrent (206 GB) | $0 | ~12 hrs | Bandwidth + storage |
| Triage 180K images (classify doc-scan vs photo) | $5–15 | 2 hrs | Extracted images |
| Classify ~15K evidence photos | $20–50 | 6 hrs | Triage complete |
| Generate image embeddings (15K) | $2–5 | 2 hrs | Classifications |
| Face detection on ~5K photos | $10–30 | 4 hrs | Classified photos |
| Transcribe DS 10 videos (14 hrs audio) | $0–5 | 4 hrs | Downloaded videos + GPU |
| Transcribe DS 9 audio (~10 hrs) | $0–3 | 2 hrs | Downloaded audio + GPU |
| Speaker diarization | $0–10 | 2 hrs | Transcripts |
| Synthetic test data | $0 | 1.5 hrs | None |
| **Total** | **$37–118** | **~36 hrs** | |

---

## Sources to Add to phase-1-community-data.md

None of the media sources qualify for Phase 1 (community-processed data ready to ingest). All media requires original processing. However, the following should be added to `data-sources.md`:

### New entries for data-sources.md Tier 3 (Raw)

| # | Source | What | Size | Notes |
|---|--------|------|------|-------|
| 25 | **DOJ Dataset 9 native media** | 1,832 AVI/MP4/M4A/WAV/MOV files from email evidence | ~143 GB (full DS 9) | Partially downloadable from DOJ; inventoried by yung-megafone |
| 26 | **Wikimedia Commons CCTV** | 10-hr concatenated MCC cell block footage | WebM | Free, public, no transcription needed (silent CCTV) |
| 27 | **Zenodo IMAGES.zip** (record 18512562) | Image archive (may overlap with DS 10) | Unknown | Needs verification of contents vs DOJ originals |
| 28 | **theelderemo/FULL_EPSTEIN_INDEX** (Google Drive) | References Maxwell Proffer audio + BOP video | Unknown | External hosting; needs verification |

### Update to Known Processing Gaps table

| Gap | Scale | Status | Revised Assessment |
|-----|-------|--------|--------------------|
| **DOJ videos** | ~2,400 across DS 8, 9, 10 | Nobody has transcribed | Only ~14 hrs (DS 10) need Whisper; DS 8 is silent CCTV; DS 9 has 1,832 native media files |
| **Images** | ~180K in DS 10 | No classification/tagging | ~160K are document scans (need re-OCR not image AI); ~15K–20K are evidence photos needing classification |
| **DS 9 media inventory** | 1,832 native files | Not previously documented | yung-megafone has full CSV inventory; 1,983 of 2,542 expected files confirmed downloadable |

---

## Schema Issues Identified

1. ~~**`description_embedding` dimension mismatch**~~ **RESOLVED:** Column dropped. All embeddings now use Amazon Nova Multimodal Embeddings v1 (1024d unified space). Nova embeds image pixels directly into `visual_embedding VECTOR(1024)` — same space as text, so no separate description embedding is needed.

2. ~~**No `speaker_label` column on `video_chunks`**~~ **RESOLVED:** `speaker_label TEXT` added to `video_chunks` table.

3. **`audio_chunks` table exists:** Schema includes `audio_files` and `audio_chunks` tables (migration 00018) with `speaker_label TEXT` and `content_embedding VECTOR(1024)`.

4. ~~**No `media_type` discriminator on `videos` table**~~ **RESOLVED:** `media_type TEXT CHECK (media_type IN ('video', 'audio', 'cctv'))` added to `videos` table.

---

## Key GitHub Repos Discovered (Not Previously in data-sources.md)

| Repo | Value | Action |
|------|-------|--------|
| **furcalor/epstein** (29.7 GB) | JPGs extracted from PDFs for 8 volumes | Low priority — page-to-JPG conversion only, no AI processing |
| **yung-megafone/Epstein-Files** | DS 9 native media inventory CSV, torrent coordination | **Add to data-sources.md** — critical for media planning |
| **HarleyCoops/TrumpEpsteinFiles** | Gemini Flash analysis of 1,455 House Oversight images | Niche; entity extraction only, not DS 8/10 media |
| **theelderemo/FULL_EPSTEIN_INDEX** | References Maxwell Proffer audio + BOP video on Google Drive | **Investigate** — may contain unique audio not in DOJ release |
| **chad-loder/efta-analysis** | PDF forensic analysis of DOJ files (96 DPI finding, redaction analysis) | Reference only — no processed data |
| **msieurgavroche/epipen-distributed** | Distributed GitHub Actions processing grid | Could be adapted for distributed Whisper transcription |
