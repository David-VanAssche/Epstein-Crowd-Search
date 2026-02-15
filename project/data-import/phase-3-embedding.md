# Phase 3: Re-Embed All Chunks with Nova 1024d

After Phase 2 populates chunks, embed (or re-embed) everything with Amazon Nova Multimodal Embeddings v1 for a unified 1024-dimensional vector space.

## Why Re-Embed

- Community data uses 768d `nomic-embed-text` (svetfm) or no embeddings at all
- Our schema uses `VECTOR(1024)` columns everywhere
- Nova supports text + image + video in the same 1024d space — enables cross-modal search
- Hybrid search function `hybrid_search_chunks_rrf()` requires 1024d query embeddings

## Prerequisites

> **CRITICAL (Audit C1)**: `lib/pipeline/services/embedding-service.ts` currently calls Bedrock via raw `fetch()` without AWS Signature V4 authentication. This **will fail with 403 Forbidden**. Before running any embeddings, you must:
> 1. Install `@aws-sdk/client-bedrock-runtime` (done in Phase 0D)
> 2. Refactor `embedding-service.ts` to use `BedrockRuntimeClient.invokeModel()` instead of raw `fetch()`

## Existing Infrastructure

The embedding pipeline already exists but needs the AWS SDK fix above:

### Key files
- `lib/pipeline/services/embedding-service.ts` — `embedTexts()`, `embedImage()`, `handleEmbed()`
- `lib/pipeline/services/embedding-cache.ts` — LRU cache for dedup
- `lib/pipeline/stages.ts` — `PipelineStage.EMBED` definition
- `scripts/batch/run-all.ts` — batch runner with `--stage embed` filter

### How it works (embedding-service.ts)
1. Queries `chunks` for a document where `embedding_model != TARGET_MODEL` or `content_embedding IS NULL`
2. Builds embedding input: `contextual_header + '\n\n' + content`
3. Calls Nova via AWS Bedrock: `amazon.nova-multimodal-embeddings-v1:0`
4. Updates chunk with 1024d vector and sets `embedding_model` column
5. Processes in batches of 100 with 200ms delays

## Approach

### Option A: Use existing batch runner (recommended)

```bash
npx tsx scripts/batch/run-all.ts --stage embed
```

This will:
- Query all documents where `processing_status != 'complete'`
- For each, run `handleEmbed()` which skips already-embedded chunks
- The skip logic at line 97-98 checks `embedding_model !== TARGET_MODEL`

### Option B: Dedicated re-embed script

If Option A doesn't cover community-imported docs (they have `processing_status = 'community'`), create:

**File**: `scripts/import/reembed-nova.ts`

```typescript
// Query chunks directly (bypass document-level filtering)
const { data: chunks } = await supabase
  .from('chunks')
  .select('id, content, contextual_header')
  .or('content_embedding.is.null,embedding_model.neq.amazon.nova-multimodal-embeddings-v1:0')
  .limit(args.limit || 999999)

// Process in batches
for (const batch of batches(chunks, BATCH_SIZE)) {
  const inputs = batch.map(c => buildEmbeddingInput(c.content, c.contextual_header))
  const embeddings = await embedTexts(inputs)
  // Update each chunk
}
```

## Cost Estimate

| Metric | Value |
|--------|-------|
| Total chunks (est.) | ~305,000 |
| Avg tokens per chunk | ~250 |
| Total tokens | ~76M |
| Nova price | $0.00006 / 1K input tokens |
| **Estimated cost** | **~$4.50** |

Note: Actual cost depends on chunk sizes. Upper bound with 500 tokens avg = ~$9.

## AWS Bedrock Configuration

Required environment variables:
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

Model ID: `amazon.nova-multimodal-embeddings-v1:0`

### Rate limits
- Bedrock has per-account rate limits (typically 100 requests/second for Nova)
- The existing 200ms delay between batches keeps us well under limits
- If rate limited, the retry logic in `PipelineOrchestrator` handles backoff

## Visual Embeddings

For images in the `images` table, the existing `PipelineStage.VISUAL_EMBED` stage handles image embedding using `embedImage()` which sends base64 image data to the same Nova model. Same 1024d output, same vector space.

Run after text embedding:
```bash
npx tsx scripts/batch/run-all.ts --stage visual_embed
```

## Verification

```sql
-- Count chunks with Nova embeddings
SELECT COUNT(*) FROM chunks WHERE embedding_model = 'amazon.nova-multimodal-embeddings-v1:0';

-- Count chunks still needing embedding
SELECT COUNT(*) FROM chunks WHERE content_embedding IS NULL;

-- Test search works
SELECT chunk_id, rrf_score
FROM hybrid_search_chunks_rrf(
  'Jeffrey Epstein flight logs',
  (SELECT content_embedding FROM chunks WHERE content_embedding IS NOT NULL LIMIT 1),
  5
);
```

## Checklist

- [ ] `embedding-service.ts` refactored to use `BedrockRuntimeClient` (Audit C1)
- [ ] AWS Bedrock credentials verified (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` in `.env`)
- [ ] Test embedding with `--limit 10` first
- [ ] Full embedding run completed
- [ ] 0 chunks with `content_embedding IS NULL` (excluding raw PDF docs without text)
- [ ] All embedded chunks have `embedding_model = 'amazon.nova-multimodal-embeddings-v1:0'`
- [ ] Hybrid search returns results for test queries
