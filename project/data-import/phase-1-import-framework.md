# Phase 1: Import Framework

Build shared utilities that all import scripts depend on. Create once, reuse everywhere.

## 1A. `scripts/import/lib/import-utils.ts`

Shared utilities for all importers.

### Functions to implement

```typescript
// Re-export admin client from existing code
// IMPORTANT: Scripts run via `npx tsx` — @/ path aliases don't work outside Next.js.
// All imports MUST use relative paths.
import { createAdminClient } from '../../../lib/supabase/admin'
export { createAdminClient }

// Normalize entity names for dedup against UNIQUE(name_normalized, entity_type)
export function normalizeEntityName(name: string, type: string): string
// - Lowercase
// - Strip titles: Mr., Mrs., Ms., Dr., Prof., Sir, Lady, Lord, Hon., Rev.
// - Collapse multiple spaces/tabs to single space
// - Trim
// - For persons: "Last, First" → "first last"

// Find or create a document (upsert pattern)
export async function findOrCreateDocument(
  supabase: SupabaseClient,
  opts: {
    filename: string
    datasetId?: string
    ocrText?: string
    ocrSource?: string
    storagePath?: string
    classification?: string
    fileType?: string
    fileSizeBytes?: number
    pageCount?: number
    processingStatus?: string
    metadata?: Record<string, unknown>
  }
): Promise<string>  // returns document ID
// Uses filename + dataset_id as natural key
// If exists: update ocr_text if better source, merge metadata
// If new: insert

// Batch insert with chunking and error handling
export async function batchInsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  batchSize?: number  // default 100
): Promise<{ inserted: number; failed: number }>

// Update data_sources status
export async function updateSourceStatus(
  supabase: SupabaseClient,
  sourceName: string,
  status: string,
  counts?: { ingested?: number; failed?: number; error?: string }
): Promise<void>

// Progress logger with ETA
export class ProgressTracker {
  constructor(total: number, label: string)
  tick(count?: number): void  // logs every 100 items or 10 seconds
  done(): void
}

// Parse CLI args (consistent across all scripts)
export function parseImportArgs(): {
  limit?: number
  dryRun: boolean
  force: boolean  // re-import even if already done
}
```

### Reuses existing code

- `lib/supabase/admin.ts` → `createAdminClient()` (line 5-16)
- `lib/pipeline/batch-runner.ts` → `getDefaultConfig()` for env parsing (line 123-131)

## 1B. `scripts/import/lib/storage-reader.ts`

Helpers to interact with Supabase Storage's `raw-archive` bucket.

### Functions to implement

```typescript
// List all files in a source directory (handles pagination)
export async function listSourceFiles(
  supabase: SupabaseClient,
  type: string,   // 'github' | 'huggingface' | 'kaggle' | etc.
  source: string  // 's0fskr1p' | 'benbaessler' | etc.
): Promise<Array<{ name: string; size: number; created_at: string }>>
// Uses supabase.storage.from('raw-archive').list(`${type}/${source}`)
// Handles pagination (Supabase returns max 100 per page by default)

// Download a file as text
export async function downloadText(
  supabase: SupabaseClient,
  path: string
): Promise<string>
// Uses supabase.storage.from('raw-archive').download(path)

// Download a file as Buffer
export async function downloadBuffer(
  supabase: SupabaseClient,
  path: string
): Promise<Buffer>

// Read and parse a manifest file
export async function readManifest(
  supabase: SupabaseClient,
  source: string
): Promise<{
  source: string
  files: Array<{ path: string; sha256: string; size: number }>
  totalFiles: number
  totalSize: number
}>
// Reads from raw-archive/_manifests/{source}.json
```

### Key implementation notes

- **Pagination required**: Supabase Storage `.list()` returns max 1000 files per call. Sources like `kaggle-jazivxt` (26K files) and `maxandrews` (29K files) MUST use offset-based pagination:
  ```typescript
  let offset = 0
  const allFiles: FileObject[] = []
  while (true) {
    const { data } = await supabase.storage.from('raw-archive').list(path, { limit: 1000, offset })
    if (!data || data.length === 0) break
    allFiles.push(...data)
    offset += data.length
    if (data.length < 1000) break
  }
  ```
- Some sources have deeply nested folders — need recursive listing
- Manifest files may have UTF-8 encoding issues (erikveland manifest has non-UTF-8 bytes)
- Download large files as streams, not full buffers, when processing line-by-line

## 1C. CLI Runner Pattern

All import scripts follow this pattern:

```typescript
#!/usr/bin/env npx tsx
// scripts/import/import-{source}.ts
//
// NOTE: `tsx` v4+ auto-loads .env files, so `import 'dotenv/config'` is optional.
// Keep it as a fallback if needed, but `dotenv` is not a required dependency.
//
// IMPORTANT: Use relative imports — @/ aliases don't work outside Next.js.
import { createAdminClient, parseImportArgs, ProgressTracker, updateSourceStatus } from './lib/import-utils'
import { listSourceFiles, downloadText } from './lib/storage-reader'

const SOURCE_NAME = '{source}'
const SOURCE_TYPE = '{github|huggingface|kaggle}'

async function main() {
  const args = parseImportArgs()
  const supabase = createAdminClient()

  console.log(`[Import:${SOURCE_NAME}] Starting...`)
  if (args.dryRun) console.log('[DRY RUN]')

  await updateSourceStatus(supabase, SOURCE_NAME, 'in_progress')

  try {
    const files = await listSourceFiles(supabase, SOURCE_TYPE, SOURCE_NAME)
    const progress = new ProgressTracker(
      args.limit ? Math.min(files.length, args.limit) : files.length,
      SOURCE_NAME
    )

    // ... source-specific import logic ...

    await updateSourceStatus(supabase, SOURCE_NAME, 'ingested', {
      ingested: progress.count
    })
    progress.done()
  } catch (err) {
    await updateSourceStatus(supabase, SOURCE_NAME, 'failed', {
      error: err instanceof Error ? err.message : String(err)
    })
    throw err
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
```

### Run any script

```bash
npx tsx scripts/import/import-s0fskr1p.ts           # full import
npx tsx scripts/import/import-s0fskr1p.ts --limit 10 # test with 10 files
npx tsx scripts/import/import-s0fskr1p.ts --dry-run   # log what would happen
npx tsx scripts/import/import-s0fskr1p.ts --force      # re-import even if done
```

## Checklist

- [ ] `scripts/import/lib/import-utils.ts` created with all utilities
- [ ] `scripts/import/lib/storage-reader.ts` created with Storage helpers
- [ ] Test with: `npx tsx scripts/import/lib/storage-reader.ts` (quick sanity check)
- [ ] Verify `listSourceFiles()` handles pagination correctly
- [ ] Verify `normalizeEntityName()` handles edge cases (titles, "Last, First" format)
