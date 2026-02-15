# Phase 4: Verification & Final Review

**Status:** `[ ] Not Started`
**Depends on:** Phase 3
**Blocks:** Nothing (final phase)

## Objective

Verify all changes build cleanly, pass existing tests, and survive a comprehensive agent review.

## Tasks

### 4.1 Build verification
- [ ] `pnpm build` passes with zero errors
- [ ] No new TypeScript warnings related to changed files

### 4.2 Prompt output spot-check

Manually inspect prompt builder output for each tier to verify correctness:

- [ ] `sworn` tier: call `buildEntityExtractionPrompt` with `primary='deposition'`, verify sworn-specific instructions present
- [ ] `flight` tier: call `buildRelationshipMappingPrompt` with `primary='flight_log'`, verify `traveled_with` is prioritized but all types available
- [ ] `financial` tier: call `buildCriminalIndicatorPrompt` with `primary='financial_record'`, verify structuring/shell company focus
- [ ] `correspondence` tier: call `buildDocumentSummaryPrompt` with `primary='email'`, verify communication focus
- [ ] `default` tier: call any builder with `primary='photograph'`, verify generic prompt (regression check)
- [ ] **Tag composition:** call builder with `primary='court_filing', tags=['financial_record']`, verify official base + financial supplement present without conflicting instructions
- [ ] **Low confidence:** call `buildPromptContext` with `primaryConfidence=0.2`, verify tier falls back to `default`

### 4.3 Relationship type alignment verification
- [ ] Grep for `referenced_together` across entire codebase — should only appear in migration
- [ ] Grep for `witness_against` across entire codebase — should only appear in migration
- [ ] Verify mapper's validation set matches `types/entities.ts` canonical list exactly
- [ ] Verify no service hardcodes relationship types (all should import from canonical source or prompt builders)

### 4.4 Final agent review (council)
- [ ] Submit complete diff to **CodeReviewer** (GPT-5.2-Codex) — focus on: type safety, edge cases, data integrity
- [ ] Submit complete diff to **DeepReason** (DeepSeek R1) — focus on: logical completeness, missed edge cases, prompt engineering quality
- [ ] Address all critical findings
- [ ] Address important findings (or document why deferred)

### 4.5 Update project tracking
- [ ] Update `README.md` status table — all phases marked complete
- [ ] Note any deferred items in README "Decisions Deferred" section
- [ ] Update memory file if needed with new conventions/patterns

## Done Criteria

- [ ] Build passes clean
- [ ] All 7 tiers produce correct prompt output
- [ ] Tag composition works without conflicts
- [ ] Low-confidence fallback works
- [ ] No stale relationship type references in codebase
- [ ] Council review complete, no open criticals
- [ ] README updated

## Future Work (out of scope)

These items were identified by the council review but deferred:

1. **Redaction detector tier hints** — pass classification to redaction detector for type inference (e.g., [REDACTED] after "$" likely an amount in financial docs)
2. **Gold standard test dataset** — 50-100 hand-labeled documents per tier for precision/recall measurement
3. **A/B testing infrastructure** — scripts to compare generic vs tiered prompt quality on sample documents
4. **Prompt versioned idempotency** — check prompt version on existing extractions, allow selective reprocessing when prompts change
5. **Tier consolidation** — after running on real data, evaluate if 7 tiers should become 5 (merge contacts into default, merge flight into structured)
