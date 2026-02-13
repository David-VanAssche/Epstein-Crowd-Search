// components/stats/NeedsEyesFeed.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

interface NeedsEyesDocument {
  id: string
  filename: string
  dataset_name: string | null
  entity_count: number
  redaction_count: number
  review_count: number
  priority_score: number
  difficulty_estimate: 'easy' | 'medium' | 'hard'
}

export function NeedsEyesFeed() {
  const [datasetFilter, setDatasetFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')

  const { data } = useQuery<NeedsEyesDocument[]>({
    queryKey: ['stats', 'needs-eyes', datasetFilter, difficultyFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (datasetFilter !== 'all') params.set('dataset', datasetFilter)
      if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter)
      return fetch(`/api/stats/needs-eyes?${params.toString()}`).then((r) => r.json())
    },
    enabled: false,
  })

  const documents = data ?? []

  const difficultyColor = (d: string) => {
    switch (d) {
      case 'easy': return 'border-green-500/30 text-green-400'
      case 'medium': return 'border-amber-500/30 text-amber-400'
      case 'hard': return 'border-red-500/30 text-red-400'
      default: return ''
    }
  }

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle>Needs Eyes</CardTitle>
        <p className="text-sm text-muted-foreground">
          High-priority documents ranked by entity density, redaction count, and low review count.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Select value={datasetFilter} onValueChange={setDatasetFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Dataset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Datasets</SelectItem>
              <SelectItem value="sdny">SDNY Court Docs</SelectItem>
              <SelectItem value="fbi">FBI Files</SelectItem>
              <SelectItem value="financial">Financial Records</SelectItem>
              <SelectItem value="flights">Flight Logs</SelectItem>
            </SelectContent>
          </Select>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <Link
                        href={`/document/${doc.id}`}
                        className="text-sm font-medium text-blue-400 hover:underline"
                      >
                        {doc.filename}
                      </Link>
                      {doc.dataset_name && (
                        <p className="text-xs text-muted-foreground">{doc.dataset_name}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={difficultyColor(doc.difficulty_estimate)}>
                      {doc.difficulty_estimate}
                    </Badge>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    This document has {doc.redaction_count} redactions and {doc.entity_count} entity
                    mentions but has {doc.review_count === 0 ? 'not been reviewed yet' : `only ${doc.review_count} review(s)`}.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/document/${doc.id}?claim=true`}>
                      Claim for Review
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Documents needing review will appear here once the corpus is processed and priority scores are calculated.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
