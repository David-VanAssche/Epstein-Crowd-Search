# Phase G: Dossier PDF Export

## Status: NOT STARTED

## Problem

The EntityDossier component has a disabled "Export Dossier (PDF)" button:

```tsx
<Button variant="outline" size="sm" disabled>
  Export Dossier (PDF)
</Button>
```

The Prosecutors page also has a disabled "Export Evidence Package (PDF)" button.

The dossier API already aggregates all the data needed for a PDF — entity details, mention stats, relationships, timeline events. What's missing is the PDF generation itself.

---

## Design Decisions

### Server-side vs Client-side PDF

**Server-side (recommended)**: Generate PDF via API route using a headless rendering library. Advantages: consistent output, no browser dependency, can be cached/stored.

**Library**: `@react-pdf/renderer` — React components that render to PDF. Already works in Node.js, familiar JSX syntax, supports custom fonts and styling. Alternative: `puppeteer` (heavier, more faithful to screen rendering) or `pdfkit` (lower-level).

Choose `@react-pdf/renderer` for its React-native API and small bundle.

---

## Changes

### 1. Install Dependency

```bash
pnpm add @react-pdf/renderer
```

### 2. PDF Template Components

**New file: `lib/pdf/DossierPdfTemplate.tsx`**

React-pdf components for the dossier layout:

```typescript
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'

interface DossierPdfProps {
  entity: EntityWithSummary
  dossier: DossierResponse
  riskFactors: RiskFactors | null
  generatedAt: string
}
```

Page layout (A4):
```
┌──────────────────────────────────┐
│  EVIDENCE DOSSIER                │
│  [Entity Name]                   │
│  Entity Type: person             │
│  Generated: 2026-02-14           │
│─────────────────────────────────│
│                                  │
│  1. ENTITY PROFILE               │
│  Photo (if available)            │
│  Born: ...  Died: ...            │
│  Nationality: ...                │
│  Aliases: ...                    │
│  AI Summary: ...                 │
│                                  │
│  2. RISK ASSESSMENT              │
│  Risk Score: 3.7/5.0             │
│  Evidence: 1.8  Rel: 1.2  Ind: 0.7│
│  [factors breakdown]             │
│                                  │
│  3. DOCUMENT EVIDENCE            │
│  [table of documents with        │
│   mention counts and weights]    │
│                                  │
│  4. RELATIONSHIPS                │
│  [table of related entities      │
│   with types and strength]       │
│                                  │
│  5. TIMELINE                     │
│  [chronological events]          │
│                                  │
│  ─── DISCLAIMER ───              │
│  This dossier was generated      │
│  algorithmically from...         │
└──────────────────────────────────┘
```

Sections:
1. **Cover/Header**: Entity name, type, generation date, site logo
2. **Entity Profile**: Photo, bio details, AI summary, key facts
3. **Risk Assessment**: Score breakdown with full factor details
4. **Document Evidence**: Table of documents ordered by evidence weight — filename, classification, mention count, weight
5. **Relationships**: Table — related entity name, type, relationship type, strength, verified status
6. **Timeline**: Chronological event list — date, description, type, location
7. **Disclaimer**: Standard legal disclaimer about algorithmic generation, DOJ source, verification requirement

### 3. PDF Generation API Route

**New file: `app/api/entity/[id]/dossier/pdf/route.ts`**

```
GET /api/entity/{id}/dossier/pdf
```

Logic:
1. Validate entity ID
2. Fetch entity data (full select)
3. Call internal dossier compilation (same logic as `/api/entity/[id]/dossier`)
4. Render PDF using `@react-pdf/renderer`'s `renderToBuffer()`
5. Return with headers:
   ```
   Content-Type: application/pdf
   Content-Disposition: attachment; filename="dossier-{entity-name}.pdf"
   Cache-Control: private, max-age=300
   ```

```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import { DossierPdfTemplate } from '@/lib/pdf/DossierPdfTemplate'

export async function GET(request: NextRequest, { params }: RouteParams) {
  // ... fetch entity + dossier data ...

  const buffer = await renderToBuffer(
    <DossierPdfTemplate
      entity={entity}
      dossier={dossier}
      riskFactors={entity.risk_factors}
      generatedAt={new Date().toISOString()}
    />
  )

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dossier-${sanitizeFilename(entity.name)}.pdf"`,
    },
  })
}
```

### 4. Enable Export Button

**Modified: `components/entity/EntityDossier.tsx`**

Replace disabled button with working download:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    window.open(`/api/entity/${entity.id}/dossier/pdf`, '_blank')
  }}
>
  Export Dossier (PDF)
</Button>
```

### 5. Prosecutor Evidence Package (Stretch)

**New file: `app/api/prosecutors/export/route.ts`**

Bulk export: generates a multi-entity evidence package PDF. Takes `entity_ids[]` as query params, generates one PDF with all dossiers concatenated.

This is a stretch goal — the individual entity export is the primary deliverable.

**Modified: `app/(public)/prosecutors/page.tsx`**

Enable the "Export Evidence Package" button with entity selection (checkboxes on the table).

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `lib/pdf/DossierPdfTemplate.tsx` | NEW | React-pdf template components |
| `app/api/entity/[id]/dossier/pdf/route.ts` | NEW | PDF generation endpoint |
| `components/entity/EntityDossier.tsx` | MODIFY | Enable export button |

### Stretch:
| `app/api/prosecutors/export/route.ts` | NEW | Bulk evidence package |
| `app/(public)/prosecutors/page.tsx` | MODIFY | Enable export + selection |

## Dependencies

- **Requires Phase A** (dossier API wiring) for data aggregation
- **Benefits from Phase E** (AI summaries) for richer PDF content
- Independent of Phases B, C, D, F

## Estimated Effort

Medium. The PDF template is the bulk of the work — getting tables, headers, and styling right in @react-pdf takes iteration. The API route is straightforward.

## Cost

`@react-pdf/renderer` is free/MIT. No per-generation cost. PDF generation is CPU-bound (~1-3 seconds per dossier).
