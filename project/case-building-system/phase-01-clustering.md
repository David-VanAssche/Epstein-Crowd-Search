# Phase 1: Topic Clustering

**Status:** Not started
**Prerequisites:** Phase 0 (entity descriptions + relationship weights)
**Blocks:** Phase 2 (visualization), Phase 3 (fingerprinting)

## Why FAISS IVF Instead of UMAP + HDBSCAN

The original plan proposed UMAP + HDBSCAN + BERTopic. The council review identified fatal scale problems:

- **UMAP** at 8M x 1024d needs 100-200GB GPU RAM (kNN graph + intermediate arrays). Won't fit on any single GPU.
- **HDBSCAN** is O(N^2) worst case. At 8M points: multi-day runtime or OOM.
- **BERTopic c-TF-IDF** on legal docs produces labels dominated by boilerplate ("pursuant", "hereinafter").

**FAISS IVF clustering** handles 8M x 1024d in ~20 minutes on an A100. Then run HDBSCAN on the ~2000 centroids (not the 8M points) for hierarchy.

## Checklist

### 1.1 Embedding Export
- [ ] Write export script: batch SELECT from pgvector → Apache Arrow/Parquet
  - `SELECT id, content_embedding FROM chunks WHERE content_embedding IS NOT NULL`
  - Batch size: 50K rows per query (avoid timeout)
  - Output: Parquet file(s) on GPU VM disk
  - Include metadata columns: `document_id`, `page_number`, `section_title`
- [ ] Verify: row count matches expected (~8M), no NULL embeddings in output
- [ ] Record `embedding_model` and `embedding_count` for reproducibility

### 1.2 FAISS IVF Clustering
- [ ] Spin up GPU VM (A100 or L4) on GCP project `epsteinproject`
- [ ] Install FAISS GPU: `pip install faiss-gpu`
- [ ] Implement clustering script:
  ```python
  import faiss
  import numpy as np

  # Load embeddings (memory-mapped for 32GB)
  embeddings = np.memmap('embeddings.npy', dtype='float32', mode='r', shape=(N, 1024))

  # Normalize for cosine similarity
  faiss.normalize_L2(embeddings)

  # Train IVF index with k centroids
  ncentroids = 2000
  quantizer = faiss.IndexFlatIP(1024)
  index = faiss.IndexIVFFlat(quantizer, 1024, ncentroids, faiss.METRIC_INNER_PRODUCT)

  # Use GPU
  res = faiss.StandardGpuResources()
  gpu_index = faiss.index_cpu_to_gpu(res, 0, index)
  gpu_index.train(embeddings)

  # Assign each point to nearest centroid
  _, assignments = gpu_index.search(embeddings, 1)
  ```
- [ ] Tune `ncentroids` (start with 2000, evaluate silhouette on sample)
- [ ] Save: centroid vectors, assignments, cluster sizes
- [ ] Verify: no cluster has >5% of all points (too coarse), no cluster has <50 points (noise)

### 1.3 Hierarchical Merging
- [ ] Run HDBSCAN on the ~2000 centroid vectors (this is feasible — 2000 x 1024d is tiny)
  ```python
  import hdbscan
  clusterer = hdbscan.HDBSCAN(min_cluster_size=5)
  meta_labels = clusterer.fit_predict(centroids)
  ```
- [ ] This produces a two-level hierarchy: ~100-300 meta-topics containing ~2000 sub-topics
- [ ] Save hierarchy mapping: `{sub_topic_id: meta_topic_id}`

### 1.4 Topic Labeling
- [ ] For each of the ~2000 sub-topics, sample 50 representative chunks (nearest to centroid)
- [ ] Use Gemini Flash to generate labels:
  ```
  Prompt: "These 50 text excerpts are from the same topic cluster in a
  legal document archive about the Jeffrey Epstein case. Generate:
  1. A 3-5 word topic label
  2. A 20-word description
  3. The 5 most distinctive terms
  Do NOT use generic labels. Be specific to the content."
  ```
- [ ] For meta-topics (~100-300), generate parent labels from child labels
- [ ] Store in `topic_clusters` table
- [ ] **Manual review pass**: Domain experts review top 100 topics, correct labels

### 1.5 Legal Boilerplate Handling
- [ ] Create custom stopword list for legal documents:
  - Procedural terms: "pursuant", "hereinafter", "aforementioned", "stipulated"
  - Court headers: docket numbers, case numbers, court names
  - Standard disclaimers and form language
- [ ] Apply during labeling (exclude from representative terms)
- [ ] Consider: should boilerplate chunks be excluded from clustering entirely?

### 1.6 UMAP 2D Projection (for visualization only)
- [ ] Run UMAP on a **subsample** (1M-2M points) for 2D coordinates
  - Or: use FAISS centroids as landmarks, project remaining points via nearest-centroid interpolation
  - Alternative: use PaCMAP (faster, more stable than UMAP at scale)
- [ ] Save 2D coordinates alongside cluster assignments
- [ ] This is input for Phase 2 (Tippecanoe tile generation)

### 1.7 Database Write-Back
- [ ] Create migration `00032_topic_clusters.sql`:
  ```sql
  CREATE TABLE topic_clusters (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    parent_id INT REFERENCES topic_clusters(id),
    chunk_count INT DEFAULT 0,
    representative_terms TEXT[] DEFAULT '{}',
    representative_chunk_ids UUID[] DEFAULT '{}',
    centroid VECTOR(1024),
    metadata JSONB DEFAULT '{}'
  );

  CREATE TABLE topic_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    parameters JSONB NOT NULL,
    num_topics INT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_count BIGINT NOT NULL,
    status TEXT DEFAULT 'active'
  );

  ALTER TABLE chunks ADD COLUMN topic_cluster_id INT REFERENCES topic_clusters(id);
  ALTER TABLE chunks ADD COLUMN topic_snapshot_id UUID REFERENCES topic_snapshots(id);
  ```
- [ ] Batch UPDATE chunks with cluster assignments (50K per batch)
- [ ] Update `topic_clusters.chunk_count` aggregates
- [ ] Verify: every embedded chunk has a topic_cluster_id

### 1.8 Cluster Quality Validation
- [ ] Inspect 30 random clusters — do chunks share a coherent theme?
- [ ] Check known document groupings: do all flight logs cluster together? All depositions?
- [ ] Measure intra-cluster vs inter-cluster cosine similarity
- [ ] Check for "junk clusters" dominated by boilerplate

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/clustering/export-embeddings.py` | Export from pgvector to Parquet |
| `scripts/clustering/faiss-cluster.py` | FAISS IVF clustering + HDBSCAN hierarchy |
| `scripts/clustering/label-topics.py` | LLM labeling of clusters |
| `scripts/clustering/umap-project.py` | 2D projection for visualization |
| `scripts/clustering/write-back.py` | Write cluster assignments to DB |
| `supabase/migrations/00032_topic_clusters.sql` | Schema for topics + snapshots |

## Agent Workflow

```
1. PLAN:    Launch Plan agent to finalize FAISS hyperparameters
            (ncentroids, nprobe, metric) based on embedding distribution
2. BUILD:   Write clustering scripts (Python, run on GPU VM)
3. REVIEW:  Launch DeepReason agent to verify clustering math
            Launch CodeReviewer for script quality
4. RUN:     Execute on GPU VM (epstein-uploader or new instance)
5. VERIFY:  Launch Explore agent to sample clusters and validate quality
```

## Definition of Done

- [ ] ~2000 sub-topics and ~200 meta-topics stored in `topic_clusters`
- [ ] Every embedded chunk has `topic_cluster_id` assigned
- [ ] Topic labels reviewed by domain expert (at least top 100)
- [ ] Snapshot versioning in place (`topic_snapshots` table)
- [ ] 2D UMAP coordinates saved for visualization pipeline
- [ ] Clustering quality metrics documented
