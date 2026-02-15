# Phase 0: Foundation Repair

**Status:** Not started
**Prerequisites:** None
**Blocks:** All subsequent phases

## Why This Phase Exists

The council review unanimously identified critical gaps in the existing system that must be fixed before adding clustering and scoring layers:

1. **Entity descriptions are ALL NULL** — Role classification (lawyer vs. associate vs. victim vs. staff) is impossible without descriptions. Every downstream system (fingerprinting, pattern matching, lead generation) will produce false positives without role context.
2. **14 of 20 relationship types contribute ZERO to risk scores** — The existing scoring system operates on 30% of available relationship signal. Building topic fingerprinting on top of a partially-functional scoring system amplifies errors.
3. **pattern-detector.ts is an empty stub** — This is where the pattern detection engine should live. It currently returns `[]`.

## Checklist

### 0.1 Entity Description Generation
- [ ] Write batch script to generate entity descriptions via LLM
  - Input: all `entity_mentions` for an entity (context snippets, mention types, document classifications)
  - Output: 2-3 sentence description + inferred role
  - Model: Gemini 2.0 Flash (already used throughout pipeline)
  - Threshold: only entities with 3+ document mentions
  - Store in `entities.description` (currently always NULL)
- [ ] Run batch on all entities with 3+ mentions (~estimated 10-20K entities)
- [ ] Verify: spot-check 50 descriptions against known entities (Epstein, Maxwell, known associates, known lawyers, known staff)

### 0.2 Role Classification
- [ ] Add `entities.inferred_role` column (or use existing `category` field)
- [ ] Classify each person entity into role categories that affect scoring:
  - `subject` — person of investigative interest
  - `victim` / `minor_victim` — already exists in PersonCategory
  - `legal` — defense attorney, prosecutor, judge
  - `staff` — household employee, assistant, pilot
  - `journalist` — reporter covering the case
  - `law_enforcement` — FBI, police, investigators
  - `witness` — provided testimony
  - `peripheral` — mentioned in passing, social connection
- [ ] Roles should generate **negative risk weight** for legal, journalist, law_enforcement, staff
- [ ] Verify: no lawyer or journalist should have risk_score > 2.0 without overwhelming evidence

### 0.3 Relationship Weight Audit
- [ ] Read `supabase/migrations/00027_risk_scoring_dedup.sql` — `compute_entity_risk_score()`
- [ ] Document current weights for all 20 relationship types (6 weighted, 14 at zero)
- [ ] For each zero-weighted type, determine:
  - Genuinely uninformative? (e.g., `mentioned_together` — too noisy)
  - Informative but needs calibration? (e.g., `employed_by` — different risk if employed BY Epstein vs employing Epstein)
  - Needs splitting into subtypes? (e.g., `financial_connection` → salary vs. unexplained wire transfer)
- [ ] Propose new weights with justification
- [ ] Implement in migration `00030_relationship_weight_audit.sql`
- [ ] Verify: recompute risk scores for top 100 entities, compare before/after

### 0.4 Pattern Detector Scaffold
- [ ] Read existing stub: `lib/pipeline/services/pattern-detector.ts`
- [ ] Implement scaffold with the `InvestigativeHypothesis` framework:
  ```typescript
  interface InvestigativeHypothesis {
    id: string
    name: string
    description: string
    created_by: string
    topic_indicators: string[]      // positive signals
    counter_indicators: string[]    // what would disprove this
    minimum_confidence: number
    requires_human_review: boolean  // always true for criminal
    base_rate_calibration: {
      total_matches: number
      confirmed_relevant: number
      confirmed_irrelevant: number
    }
  }
  ```
- [ ] Create `investigative_hypotheses` table in migration
- [ ] Wire into the pipeline stage system (but no actual matching logic yet — that's Phase 3)

## Files to Create/Modify

| File | Action |
|------|--------|
| `scripts/batch/generate-entity-descriptions.ts` | Create |
| `supabase/migrations/00030_relationship_weight_audit.sql` | Create |
| `supabase/migrations/00031_investigative_hypotheses.sql` | Create |
| `lib/pipeline/services/pattern-detector.ts` | Modify (fill stub) |
| `types/entities.ts` | Modify (add inferred_role) |

## Agent Workflow

```
1. PLAN:   Launch Plan agent to analyze the 14 zero-weight relationships
           and propose weights based on investigative logic
2. BUILD:  Implement entity description batch script + migration
3. REVIEW: Launch security-reviewer to audit the migration
           Launch CodeReviewer to review the batch script
4. RUN:    Execute batch entity description generation
5. VERIFY: Spot-check results against known entities
```

## Definition of Done

- [ ] No entity with 3+ mentions has NULL description
- [ ] All 20 relationship types have documented weights (even if some remain at 0 with justification)
- [ ] pattern-detector.ts has the hypothesis framework scaffold (not empty)
- [ ] Risk scores recomputed with new weights; top 100 entities spot-checked
- [ ] No lawyer/journalist/law-enforcement entity has risk_score > 2.0 without justification
