// components/stats/DOJReleaseTracker.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Scale, ExternalLink } from 'lucide-react'

interface DOJRelease {
  id: string
  title: string
  release_date: string
  url: string | null
  summary: string | null
  release_type: string | null
  is_new: boolean
}

export function DOJReleaseTracker() {
  const [releases, setReleases] = useState<DOJRelease[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/doj-releases')
      .then((r) => r.json())
      .then((json) => setReleases(json.data || []))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle>DOJ Release Monitor</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Tracking Department of Justice releases related to the Epstein case
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : releases.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No DOJ releases tracked yet.</p>
        ) : (
          <div className="space-y-3">
            {releases.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {r.is_new && <Badge className="bg-green-500/20 text-green-400 text-xs">New</Badge>}
                      {r.release_type && <Badge variant="secondary" className="text-xs">{r.release_type}</Badge>}
                    </div>
                    <h4 className="text-sm font-medium line-clamp-2">{r.title}</h4>
                    {r.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.summary}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(r.release_date))}
                    </p>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline inline-flex items-center gap-1 mt-1">
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
