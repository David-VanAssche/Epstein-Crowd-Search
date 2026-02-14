'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'

interface NeedsEyesDoc {
  id: string
  filename: string
  redaction_count: number
  difficulty_estimate: 'easy' | 'medium' | 'hard'
}

export function NeedsEyesCompact() {
  const { data } = useQuery<NeedsEyesDoc[]>({
    queryKey: ['needs-eyes-compact'],
    queryFn: async () => {
      const res = await fetch('/api/stats/needs-eyes?limit=3')
      if (!res.ok) return []
      return res.json()
    },
  })

  const docs = data ?? []

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-400" />
            Needs Eyes
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <Link href="/redactions">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {docs.length > 0 ? (
          <div className="space-y-2">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/document/${doc.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-background p-2.5 transition-colors hover:bg-surface-elevated"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.redaction_count} redactions
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    doc.difficulty_estimate === 'easy'
                      ? 'border-green-500/30 text-green-400'
                      : doc.difficulty_estimate === 'medium'
                        ? 'border-amber-500/30 text-amber-400'
                        : 'border-red-500/30 text-red-400'
                  }
                >
                  {doc.difficulty_estimate}
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Documents needing review will appear here once processing begins.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
