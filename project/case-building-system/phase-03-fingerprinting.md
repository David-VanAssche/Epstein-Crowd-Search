# Phase 3: Entity Topic Fingerprinting

**Status:** Not started
**Prerequisites:** Phase 0 (entity descriptions/roles), Phase 1 (topic clusters)
**Blocks:** Phase 4 (case assembly)

## What This Phase Does

Transforms entities from "mentioned in N documents" to a rich topic profile: "40% financial, 30% travel, 20% recruitment, 10% legal" — then matches profiles against user-defined investigative hypotheses to surface entities of interest.

## Key Design Decisions (from Council Review)

1. **Minimum 10-document threshold** for meaningful fingerprinting (Opus review)
2. **Jensen-Shannon Divergence** instead of cosine for distribution similarity (GPT-5.2 review)
3. **Role-aware scoring** — lawyers/staff/journalists get negative risk weight (Opus review)
4. **Hypotheses are user-defined and falsifiable**, not hardcoded templates (all reviewers)
5. **Base rate calibration** — every hypothesis tracks its false positive rate (Opus review)

## Checklist

### 3.1 Entity Topic Fingerprint Materialized View
- [ ] Create migration `00033_entity_fingerprints.sql`:
  ```sql
  CREATE MATERIALIZED VIEW entity_topic_fingerprints AS
  SELECT
    em.entity_id,
    c.topic_cluster_id,
    tc.label AS topic_label,
    COUNT(*) AS mention_count,
    SUM(em.evidence_weight) AS total_weight,
    COUNT(*)::FLOAT / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY em.entity_id), 0) AS topic_pct
  FROM entity_mentions em
  JOIN chunks c ON c.id = em.chunk_id
  JOIN topic_clusters tc ON tc.id = c.topic_cluster_id
  WHERE c.topic_cluster_id IS NOT NULL
  GROUP BY em.entity_id, c.topic_cluster_id, tc.label;

  CREATE INDEX idx_etf_entity ON entity_topic_fingerprints (entity_id);
  CREATE INDEX idx_etf_topic ON entity_topic_fingerprints (topic_cluster_id);
  ```
- [ ] Add refresh to `refresh_network_views()` or create separate refresh function
- [ ] Verify: spot-check fingerprints for known entities

### 3.2 Fingerprint Quality Gate
- [ ] Compute per-entity stats:
  - `document_count` — how many distinct documents mention this entity
  - `topic_count` — how many distinct topics they appear in
  - `entropy` — Shannon entropy of their topic distribution (high = diverse, low = concentrated)
- [ ] Apply tiered reliability labels:
  | Documents | Reliability | Use |
  |-----------|-------------|-----|
  | 1-3 | Unreliable | Network edges only, no fingerprinting |
  | 4-9 | Low | Show with "limited data" warning |
  | 10-30 | Moderate | Full fingerprinting |
  | 31+ | High | Full fingerprinting + pattern matching |
- [ ] Store reliability tier on entity or in fingerprint metadata
- [ ] Verify: entities with <10 docs are excluded from pattern matching

### 3.3 Role-Aware Scoring Adjustment
- [ ] Use entity roles from Phase 0 (inferred_role field) to apply scoring adjustments:
  - `legal` (lawyers, judges): **negative** pattern match weight
  - `law_enforcement`: negative weight
  - `journalist`: negative weight
  - `staff`: reduced weight (0.5x)
  - `victim` / `minor_victim`: excluded from perpetrator pattern matching
  - `subject` / unmarked: standard weight
- [ ] This prevents lawyers who reviewed depositions from matching "trafficking" patterns
- [ ] Verify: no entity with role `legal` matches any criminal pattern

### 3.4 Investigative Hypothesis Framework
- [ ] Implement `InvestigativeHypothesis` system (scaffold from Phase 0):
  ```typescript
  interface InvestigativeHypothesis {
    id: string
    name: string
    description: string
    created_by: string
    created_at: Date
    // What topics indicate this pattern
    topic_indicators: { topic_label: string; min_pct?: number; min_weight?: number }[]
    // What topics would DISPROVE this pattern
    counter_indicators: { topic_label: string; description: string }[]
    // Thresholds
    min_matching_topics: number
    min_total_evidence_weight: number
    requires_human_review: boolean  // always true for criminal hypotheses
    // Calibration (updated as researchers review matches)
    calibration: {
      total_matches: number
      confirmed_relevant: number
      confirmed_irrelevant: number
      false_positive_rate: number
    }
  }
  ```
- [ ] Create API endpoints:
  - `POST /api/hypotheses` — create hypothesis (researcher+ tier)
  - `GET /api/hypotheses` — list all hypotheses with calibration stats
  - `GET /api/hypotheses/[id]/matches` — entities matching this hypothesis
  - `POST /api/hypotheses/[id]/review` — mark a match as relevant/irrelevant (updates calibration)
- [ ] Seed 4-6 initial hypotheses (the trafficking, money_laundering, obstruction, conspiracy patterns from the original plan) — but as **editable hypotheses, not hardcoded**
- [ ] Verify: hypothesis CRUD works, calibration updates on review

### 3.5 Pattern Matching Engine
- [ ] Implement in `lib/pipeline/services/pattern-detector.ts`:
  - For each entity with fingerprint reliability >= "moderate":
    - For each active hypothesis:
      - Check topic overlap (how many indicator topics appear in entity fingerprint)
      - Check evidence weight threshold
      - Check counter-indicators (if entity appears strongly in counter-indicator topics, reduce match confidence)
      - Apply role-aware adjustment
      - Compute match_strength (0-1)
  - Return sorted list of matches above threshold
- [ ] Store matches in `entity_pattern_matches` table:
  ```sql
  CREATE TABLE entity_pattern_matches (
    entity_id UUID REFERENCES entities(id),
    hypothesis_id UUID REFERENCES investigative_hypotheses(id),
    match_strength REAL,
    matching_topics TEXT[],
    counter_evidence TEXT[],
    snapshot_id UUID REFERENCES topic_snapshots(id),
    computed_at TIMESTAMPTZ DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id),
    review_status TEXT,  -- NULL, 'relevant', 'irrelevant'
    PRIMARY KEY (entity_id, hypothesis_id, snapshot_id)
  );
  ```
- [ ] Verify: known perpetrators match expected patterns; known innocents don't

### 3.6 Entity Similarity
- [ ] Compute fingerprint vectors for entities with 10+ documents:
  - Dense vector of topic percentages (length = num_topics)
  - Normalize to probability distribution
- [ ] Use **Jensen-Shannon Divergence** (not cosine) for distribution similarity:
  ```python
  from scipy.spatial.distance import jensenshannon
  similarity = 1 - jensenshannon(fingerprint_a, fingerprint_b)
  ```
- [ ] Precompute top-20 similar entities per entity (batch job)
- [ ] Store in `entity_similar_fingerprints` table
- [ ] Verify: entities with similar known roles cluster together

### 3.7 Unsupervised Anomaly Detection
- [ ] In addition to hypothesis matching, implement anomaly detection (no predefined patterns):
  - **Cluster bridge**: entity appears in 3+ topic clusters that rarely co-occur for other entities
  - **High centrality, low scrutiny**: high PageRank/betweenness but few direct mentions
  - **Temporal burst**: mentions concentrated in narrow time window
  - **Fingerprint outlier**: entity whose fingerprint is distant from all other entities (isolation score)
- [ ] Store anomalies as `investigation_leads` with lead_type and explanation
- [ ] These are discovery signals, not accusations — frame accordingly in UI
- [ ] Verify: anomalies surface genuinely interesting patterns, not just noise

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/00033_entity_fingerprints.sql` | Create |
| `lib/pipeline/services/pattern-detector.ts` | Modify (implement matching) |
| `lib/pipeline/services/anomaly-detector.ts` | Create |
| `app/api/hypotheses/route.ts` | Create |
| `app/api/hypotheses/[id]/route.ts` | Create |
| `app/api/hypotheses/[id]/matches/route.ts` | Create |
| `app/api/hypotheses/[id]/review/route.ts` | Create |
| `types/hypotheses.ts` | Create |
| `lib/hooks/useHypotheses.ts` | Create |
| `scripts/batch/compute-fingerprints.ts` | Create |

## Agent Workflow

```
1. PLAN:    Launch Plan agent to design hypothesis matching algorithm
            Launch DeepReason agent to verify JSD math + threshold calibration
2. BUILD:   Implement fingerprint view, hypothesis CRUD, pattern matching
3. REVIEW:  Launch security-reviewer for RLS on hypotheses table
            Launch CodeReviewer for matching logic
4. RUN:     Execute fingerprint computation + pattern matching batch
5. VERIFY:  Launch Explore agent to validate matches against known entities
```

## Definition of Done

- [ ] Entity fingerprints computed for all entities with 10+ document mentions
- [ ] Reliability tiers applied (entities with <10 docs excluded from matching)
- [ ] Role-aware scoring prevents lawyers/journalists from matching criminal patterns
- [ ] Hypothesis CRUD API works with calibration tracking
- [ ] Pattern matching produces results for seeded hypotheses
- [ ] At least 3 anomaly detection types implemented
- [ ] Results validated against known entities (Epstein, Maxwell, known associates)
