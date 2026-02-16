# Phase 4: Media & Corrections

> **Status:** Not started
> **Estimated effort:** 12-16 hours
> **Depends on:** Phase 1 (image/transcript data imported), Phase 3 (sidebar nav updated)

## Goal

Build three remaining UI features: DOJ source verification links, a unified media browser (replacing the Audio section), and a self-correction audit trail for entity data.

## Tasks

### 4.1 DOJ Source Verification Links

**Modify:**
- `components/documents/DocumentHeader.tsx` (or equivalent document view header)
- Add DOJ source link component

**New component:** `components/documents/DOJSourceBadge.tsx`

```tsx
function DOJSourceBadge({ document }: { document: Document }) {
  const dojUrl = buildDojUrl(document.dataset_id, document.original_path);
  const isVerified = document.metadata?.sha256_verified === true;

  return (
    <div className="flex items-center gap-2 text-sm">
      <a href={dojUrl} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
        DOJ Source
      </a>
      {isVerified && (
        <Badge variant="outline" className="text-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          SHA-256 Verified
        </Badge>
      )}
      <span className="text-muted-foreground">
        EFTA {document.original_path}
      </span>
    </div>
  );
}
```

**DOJ URL builder:**
```typescript
function buildDojUrl(datasetId: string, eftaRange: string): string {
  // Maps dataset IDs to DOJ release URLs
  // DS1-DS12 map to specific DOJ FOIA release pages
  const datasetMap: Record<string, string> = {
    'ds1': 'https://www.justice.gov/d9/2024-12/dataset-1.zip',
    'ds2': 'https://www.justice.gov/d9/2024-12/dataset-2.zip',
    // ... etc
  };
  return datasetMap[datasetId] ?? '#';
}
```

**Integration points:**
- Document viewer header (primary placement)
- Search result cards (compact badge)
- Entity dossier → document list (inline link)

### 4.2 Media Browser

**Rename and expand the Audio section to a unified Media browser.**

**New/modified files:**
- `app/(public)/media/page.tsx` — Media browser page (replaces `/audio`)
- `components/media/MediaGrid.tsx` — Thumbnail grid
- `components/media/MediaFilters.tsx` — Type/analysis filters
- `components/media/ImageDetail.tsx` — Image detail view with analysis overlay
- `app/api/media/route.ts` — Unified media API

**Sidebar change:**
- Rename "Audio" to "Media" in `AppSidebar.tsx`
- Icon: `Image` from lucide-react (or `Film` for broader media)

**Media browser tabs:**
```tsx
<Tabs defaultValue="images">
  <TabsList>
    <TabsTrigger value="images">Images (180,234)</TabsTrigger>
    <TabsTrigger value="videos">Videos (2,156)</TabsTrigger>
    <TabsTrigger value="audio">Audio (375)</TabsTrigger>
  </TabsList>

  <TabsContent value="images">
    <MediaGrid type="image" />
  </TabsContent>
  {/* ... */}
</Tabs>
```

**Image grid:**
- Lazy-loaded thumbnail grid using `AspectRatio` component (already installed)
- Filters: Has analysis (from rhowardstone), Has faces detected, Has location, Has text, Dataset
- Click to expand: full image + analysis metadata overlay
- Analysis overlay shows: classification, content description, face count, extracted text

**Image detail view:**
```tsx
function ImageDetail({ image }: { image: ImageRecord }) {
  return (
    <Dialog>
      <div className="grid grid-cols-2 gap-4">
        {/* Left: full image */}
        <div className="relative">
          <img src={image.url} alt={image.description} />
          {/* Optional: face detection bounding boxes (toggle) */}
        </div>

        {/* Right: analysis metadata */}
        <div>
          <h3>Analysis</h3>
          <dl>
            <dt>Classification</dt>
            <dd>{image.metadata?.rhowardstone_analysis?.classification}</dd>
            <dt>Description</dt>
            <dd>{image.metadata?.rhowardstone_analysis?.description}</dd>
            <dt>Faces Detected</dt>
            <dd>{image.metadata?.rhowardstone_analysis?.face_count ?? 'N/A'}</dd>
            <dt>Source Document</dt>
            <dd><Link href={`/documents/${image.document_id}`}>View Document</Link></dd>
          </dl>
        </div>
      </div>
    </Dialog>
  );
}
```

**API endpoint:**
```typescript
// GET /api/media?type=image&has_analysis=true&dataset=ds10&page=1&limit=50
// Returns paginated media items with analysis metadata
```

### 4.3 Self-Correction Audit Trail

**Uses:** `entity_corrections` table from Phase 0 migration

**New component:** `components/entities/AuditTrail.tsx`

```tsx
function AuditTrail({ entityId }: { entityId: string }) {
  const { data: corrections } = useQuery({
    queryKey: ['corrections', entityId],
    queryFn: () => supabase
      .from('entity_corrections')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
  });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">
        Correction History ({corrections?.length ?? 0} revisions)
      </h4>
      {corrections?.map((c, i) => (
        <div key={c.id} className="border-l-2 pl-3 py-1">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={i === 0 ? 'default' : 'secondary'}>
              {i === 0 ? 'Current' : `v${corrections.length - i}`}
            </Badge>
            <span className="text-muted-foreground">
              {formatDistanceToNow(c.created_at)} ago
            </span>
          </div>
          <p className="text-sm mt-1">
            <strong>{c.field_changed}:</strong>{' '}
            <span className="line-through text-muted-foreground">{c.old_value}</span>
            {' → '}
            <span className="font-medium">{c.new_value}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Source: {c.source} | Confidence: {(c.confidence * 100).toFixed(0)}%
          </p>
        </div>
      ))}
    </div>
  );
}
```

**Integration:**
- Add `AuditTrail` to entity dossier page (collapsible section)
- Add `CorrectionBadge` to entity cards in search results (shows revision count)
- Write corrections during:
  - Data import (Phase 1 — source: `'data_import'`)
  - Community votes (existing vote system — source: `'community_vote'`)
  - Pipeline reruns (when a better model updates extraction — source: `'pipeline_rerun'`)

**CorrectionBadge component:**
```tsx
function CorrectionBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge variant="outline" className="text-xs">
      {count} revision{count > 1 ? 's' : ''}
    </Badge>
  );
}
```

## Checklist

- [ ] 4.1 DOJ source badge component created
- [ ] 4.1 DOJ URL builder maps all 12 datasets
- [ ] 4.1 Badge integrated into document viewer, search results
- [ ] 4.1 SHA-256 verification status displayed
- [ ] 4.2 Media browser page created (replaces /audio)
- [ ] 4.2 Image grid with lazy loading and filters
- [ ] 4.2 Image detail view with analysis metadata
- [ ] 4.2 Video and audio tabs functional
- [ ] 4.2 Media API endpoint with type/filter/pagination
- [ ] 4.2 Sidebar renamed: Audio → Media
- [ ] 4.3 AuditTrail component created
- [ ] 4.3 Integrated into entity dossier page
- [ ] 4.3 CorrectionBadge on entity cards
- [ ] 4.3 Corrections written during imports and votes
- [ ] Mobile responsive: media grid adapts to 2 columns
- [ ] Performance: image thumbnails use Supabase image transform for resizing
