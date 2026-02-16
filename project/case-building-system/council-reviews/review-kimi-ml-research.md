# Council Review: ML & Topic Modeling Research
**Reviewer:** Kimi K2.5 (via Fireworks AI)
**Focus:** Topic modeling alternatives, pattern matching robustness, embedding quality

## Key Findings

### 1. Abandon BERTopic for This Scale

UMAP is O(N log N) with NN descent, but at 8M x 1024d needs ~60-80GB RAM and 6-12 hours on V100. HDBSCAN is O(N^2) worst case. c-TF-IDF on 8M is I/O bound.

**Recommended: FAISS GPU IVF clustering**
```python
faiss.index_factory(1024, "IVF4096,PQ32")
# Cluster 8M vectors in ~20 minutes on A100
```
- Embeddings are already semantic — UMAP dimensionality reduction destroys linear separability needed for legal fine distinctions (e.g., "travel for exploitation" vs. "travel for leisure")
- Label centroids via LLM on 50 nearest chunks each
- For hierarchy: run HDBSCAN on the ~500-2000 centroids only (tiny, feasible)

**Why not Top2Vec?** Uses Doc2Vec (outdated for legal text, misses long-range dependencies).
**Why not LDA on embeddings?** Spherical clustering assumptions fail in high dimensions.

### 2. Replace Hard Templates with Fuzzy Graph Motifs

Hard-coded templates fail because:
- Topics are soft distributions (entity might be 0.4 "travel", 0.3 "recruitment")
- Topic definitions drift across retrainings (UMAP stochasticity)
- Legal concepts are polysemous ("travel" could be legitimate)

**Recommended alternatives:**
- **Tversky Index** (asymmetric similarity) to compare entity fingerprints to seed entities
- **Non-negative Tensor Factorization (NTF)** on Entity x Topic x Time 3D tensor → reveals co-occurring patterns
- **Few-shot learning:** Annotate 50 known criminal entities, train Set Transformer to learn scoring function

### 3. Narrative Generation: Use Claim-Evidence-Reasoning

Raw LLM generation will hallucinate citations. Topic distributions lack specific evidentiary spans.

**CER pipeline:**
1. **Claim Extraction:** LLM generates Subject-Predicate-Object hypothesis graph
2. **Evidence Retrieval:** Filter chunks by topic → re-rank with ColBERTv2 → top-10 with span highlighting
3. **Citation Verification:** Constrained LLM pass — output only from provided chunks, or "INSUFFICIENT EVIDENCE"
4. **Consistency Check:** NLI model (bart-large-mnli) verifies sentences entail the chunks

**Prompt engineering:** Use few-shot with negative examples:
```
Good: "Documents indicate X traveled to locations [442:12-45]"
Bad:  "X trafficked victims to the island" (hallucinated conclusion)
```

### 4. Better Lead Generation Signals

Current signals analysis:
- High centrality → flags secretaries, event planners (misleading)
- Temporal bursts → court dates cause spikes (not criminal)
- Cluster bridges → detects brokers, not necessarily criminals

**Better approaches:**
- **GraphSAGE autoencoder** on entity-document bipartite graph → anomalies = high reconstruction error
- **Spectral co-clustering** on Entity x Document matrix → finds document communities sharing rare entities
- **CP-ALS tensor decomposition** on Entity x Document x Time → entities loading on hidden criminal-correlated components
- **Isolation Forest** directly on 1024d embeddings → semantically anomalous chunks (coded language)

### 5. Temporal Topic Modeling

Running BERTopic independently on time slices creates **topic alignment issues** (Topic 5 in 2002 ≠ Topic 5 in 2003).

**Recommended:**
- Sliding window clustering with overlapping 6-month buffers
- Enforce centroid proximity across windows (cosine distance < 0.3 = same topic)
- Temporal topic embeddings: weighted average of document embeddings per topic per time window
- Detect "anomalous acceleration" (sudden semantic drift) as event onset indicators

### 6. Embedding Quality Concerns

Amazon Nova is multimodal and general-domain. Legal documents have:
- Normative language ("shall", "pursuant to")
- Named entities with aliases
- Long-range coreference (victim referred to as "the minor" 10 pages later)

**Checks:**
- Compute cosine variance. If 95% of pairwise similarities > 0.8, embeddings are too coarse (collapse)
- Run UMAP on 10K sample to visualize. If "financial transfer" and "travel itinerary" overlap → insufficient granularity

**If embeddings are too coarse:**
- Fine-tune LoRA adapter (rank 16) on legal entailment pairs. Cost: ~2 hours on A100
- Or replace with E5-Mistral-7B (instruction-tuned for retrieval) or GTE-Large fine-tuned on legal contracts

### 7. HDBSCAN Stability

UMAP + HDBSCAN is inherently non-deterministic. Small changes in embedding set produce different clusters. Critical for a system that needs stable topic references.

**Mitigations:** Deterministic seed, centroid tracking across versions, minimum-cost matching for cluster alignment.
