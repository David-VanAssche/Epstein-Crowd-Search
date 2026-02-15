# Phase 3: Service Wiring

**Status:** `[ ] Not Started`
**Depends on:** Phase 0 (relationship types), Phase 2 (prompt builders)
**Blocks:** Phase 4 (verification)

## Objective

Modify 5 pipeline service files to replace inline prompts with prompt builder calls. Thread `PromptContext` through each service.

## Common Pattern

Each service modification follows the same 4-step pattern:

1. **Import** `buildPromptContext` + stage-specific builder from `@/lib/pipeline/prompts`
2. **Fetch** `classification, classification_confidence, classification_tags, filename` from documents table (currently most only fetch `classification`)
3. **Build** `PromptContext` once per document at the start of the handler
4. **Replace** inline prompt string with builder call, passing `ctx` instead of raw `documentType` string

## Tasks

### 3.1 Modify `lib/pipeline/services/entity-extractor.ts`

- [ ] Add imports: `buildEntityExtractionPrompt`, `buildPromptContext`, `PROMPT_VERSION`
- [ ] In `handleEntityExtract()`: expand `.select('classification')` to include `classification_confidence, classification_tags, filename`
- [ ] Build `PromptContext` once: `const ctx = buildPromptContext(classification, tags, { documentId, filename, primaryConfidence })`
- [ ] Change `extractEntitiesFromChunk(content, documentType, apiKey)` signature to `extractEntitiesFromChunk(content, ctx, apiKey)`
- [ ] Replace inline prompt with `buildEntityExtractionPrompt(ctx, chunkContent)`
- [ ] Add `prompt_version: PROMPT_VERSION` to entity_mention insert metadata (if metadata column exists) or as a comment for future use
- [ ] Remove the now-unused `ENTITY_TYPES` prompt list (entity types are in the builder)
- [ ] Keep `ENTITY_TYPES` const for validation (filtering invalid types from LLM response)

### 3.2 Modify `lib/pipeline/services/relationship-mapper.ts`

- [ ] Add imports: `buildRelationshipMappingPrompt`, `buildPromptContext`, `PROMPT_VERSION`
- [ ] **Fix:** Remove local `RELATIONSHIP_TYPES` const (11 types)
- [ ] Import canonical `RelationshipType` from `types/entities.ts` for validation
- [ ] Create `VALID_RELATIONSHIP_TYPES` Set from canonical list for response filtering
- [ ] In `handleRelationshipMap()`: fetch `classification, classification_confidence, classification_tags, filename` (currently doesn't fetch classification at all)
- [ ] Build `PromptContext` once per document
- [ ] Change `extractRelationships(chunkContent, entityNames, apiKey)` to `extractRelationships(chunkContent, entityNames, ctx, apiKey)`
- [ ] Replace inline prompt with `buildRelationshipMappingPrompt(ctx, entityNames, chunkContent)`
- [ ] Add validation: filter extracted relationships against `VALID_RELATIONSHIP_TYPES` before insert
- [ ] Rename any hardcoded `referenced_together` → `mentioned_together`, `witness_against` → `witness_testimony` in fallback/default logic

### 3.3 Modify `lib/pipeline/services/criminal-indicator-scorer.ts`

- [ ] Add imports: `buildCriminalIndicatorPrompt`, `buildPromptContext`
- [ ] In `handleCriminalIndicators()`: expand select to include `classification_confidence, classification_tags, filename`
- [ ] Build `PromptContext` once per document
- [ ] Change `analyzeCriminalIndicators(ocrText, classification, entities, apiKey)` to `analyzeCriminalIndicators(ocrText, ctx, entities, apiKey)`
- [ ] Replace inline prompt with `buildCriminalIndicatorPrompt(ctx, entities, ocrText)`
- [ ] Remove the inline ethical guidelines (now in shared `common.ts`)

### 3.4 Modify `lib/pipeline/services/timeline-extractor.ts`

- [ ] Add imports: `buildTimelineExtractionPrompt`, `buildPromptContext`
- [ ] In `handleTimelineExtract()`: expand select to include `classification_confidence, classification_tags, filename`
- [ ] Build `PromptContext` once per document
- [ ] Change `extractTimelineEvents(chunkContent, documentType, apiKey)` to `extractTimelineEvents(chunkContent, ctx, apiKey)`
- [ ] Replace inline prompt with `buildTimelineExtractionPrompt(ctx, chunkContent)`

### 3.5 Modify `lib/pipeline/services/document-summarizer.ts`

- [ ] Add imports: `buildDocumentSummaryPrompt`, `buildPromptContext`
- [ ] In `handleSummarize()`: expand select to include `classification_confidence, classification_tags, filename`
- [ ] Build `PromptContext` once per document
- [ ] Change `generateSummary(ocrText, classification, entityNames, apiKey)` to `generateSummary(ocrText, ctx, entityNames, apiKey)`
- [ ] Replace inline prompt with `buildDocumentSummaryPrompt(ctx, entityNames, ocrText)`
- [ ] Remove inline ethical guidelines (now in shared `common.ts`)

### 3.6 NOT Modified (and why)

- [ ] `redaction-detector.ts` — format-agnostic, `[REDACTED]` detection doesn't vary by tier (council noted this could gain tier hints for type inference — deferred to future work)
- [ ] `email-extractor.ts` — already domain-specific with classification gate
- [ ] `financial-extractor.ts` — already domain-specific with classification gate
- [ ] `classifier.ts` — upstream of prompt variants, not affected
- [ ] `smart-chunker.ts` — no LLM prompt, pure text processing

### 3.7 Build gate
- [ ] `pnpm build` passes clean

### 3.8 Agent review
- [ ] Submit all 5 modified service files to **CodeReviewer** (GPT-5.2-Codex) for review
- [ ] Focus areas: correct PromptContext threading, no broken function signatures, prompt version tracking, fail-open behavior
- [ ] Address critical/important findings

## Fail-Open Pattern

Every service must handle PromptContext build failures gracefully:

```typescript
let ctx: PromptContext
try {
  ctx = buildPromptContext(classification, tags, { documentId, filename, primaryConfidence })
} catch {
  console.warn(`[Stage] PromptContext build failed for ${documentId}, using default tier`)
  ctx = buildPromptContext('other', [], { documentId, filename: '', primaryConfidence: 0 })
}
```

This ensures no document is ever skipped due to bad classification data.

## Done Criteria

- [ ] All 5 services use prompt builders instead of inline prompts
- [ ] All 5 services fetch classification_tags alongside classification
- [ ] Relationship mapper uses canonical type set, not local 11-type list
- [ ] Fail-open pattern implemented in all 5 services
- [ ] Build passes
- [ ] Agent review complete
