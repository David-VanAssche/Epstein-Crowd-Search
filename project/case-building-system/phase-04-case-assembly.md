# Phase 4: Case Assembly

**Status:** Not started
**Prerequisites:** Phase 0 (foundations), Phase 3 (fingerprinting + pattern matching)
**Blocks:** None (Phase 5 can run in parallel)

## What This Phase Does

For each entity flagged by pattern matching or anomaly detection, automatically compiles a provenance-tagged evidence package — structured case data + LLM narrative with every sentence traced back to source documents.

## Key Design Decision: Claim-Evidence-Reasoning (CER) Pipeline

The council unanimously rejected raw LLM narrative generation. Instead:

```
1. COMPILE    → Gather all evidence for an entity (structured data)
2. CLAIM      → LLM generates testable claims from the evidence
3. RETRIEVE   → For each claim, retrieve supporting chunks with exact citations
4. VERIFY     → NLI check: does the cited chunk actually support the claim?
5. TAG        → Every sentence gets a provenance tag
6. FRAME      → Generate BOTH prosecution and defense perspectives
7. GATE       → Human review required before export
```

## Checklist

### 4.1 Evidence Compiler Service
- [ ] Create `lib/services/case-compiler.ts`:
  - Input: `entity_id`
  - Gathers from database:
    - Entity profile (description, role, risk_score, risk_factors)
    - Topic fingerprint (from Phase 3 materialized view)
    - Pattern matches (from Phase 3 hypothesis matching)
    - All entity_mentions with evidence_weight, ranked by weight
    - Top 20 documents (by evidence_weight) with summaries
    - All entity_relationships with evidence arrays
    - Timeline events involving this entity
    - Criminal indicators from documents mentioning this entity
    - Contradictions involving this entity
    - Redactions where this entity is resolved_entity_id
    - Network metrics (PageRank, betweenness, cluster_id)
    - Similar entities (from Phase 3 fingerprint similarity)
  - Output: structured `CaseEvidence` object
- [ ] Create TypeScript interface `AutomatedCase` (see below)
- [ ] Verify: compiler returns complete data for known entities

### 4.2 AutomatedCase Interface
- [ ] Define in `types/case.ts`:
  ```typescript
  interface AutomatedCase {
    entity: EntityProfile
    topic_fingerprint: TopicEntry[]
    matched_patterns: PatternMatch[]
    timeline: TimelineEntry[]
    relationships: RelationshipEntry[]
    criminal_indicators: IndicatorEntry[]
    key_documents: DocumentEntry[]
    contradictions: ContradictionEntry[]
    similar_entities: SimilarEntity[]
    anomalies: AnomalyEntry[]

    // Provenance-tagged narrative
    narrative: {
      prosecution_view: TaggedParagraph[]
      defense_view: TaggedParagraph[]
      open_questions: string[]
    }

    // Metadata
    generated_at: string
    snapshot_version: number
    reliability_tier: 'high' | 'moderate' | 'low'
    requires_review: boolean  // always true for criminal patterns
    reviewed_by?: string
    review_status?: 'approved' | 'flagged' | 'rejected'
  }

  interface TaggedParagraph {
    text: string
    sentences: TaggedSentence[]
  }

  interface TaggedSentence {
    text: string
    provenance: 'documentary' | 'inferred' | 'statistical' | 'contextual'
    citations: Citation[]
    confidence: number
  }

  interface Citation {
    document_id: string
    document_title: string
    chunk_id: string
    page_number?: number
    span_text: string  // exact quoted text from source
  }
  ```

### 4.3 Claim-Evidence-Reasoning Pipeline
- [ ] **Step 1: Claim Generation**
  - LLM generates structured claims from the compiled evidence:
    ```
    Prompt: "Given this entity's evidence profile, generate a list of
    testable factual claims. Each claim must be:
    - Specific (names, dates, amounts)
    - Falsifiable (could be proven wrong)
    - Grounded (based on the evidence provided, not speculation)
    Format: [{claim_text, claim_type, confidence, relevant_topics}]"
    ```
  - Claim types: `presence`, `relationship`, `financial`, `temporal`, `behavioral`

- [ ] **Step 2: Evidence Retrieval**
  - For each claim, search the entity's chunks by embedding similarity
  - Retrieve top-10 chunks with exact span highlighting
  - Also check: do any chunks CONTRADICT the claim?

- [ ] **Step 3: Citation Verification**
  - Second LLM pass (constrained generation):
    ```
    Prompt: "Write a single paragraph about this claim using ONLY the
    provided source chunks. Cite using [DocID:Page]. If the claim is
    not supported by the chunks, output 'INSUFFICIENT EVIDENCE'.
    Do not infer beyond what is explicitly stated."
    ```
  - Tag each sentence with provenance type

- [ ] **Step 4: Adversarial Framing**
  - Generate defense perspective:
    ```
    Prompt: "Given the same evidence, write an alternative explanation
    that assumes innocence. What legitimate reasons could explain
    this entity's presence in these documents? Consider their role
    ({entity.inferred_role}) and professional context."
    ```
  - Both views presented side-by-side in the case output

- [ ] Verify: generated narratives are factual, properly cited, and hedged

### 4.4 Case API Endpoint
- [ ] Create `app/api/entity/[id]/case/route.ts`:
  - `GET` — returns compiled case with narrative
  - Auth: researcher+ tier required
  - Caching: cache compiled case for 24 hours (invalidate on new data)
  - Rate limiting: max 10 case generations per user per hour
- [ ] Verify: endpoint returns complete AutomatedCase for valid entity IDs

### 4.5 Investigation Lead Generation
- [ ] Create `lib/services/lead-generator.ts`:
  - Aggregates anomalies from Phase 3 into ranked leads
  - Each lead has:
    - `lead_type`: cluster_bridge, centrality_anomaly, temporal_burst, fingerprint_outlier, similar_to_high_risk
    - `entity_id` + entity name
    - `explanation`: human-readable description of why this is interesting
    - `suggested_action`: what to investigate next
    - `priority`: high / medium / low
  - Leads are suggestions, not accusations — language must reflect this
- [ ] Store in `investigation_leads` table
- [ ] Create API: `GET /api/leads` (paginated, filterable by type/priority)
- [ ] Verify: leads surface genuinely interesting entities, not just noise

### 4.6 Human Review Gate
- [ ] No case narrative is marked as "final" without human review
- [ ] Review workflow:
  1. Researcher generates case via API
  2. Case marked `requires_review: true`
  3. Reviewer (moderator+ tier) reads case, marks as `approved`, `flagged`, or `rejected`
  4. Only `approved` cases can be exported to PDF
- [ ] Rejected cases get `rejection_reason` field
- [ ] Verify: PDF export is blocked without approval

### 4.7 Null Result Communication
- [ ] When the system finds nothing unusual about an entity, communicate this clearly:
  ```
  "Analysis of [Entity Name] across [N] documents found no statistically
  unusual patterns. Their document presence is consistent with their role
  as [inferred_role]. No investigative leads were generated."
  ```
- [ ] This is a meaningful result, not an empty state
- [ ] Verify: entities with low risk scores get null result messages, not empty pages

## Files to Create

| File | Purpose |
|------|---------|
| `lib/services/case-compiler.ts` | Evidence compilation from all sources |
| `lib/services/cer-pipeline.ts` | Claim-Evidence-Reasoning narrative generation |
| `lib/services/lead-generator.ts` | Investigation lead generation |
| `types/case.ts` | AutomatedCase interface + related types |
| `app/api/entity/[id]/case/route.ts` | Case generation endpoint |
| `app/api/leads/route.ts` | Investigation leads endpoint |
| `supabase/migrations/00034_case_assembly.sql` | Leads table, review tracking |
| `components/case/CaseView.tsx` | Case presentation component |
| `components/case/ProvenanceTag.tsx` | Visual provenance badges |
| `components/case/DualNarrative.tsx` | Prosecution + defense side-by-side |

## Agent Workflow

```
1. PLAN:    Launch Plan agent to design CER pipeline prompt chain
            Launch DeepReason agent to verify citation verification logic
2. BUILD:   Implement compiler, CER pipeline, lead generator
3. REVIEW:  Launch CodeReviewer for narrative generation quality
            Launch security-reviewer for API auth/rate limiting
4. TEST:    Generate cases for 10 known entities, verify accuracy
5. VERIFY:  Launch Explore agent to read generated narratives and check citations
```

## Definition of Done

- [ ] Case compiler gathers all evidence for any entity
- [ ] CER pipeline produces provenance-tagged narratives
- [ ] Every sentence tagged as documentary/inferred/statistical/contextual
- [ ] Both prosecution and defense views generated
- [ ] Human review gate blocks PDF export without approval
- [ ] Null results communicated clearly for low-risk entities
- [ ] Investigation leads generated with appropriate framing
- [ ] Cases validated against 10 known entities
