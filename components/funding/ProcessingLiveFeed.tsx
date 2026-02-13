// components/funding/ProcessingLiveFeed.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface ProcessingEvent {
  id: string
  filename: string
  pages: number
  entities: number
  timestamp: string
}

export function ProcessingLiveFeed() {
  const { data } = useQuery<ProcessingEvent[]>({
    queryKey: ['processing', 'live-feed'],
    queryFn: () => fetch('/api/processing/recent').then((r) => r.json()),
    refetchInterval: 10_000,
    enabled: false,
  })

  const events = data ?? []
  const isActive = events.length > 0

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Live Processing Feed</CardTitle>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Processing' : 'Pipeline Idle'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isActive ? (
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded border border-border bg-background px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">Just processed: </span>
                  <span className="font-medium">{event.filename}</span>
                  <span className="text-muted-foreground">
                    {' '}({event.pages} pages, {event.entities} entities)
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Pipeline idle. Processing events will appear here in real time when batch processing is running.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
