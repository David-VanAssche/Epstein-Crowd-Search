# Pipeline Model Strategy & Cost Analysis

> Research date: 2026-02-14
> Corpus: ~2,731,789 EFTA pages + images/videos/audio
> Status: Reference document — revisit after dedup/reorganization to get accurate counts

## Overview

Every document passes through 17 pipeline stages. 7 are free (deterministic/compute-only), 3 have fixed provider costs (OCR, embeddings), and **10 require LLM inference** — the focus of this analysis.

## Fixed-Cost Stages (Not Model-Dependent)

| Stage | Provider | Est. Cost | Notes |
|-------|----------|-----------|-------|
| OCR | Google Document AI | ~$4,050 | $1.50/1K pages, no real alternative at this quality |
| Text Embedding | AWS Nova (Bedrock) | ~$270 | $0.10/1M tokens, 1024d unified multimodal space |
| Visual Embedding | AWS Nova Multimodal | ~$90 | Same vector space as text — required for cross-modal search |
| Chunking | Local (deterministic) | $0 | Rule-based 800-1500 char splits |
| Co-Flight Links | DB query | $0 | Cross-references flight logs + email headers |
| Network Metrics | Compute | $0 | PageRank, betweenness centrality, community detection |
| Risk Scoring | Compute | $0 | Composite score from evidence weights |

**Subtotal: ~$4,410**

## LLM-Powered Stages: Three Options

### Option A: Fireworks API (Standard)

All stages via `qwen3-235b` ($0.22/$0.88 per 1M tokens).

| Stage | Input tok/pg | Output tok/pg | Pages | Cost |
|-------|-------------|---------------|-------|------|
| Classification | 500 | 30 | 2.7M | $373 |
| Contextual Headers | 2,000 | 80 | 2.7M | $1,394 |
| Entity Extraction | 2,400 | 600 | 2.7M | $2,885 |
| Relationship Mapping | 1,000 | 150 | 2.7M | $962 |
| Redaction Detection | 600 | 100 | 2.7M | $601 |
| Timeline Extraction | 800 | 100 | 2.7M | $721 |
| Summarization | 2,000 | 200 | 2.7M | $1,683 |
| Criminal Indicators | 1,500 | 150 | 2.7M | $1,262 |
| Email Extraction | 1,000 | 200 | 410K (15%) | $162 |
| Financial Extraction | 1,000 | 200 | 546K (20%) | $216 |
| **TOTAL** | | | | **$10,259** |

### Option B: Fireworks Batch API (50% Discount)

Same as above but submitted as batch jobs (24-48 hour turnaround).

**Total: ~$5,130**

### Option C: Self-Hosted on GCP Spot Instances

#### GPU Options

| GPU | VRAM | Spot Price | Model Fit | vLLM Throughput |
|-----|------|-----------|-----------|-----------------|
| T4 | 16GB | $0.11/hr | Qwen3-8B (tight) | ~1,500 tok/s |
| **L4** | 24GB | **$0.24/hr** | Qwen3-8B comfortably | ~2,500 tok/s |
| **A100 40GB** | 40GB | **$0.88/hr** | Qwen3-32B, 70B (INT4) | ~1,000 tok/s |
| A100 80GB | 80GB | $1.10/hr | Qwen3-70B (FP16) | ~800 tok/s |

#### Cost by Stage Group

**Simple stages (8B model sufficient):**

| Stage | GPU Hours (L4) | Cost |
|-------|---------------|------|
| Classification | 9 hrs | $2 |
| Contextual Headers | 24 hrs | $6 |
| Redaction Detection | 30 hrs | $7 |
| Email Extraction | 9 hrs | $2 |
| Financial Extraction | 12 hrs | $3 |
| **Subtotal** | **86 hrs** | **$21** |

**Complex stages (32B+ model needed):**

| Stage | GPU Hours (A100) | Cost |
|-------|-----------------|------|
| Entity Extraction | 455 hrs | $401 |
| Relationship Mapping | 114 hrs | $100 |
| Timeline Extraction | 76 hrs | $67 |
| Summarization | 152 hrs | $134 |
| Criminal Indicators | 114 hrs | $100 |
| **Subtotal** | **911 hrs** | **$802** |

**Self-hosted total: ~$823 compute + ~$200 overhead = ~$1,023**

## Comparison Summary

| Option | LLM Cost | + Fixed Costs | Grand Total | Time | DevOps |
|--------|---------|---------------|-------------|------|--------|
| Fireworks Standard | $10,259 | $4,410 | **$14,669** | Hours-days | Zero |
| Fireworks Batch (50% off) | $5,130 | $4,410 | **$9,540** | 24-48 hrs | Zero |
| Self-hosted (hybrid 8B+32B) | $1,023 | $4,410 | **$5,433** | 2-6 weeks | High |
| Self-hosted (8B only) | $308 | $4,410 | **$4,718** | ~19 days/GPU | High |

## Recommended Hybrid Approach

Best balance of cost and complexity:

1. **Self-host simple stages** on L4 spot w/ Qwen3-8B: **$21**
   - Classification, contextual headers, redaction detection, email/financial extraction
   - These are straightforward structured extraction — 8B is plenty
   - ~86 GPU-hours on a single L4 (~4 days)

2. **Fireworks Batch for complex stages**: **$3,756**
   - Entity extraction, relationship mapping, timeline, summarization, criminal indicators
   - These need reasoning quality that 32B+ provides
   - Done in 24-48 hours, zero ops burden

3. **Fixed costs**: **$4,410**
   - Google Document AI for OCR
   - AWS Nova for embeddings

**Hybrid total: ~$8,187** (vs $14,669 all-Fireworks, saving ~44%)

## Quality Requirements by Stage

### 8B Model Sufficient
- **Classification**: Simple categorization into 16 types. Even 3B models do this well.
- **Contextual Headers**: Metadata-style summary generation. Pattern-matching heavy.
- **Redaction Detection**: Identifying black-box regions + capturing context. Mostly pattern matching.
- **Email Extraction**: Structured parsing of from/to/cc/body. Template-driven.
- **Financial Extraction**: Structured parsing of amounts/accounts. Template-driven.

### 32B+ Model Required
- **Entity Extraction**: Needs entity disambiguation (which "John" is this?), complex structured JSON output.
- **Relationship Mapping**: Multi-hop reasoning about how entities relate across context.
- **Timeline Extraction**: Temporal reasoning, date normalization, event sequencing.
- **Summarization**: Coherent narrative generation capturing significance.
- **Criminal Indicators**: Nuanced legal/contextual analysis — trafficking indicators vs. normal activity.

## Self-Hosting Setup Notes

### Infrastructure
- Existing GCP project: `epsteinproject`
- Existing VM: `epstein-uploader` in `us-central1-a`
- Would need a new GPU VM (L4 or A100) — spot instance
- Install: vLLM + Qwen3-8B (or 32B for A100)

### Key Considerations
- Spot preemption: checkpoint every ~100K pages, auto-restart
- vLLM throughput assumes optimal continuous batching — real-world expect 70% of peak
- Budget 10-15% extra time for spot disruptions
- Entity extraction alone = 40% of total compute (the bottleneck)

### Parallelization
- 1 L4: simple stages done in ~4 days
- 1 A100: complex stages done in ~6 weeks
- 6 A100s in parallel: complex stages done in ~1 week, but costs $4,800
- Sweet spot: 2-3 A100s, ~2-3 weeks, ~$1,600-2,400

## Before Running: Validation Steps

1. **Dedup first** — actual page count after dedup may be significantly less than 2.7M
2. **Audit seed data** — some docs may already have community OCR/entities that can be imported
3. **Run 10K page pilot** — validate 8B model quality on simple stages before committing
4. **Check Fireworks batch API** — confirm qwen3-235b is eligible for batch pricing
5. **Re-estimate after dedup** — all costs scale linearly with page count

## Cost Per Document Page (All 17 Stages)

| Approach | Cost/Page |
|----------|-----------|
| Fireworks Standard | $0.00537 |
| Fireworks Batch | $0.00349 |
| Hybrid (recommended) | $0.00300 |
| Full self-hosted | $0.00199 |
