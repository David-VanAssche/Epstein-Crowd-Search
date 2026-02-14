# Phase A: Entity Profile Enrichment

## Status: NOT STARTED

## Problem

The entity detail page has significant gaps between what data exists and what's rendered:

1. **Wikidata enrichment fields exist but are never rendered** — `photo_url`, `birth_date`, `death_date`, `nationality`, `occupation` are fetched from the API (included in the 24-column select on `/api/entity/[id]`) but `EntityProfile.tsx` ignores them entirely.

2. **The dossier API exists but is never called** — `/api/entity/[id]/dossier` is a fully-implemented endpoint that joins 4 tables (entities, entity_mentions via RPC, entity_relationships, timeline_events) into a comprehensive dossier object. `EntityDossier.tsx` only renders from `entity.risk_factors` passed as a prop — it never fetches the dossier endpoint.

3. **`useEntity` hook has dead code** — It fetches `?include=mentions` but the API route never reads that query param. The mentions query returns duplicate entity data. The hook also fetches connections, but `EntityConnections` does its own separate `fetch()` call.

4. **PropertyOwnershipTimeline is built but unmounted** — `components/entity/PropertyOwnershipTimeline.tsx` with `usePropertyOwnership` hook and `/api/entity/[id]/ownership` route are all working, but the component is never rendered in EntityProfile.

5. **EntityCard has no visual identity** — No avatar/photo, no description excerpt. Every card looks identical aside from the text.

---

## Changes

### 1. Entity Avatar Component

**New file: `components/entity/EntityAvatar.tsx`**

A reusable avatar for entities. For persons with `photo_url` (from Wikidata), render the image. For others, render a colored icon based on `entity_type`.

```typescript
interface EntityAvatarProps {
  entity: {
    name: string
    entity_type: EntityType
    photo_url?: string | null
  }
  size?: 'sm' | 'md' | 'lg'   // sm=8, md=12, lg=20 (tailwind h-/w-)
  className?: string
}
```

- Uses `next/image` with `fill` for the photo (avatar is `relative overflow-hidden rounded-full`)
- Fallback: colored circle with entity type icon from lucide (User for person, Building for org, MapPin for location, Plane for aircraft, etc.)
- Colors from `ENTITY_TYPE_META[entity_type].cssClass`

### 2. Entity Bio Section in EntityProfile Overview Tab

**Modified: `components/entity/EntityProfile.tsx`**

Add a bio card between the header and the Risk Assessment section, inside the Overview tab:

```
┌──────────────────────────────────────────────┐
│ [Photo]  Jeffrey Edward Epstein              │
│          Born: Jan 20, 1953  Died: Aug 10..  │
│          Nationality: American               │
│          Occupation: Financier, Hedge fund..  │
│          Category: Financier                 │
│          Aliases: Jeffrey E. Epstein, ...     │
└──────────────────────────────────────────────┘
```

Logic:
- Only render the bio card if ANY of `photo_url`, `birth_date`, `death_date`, `nationality.length > 0`, `occupation.length > 0`, or `category` are truthy
- Photo: 80x80 rounded avatar on the left (uses EntityAvatar size `lg`)
- Dates: format with `toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })`
- If `birth_date && death_date`, show "Born: X — Died: Y"
- Nationality: join with ", "
- Occupation: join with ", "
- Category: humanize from `PERSON_CATEGORY_META` (already exists in `lib/constants/entity-types.ts`)

### 3. EntityAvatar in EntityCard

**Modified: `components/entity/EntityCard.tsx`**

Add the avatar on the left side of the card:

```
┌───────────────────────────────────┐
│ [Av]  Jeffrey Epstein  [Risk][Type]│
│       42 mentions  12 documents    │
└───────────────────────────────────┘
```

- EntityAvatar size `sm` (h-8 w-8)
- Only passes `photo_url` if entity includes it — the list API doesn't fetch it, so this requires adding `photo_url` to the entity list select

### 4. Add photo_url to Entity List API

**Modified: `app/api/entity/route.ts`**

Add `photo_url` to the select:
```typescript
.select('id, name, entity_type, mention_count, document_count, risk_score, photo_url')
```

### 5. Wire EntityDossier to Dossier API

**Modified: `components/entity/EntityDossier.tsx`**

Add a React Query fetch to `/api/entity/[id]/dossier`:

```typescript
const { data: dossier, isLoading } = useQuery({
  queryKey: ['entity-dossier', entity.id],
  queryFn: () => fetchApi<DossierResponse>(`/api/entity/${entity.id}/dossier`),
  staleTime: 5 * 60_000,
})
```

Wire the returned data to:
- **Involvement Summary** card: use `dossier.involvement_summary.document_appearances` to show actual document list (not just risk factor numbers)
- **Key Documents** card: enhance with actual document names and links from `dossier.involvement_summary.document_appearances`
- **Relationship Evidence** card: use `dossier.relationship_map` for richer relationship display with entity links
- **Timeline of Activities** card: render `dossier.timeline` events (date + description + location + event_type badge)

**New type: `types/dossier.ts`**

```typescript
export interface DossierResponse {
  entity: { name: string; type: string; aliases: string[]; description: string | null; ... }
  involvement_summary: {
    document_appearances: EntityMentionStats[]
    total_documents: number
    total_mentions: number
  }
  relationship_map: Array<{
    relationship_type: string
    description: string | null
    strength: number
    is_verified: boolean
    connected_entity: { id: string; name: string; type: string } | null
  }>
  timeline: Array<{
    date: string | null
    date_display: string | null
    description: string
    event_type: string
    location: string | null
    is_verified: boolean
  }>
  generated_at: string
}
```

### 6. Fix useEntity Hook

**Modified: `lib/hooks/useEntity.ts`**

Remove the broken `?include=mentions` query that returns duplicate entity data. Remove the connections query that's duplicated by EntityConnections' own fetch. Add a dossier query option:

```typescript
export function useEntity(entityId: string) {
  const { data: entity, isLoading } = useQuery<Entity>({
    queryKey: ['entity', entityId],
    queryFn: () => fetchApi<Entity>(`/api/entity/${entityId}`),
    enabled: !!entityId,
  })

  return {
    entity: entity ?? null,
    isLoading,
  }
}
```

This is a breaking change to the hook's return type — audit all callers:
- `app/(public)/entity/[id]/page.tsx` — uses `entity` and `isLoading` (safe)
- No other callers found in prior analysis

### 7. Mount PropertyOwnershipTimeline

**Modified: `components/entity/EntityProfile.tsx`**

Add a "Property" section in the Overview tab, below the Risk Assessment card, conditionally rendered for entity types `property`, `person`, `organization`, `trust`:

```typescript
{['property', 'person', 'organization', 'trust'].includes(entity.entity_type) && (
  <PropertyOwnershipTimeline entityId={entity.id} />
)}
```

The component already handles empty state gracefully ("No ownership records found").

### 8. EntityProfile Header Upgrade

**Modified: `components/entity/EntityProfile.tsx`**

Replace the current plain text header with EntityAvatar:

```
Current:    [h1 name]  [type badge]  [verified badge]  [risk badge]
New:        [Avatar]   [h1 name]  [type badge]  [verified badge]  [risk badge]
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `components/entity/EntityAvatar.tsx` | NEW | Reusable entity avatar (photo or type icon) |
| `types/dossier.ts` | NEW | DossierResponse interface |
| `components/entity/EntityProfile.tsx` | MODIFY | Add bio section, avatar, property timeline, fix header |
| `components/entity/EntityCard.tsx` | MODIFY | Add avatar |
| `components/entity/EntityDossier.tsx` | MODIFY | Wire to dossier API, render real data |
| `lib/hooks/useEntity.ts` | MODIFY | Remove dead queries |
| `app/api/entity/route.ts` | MODIFY | Add photo_url to select |

## Dependencies

- None — all APIs and data already exist
- Can be implemented independently of other phases

## Estimated Effort

Small-medium. ~6 files touched, mostly UI wiring to existing data. No migration needed.
