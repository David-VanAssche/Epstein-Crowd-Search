# Automated Case-Building via Embedding Clustering
**Status**: Architecture reference document

## Context

The system has 1024d Nova embeddings on millions of chunks, plus per-entity risk scores, criminal indicators, 20 relationship types, timeline events, and network metrics (PageRank, betweenness, community detection). But nothing **synthesizes** these signals into coherent cases. The `pattern-detector.ts` is an empty stub. Entity descriptions are always NULL. The Prosecutor Dashboard lists entities by risk score but provides no assembled evidence.

The question: how do embedding maps/clustering tools automatically discover themes, surface criminal patterns, and build cases around individuals?

---

## The Three-Layer Architecture

```
Layer 1: TOPIC DISCOVERY          What are the documents about?
         (BERTopic/HDBSCAN)       → clusters, labels, dynamic filters
                                       │
Layer 2: ENTITY FINGERPRINTING    What is each person involved in?
         (per-entity topic dist)  → topic profiles, pattern matching
                                       │
Layer 3: CASE ASSEMBLY            What's the case against them?
         (evidence compilation)   → narrative, evidence chain, export
```

---

## Layer 1: Topic Discovery (Corpus-Wide Clustering)

### What it does
Takes the ~8M chunk embeddings already in pgvector, runs UMAP + HDBSCAN to discover natural topic clusters, then auto-labels each cluster. This creates the "embedding map" and the dynamic filter taxonomy.

### Pipeline

```
1. Export chunk embeddings from pgvector
   SELECT id, content_embedding FROM chunks WHERE content_embedding IS NOT NULL
   → ~8M vectors × 1024d → numpy memmap (~32 GB)

2. UMAP dimensionality reduction
   1024d → 50d (for clustering, preserves more structure than 2D)
   1024d → 2d  (for visualization only)
   GPU-accelerated: cuml.UMAP on a T4/L4 instance

3. HDBSCAN clustering on 50d UMAP output
   min_cluster_size=100 (prevents micro-clusters)
   → ~200-500 natural topic clusters + noise label (-1)

4. Topic labeling via BERTopic c-TF-IDF
   For each cluster, extract top 10 representative terms
   Then LLM-summarize into a human label:
   Cluster 47: ["wire", "transfer", "account", "bank", "deposit"]
     → "Wire Transfers & Banking"
   Cluster 112: ["flight", "passenger", "manifest", "departure", "teterboro"]
     → "Flight Manifests - Teterboro"
   Cluster 203: ["massage", "schedule", "appointment", "girl", "young"]
     → "Massage Scheduling (Recruitment Indicators)"

5. Hierarchical topic merging
   BERTopic produces a topic hierarchy (dendrogram)
   → Level 0: "Financial Records" (parent)
   → Level 1: "Wire Transfers", "Property Purchases", "Trust Documents" (children)
   This hierarchy becomes the dynamic filter tree in the UI

6. Write back to database
   ALTER TABLE chunks ADD COLUMN topic_cluster_id INT;
   ALTER TABLE chunks ADD COLUMN topic_label TEXT;
   New table: topic_clusters (id, label, description, parent_id, chunk_count,
     representative_terms[], representative_chunk_ids[], centroid VECTOR(1024))
```

### What the user sees
- A zoomable 2D scatter plot (UMAP projection) where each dot is a chunk, colored by cluster
- Hovering shows document title + snippet
- Clicking a region filters the document browser to that topic
- Sidebar shows hierarchical topic tree with counts: "Financial (142K) > Wire Transfers (38K) > Offshore (12K)"
- Topics that correlate with criminal indicators are flagged (red tint on the map)

### Scale / Cost
- One-time computation on a GPU VM (~$5-10 in compute)
- Re-run periodically as new documents are processed (incremental UMAP possible but full recompute is simpler)
- Storage: ~32 MB for cluster assignments (8M rows × 4 bytes)

---

## Layer 2: Entity Topic Fingerprinting

### What it does
For each entity, computes a **topic fingerprint** — a distribution showing what percentage of their mentions fall in each topic cluster. This transforms entities from "mentioned in N documents" to "40% financial, 30% travel, 20% recruitment, 10% legal."

### Computation

```sql
-- Per-entity topic distribution
CREATE MATERIALIZED VIEW entity_topic_fingerprints AS
SELECT
  em.entity_id,
  c.topic_cluster_id,
  tc.topic_label,
  COUNT(*) AS mention_count,
  SUM(em.evidence_weight) AS total_weight,
  COUNT(*)::FLOAT / SUM(COUNT(*)) OVER (PARTITION BY em.entity_id) AS topic_pct
FROM entity_mentions em
JOIN chunks c ON c.id = em.chunk_id
JOIN topic_clusters tc ON tc.id = c.topic_cluster_id
WHERE c.topic_cluster_id IS NOT NULL
GROUP BY em.entity_id, c.topic_cluster_id, tc.topic_label;
```

### Criminal Activity Pattern Templates

Define known criminal patterns as expected topic distributions:

```typescript
const CRIMINAL_PATTERNS = {
  trafficking: {
    description: "Travel + recruitment + victim mentions + scheduling",
    required_topics: ["travel/flights", "massage/scheduling", "recruitment"],
    boosting_topics: ["victim testimony", "hotel/property", "phone records"],
    min_topic_count: 3,        // Must appear in at least 3 of these
    min_evidence_weight: 2.0,  // Minimum total evidence weight across pattern topics
  },

  money_laundering: {
    description: "Financial + shell companies + offshore + property",
    required_topics: ["wire transfers", "trust/shell entities", "property"],
    boosting_topics: ["offshore", "cash transactions", "tax filings"],
    min_topic_count: 2,
    min_evidence_weight: 1.5,
  },

  obstruction: {
    description: "Legal proceedings + document handling + witness contact",
    required_topics: ["legal/court", "correspondence"],
    boosting_topics: ["shredding/destruction", "witness contact", "NDA/settlement"],
    min_topic_count: 2,
    min_evidence_weight: 1.0,
  },

  conspiracy_coordination: {
    description: "Communication + travel + meetings + multiple associates",
    required_topics: ["correspondence/email", "travel/flights", "meetings"],
    boosting_topics: ["phone records", "scheduling", "coded language"],
    min_topic_count: 3,
    min_evidence_weight: 1.5,
  },
}
```

### Pattern Matching

For each entity with risk_score > 1.0, compare their topic fingerprint against each criminal pattern template:

```
Entity "Person X":
  topic_fingerprint = {
    "Flight Manifests": 35% (weight 4.2),
    "Massage Scheduling": 22% (weight 2.8),
    "Wire Transfers": 18% (weight 2.1),
    "Victim Testimony": 15% (weight 1.9),
    "Legal Proceedings": 10% (weight 1.2)
  }

  → MATCHES: trafficking (3/3 required topics, weight 9.0 >> 2.0 threshold)
  → MATCHES: money_laundering (2/2 required topics, weight 6.3 >> 1.5 threshold)
  → PARTIAL: obstruction (1/2 required topics)
```

### Entity Similarity via Fingerprints

Two entities with similar topic fingerprints may be co-conspirators:

```sql
-- Find entities with similar topic fingerprints to a target entity
-- Uses cosine similarity on topic distribution vectors
SELECT
  b.entity_id,
  e.name,
  1 - (a.fingerprint_vec <=> b.fingerprint_vec) AS similarity
FROM entity_fingerprint_vectors a
JOIN entity_fingerprint_vectors b ON b.entity_id != a.entity_id
JOIN entities e ON e.id = b.entity_id
WHERE a.entity_id = $TARGET_ENTITY_ID
ORDER BY a.fingerprint_vec <=> b.fingerprint_vec
LIMIT 20;
```

This answers: "Who else has a similar pattern of involvement to Person X?"

---

## Layer 3: Automated Case Assembly

### What it does
For each entity flagged by pattern matching, automatically compiles an evidence package — a structured "case file" with narrative, evidence chains, and citations.

### Case File Structure

```typescript
interface AutomatedCase {
  entity: {
    id: string
    name: string
    risk_score: number          // 0-5
    risk_factors: RiskFactors   // Breakdown
    network_metrics: {
      pagerank: number          // Importance in network
      betweenness: number       // Bridge figure score
      cluster_id: number        // Community membership
    }
  }

  // From Layer 2 pattern matching
  matched_patterns: {
    pattern_name: string        // "trafficking", "money_laundering"
    match_strength: number      // 0-1
    matched_topics: string[]    // Which topic clusters triggered
    evidence_weight: number     // Total evidence weight across pattern
  }[]

  // Topic fingerprint visualization data
  topic_fingerprint: {
    topic_label: string
    percentage: number
    evidence_weight: number
    document_count: number
  }[]

  // Timeline of involvement (from timeline_events + entity_mentions)
  timeline: {
    date: string
    event_type: string
    description: string
    document_id: string
    document_title: string
    evidence_weight: number
  }[]

  // Key relationships ranked by risk contribution
  relationships: {
    other_entity: { id: string, name: string, risk_score: number }
    relationship_type: string
    strength: number
    evidence_documents: string[]
    date_range: string | null
  }[]

  // Criminal indicators aggregated across all documents
  criminal_indicators: {
    category: string            // trafficking, obstruction, etc.
    severity: string
    evidence_snippet: string
    source_document: string
    document_probative_weight: number
  }[]

  // Top evidence documents ranked by evidence_weight
  key_documents: {
    document_id: string
    filename: string
    classification: string
    evidence_weight: number
    summary: string
    criminal_indicators: string[]
    page_count: number
  }[]

  // Contradictions involving this entity
  contradictions: {
    claim_a: string
    claim_b: string
    severity: string
    documents: string[]
  }[]

  // Connected entities with similar patterns (potential co-conspirators)
  similar_entities: {
    entity_id: string
    name: string
    fingerprint_similarity: number
    shared_documents: number
    shared_relationships: string[]
  }[]

  // AI-generated narrative summary
  narrative: string             // 500-1000 word case summary
}
```

### Narrative Generation

The LLM receives the assembled case data and generates a prosecutorial narrative:

```
Prompt: "You are an investigative analyst. Given the following evidence
about {entity_name}, write a 500-1000 word analytical summary of their
involvement. Structure it as:
1. Overview of involvement (1-2 sentences)
2. Pattern analysis (what criminal patterns their activity matches)
3. Key evidence (specific documents, dates, relationships)
4. Connections (who they're linked to and how)
5. Open questions (what remains unresolved)

Be factual. Cite specific documents. Do not speculate beyond the evidence.
Use hedging language ('evidence suggests', 'records indicate')."
```

### Prioritized Lead Generation

The system auto-generates investigation leads by identifying anomalies:

```
Lead types:
1. HIGH CENTRALITY, LOW SCRUTINY
   Entity with high PageRank/betweenness but few direct mentions
   → "Person X connects 3 communities but appears in only 4 documents — investigate"

2. PATTERN MATCH WITHOUT RISK SCORE
   Entity whose topic fingerprint matches a criminal pattern
   but whose risk_score is low (due to low evidence weight)
   → "Person Y's activity matches trafficking pattern but evidence is circumstantial"

3. TEMPORAL BURST
   Entity with clustered mentions in a narrow time window
   → "Person Z has 47 mentions concentrated in March-April 2005"

4. CLUSTER BRIDGE
   Entity that appears in multiple topic clusters that rarely co-occur
   → "Person W uniquely bridges 'Legal Proceedings' and 'Massage Scheduling' clusters"

5. SIMILAR FINGERPRINT TO HIGH-RISK ENTITY
   Entity whose topic fingerprint is >0.85 similar to a risk_score >3.0 entity
   → "Person V has 92% similar activity pattern to [known high-risk person]"
```

---

## How This Connects to the Existing System

### Fills the `pattern-detector.ts` Stub
The empty pattern detector at `lib/pipeline/services/pattern-detector.ts` becomes the home for:
- Topic fingerprint computation
- Criminal pattern template matching
- Anomaly detection (the lead types above)

### Powers the Entity Dossier System
Phase E (AI Entity Summaries) gets the topic fingerprint + matched patterns as input, making entity descriptions data-driven rather than pure LLM summarization.

### Enhances the Prosecutor Dashboard
`app/(public)/prosecutors/page.tsx` currently just lists entities by risk score. With case assembly:
- Each entity row shows matched criminal patterns (icons/badges)
- Clicking opens the full automated case view
- "Export Evidence Package (PDF)" button (currently disabled) can be wired to the case structure
- Filter by criminal pattern type: "Show all entities matching trafficking pattern"

### Feeds Investigation Threads
Auto-generated leads become suggested investigation thread starters. The system can pre-populate threads with relevant documents, entities, and timeline events.

### Connects to Risk Scoring
Topic fingerprint data could feed into a revised risk score formula:
- Current: evidence (2.0) + relationships (1.5) + indicators (1.5) = 5.0 max
- Enhanced: evidence (1.5) + relationships (1.0) + indicators (1.0) + pattern_match (1.5) = 5.0 max
- Pattern match score based on number and strength of matched criminal patterns

### Relationship Score Gap
Currently 14 of 20 relationship types contribute ZERO to risk scores. With topic fingerprinting, relationships like `employed_by`, `guest_of`, `beneficiary_of` gain indirect weight through the topic clusters they co-occur in, even without explicit risk score contribution.

---

## Implementation: What Gets Built

### Phase 1: Topic Clustering (one-time computation)
- Export embeddings from pgvector to numpy
- UMAP + HDBSCAN on GPU VM
- BERTopic labeling + hierarchy
- Write cluster assignments back to DB
- **Output**: `topic_clusters` table, `chunks.topic_cluster_id` column

### Phase 2: Visualization
- 2D UMAP scatter plot component (Deck.gl or react-map-gl for WebGL performance)
- Hierarchical topic filter sidebar
- Color-coding by criminal indicator density
- Entity overlay (highlight chunks mentioning a specific entity)

### Phase 3: Entity Fingerprinting
- `entity_topic_fingerprints` materialized view
- Criminal pattern templates (configurable JSONB)
- Pattern matching engine
- **Output**: Per-entity pattern matches stored in `entities.metadata`

### Phase 4: Case Assembly
- Case compiler service: gathers all evidence for an entity
- LLM narrative generation
- Lead scoring / prioritization
- **Output**: `/api/entity/[id]/case` endpoint returning full `AutomatedCase`

### Phase 5: Case UI
- Entity case view page (structured evidence presentation)
- Prosecutor dashboard enhancements (pattern badges, case links)
- PDF export (Phase G of entity dossier system)
- Investigation thread pre-population from leads

### Phase 6: Feedback Loop
- Community validation of auto-generated cases (verify/dispute)
- Pattern template refinement based on researcher feedback
- Incremental re-clustering as new documents are processed

---

## Tools / Libraries

| Tool | Purpose | Why |
|------|---------|-----|
| **BERTopic** | Topic modeling | Works with pre-computed embeddings, produces hierarchies, auto-labels |
| **UMAP** (cuml GPU) | Dimensionality reduction | Handles 8M+ points, GPU-accelerated |
| **HDBSCAN** | Density clustering | No need to specify k, handles noise, scales well |
| **Deck.gl** | WebGL scatter plot | Renders millions of points in browser at 60fps |
| **Gemini 2.0 Flash** | Narrative generation | Already used throughout pipeline, fast + cheap |

### Scale Estimates

| Step | Data Size | Compute | Cost |
|------|-----------|---------|------|
| Export embeddings | ~32 GB (8M × 1024 × float32) | 20 min | $0 |
| UMAP 1024d → 50d | 8M vectors | 1-3 hrs (GPU) | $3-8 |
| UMAP 1024d → 2d | 8M vectors | 1-2 hrs (GPU) | $3-8 |
| HDBSCAN | 8M × 50d | 30-60 min | included |
| BERTopic labeling | ~300 clusters | 5 min | ~$0.10 |
| Entity fingerprints | ~100K entities | SQL materialized view, 10 min | $0 |
| Pattern matching | ~10K entities (risk > 1.0) | 5 min | $0 |
| Narrative generation | ~500 entities (risk > 2.0) | ~$2-5 (Gemini Flash) | $2-5 |
| **Total** | | **~4 hours** | **~$15-25** |

---

## Verification

1. **Clustering quality**: Inspect 20 random clusters — do chunks within each cluster share a coherent theme?
2. **Topic labels**: Are auto-generated labels accurate? Spot-check 50 clusters against representative chunks
3. **Entity fingerprints**: For known entities (Epstein, Maxwell), do topic fingerprints match expected involvement areas?
4. **Pattern matching**: Do known perpetrators match trafficking/financial crime patterns? Do known victims NOT match perpetrator patterns?
5. **Case narrative**: Are generated narratives factual, properly hedged, and well-cited?
6. **Leads**: Do anomaly-detected leads surface genuinely interesting entities, not just noise?
7. **Dynamic filters**: Do topic filters in the UI produce coherent document sets?
