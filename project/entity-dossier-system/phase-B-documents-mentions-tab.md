# Phase B: Documents & Mentions Tab

## Status: NOT STARTED

## Problem

The "Documents" tab on the entity detail page renders `EntityMentions`, which is a pure stub:

```typescript
export function EntityMentions({ entityId }: EntityMentionsProps) {
  return <ProcessingFundingCard slug="entity-mentions" variant="compact" />
}
```

Meanwhile, the data already exists:
- The `/api/entity/[id]` route calls `get_entity_mention_stats` RPC and returns `mention_stats` in the response
- The RPC returns per-document stats: `document_id, document_filename, document_classification, dataset_name, mention_count, mention_types, first_mention, last_mention`
- Individual mentions exist in `entity_mentions` table with `mention_text, context_snippet, mention_type, confidence, page_number, evidence_weight`

But the `EntityMentions` component doesn't use any of it.

---

## Changes

### 1. Entity Mentions API Route

**New file: `app/api/entity/[id]/mentions/route.ts`**

Dedicated endpoint for paginated entity mentions with document context:

```
GET /api/entity/{id}/mentions?page=1&per_page=20&doc_id=xxx&mention_type=direct
```

Query:
```sql
SELECT
  em.id, em.mention_text, em.context_snippet, em.mention_type,
  em.confidence, em.page_number, em.evidence_weight, em.created_at,
  d.id AS document_id, d.filename AS document_filename,
  d.classification AS document_classification
FROM entity_mentions em
JOIN documents d ON d.id = em.document_id
WHERE em.entity_id = $1
ORDER BY em.evidence_weight DESC NULLS LAST, em.created_at DESC
LIMIT $per_page OFFSET ($page - 1) * $per_page
```

Optional filters:
- `doc_id` — filter to mentions in a single document
- `mention_type` — filter by direct/indirect/implied/co_occurrence

Returns paginated response with total count.

### 2. useEntityMentions Hook

**New file: `lib/hooks/useEntityMentions.ts`**

```typescript
interface UseEntityMentionsOptions {
  entityId: string
  page?: number
  perPage?: number
  documentId?: string
  mentionType?: MentionType
}

export function useEntityMentions(options: UseEntityMentionsOptions) {
  return useQuery({
    queryKey: ['entity-mentions', options],
    queryFn: () => fetchPaginated<EntityMentionWithDoc>(url),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
}
```

### 3. EntityMentions Component Rewrite

**Modified: `components/entity/EntityMentions.tsx`**

Replace the stub with a real implementation:

```
┌─ Documents Tab ─────────────────────────────────────────┐
│                                                          │
│  [Document Stats Summary]                                │
│  Mentioned in 12 documents, 42 total mentions            │
│                                                          │
│  [Filter: All Types ▼]  [Sort: Evidence Weight ▼]        │
│                                                          │
│  ┌─ court-filing-2003-04.pdf ─────────── deposition ──┐  │
│  │  "...testified that Jeffrey Epstein directed the    │  │
│  │   transfer of funds to [REDACTED] account..."       │  │
│  │   Page 14  |  Direct mention  |  Weight: 0.85       │  │
│  │   [View Document →]                                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ flight-log-N908JE.pdf ─────────── flight_log ─────┐  │
│  │  "Jeffrey Epstein, [REDACTED], Sarah Kellen..."     │  │
│  │   Page 3   |  Co-occurrence   |  Weight: 0.12       │  │
│  │   [View Document →]                                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                          │
│  [← Page 1 of 3 →]                                      │
└──────────────────────────────────────────────────────────┘
```

Component structure:
- **Summary bar**: total documents, total mentions (from entity.mention_count / entity.document_count passed as props)
- **Filter row**: mention type dropdown (All, Direct, Indirect, Implied, Co-occurrence), sort dropdown (Evidence Weight, Date, Page)
- **Mention cards**: each mention as a Card with:
  - Header: document filename (linked to `/document/{id}`) + classification badge
  - Body: `context_snippet` with the `mention_text` highlighted in bold/accent color
  - Footer: page number, mention_type badge, evidence_weight (if non-null), confidence percentage
- **Pagination**: standard page controls using the paginated API

Mention type badge colors:
- `direct` → green (`bg-green-500/20 text-green-400`)
- `indirect` → blue (`bg-blue-500/20 text-blue-400`)
- `implied` → amber (`bg-amber-500/20 text-amber-400`)
- `co_occurrence` → gray (`bg-muted text-muted-foreground`)

### 4. Highlight Utility

**New file: `lib/utils/highlight-mention.tsx`**

A small utility that takes `context_snippet` and `mention_text` and returns a React element with the mention text wrapped in `<mark>`:

```typescript
export function highlightMention(
  context: string,
  mentionText: string
): React.ReactNode {
  const idx = context.toLowerCase().indexOf(mentionText.toLowerCase())
  if (idx === -1) return context
  return (
    <>
      {context.slice(0, idx)}
      <mark className="bg-accent/20 text-accent font-medium rounded px-0.5">
        {context.slice(idx, idx + mentionText.length)}
      </mark>
      {context.slice(idx + mentionText.length)}
    </>
  )
}
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `app/api/entity/[id]/mentions/route.ts` | NEW | Paginated mentions API |
| `lib/hooks/useEntityMentions.ts` | NEW | React Query hook for mentions |
| `lib/utils/highlight-mention.tsx` | NEW | Context snippet highlighting |
| `components/entity/EntityMentions.tsx` | REWRITE | Real component replacing stub |

## Dependencies

- Data must exist in `entity_mentions` table (requires pipeline processing of documents)
- Phase A should be done first (fixes useEntity hook) but is not strictly required

## Estimated Effort

Small. 4 files, straightforward CRUD with pagination. The hardest part is making the mention cards look good with context highlighting.
