# Council Review: Investigative Integrity & System Design
**Reviewer:** Claude Opus 4.6 (via Task agent)
**Focus:** Ethics, confirmation bias, false positives, implementation order

## Key Findings

### 1. Criminal Pattern Templates = Confirmation Bias by Design
When you define "trafficking = travel + recruitment + victim mentions," you are encoding a prosecutorial hypothesis and searching for evidence that fits. This is literally confirmation bias.

**A defense attorney who traveled to the Virgin Islands, reviewed victim testimony, and handled financial records will light up every single template.**

**Recommendation:** Two modes:
- **Mode A (unsupervised):** Let clustering surface patterns you didn't expect. Present co-occurrence patterns as observations, not accusations.
- **Mode B (hypothesis-driven):** Templates are user-defined, explicitly labeled as "hypotheses under test," include counter-indicators, and track base rate calibration.

### 2. Narrative Generation: The Authoritative Hallucination Problem
Auto-generated case summaries will:
- Confuse correlation with causation
- Fill gaps with plausible-sounding inference
- Create a veneer of authority (well-formatted PDF = looks like a legal brief)

**Required guardrails:**
- Sentence-level provenance tagging: `[DOCUMENTARY]`, `[INFERRED]`, `[STATISTICAL]`, `[CONTEXTUAL]`
- Adversarial framing: generate BOTH prosecution and defense views
- Mandatory human review gate before export
- Prominent header: "AI-ASSISTED ANALYSIS — NOT A LEGAL DOCUMENT"
- Consider: no proper names in generated text (use Entity IDs, human fills in names)

### 3. False Positives Are Severe
High-risk categories for misclassification:
| Role | Why they appear | Risk |
|------|----------------|------|
| Defense attorneys | Travel, victim contact, financials | Extremely high |
| Journalists | Investigation records, contacts | High |
| Law enforcement | Case files, interviews, surveillance | High |
| Financial professionals | Transactions, accounts | High |
| Household staff | Presence, scheduling, payroll | Moderate |

**Required:** Role-aware scoring with negative risk weight for legal/journalist/law enforcement roles.

### 4. Entity Fingerprint Minimum Thresholds
| Documents | Reliability | Recommended Use |
|-----------|-------------|-----------------|
| 1-3 | Unreliable | Exclude from fingerprinting |
| 4-10 | Low | Heavy uncertainty weighting |
| 11-30 | Moderate | Full fingerprinting with flags |
| 31+ | High | Full analysis |

Estimate: fewer than 200 entities will have truly reliable fingerprints.

### 5. Fix Foundations Before Adding Layers
**P0:** Fix entity descriptions (all NULL), weight relationship types, implement evidence graph
**P1:** Hypothesis-driven patterns, provenance tagging, 10-doc threshold
**P2:** Contradiction detection, document credibility taxonomy, temporal windowing
**P3:** Tiered access controls, audit trail, adversarial robustness

### 6. Versioning and Reproducibility
- Immutable topic snapshots with versioned IDs
- Hungarian algorithm for cluster alignment across versions
- Deterministic UMAP seed
- Changelog for every recomputation
- Downstream cache invalidation on cluster change

### 7. What's Missing
- **Evidence graph** (DAG tracing claims to specific document pages)
- **Contradiction detection** (system only confirms, never challenges)
- **Document credibility taxonomy** (not all docs are equal — already exists but underdeveloped)
- **Temporal decay** (30-year static graph is misleading)
- **Audit trail** (every query/export logged for accountability)
- **Adversarial robustness** (threat model for misuse)
- **Null result communication** (system should clearly say "nothing unusual found")

### Overarching Principle
> "This system should make researchers *more careful*, not less. Every feature should be designed to slow down conclusions, surface uncertainty, and demand verification."
