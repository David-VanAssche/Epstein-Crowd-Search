// components/map/MapSidebar.tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { MapLocation } from '@/types/map'

interface MapSidebarProps {
  location: MapLocation
}

export function MapSidebar({ location }: MapSidebarProps) {
  return (
    <div className="mt-4 space-y-6">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type</span>
          <Badge variant="outline">{location.locationType}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Coordinates</span>
          <span className="text-xs">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total mentions</span>
          <span>{location.mentionCount}</span>
        </div>
      </div>

      <Separator />

      {location.topEntities && location.topEntities.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Associated Entities</h4>
          <div className="flex flex-wrap gap-1">
            {location.topEntities.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {location.documents && location.documents.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
            Documents ({location.documents.length})
          </h4>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {location.documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/document/${doc.id}`}
                className="block rounded-lg border border-border bg-surface p-2 transition-colors hover:bg-surface-elevated"
              >
                <p className="text-xs font-medium">{doc.filename}</p>
                {doc.date && (
                  <p className="text-xs text-muted-foreground">{doc.date}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {location.activityTimeline && location.activityTimeline.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Activity Timeline</h4>
          <div className="space-y-2">
            {location.activityTimeline.map((event, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="whitespace-nowrap text-muted-foreground">{event.date}</span>
                <span>{event.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
