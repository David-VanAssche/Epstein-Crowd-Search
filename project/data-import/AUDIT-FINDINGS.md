# Data Import Pipeline — Audit Findings

Consolidated findings from three independent reviews: Security, Architecture, and Code Feasibility.

## CRITICAL (Must fix before implementation)

### C1. AWS Bedrock Embedding Uses Unsigned `fetch()` — Will Fail

**Source**: Architecture + Code reviews
**File**: `lib/pipeline/services/embedding-service.ts:21-29`

The embedding service calls Bedrock via raw `fetch()` without AWS Signature V4 authentication. Bedrock requires SigV4 signing — this will return `403 Forbidden`.

**Evidence**: No `@aws-sdk` package in `package.json`. The code comment in `project/phase-06-worker-pipeline.md:1762` even says "AWS Signature V4 auth handled by @aws-sdk/client-bedrock-runtime in production" — but the SDK was never added.

**Fix**:
```bash
pnpm add @aws-sdk/client-bedrock-runtime
```
Then refactor `embedding-service.ts` to use `BedrockRuntimeClient.invokeModel()`.

---

### C2. Import Scripts Cannot Use `@/` Path Aliases

**Source**: Code review
**File**: Plan Phase 1 references `import { createAdminClient } from '@/lib/supabase/admin'`

TypeScript `@/` path aliases only work inside Next.js context. Scripts run via `npx tsx` do NOT resolve them. All existing batch scripts use relative imports:
```typescript
// scripts/batch/extract-entities.ts:5-6
import { runBatch, getDefaultConfig } from '../../lib/pipeline/batch-runner'
import { handleEntityExtract } from '../../lib/pipeline/services/entity-extractor'
```

**Fix**: All plan docs and import scripts must use relative paths like `../../lib/` not `@/lib/`.

---

### C3. Entity Extractor Doesn't Use `name_normalized` for Dedup

**Source**: Code review
**File**: `lib/pipeline/services/entity-extractor.ts:122-127`

The `findOrCreateEntity()` function matches by exact `name` + `entity_type`, but the schema has `UNIQUE(name_normalized, entity_type)`. Without computing `name_normalized`, inserts will either:
- Fail on the constraint (if `name_normalized` is NOT NULL)
- Create duplicates (if `name_normalized` is NULL and constraint is partial)

**Fix**: Import scripts must compute `name_normalized` before insert/upsert.

---

## HIGH (Should fix)

### H1. Missing Dependency: `better-sqlite3`

**Source**: Code review
**File**: `package.json` — not present

Required for Phase 2 Priority 5 (maxandrews/lmsband SQLite entity databases).

**Fix**: `pnpm add -D better-sqlite3 @types/better-sqlite3`

---

### H2. `run-all.ts` Query Includes `community` Status Docs

**Source**: Architecture review
**File**: `scripts/batch/run-all.ts:107`

The batch runner queries `WHERE processing_status != 'complete'`, which will pick up community-imported docs (status = `'community'`). This is actually **correct behavior** — it means after import, running `batch:all` will process community docs through remaining stages. But:

**Concern**: Some stages (OCR, chunk) should be SKIPPED for community docs that already have OCR text and chunks. The skip checks in `run-all.ts` (lines 84-103) only cover OCR, CHUNK, and ENTITY_EXTRACT. Other stages have no skip checks.

**Recommendation**: Add skip checks for EMBED (check `embedding_model` matches target) and CLASSIFY (check `classification` exists) to prevent redundant API calls.

---

### H3. Supabase Storage Pagination Implementation

**Source**: Code review
**File**: Plan Phase 1 — `listSourceFiles()`

The Supabase Storage `.list()` API returns max 1000 items. Sources like `kaggle-jazivxt` (26K files) and `maxandrews` (29K files) need paginated listing.

**Fix**: Implement offset-based pagination loop in `storage-reader.ts`:
```typescript
while (true) {
  const { data } = await supabase.storage.from('raw-archive').list(path, { limit: 1000, offset })
  if (!data || data.length === 0) break
  allFiles.push(...data)
  offset += data.length
  if (data.length < 1000) break
}
```

---

### H4. Gemini API Key Exposed in URL Query Parameters

**Source**: Security review
**File**: `lib/pipeline/services/entity-extractor.ts:39` (and 14 other files)

All Gemini API calls pass the key as `?key=${apiKey}` in the URL. This means the API key appears in:
- Server access logs
- Network monitoring tools
- Error messages that include URLs

**Recommendation**: This is Google's standard API key pattern (not a bug), but sensitive. Ensure logs don't capture full URLs, and consider switching to OAuth2/service account auth for production.

---

### H5. Input Validation for Community Data

**Source**: Security review

Community-contributed data (OCR text, entity names, metadata) is untrusted input. When displayed in the web UI:
- OCR text could contain XSS payloads
- Entity names could contain SQL injection attempts

**Current mitigations**:
- `ChatMessage.tsx` uses `rehype-sanitize` for markdown rendering (good)
- Supabase parameterized queries prevent SQL injection (good)
- No `dangerouslySetInnerHTML` in production code (good)

**Remaining risk**: Raw OCR text displayed via `{document.ocr_text}` in React is auto-escaped. **Low risk** but should sanitize entity `description` fields before display.

---

## MEDIUM (Nice to have)

### M1. Missing Zenodo Source in Import Scripts

**Source**: Architecture review

The Storage inventory shows `zenodo/` (3,955 files, 4.1GB) but no import script is planned for it. The zenodo data is mixed PDFs/images — should be treated as raw (Priority 9) or given its own importer if it contains processed data.

**Fix**: Add zenodo to Phase 2 Priority 9 (raw PDF registration) or create a separate script.

---

### M2. No Rollback/Recovery Strategy

**Source**: Architecture review

If an import fails midway through 30K documents, there's no way to resume from where it left off.

**Recommendation**: Each import script should:
1. Track progress via `data_sources.ingested_count`
2. Skip already-imported files (check by filename/storage_path in `documents` table)
3. Support `--resume` flag that continues from last successful file

---

### M3. DB Size Estimate Missing TOAST and Index Overhead

**Source**: Architecture review

The 4.4GB estimate doesn't account for:
- **TOAST storage**: `ocr_text` column stores full text, TOAST-compressed but still significant
- **HNSW index**: For 305K 1024d vectors, HNSW index ≈ 1.5-2x vector data size
- **GIN indexes**: `content_tsv` GIN indexes can be 20-40% of text data

**Revised estimate**: ~5.5-6.5GB (still within 8GB Pro limit, but tighter)

**Mitigation**: Store raw OCR text in Storage bucket `ocr-text/` instead of `documents.ocr_text` column. The `ocr_text_path` column already exists for this purpose.

---

### M4. Missing `dotenv` Package — Not Actually Needed

**Source**: Code review

The plan uses `import 'dotenv/config'` but `dotenv` isn't in `package.json`. However, `tsx` v4+ automatically loads `.env` files, so this import is unnecessary. The existing batch scripts use it as a fallback pattern.

**Recommendation**: Either add `dotenv` as a devDependency (`pnpm add -D dotenv`) for explicitness, or remove the import from new scripts.

---

## Checklist of Fixes

- [ ] **C1**: Add `@aws-sdk/client-bedrock-runtime` and refactor `embedding-service.ts`
- [ ] **C2**: Update plan docs to use relative imports in all script examples
- [ ] **C3**: Implement `normalizeEntityName()` and update entity insert logic
- [ ] **H1**: Add `better-sqlite3` + types to devDependencies
- [ ] **H2**: Add skip checks for EMBED and CLASSIFY stages
- [ ] **H3**: Implement paginated `listSourceFiles()`
- [ ] **H4**: Review logging to ensure API keys aren't captured
- [ ] **H5**: Verify all user-facing data display is properly escaped
- [ ] **M1**: Add zenodo source handling
- [ ] **M2**: Add resume/progress tracking to import scripts
- [ ] **M3**: Monitor DB size during import; consider moving `ocr_text` to Storage
- [ ] **M4**: Decide on dotenv dependency
