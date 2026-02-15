# Council Review: Data Engineering & Scale
**Reviewer:** GPT-5.2 Codex (via OpenAI Responses API)
**Focus:** Scale feasibility, memory requirements, pipeline engineering

## Key Findings

### 1. UMAP + HDBSCAN at 8M: NOT FEASIBLE

**UMAP:**
- 8M x 1024d = ~32 GB for embeddings alone
- UMAP needs: kNN graph (~120-400M edges, 2-6 GB) + weights + intermediate arrays
- cuML UMAP needs 2-4x input size = **100-200 GB GPU memory**
- Conclusion: won't fit on any single GPU. "4 hours" estimate is not credible.

**HDBSCAN:**
- Notoriously expensive at scale. Even cuML struggles beyond 2-3M points.
- O(N log N) with heavy constant factors + memory blowup in mutual reachability graph
- 8M x 50d → expect **multi-day runtime** or OOM

### 2. Better Alternatives

**Option A: MiniBatchKMeans** (spherical, on normalized embeddings)
- k = 5K-50K initial clusters, then hierarchical merging by centroid similarity

**Option B: Graph-based clustering**
- Build ANN graph with FAISS (IVF/HNSW), then Leiden/Louvain community detection
- This is how people cluster 10M+ embeddings without HDBSCAN

**Option C: Two-stage**
- Coarse clusters via LSH or IVF partitioning → HDBSCAN within each shard

### 3. Data Engineering Gaps

**Missing from the pipeline:**
- Metadata snapshotting/versioning (embedding version, cluster algo, run_id)
- Export pipeline: pulling 8M rows in one query will timeout. Need batched export + Parquet caching
- Near-duplicate filtering: legal boilerplate will dominate clusters
- Text preprocessing for c-TF-IDF: custom stopword list for legal terms
- Data lineage + rollback tracking

**Required engineering:**
- Store `embedding_version`, `topic_version`, `cluster_algo`, `run_id`
- Use Parquet + Arrow for transfer, load directly to GPU
- Partitioned job (Spark + RAPIDS) recommended for 8M

### 4. BERTopic c-TF-IDF on Legal Docs

Expected failure modes:
- Topics dominated by boilerplate ("hereinafter", "pursuant", "affidavit")
- Long procedural filings drown semantic signals
- Cluster labels meaningless without removing docket boilerplate

**Better:** Custom stopword lists + Keyphrase extraction (YAKE/KeyBERT) + LLM labeling on representative samples

### 5. Incremental Updates: Full Recompute Not Realistic

If UMAP/HDBSCAN took 1-3 days, can't re-run weekly.

**Options:**
- MiniBatchKMeans with online updates (new chunks → nearest centroid)
- Periodic merge/rebalance rather than full recompute
- BERTopic's `partial_fit` exists but HDBSCAN is not incremental

### 6. Fingerprint Similarity Metric

Cosine on topic distributions is OK but distributions are sparse and long-tailed.

**Better:**
- Jensen-Shannon Divergence or Hellinger distance for probability distributions
- Compute similarity on top-K topics only with weighted overlap
- Normalize by entropy (high-entropy profiles shouldn't match strongly)

### 7. Other Scale Concerns

- **Deck.gl 8M scatter:** will choke browsers. Need multiscale tiles, binning, LOD, or sampling. 1-2M cap realistic.
- **Cost estimate ($15-25):** Not credible for actual compute. More realistic: $50-200 for GPU time.
- **Cluster count (200-500):** Too low for 8M chunks. Expect thousands unless extremely coarse.
- **Write-back:** Store cluster confidence, membership probabilities, and embedding version. Keep HDBSCAN outlier scores.

### Concrete Alternative Plan

1. FAISS IVF/PQ or HNSW → ANN index
2. MiniBatchKMeans (k=20K-50K)
3. Hierarchical merging → ~1K-3K topics
4. LLM labeling on representative chunks
5. New chunks → nearest centroid assignment (incremental)
6. Jensen-Shannon Divergence for fingerprint similarity
