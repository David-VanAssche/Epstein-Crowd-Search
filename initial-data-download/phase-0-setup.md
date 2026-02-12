# Phase 0: Setup

**Time:** ~30 minutes
**Run on:** Local machine
**Cost:** $25/mo Supabase Pro subscription
**Prerequisites:** Supabase account, Google Cloud account

## Tasks

- [ ] 0.1: Upgrade Supabase to Pro tier
- [ ] 0.2: Create storage buckets
- [ ] 0.3: Run database migrations
- [ ] 0.4: Configure environment variables
- [ ] 0.5: Seed reference tables
- [ ] 0.6: Create Python upload tool scaffold

---

### 0.1: Upgrade Supabase to Pro Tier

Go to Supabase Dashboard → Settings → Billing → Upgrade to Pro ($25/mo).

Required for:
- 100GB included storage (250GB total needed, ~$3/mo overage)
- 500MB max file size (needed for large PDFs)
- No project pausing after inactivity

### 0.2: Create Storage Buckets

Create three buckets in Supabase Dashboard → Storage:

| Bucket | Public | Purpose |
|--------|--------|---------|
| `documents` | No | Raw PDFs from DOJ + House Oversight |
| `ocr-text` | No | Pre-extracted text files |
| `entities` | No | Entity JSON per document |

Path conventions:
```
documents/doj/dataset-{1..12}/{filename}.pdf
documents/house-oversight/estate/{filename}.pdf
documents/house-oversight/birthday-book/{filename}.pdf
ocr-text/doj/dataset-{1..12}/{filename}.txt
ocr-text/house-oversight/{filename}.txt
entities/by-document/{doc_id}.json
```

### 0.3: Run Database Migrations

Create these tables (extending the schema from `epstein-archive-scaffold-prompt.md`):

**Migration: `data_sources` table**
```sql
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,       -- 'github' | 'huggingface' | 'kaggle' | 'website'
  url TEXT NOT NULL,
  data_type TEXT NOT NULL,         -- 'ocr_text' | 'embeddings' | 'entities' | 'structured' | 'raw_pdf'
  coverage TEXT,                   -- 'DOJ datasets 1-12' | 'House Oversight' | etc.
  record_count INT,
  ingested_count INT DEFAULT 0,
  ingested_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',   -- 'pending' | 'in_progress' | 'ingested' | 'failed'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Migration: Add tracking columns to `documents` table**
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_source TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_text_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_source TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INT DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS entity_count INT DEFAULT 0;
```

`ocr_source` values: `null` (not OCR'd), `'s0fskr1p'`, `'epstein-docs'`, `'tensonaut'`, `'pipeline'`
`embedding_source` values: `null` (not embedded), `'svetfm'`, `'pipeline'`

### 0.4: Configure Environment Variables

Create `.env` in project root:
```
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these at: Supabase Dashboard → Settings → API

### 0.5: Seed Reference Tables

Seed `datasets` table with 13 entries (12 DOJ + 1 House Oversight).
Seed `data_sources` table with all 24 sources from `data-sources.md`.

### 0.6: Create Python Upload Tool Scaffold

Create the CLI tool structure at `scripts/doj_uploader/`. See `architecture.md` for full file layout and dependencies.

## Acceptance Criteria

- [ ] Supabase Pro tier active
- [ ] 3 storage buckets created with correct names
- [ ] `data_sources` table exists with 24 rows
- [ ] `documents` table has new tracking columns
- [ ] `.env` configured and tested (can connect to Supabase)
- [ ] `python scripts/upload-to-supabase.py status` runs without error
