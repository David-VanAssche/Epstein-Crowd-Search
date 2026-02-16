# Phase D: Redactions Tab & Entity Linking

## Status: NOT STARTED

## Problem

The entity detail page has a "Redactions" tab that's just static text:

```tsx
<TabsContent value="redactions" className="mt-6">
  <p className="text-sm text-muted-foreground">
    Redactions where this entity may be the hidden text will appear here.
  </p>
</TabsContent>
```

The redaction system is actually quite sophisticated:
- `redactions` table has `resolved_entity_id` FK to entities (for confirmed redactions)
- `co_occurring_entity_ids` array links redactions to entities that appear nearby
- `context_embedding` (1024d vector) enables similarity matching across redactions
- `redaction_proposals` and `proposal_votes` tables support community resolution
- `auto_confirm_and_cascade` SQL function implements automatic cascade propagation
- `status` state machine: unsolved → proposed → confirmed/disputed/corroborated
- The redaction-detector pipeline stage already populates this data

What's missing is showing this from the entity's perspective — "which redactions might be this person?"

---

## Changes

### 1. Entity Redactions API Route

**New file: `app/api/entity/[id]/redactions/route.ts`**

Two categories of redactions for an entity:

**A. Confirmed/Proposed** — redactions where `resolved_entity_id = entity_id` or a proposal names this entity:
```sql
SELECT r.*, d.filename AS document_filename, d.classification
FROM redactions r
JOIN documents d ON d.id = r.document_id
WHERE r.resolved_entity_id = $entity_id
ORDER BY r.confidence DESC, r.created_at DESC
```

**B. Co-occurring** — redactions where this entity appears in `co_occurring_entity_ids` (entity was nearby the redaction in the document):
```sql
SELECT r.*, d.filename AS document_filename, d.classification
FROM redactions r
JOIN documents d ON d.id = r.document_id
WHERE r.co_occurring_entity_ids @> ARRAY[$entity_id]::uuid[]
  AND (r.resolved_entity_id IS NULL OR r.resolved_entity_id != $entity_id)
ORDER BY r.created_at DESC
LIMIT 50
```

**C. Proposals naming this entity** — from redaction_proposals:
```sql
SELECT rp.*, r.surrounding_text, r.sentence_template, r.redaction_type,
       d.filename AS document_filename
FROM redaction_proposals rp
JOIN redactions r ON r.id = rp.redaction_id
JOIN documents d ON d.id = r.document_id
WHERE rp.proposed_text ILIKE '%' || $entity_name || '%'
  OR rp.proposed_entity_id = $entity_id
ORDER BY rp.confidence DESC
LIMIT 50
```

Response groups results into:
```json
{
  "confirmed": [...],
  "proposed": [...],
  "co_occurring": [...]
}
```

### 2. EntityRedactions Component

**New file: `components/entity/EntityRedactions.tsx`**

Replace the inline static text in EntityProfile with a real component:

```
┌─ Redactions Tab ────────────────────────────────────────┐
│                                                          │
│  Confirmed Resolutions (3)                               │
│  ┌───────────────────────────────────────────────────┐   │
│  │  deposition-2005-03.pdf  |  Page 14  |  person    │   │
│  │  "The witness testified that [Jeffrey Epstein]     │   │
│  │   was present at the meeting on March 3rd."        │   │
│  │  ✅ Confirmed  |  Confidence: 92%                  │   │
│  │  Cascaded to: 4 similar redactions                 │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  Proposed Matches (2)                                    │
│  ┌───────────────────────────────────────────────────┐   │
│  │  police-report-2006.pdf  |  Page 7  |  person     │   │
│  │  "...contacted by [REDACTED] regarding payment..." │   │
│  │  🔶 Proposed  |  Confidence: 68%  |  3 votes      │   │
│  │  [Vote: Agree] [Vote: Disagree]                    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  Nearby Redactions (8)                                   │
│  These redactions appear near this entity in documents.  │
│  ┌───────────────────────────────────────────────────┐   │
│  │  fbi-report-2007.pdf  |  Page 3  |  organization  │   │
│  │  "...transferred funds to [REDACTED] through..."   │   │
│  │  ❓ Unsolved  |  ~12 chars                         │   │
│  │  [Propose Solution]                                │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Three sections:
1. **Confirmed Resolutions** — `status = 'confirmed'` and `resolved_entity_id = entity_id`. Show resolved_text, confidence, cascade_count.
2. **Proposed Matches** — proposals naming this entity. Show vote counts, allow voting (requires auth).
3. **Nearby Redactions** — unsolved redactions co-occurring with this entity. Show redaction_type, char_length_estimate. "Propose Solution" button links to redaction detail page.

Each redaction card shows:
- Document filename (linked) + page number + redaction_type badge
- `sentence_template` with the `[REDACTED]` or resolved text highlighted
- Status indicator (confirmed/proposed/unsolved) with appropriate icon and color
- Confidence percentage
- Cascade info for confirmed redactions

### 3. Redaction Status Badges

Colors per status:
- `confirmed` → green (`bg-green-500/20 text-green-400`)
- `proposed` → amber (`bg-amber-500/20 text-amber-400`)
- `unsolved` → gray (`bg-muted text-muted-foreground`)
- `disputed` → red (`bg-red-500/20 text-red-400`)
- `corroborated` → blue (`bg-blue-500/20 text-blue-400`)

### 4. Wire into EntityProfile

**Modified: `components/entity/EntityProfile.tsx`**

Replace the static text in the redactions tab:
```tsx
<TabsContent value="redactions" className="mt-6">
  <EntityRedactions entityId={entity.id} entityName={entity.name} />
</TabsContent>
```

### 5. Hook

**New file: `lib/hooks/useEntityRedactions.ts`**

```typescript
export function useEntityRedactions(entityId: string, entityName: string) {
  return useQuery({
    queryKey: ['entity-redactions', entityId],
    queryFn: () => fetchApi<EntityRedactionsResponse>(
      `/api/entity/${entityId}/redactions`
    ),
    staleTime: 60_000,
  })
}
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `app/api/entity/[id]/redactions/route.ts` | NEW | Entity redactions API (3 categories) |
| `components/entity/EntityRedactions.tsx` | NEW | Full redactions tab component |
| `lib/hooks/useEntityRedactions.ts` | NEW | React Query hook |
| `components/entity/EntityProfile.tsx` | MODIFY | Wire EntityRedactions into redactions tab |

## Dependencies

- Redaction data must exist (requires pipeline `REDACTION_DETECT` stage)
- Independent of Phases A-C
- Phase F (Redacted Entity Inference) builds on this

## Estimated Effort

Medium. The API query for co-occurring redactions is the trickiest part (array containment query). The UI has 3 distinct sections with different behaviors.
