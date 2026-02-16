# Council Review: UI/UX Design for New Features
**Reviewer:** FrontendExpert (Google Gemini 3 Pro)
**Focus:** UI/UX design for 6 new features derived from rhowardstone analysis

## Feature 1: Investigation Reports Page (`/reports`)

### Purpose
Surface 100+ investigation reports from rhowardstone as browsable, searchable content. These are synthesized analysis pieces that connect documents → entities → patterns.

### Layout
```
┌─────────────────────────────────────────────────┐
│ Investigation Reports                    [Search]│
│                                                   │
│ Filter: [All] [Congressional] [Financial] [Travel]│
│         [Victims] [Associates] [Legal]            │
│                                                   │
│ Sort: [Congressional Score ▼] [Date] [Entities]   │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ ★★★★☆ Report: Maxwell Deposition Analysis     │ │
│ │ Congressional Score: 87/100                    │ │
│ │ Entities: G. Maxwell, J. Epstein, +12 more     │ │
│ │ Documents referenced: 47                       │ │
│ │ Tags: [deposition] [testimony] [trafficking]   │ │
│ │ Summary: Cross-references Maxwell's deposition │ │
│ │ with flight logs and financial records...       │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ ★★★★★ Report: Flight Log Anomalies            │ │
│ │ Congressional Score: 94/100                    │ │
│ │ ...                                            │ │
│ └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Components
- `ReportCard` — Expandable card with score badge, entity chips, document count
- `ReportDetail` — Full markdown rendering with entity/document hyperlinks
- `ReportFilters` — Multi-select tags, score range slider, entity search
- Use existing shadcn/ui `Card`, `Badge`, `Accordion`, `Slider` components

### Report Detail View
When a user clicks a report card, expand inline (accordion) or navigate to `/reports/[slug]`:
- Full markdown content rendered via `react-markdown` (already a dependency)
- Entity names are hyperlinked to `/entities/[id]`
- Document references link to `/documents/[id]`
- Sidebar: linked entities list, linked documents list, related reports

## Feature 2: Congressional Guide (`/start-here`)

### Purpose
A guided starting point for congressional staffers, journalists, and new researchers. Answers "What should I look at first?" using congressional scoring.

### Layout
```
┌─────────────────────────────────────────────────┐
│ Start Here: A Researcher's Guide                 │
│                                                   │
│ "Where to begin with 2.7 million pages"          │
│                                                   │
│ ┌─────────────────────────────────────────────┐   │
│ │ 🔴 Critical Priority (Score 90-100)         │   │
│ │ 12 documents · 4 reports · 8 entities       │   │
│ │                                              │   │
│ │ • Maxwell Deposition Vol. 1-4 (1,247 pages) │   │
│ │ • Flight Log Master (all years)              │   │
│ │ • FBI Interview Summaries (302s)             │   │
│ │ └── [View all critical documents →]          │   │
│ └─────────────────────────────────────────────┘   │
│                                                   │
│ ┌─────────────────────────────────────────────┐   │
│ │ 🟠 High Priority (Score 70-89)              │   │
│ │ 34 documents · 11 reports · 23 entities     │   │
│ │ ...                                          │   │
│ └─────────────────────────────────────────────┘   │
│                                                   │
│ ┌─────────────────────────────────────────────┐   │
│ │ 📖 Reading Paths                             │   │
│ │                                              │   │
│ │ [Financial Trail] [Travel Pattern]           │   │
│ │ [Victim Testimony] [Legal Proceedings]       │   │
│ │ [Associate Network]                          │   │
│ │                                              │   │
│ │ Each path is a curated sequence of           │   │
│ │ documents + reports for focused research.    │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Components
- `PriorityTier` — Collapsible tier with doc/report/entity counts
- `ReadingPath` — Curated document sequence with progress tracking
- `GuideSidebar` — Quick jump to priority tiers
- Tier colors match existing design system (red = critical, orange = high, yellow = medium)

## Feature 3: Redaction Quality Badges

### Purpose
Show users HOW a redaction was detected so they can assess confidence. Three detection methods produce different reliability levels.

### Badge System
```
┌──────────────────────────────────────────────┐
│ Redaction on page 47, line 12-14             │
│                                              │
│ Detection: [■ Spatial] [◉ OCR Layer] [🤖 LLM]│
│                                              │
│ ■ Spatial — Black rectangle detected         │
│   Confidence: 99% · Method: PyMuPDF geometry │
│   Dimensions: 142x18px at (234, 567)         │
│                                              │
│ ◉ OCR Layer — Hidden text found              │
│   Confidence: 42% · Passed noise filter: Yes │
│   Recovered text: "███████████"              │
│   ⚠ Note: OCR layer text has ~2% true rate   │
│                                              │
│ 🤖 LLM — Context analysis                    │
│   Confidence: 78% · Model: Qwen3-8B         │
│   Reasoning: "Sentence structure suggests    │
│   a proper noun was removed..."              │
└──────────────────────────────────────────────┘
```

### Integration
- Add `detection_method` badge to existing `SolvableRedactionCard` component
- Color coding: green (spatial, highest confidence), yellow (OCR layer, medium), blue (LLM, varies)
- Tooltip on hover explains the detection method
- If multiple methods agree, show a "corroborated" indicator

## Feature 4: DOJ Source Verification Links

### Purpose
Every document should link back to its DOJ source for independent verification. This builds trust and supports journalistic standards.

### Implementation
```
┌──────────────────────────────────────────────┐
│ Document: EFTA00045123-00045189              │
│ Dataset: DS4 (Released 2024-01-15)           │
│                                              │
│ [📄 View PDF] [🔗 DOJ Source] [📋 EFTA Range]│
│                                              │
│ DOJ Source:                                  │
│ justice.gov/archives/jm/epstein/dataset-4    │
│ Pages 45,123 – 45,189 (67 pages)            │
│ Verified: ✓ SHA-256 matches DOJ release      │
└──────────────────────────────────────────────┘
```

### Components
- `DOJSourceBadge` — Compact link with verification status
- Add to document header in viewer, search results, and entity dossier document lists
- SHA-256 verification against our `_manifests/` data

## Feature 5: Media Browser (Rename Audio → Media)

### Purpose
Expand the existing Audio section to cover all media types: images (180K), videos (2K+), audio files, and now 38,955 analyzed images from rhowardstone.

### Navigation Change
```
Current sidebar:       Proposed sidebar:
├── Documents          ├── Documents
├── Audio              ├── Media          ← renamed
└── ...                │   ├── Images (180K)
                       │   ├── Videos (2K)
                       │   ├── Audio (375)
                       │   └── ...
                       └── ...
```

### Media Browser Layout
```
┌─────────────────────────────────────────────────┐
│ Media Browser                                    │
│                                                   │
│ [Images 180,234] [Videos 2,156] [Audio 375]      │
│                                                   │
│ Filter: [All] [Analyzed] [Faces Detected]         │
│         [Has Location] [Has Text]                 │
│                                                   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │     │ │     │ │     │ │     │ │     │        │
│ │ img │ │ img │ │ img │ │ img │ │ img │        │
│ │     │ │     │ │     │ │     │ │     │        │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘        │
│ DS4 pg47 DS7 pg12 DS10    DS10    DS10           │
│                                                   │
│ [Load more...]                                    │
└─────────────────────────────────────────────────┘
```

### Image Detail View
- Thumbnail grid with lazy loading (existing `AspectRatio` component)
- Click to expand: full image + analysis metadata from rhowardstone
- Face detection overlay (bounding boxes, optional — privacy toggle)
- Linked document: "This image appears on page X of document Y"

## Feature 6: Self-Correction Audit Trail

### Purpose
When AI extractions are corrected (by users or better models), show the full history. This builds trust and demonstrates intellectual honesty.

### Layout (on Entity Dossier page)
```
┌──────────────────────────────────────────────┐
│ Entity: Sarah Kellen                         │
│                                              │
│ Corrections History (3 revisions)            │
│                                              │
│ v3 (current) — 2026-02-10                    │
│   Role: Personal assistant → Alleged recruiter│
│   Source: Maxwell deposition cross-reference │
│   Changed by: Community vote (87% agree)     │
│                                              │
│ v2 — 2026-01-28                              │
│   Added: 12 new document references          │
│   Source: rhowardstone import                │
│   Changed by: System (data import)           │
│                                              │
│ v1 — 2026-01-15                              │
│   Initial extraction by Qwen3-235B          │
│   Source: Pipeline stage 7 (entity_extract)  │
│   Confidence: 0.72                           │
└──────────────────────────────────────────────┘
```

### Components
- `AuditTrail` — Timeline component showing version diffs
- `CorrectionBadge` — Shows revision count on entity cards
- Store corrections in `entity_corrections` table (new migration)
- Track: `field_changed`, `old_value`, `new_value`, `source`, `changed_by`, `timestamp`

## Mobile Considerations

- Reports page: Cards stack vertically, congressional score badge stays visible
- Start-here guide: Priority tiers become full-width accordions
- Media browser: 2-column grid on mobile, swipe for detail view
- Redaction badges: Collapse to icon-only, expand on tap
- Audit trail: Simplified timeline, latest version only with "Show history" toggle

## Accessibility Notes

- Congressional score badges use color + text (not color alone)
- Detection method badges include aria-labels
- Report content supports screen readers via semantic markdown rendering
- Media grid includes alt text from rhowardstone's image analysis
