# Automated Case-Building System

## Vision

Use embedding clustering on 2.7M pages (~8M chunks) of DOJ documents to automatically discover themes, surface criminal patterns, build evidence-backed cases around individuals, and generate investigation leads — while maintaining investigative integrity and avoiding false accusations.

## Architecture (Three Layers)

```
Layer 1: TOPIC DISCOVERY          What are the documents about?
         (FAISS IVF clustering)   → clusters, labels, dynamic filters, zoomable map

Layer 2: ENTITY FINGERPRINTING    What is each person involved in?
         (per-entity topic dist)  → topic profiles, hypothesis-driven pattern matching

Layer 3: CASE ASSEMBLY            What's the case against them?
         (CER pipeline)           → provenance-tagged narratives, evidence chains, leads
```

## Key Architecture Decisions (from Council Review)

### 1. FAISS IVF, not UMAP + HDBSCAN
The original plan proposed UMAP + HDBSCAN + BERTopic. **All four reviewers agreed this won't work at 8M scale.** UMAP needs 100-200GB GPU RAM for 8M x 1024d. HDBSCAN is O(N^2) worst case.

**Decision:** Use FAISS GPU IVF clustering (k=500-2000 centroids, ~20 min on A100), then hierarchical merging of centroids via HDBSCAN on the ~2000 centroids (not the 8M points). LLM-label clusters from representative chunks.

### 2. Hypothesis-Driven Patterns, not Hardcoded Templates
The original plan hardcoded patterns like `trafficking = travel + recruitment + victim`. **All reviewers flagged this as confirmation bias by design.**

**Decision:** Patterns are user-defined "Investigative Hypotheses" with required counter-indicators, base rate calibration, and falsifiability criteria. The system also runs unsupervised anomaly detection to surface unexpected patterns.

### 3. Provenance-Tagged Narratives, not Raw LLM Output
Auto-generated case summaries without provenance are dangerously misleading.

**Decision:** Implement Claim-Evidence-Reasoning (CER) pipeline. Every sentence tagged as `[DOCUMENTARY]`, `[INFERRED]`, `[STATISTICAL]`, or `[CONTEXTUAL]`. Adversarial framing generates both prosecution and defense views. Mandatory human review gate before PDF export.

### 4. Vector Tiles (MVT), not Raw Scatter Plot
8M points will crash the browser.

**Decision:** Pre-process UMAP 2D coordinates into vector tiles via Tippecanoe. Deck.gl MVTLayer renders only visible points. LOD switching: hexbin aggregation at low zoom, individual points at high zoom. Entity search via separate overlay layer.

### 5. Fix Foundations First
Entity descriptions are all NULL. 14 of 20 relationship types contribute zero to risk scores. The pattern-detector.ts is an empty stub.

**Decision:** Phase 1 fixes these prerequisites before adding clustering layers.

## Phases

| Phase | Name | Focus | Status |
|-------|------|-------|--------|
| 0 | [Foundations](phase-00-foundations.md) | Fix entity descriptions, relationship weights, pattern detector stub | Not started |
| 1 | [Topic Clustering](phase-01-clustering.md) | FAISS IVF clustering, topic labeling, DB write-back | Not started |
| 2 | [Visualization](phase-02-visualization.md) | Vector tiles, Deck.gl MVT, LOD, topic sidebar | Not started |
| 3 | [Entity Fingerprinting](phase-03-fingerprinting.md) | Topic fingerprints, hypothesis framework, pattern matching | Not started |
| 4 | [Case Assembly](phase-04-case-assembly.md) | CER pipeline, provenance tagging, evidence compilation | Not started |
| 5 | [Guardrails & Ethics](phase-05-guardrails.md) | Access controls, adversarial framing, audit trail | Not started |

## Agent Workflow

Each phase follows this pattern:

```
1. PLAN    → Launch Plan agent (Opus) to design implementation details
2. BUILD   → Implement code (Claude Code main session)
3. REVIEW  → Launch council review:
              - CodeReviewer agent (GPT-5.2 Codex) for code quality
              - security-reviewer agent (Opus) for RLS/auth
              - DeepReason agent (DeepSeek R1) for logic verification
              - FrontendExpert agent (Gemini) for UI components
4. FIX     → Address review findings
5. VERIFY  → Run tests, validate against known entities
```

## Council Reviews

Full reviews from four independent models are preserved in `council-reviews/`:
- [Claude Opus — Investigative Integrity](council-reviews/review-opus-integrity.md)
- [GPT-5.2 Codex — Data Engineering](council-reviews/review-gpt5-engineering.md)
- [Gemini 3 Pro — Visualization](council-reviews/review-gemini-visualization.md)
- [Kimi K2.5 — ML Research](council-reviews/review-kimi-ml-research.md)

## Cost Estimates

| Component | Compute | Cost |
|-----------|---------|------|
| FAISS IVF clustering (8M x 1024d) | ~20 min GPU | $2-5 |
| UMAP 2D projection (for viz) | ~2 hrs GPU | $5-10 |
| Tippecanoe tile generation | ~30 min CPU | $0 |
| Topic labeling (LLM on ~500 clusters) | ~10 min | $0.50 |
| Entity fingerprints (SQL materialized view) | ~10 min | $0 |
| Narrative generation (~500 high-risk entities) | ~30 min | $2-5 |
| **Total** | **~4 hours** | **$10-25** |
