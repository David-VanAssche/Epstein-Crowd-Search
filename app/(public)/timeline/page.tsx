// app/(public)/timeline/page.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { fetchApi } from '@/lib/api/client'
import Link from 'next/link'

interface TimelineEvent {
  id: string
  date: string
  title: string
  description: string | null
  document_id: string | null
  document_filename: string | null
  entity_names: string[]
  event_type: string | null
}

export default function TimelinePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['timeline'],
    queryFn: () => fetchApi<TimelineEvent[]>('/api/timeline'),
    staleTime: 60_000,
  })

  const events = data ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">Timeline</h1>
      <p className="mb-8 text-muted-foreground">
        Chronological view of events extracted from the Epstein files.
      </p>

      {isLoading ? (
        <LoadingState variant="list" count={8} />
      ) : events.length > 0 ? (
        <div className="relative border-l border-border pl-6 space-y-6">
          {events.map((event) => (
            <div key={event.id} className="relative">
              <div className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <div className="text-xs text-muted-foreground mb-1">{event.date}</div>
              <Card className="border-border bg-surface">
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-1">
                    {event.document_id ? (
                      <Link href={`/document/${event.document_id}`} className="hover:text-primary">
                        {event.title}
                      </Link>
                    ) : (
                      event.title
                    )}
                  </h3>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                  )}
                  {event.entity_names.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.entity_names.map((name) => (
                        <Badge key={name} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          variant="not-processed"
          title="Timeline Coming Soon"
          description="Timeline events will appear as documents are processed and dates are extracted."
          showFundingCTA
        />
      )}
    </div>
  )
}
