# Classification-Specific Prompt Variants

**Status:** Planning
**Created:** 2026-02-15
**Last Updated:** 2026-02-15

## Overview

Replace generic one-size-fits-all LLM prompts across 5 pipeline stages with classification-specific variants grouped by 7 document tiers. A deposition, flight manifest, and email thread need fundamentally different extraction strategies.

## Council of Agents Review (2026-02-15)

Three independent reviewers analyzed the initial plan:

| Reviewer | Model | Key Finding |
|----------|-------|-------------|
| **CodeReviewer** | GPT-5.2-Codex + GPT-4.1 | "Do NOT subset relationship types — use full set with tier guidance. Add prompt versioning. Gate on classification confidence." |
| **DeepReason** | DeepSeek R1 + Kimi K2.5 | "Relationship subsetting critically flawed. Tag composition needs conflict resolution. Redaction detector should get tier hints for TYPE inference." |
| **FrontendExpert** | Gemini 3 Pro | "PromptContext needs confidence + metadata. Separate functions > dispatcher. Add `common/` for shared fragments. TypeScript template literals are correct pattern." |

### Consensus Decisions (all 3 agree)

1. **Do NOT subset relationship types** — present all types with tier-specific ranking/guidance
2. **Add prompt versioning** — version string stored on extraction output for audit/reprocessing
3. **PromptContext needs more fields** — `primaryConfidence`, `documentId`, `filename`
4. **SQL migration needed** — rename `referenced_together`/`witness_against` in existing data
5. **Tag supplement composition** — cap at 2 secondary tiers, supplements are disambiguation hints only
6. **Fail-open on errors** — bad classification → default tier, never skip document

### Decisions Deferred

- Tier granularity (3 vs 5 vs 7) — implement 7, validate with data, consolidate if needed
- Gold standard test dataset — valuable but blocks nothing; add to future roadmap
- Redaction detector tier hints — good idea, implement after core prompt variants ship

## Phases

| Phase | File | Description | Status |
|-------|------|-------------|--------|
| 0 | [phase-0-relationship-fix.md](phase-0-relationship-fix.md) | Fix relationship type misalignment + SQL migration | `[ ]` |
| 1 | [phase-1-prompt-foundation.md](phase-1-prompt-foundation.md) | PromptContext types, tier mapping, shared constants, index | `[ ]` |
| 2 | [phase-2-prompt-builders.md](phase-2-prompt-builders.md) | 5 prompt builder files with tier-specific instructions | `[ ]` |
| 3 | [phase-3-service-wiring.md](phase-3-service-wiring.md) | Modify 5 service files to use prompt builders | `[ ]` |
| 4 | [phase-4-verify-review.md](phase-4-verify-review.md) | Build verification, Codex review, final fixes | `[ ]` |

## File Map

### New files (8)
```
lib/pipeline/prompts/
  types.ts                    # PromptTier, PromptContext, classificationToTier(), buildPromptContext()
  common.ts                   # Shared fragments: ethical guidelines, tier preambles, tag supplements
  entity-extraction.ts        # buildEntityExtractionPrompt()
  relationship-mapping.ts     # buildRelationshipMappingPrompt()
  criminal-indicators.ts      # buildCriminalIndicatorPrompt()
  timeline-extraction.ts      # buildTimelineExtractionPrompt()
  document-summary.ts         # buildDocumentSummaryPrompt()
  index.ts                    # Barrel export
```

### Modified files (6)
```
types/entities.ts                                    # Add communicated_with, met_with to RelationshipType
lib/pipeline/services/entity-extractor.ts            # Use prompt builder, thread PromptContext
lib/pipeline/services/relationship-mapper.ts         # Use prompt builder, fix type alignment, thread ctx
lib/pipeline/services/criminal-indicator-scorer.ts   # Use prompt builder, thread ctx
lib/pipeline/services/timeline-extractor.ts          # Use prompt builder, thread ctx
lib/pipeline/services/document-summarizer.ts         # Use prompt builder, thread ctx
```

### New migration (1)
```
supabase/migrations/00031_relationship_types_align.sql  # Rename mismatched relationship types in existing data
```

## Agent Workflow

Each phase includes gates where the council of agents is consulted:

- **Pre-implementation:** Plan agent designs approach (already done)
- **Post-implementation:** CodeReviewer (GPT-5.2-Codex) reviews each phase's code
- **Build gate:** `pnpm build` must pass before moving to next phase
- **Final review:** Pre-deploy reviewer checks all changes holistically
