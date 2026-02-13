// components/investigation/ThreadConvergence.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GitMerge } from 'lucide-react'
import Link from 'next/link'

interface Convergence {
  id: string
  thread_a_id: string
  thread_b_id: string
  thread_a_title: string | null
  thread_b_title: string | null
  overlap_type: string
  description: string | null
  shared_entity_ids: string[]
  created_at: string
  related_thread_id: string
  related_thread_title: string | null
}

interface ThreadConvergenceProps {
  threadId: string
}

export function ThreadConvergence({ threadId }: ThreadConvergenceProps) {
  const [convergences, setConvergences] = useState<Convergence[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/investigation-threads/${threadId}/convergences`)
      .then((r) => r.json())
      .then((json) => setConvergences(json.data || []))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [threadId])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }

  if (convergences.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No convergences found with other investigation threads.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {convergences.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <GitMerge className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{c.overlap_type}</Badge>
                  {c.shared_entity_ids.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {c.shared_entity_ids.length} shared entit{c.shared_entity_ids.length === 1 ? 'y' : 'ies'}
                    </span>
                  )}
                </div>
                <Link
                  href={`/investigations/${c.related_thread_id}`}
                  className="text-sm font-medium text-accent hover:underline block"
                >
                  {c.related_thread_title || 'Untitled thread'}
                </Link>
                {c.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
