// components/timeline/TimelineEventCard.tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TimelineEvent } from '@/types/timeline'

const EVENT_TYPE_COLORS: Record<string, string> = {
  travel: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  meeting: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  legal: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  financial: 'bg-green-500/20 text-green-400 border-green-500/30',
  communication: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  arrest: 'bg-red-500/20 text-red-400 border-red-500/30',
  property: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  other: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const DATE_PRECISION_LABELS: Record<string, string> = {
  exact: '',
  approximate: '(approx.)',
  month: '(month)',
  year: '(year)',
  unknown: '(date unclear)',
}

interface TimelineEventCardProps {
  event: TimelineEvent
  side: 'left' | 'right'
}

export function TimelineEventCard({ event, side }: TimelineEventCardProps) {
  const typeColors = EVENT_TYPE_COLORS[event.eventType] || EVENT_TYPE_COLORS.other

  return (
    <div className={`relative mb-8 flex items-start ${
      side === 'left'
        ? 'md:flex-row-reverse md:pr-[calc(50%+2rem)] md:pl-0 pl-12'
        : 'md:pl-[calc(50%+2rem)] md:pr-0 pl-12'
    }`}>
      {/* Connection dot on the spine */}
      <div className="absolute left-1/2 top-3 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-accent bg-background md:block" />
      <div className="absolute left-[13px] top-3 h-3 w-3 rounded-full border-2 border-accent bg-background md:hidden" />

      {/* Connection line to spine */}
      <div className={`absolute top-[17px] hidden h-px bg-border md:block ${
        side === 'left'
          ? 'right-1/2 left-auto w-8 mr-[6px]'
          : 'left-1/2 right-auto w-8 ml-[6px]'
      }`} />

      <Card className="w-full border-border bg-surface transition-colors hover:bg-surface-elevated">
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-primary">
              {new Date(event.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: event.datePrecision === 'exact' ? 'numeric' : undefined,
              })}
            </span>
            {event.datePrecision && event.datePrecision !== 'exact' && (
              <span className="text-xs text-muted-foreground">
                {DATE_PRECISION_LABELS[event.datePrecision]}
              </span>
            )}
          </div>

          <Badge variant="outline" className={`mb-2 ${typeColors}`}>
            {event.eventType}
          </Badge>

          <p className="mb-3 text-sm text-muted-foreground">{event.description}</p>

          {event.location && (
            <p className="mb-2 text-xs text-muted-foreground">
              Location: {event.location}
            </p>
          )}

          {event.entities.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {event.entities.map((entity) => (
                <Link key={entity.id} href={`/entity/${entity.id}`}>
                  <Badge variant="secondary" className="cursor-pointer text-xs hover:bg-accent/20">
                    {entity.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {event.sourceDocuments.length > 0 && (
            <div className="border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">Sources: </span>
              {event.sourceDocuments.map((doc, i) => (
                <span key={doc.id}>
                  {i > 0 && ', '}
                  <Link
                    href={`/document/${doc.id}${doc.pageNumber ? `#page-${doc.pageNumber}` : ''}`}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {doc.filename}{doc.pageNumber ? ` p.${doc.pageNumber}` : ''}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
