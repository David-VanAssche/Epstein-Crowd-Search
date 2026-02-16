# Entity Dossier System — Implementation Plans

## Overview

7 phases to transform the entity system from a basic list + stub tabs into a comprehensive investigative research platform with AI summaries, document evidence, timeline visualization, redaction analysis, and PDF export.

## Current State (Gaps Identified)

| Feature | Status | Phase |
|---------|--------|-------|
| Entity photo/bio (Wikidata data exists, not rendered) | **Gap** | A |
| Dossier API exists but frontend never calls it | **Gap** | A |
| useEntity hook has dead/duplicate queries | **Bug** | A |
| PropertyOwnershipTimeline built but not mounted | **Gap** | A |
| Documents tab (EntityMentions) is a stub | **Gap** | B |
| Timeline tab (EntityTimeline) is a stub | **Gap** | C |
| Redactions tab is static placeholder text | **Gap** | D |
| Entity AI summaries (entities.description always NULL) | **Missing** | E |
| Redacted entity inference ([Redacted Person 003]) | **Missing** | F |
| Dossier PDF export (button disabled) | **Missing** | G |

## Phase Summaries

### [Phase A: Entity Profile Enrichment](./phase-A-entity-profile-enrichment.md)
Render Wikidata enrichment (photo, bio, dates, nationality, occupation), wire EntityDossier to the existing dossier API, fix useEntity hook, mount PropertyOwnershipTimeline.
- **New files**: 2 (EntityAvatar, DossierResponse type)
- **Modified files**: 5
- **Migration**: None
- **Effort**: Small-medium

### [Phase B: Documents & Mentions Tab](./phase-B-documents-mentions-tab.md)
Replace EntityMentions stub with paginated mention list showing context snippets, evidence weights, and document links.
- **New files**: 3 (API route, hook, highlight utility)
- **Modified files**: 1 (EntityMentions rewrite)
- **Migration**: None
- **Effort**: Small

### [Phase C: Timeline Tab](./phase-C-timeline-tab.md)
Replace EntityTimeline stub with vertical timeline visualization grouped by year, with event type filtering and co-entity links.
- **New files**: 3 (API route, hook, types)
- **Modified files**: 1 (EntityTimeline rewrite)
- **Migration**: None
- **Effort**: Small-medium

### [Phase D: Redactions Tab & Entity Linking](./phase-D-redactions-tab.md)
Show confirmed resolutions, proposed matches, and nearby redactions on the entity detail page. Enable community voting on proposals.
- **New files**: 3 (API route, component, hook)
- **Modified files**: 1 (EntityProfile)
- **Migration**: None
- **Effort**: Medium

### [Phase E: AI Entity Summaries](./phase-E-ai-entity-summaries.md)
New pipeline stage that generates per-entity AI summaries from aggregated document mentions, relationships, and timeline events using Gemini 2.0 Flash.
- **New files**: 4 (migration, summarizer service, pipeline handler, batch script)
- **Modified files**: 5 (stages, EntityProfile, EntityCard, API, types)
- **Migration**: 00029_entity_summaries.sql
- **AI Cost**: ~$5 for all entities with 3+ mentions
- **Effort**: Medium

### [Phase F: Redacted Entity Inference](./phase-F-redacted-entity-inference.md)
Cluster similar redactions across documents, create placeholder entities like [Redacted Person 003], and track community resolution.
- **New files**: 8 (migration, clusterer, script, 3 API routes, 2 pages)
- **Modified files**: 4 (sidebar, EntityCard, EntityProfile, EntityAvatar)
- **Migration**: 00030_redacted_entity_inference.sql
- **Effort**: Large

### [Phase G: Dossier PDF Export](./phase-G-dossier-pdf-export.md)
Generate downloadable PDF dossiers per entity using @react-pdf/renderer.
- **New files**: 2 (PDF template, API route)
- **Modified files**: 1 (EntityDossier enable button)
- **Dependency**: pnpm add @react-pdf/renderer
- **Effort**: Medium

## Dependency Graph

```
Phase A ──→ Phase G (PDF needs dossier data wiring)
   │
   └──→ Phase E benefits from A (enhanced profile display)

Phase B ──→ (independent)

Phase C ──→ (independent)

Phase D ──→ Phase F (redaction tab needed before inference system)

Phase E ──→ Phase G benefits from E (richer PDF content)
```

## Recommended Implementation Order

```
┌─── Parallel Track 1 ───┐  ┌─── Parallel Track 2 ───┐
│                         │  │                         │
│  Phase A (profile)      │  │  Phase B (documents)    │
│     ↓                   │  │     ↓                   │
│  Phase E (AI summaries) │  │  Phase C (timeline)     │
│     ↓                   │  │     ↓                   │
│  Phase G (PDF export)   │  │  Phase D (redactions)   │
│                         │  │     ↓                   │
└─────────────────────────┘  │  Phase F (inference)    │
                             │                         │
                             └─────────────────────────┘
```

Phases A and B can start simultaneously. Within each track, phases should be sequential.

## Total Scope

| Metric | Count |
|--------|-------|
| New files | ~25 |
| Modified files | ~14 |
| New migrations | 2 |
| New API routes | ~8 |
| New pages | 2 |
| New components | ~6 |
| New hooks | ~4 |
| Dependencies to install | 1 (@react-pdf/renderer) |
